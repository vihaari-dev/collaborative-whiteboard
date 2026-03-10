import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CanvasLayer from './CanvasLayer';
import { ChevronLeft, ChevronRight, Plus, Infinity, BookOpen } from 'lucide-react';

const RightPanel = ({
    logic,
    canvasMode,
    setCanvasMode,
    canvasPage,
    handleCanvasPageChange,
    totalCanvasPages,
    onAddPage,
    onStrokeEnd,
    scale,
    offset,
    handleWheel,
    setTransform,
    dimensions,
    gridType,
    theme,
}) => {
    const containerRef = useRef(null);

    // ── In pagewise/notebook mode: scale=1, offset={0,0} (fixed, no panning)
    const isNotebook = canvasMode === 'pagewise';

    // Effective transform for coordinate math
    const effectiveScale  = isNotebook ? 1 : scale;
    const effectiveOffset = isNotebook ? { x: 0, y: 0 } : offset;

    const screenToWorld = useCallback((clientX, clientY) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (clientX - rect.left - effectiveOffset.x) / effectiveScale,
            y: (clientY - rect.top  - effectiveOffset.y) / effectiveScale,
        };
    }, [effectiveOffset, effectiveScale]);

    const handlePointerDown = useCallback((e) => {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        containerRef.current?.setPointerCapture(e.pointerId);
        const { clientX, clientY, pressure } = e;

        // In notebook mode, no panning allowed
        if (!isNotebook && (logic.state.activeTool === 'hand' || e.button === 1)) {
            logic.refs.isPanningRef.current = true;
            logic.refs.lastPointerPos.current = { x: clientX, y: clientY };
            return;
        }

        const wp = screenToWorld(clientX, clientY);
        if (logic.state.activeTool === 'eraser') { logic.actions.eraseStroke(wp.x, wp.y, effectiveScale); return; }
        if (logic.state.activeTool === 'select') return;
        logic.actions.startDrawing(wp.x, wp.y, pressure || 0.5);
    }, [logic, effectiveScale, isNotebook, screenToWorld]);

    const handlePointerMove = useCallback((e) => {
        const { clientX, clientY } = e;

        if (logic.refs.isPanningRef.current && !isNotebook) {
            const dx = clientX - logic.refs.lastPointerPos.current.x;
            const dy = clientY - logic.refs.lastPointerPos.current.y;
            setTransform(scale, { x: offset.x + dx, y: offset.y + dy });
            logic.refs.lastPointerPos.current = { x: clientX, y: clientY };
            return;
        }

        if (logic.state.activeTool === 'eraser' && e.buttons === 1) {
            const wp = screenToWorld(clientX, clientY);
            logic.actions.eraseStroke(wp.x, wp.y, effectiveScale);
            return;
        }

        if (logic.state.currentStroke) {
            const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
            const pts = evs.map(ev => {
                const wp = screenToWorld(ev.clientX, ev.clientY);
                return { x: wp.x, y: wp.y, pressure: ev.pressure || 0.5 };
            });
            logic.actions.continueDrawing(pts);
        }
    }, [logic, scale, offset, setTransform, effectiveScale, isNotebook, screenToWorld]);

    const handlePointerUp = useCallback(() => {
        logic.refs.isPanningRef.current = false;
        const newElements = logic.actions.endDrawing();
        if (newElements && onStrokeEnd) onStrokeEnd(newElements);
    }, [logic, onStrokeEnd]);

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* ── Mode Header ── */}
            <div style={{
                height: 44, display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '0 12px',
                background: 'white', borderBottom: '1px solid #E5E5E5', flexShrink: 0, gap: 8,
            }}>
                {/* Mode tabs */}
                <div style={{ display: 'flex', background: '#F0F0F5', borderRadius: 8, padding: 3, gap: 2 }}>
                    {[
                        { id: 'infinite', label: 'Infinite', Icon: Infinity, color: '#0066FF' },
                        { id: 'pagewise', label: 'Notebook', Icon: BookOpen, color: '#7C3AED' },
                    ].map(({ id, label, Icon, color }) => (
                        <button key={id}
                            onPointerDown={e => e.stopPropagation()}
                            onClick={() => setCanvasMode(id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                padding: '4px 10px', border: 'none', borderRadius: 6,
                                background: canvasMode === id ? 'white' : 'transparent',
                                color: canvasMode === id ? color : '#888',
                                fontWeight: canvasMode === id ? 700 : 500,
                                fontSize: 12,
                                boxShadow: canvasMode === id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer', transition: 'all 0.15s',
                            }}
                        >
                            <Icon size={13} />{label}
                        </button>
                    ))}
                </div>

                {/* Notebook page nav */}
                <AnimatePresence>
                    {canvasMode === 'pagewise' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button onPointerDown={e => e.stopPropagation()}
                                onClick={() => handleCanvasPageChange(p => p - 1)}
                                disabled={canvasPage <= 1}
                                style={{ width: 26, height: 26, border: '1px solid #E5E5E5', borderRadius: 6, background: 'none', cursor: canvasPage <= 1 ? 'default' : 'pointer', opacity: canvasPage <= 1 ? 0.3 : 1 }}>
                                <ChevronLeft size={14} />
                            </button>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', minWidth: 72, textAlign: 'center' }}>
                                Page {canvasPage} / {totalCanvasPages}
                            </span>
                            <button onPointerDown={e => e.stopPropagation()}
                                onClick={() => handleCanvasPageChange(p => p + 1)}
                                disabled={canvasPage >= totalCanvasPages}
                                style={{ width: 26, height: 26, border: '1px solid #E5E5E5', borderRadius: 6, background: 'none', cursor: canvasPage >= totalCanvasPages ? 'default' : 'pointer', opacity: canvasPage >= totalCanvasPages ? 0.3 : 1 }}>
                                <ChevronRight size={14} />
                            </button>
                            <button onPointerDown={e => e.stopPropagation()}
                                onClick={onAddPage}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#7C3AED', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600, marginLeft: 4 }}>
                                <Plus size={12} />Page
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                    color: canvasMode === 'infinite' ? '#0066FF' : '#7C3AED',
                    background: canvasMode === 'infinite' ? '#EBF5FF' : '#F5F0FF',
                    padding: '3px 8px', borderRadius: 100, textTransform: 'uppercase',
                }}>
                    {canvasMode === 'infinite' ? '∞ Canvas' : '📓 Notebook'}
                </div>
            </div>

            {/* ── Drawing Surface ── */}
            <div
                ref={containerRef}
                // In notebook mode: plain white background, filling full height.
                // In infinite mode: grid background.
                className={isNotebook ? '' : `grid-bg bg-grid-${gridType} theme-${theme}`}
                style={{
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    touchAction: 'none',
                    cursor: (!isNotebook && logic.state.activeTool === 'hand') ? 'grab' : 'crosshair',
                    // Notebook: clean white page feel, fills everything
                    background: isNotebook
                        ? 'white'
                        : undefined,
                    // Subtle horizontal ruling for notebook mode
                    backgroundImage: isNotebook
                        ? 'repeating-linear-gradient(to bottom, transparent, transparent 31px, #E8ECF4 32px)'
                        : undefined,
                    backgroundSize: isNotebook ? '100% 32px' : undefined,
                    backgroundPosition: isNotebook ? '0 48px' : undefined,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onWheel={isNotebook ? undefined : handleWheel}
            >
                {/* Notebook: red margin line on the left */}
                {isNotebook && (
                    <div style={{
                        position: 'absolute', top: 0, bottom: 0, left: 64,
                        width: 1, background: '#FFCDD2',
                        pointerEvents: 'none', zIndex: 1,
                    }} />
                )}

                {/* The single CanvasLayer — always mounted */}
                <CanvasLayer
                    strokes={logic.state.elements}
                    currentStroke={logic.state.currentStroke}
                    scale={effectiveScale}
                    offset={effectiveOffset}
                    width={dimensions.width}
                    height={dimensions.height}
                />
            </div>
        </div>
    );
};

export default RightPanel;
