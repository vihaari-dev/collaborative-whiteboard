import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import CanvasLayer from './CanvasLayer';
import VoiceNotesLayer from './VoiceNotesLayer';
import { useCanvasTransform } from '../hooks/useCanvasTransform';
import { ChevronLeft, ChevronRight, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { uploadDocument } from '../services/api';

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

/**
 * DocumentViewer — Left panel (PDF + annotation overlay)
 *
 * Key design decisions for correct drawing:
 *  - The PDF <Page> lives inside a transformed div (translate + scale via offset/scale).
 *  - The CanvasLayer that receives drawing strokes is a SIBLING overlay positioned
 *    over the full container (position:absolute, top:0, left:0, 100%×100%).
 *    It is given the real `scale` and `offset` so its internal transform matches
 *    the pointer-event world-coordinate calculation exactly.
 *  - This means strokes are stored/drawn in the same world space as pointer events,
 *    so cursor and graphics always align, regardless of pan/zoom state.
 *  - Strokes are read from `logic.state.elements` (live), not from `annotations[page]`
 *    (stale), so they persist immediately after mouse release.
 */
const DocumentViewer = ({
    boardId,
    documentUrl,
    logic,           // useWhiteboardLogic instance (docLogic)
    onUpload,
    isActive,
    onFocus,
    page,
    setPage,
    onStrokeEnd,     // (newElements) => void — called to persist finished strokes
    voiceNotes = [],
    pendingPin = null,
    onVoiceDrop,
    onDeleteVoiceNote,
}) => {
    const [numPages, setNumPages] = useState(null);
    const containerRef = useRef(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // This component owns its own pan/zoom transform for the PDF side
    const { scale, offset, setTransform, handleWheel, zoomIn, zoomOut } = useCanvasTransform();

    // Track container size for PDF width calculation
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                setContainerSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
    }

    // --- Coordinate helper ---
    // Maps a screen (clientX, clientY) to world space relative to the container.
    // World coords = (screenPos - containerOrigin - offset) / scale
    const screenToWorld = (clientX, clientY) => {
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (clientX - rect.left - offset.x) / scale,
            y: (clientY - rect.top - offset.y) / scale,
        };
    };

    // --- Pointer Handlers ---
    const handlePointerDown = (e) => {
        onFocus();
        if (!documentUrl) return;

        containerRef.current.setPointerCapture(e.pointerId);
        const { clientX, clientY, pressure } = e;

        // Voice note drop
        if (logic.state.activeTool === 'voice') {
            const wp = screenToWorld(clientX, clientY);
            if (onVoiceDrop) onVoiceDrop(wp);
            return;
        }

        if (logic.state.activeTool === 'hand' || e.button === 1) {
            logic.refs.isPanningRef.current = true;
            logic.refs.lastPointerPos.current = { x: clientX, y: clientY };
            return;
        }

        const wp = screenToWorld(clientX, clientY);

        if (logic.state.activeTool === 'eraser') {
            logic.actions.eraseStroke(wp.x, wp.y, scale);
            return;
        }

        logic.actions.startDrawing(wp.x, wp.y, pressure || 0.5);
    };

    const handlePointerMove = (e) => {
        const { clientX, clientY, pressure } = e;

        if (logic.refs.isPanningRef.current) {
            const dx = clientX - logic.refs.lastPointerPos.current.x;
            const dy = clientY - logic.refs.lastPointerPos.current.y;
            setTransform(scale, { x: offset.x + dx, y: offset.y + dy });
            logic.refs.lastPointerPos.current = { x: clientX, y: clientY };
            return;
        }

        if (logic.state.activeTool === 'eraser' && e.buttons === 1) {
            const wp = screenToWorld(clientX, clientY);
            logic.actions.eraseStroke(wp.x, wp.y, scale);
            return;
        }

        if (logic.state.currentStroke) {
            const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
            const points = events.map(ev => {
                const wp = screenToWorld(ev.clientX, ev.clientY);
                return { x: wp.x, y: wp.y, pressure: ev.pressure || 0.5 };
            });
            logic.actions.continueDrawing(points);
        }
    };

    const handlePointerUp = () => {
        logic.refs.isPanningRef.current = false;
        const newElements = logic.actions.endDrawing();
        if (newElements && onStrokeEnd) onStrokeEnd(newElements);
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('document', file);
        try {
            const { data } = await uploadDocument(boardId, formData);
            onUpload(data.documentUrl);
        } catch (err) {
            console.error(err);
        }
    };

    const pdfWidth = containerSize.width > 0 ? containerSize.width * 0.9 : 600;

    return (
        <div
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid #E5E5E5',
                background: '#F5F5F7',
                position: 'relative',
                height: '100%',
            }}
            onClick={onFocus}
        >
            {/* ── Toolbar ─────────────────────────────────────────── */}
            <div style={{
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                background: 'white',
                borderBottom: '1px solid #E5E5E5',
                flexShrink: 0,
                gap: '8px',
            }}>
                {/* Page navigation */}
                {documentUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            style={{ background: 'none', border: 'none', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.3 : 1 }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontWeight: 600, color: '#FF9500', minWidth: '80px', textAlign: 'center' }}>
                            Page {page} / {numPages || '–'}
                        </span>
                        <button
                            disabled={page >= numPages}
                            onClick={() => setPage(p => p + 1)}
                            style={{ background: 'none', border: 'none', cursor: page >= numPages ? 'default' : 'pointer', opacity: page >= numPages ? 0.3 : 1 }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                ) : (
                    <span style={{ fontSize: '13px', color: '#999' }}>PDF Document</span>
                )}

                {/* Zoom controls */}
                {documentUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                            onClick={zoomOut}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '4px' }}
                        >
                            <ZoomOut size={15} />
                        </button>
                        <span style={{ fontSize: '11px', color: '#999', minWidth: '36px', textAlign: 'center' }}>
                            {Math.round(scale * 100)}%
                        </span>
                        <button
                            onClick={zoomIn}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '4px' }}
                        >
                            <ZoomIn size={15} />
                        </button>
                    </div>
                )}
            </div>

            {/* ── Content Area ─────────────────────────────────────── */}
            <div
                ref={containerRef}
                style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    touchAction: 'none',
                    cursor: ({
                    hand:     'grab',
                    select:   'default',
                    eraser:   'cell',
                    pen:      'crosshair',
                    dynamic:  'crosshair',
                    fountain: 'crosshair',
                    marker:   'crosshair',
                    pencil:   'crosshair',
                })[logic.state.activeTool] ?? 'crosshair',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onWheel={handleWheel}
            >
                {!documentUrl ? (
                    /* Upload Prompt */
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', height: '100%', color: '#666', gap: '12px',
                    }}>
                        <Upload size={48} style={{ opacity: 0.3 }} />
                        <p style={{ margin: 0, fontSize: '14px' }}>Upload a PDF to start reading</p>
                        <label style={{
                            padding: '8px 16px', background: '#FF9500', color: 'white',
                            borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                        }}>
                            Choose PDF
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={handleUpload}
                                style={{ display: 'none' }}
                            />
                        </label>
                    </div>
                ) : (
                    <>
                        {/* ── PDF Layer (transformed) ───── */}
                        <div
                            style={{
                                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                                transformOrigin: '0 0',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                // Pointer events disabled: the container div handles all events
                                pointerEvents: 'none',
                                userSelect: 'none',
                            }}
                        >
                            <Document
                                file={`http://localhost:5000${documentUrl}`}
                                onLoadSuccess={onDocumentLoadSuccess}
                                loading={
                                    <div style={{
                                        width: `${pdfWidth}px`, height: '400px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#999', fontSize: '14px',
                                    }}>
                                        Loading PDF…
                                    </div>
                                }
                            >
                                <Page
                                    pageNumber={page}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    width={pdfWidth}
                                />
                            </Document>
                        </div>

                        {/* Annotation Canvas overlay */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0,
                            width: '100%', height: '100%',
                            pointerEvents: 'none',
                        }}>
                            <CanvasLayer
                                strokes={logic.state.elements}
                                currentStroke={logic.state.currentStroke}
                                scale={scale}
                                offset={offset}
                                width={containerSize.width || 800}
                                height={containerSize.height || 1200}
                                disableGrid={true}
                            />
                        </div>

                        {/* PDF-panel voice note pins */}
                        <VoiceNotesLayer
                            voiceNotes={voiceNotes}
                            scale={scale}
                            offset={offset}
                            pendingPin={pendingPin}
                            recDuration={0}
                            onDeleteNote={onDeleteVoiceNote || (() => {})}
                            panel="doc"
                        />
                    </>
                )}
            </div>

            {/* ── Active-panel focus ring ───────────────────────────── */}
            {isActive && (
                <div style={{
                    position: 'absolute', inset: 0,
                    border: '2px solid #FF9500',
                    pointerEvents: 'none',
                    borderRadius: '2px',
                }} />
            )}
        </div>
    );
};

export default DocumentViewer;
