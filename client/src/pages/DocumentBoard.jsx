import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getBoard, updateBoard, uploadVoiceNote } from '../services/api';
import { initiateSocketConnection, disconnectSocket, joinRoom, subscribeToDrawings, emitDrawing } from '../services/socket';
import UIManager from '../components/UIManager';
import { ColorWheelPicker } from '../components/ColorWheelPicker';
import VoiceNotesLayer from '../components/VoiceNotesLayer';
import { useCanvasTransform } from '../hooks/useCanvasTransform';
import { useWhiteboardLogic } from '../hooks/useWhiteboardLogic';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import DocumentViewer from '../components/DocumentViewer';
import RightPanel from '../components/RightPanel';
import { TOOLS } from '../utils/StrokeUtils';
import { MousePointer2, Square, PenTool, Share, ChevronRight, Hand, Eraser, Undo2, Redo2, Pencil, Highlighter, Mic } from 'lucide-react';
import '../styles/grids.css';

// ── Toolbar ─────────────────────────────────────────────────────────────────

const TopBar = ({ title, mode }) => (
    <div style={{ height: 60, borderBottom: '1px solid #E5E5E5', background: 'white', display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 32, height: 32, background: '#FF9500', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 11 }}>Doc</div>
            <div style={{ height: 24, width: 1, background: '#E5E5E5' }} />
            <div>
                <h2 style={{ fontSize: 14, margin: 0 }}>{title}</h2>
                <div style={{ fontSize: 11, color: '#999', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>DeepWork OS</span><ChevronRight size={10} /><span style={{ textTransform: 'capitalize' }}>{mode}</span>
                </div>
            </div>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#0066FF', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Share size={14} /> Share
        </button>
    </div>
);

// Cursor mapping per tool
const getCursor = (tool) => ({
    hand:     'grab',
    select:   'default',
    eraser:   'cell',
    pen:      'crosshair',
    dynamic:  'crosshair',
    fountain: 'crosshair',
    marker:   'crosshair',
    pencil:   'crosshair',
})[tool] ?? 'crosshair';

const Btn = ({ icon: Icon, active, activeColor, onClick, title }) => (
    <button
        title={title}
        onClick={onClick}
        onPointerDown={e => e.stopPropagation()}
        style={{
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none',
            background: active ? (activeColor ? activeColor + '22' : '#EBF5FF') : 'transparent',
            color: active ? (activeColor || '#0066FF') : '#555',
            borderRadius: 6, cursor: 'pointer',
            transition: 'background 0.12s, color 0.12s',
            flexShrink: 0,
        }}
    >
        <Icon size={14} />
    </button>
);

const Sep = () => <div style={{ width: 1, height: 20, background: '#E8E8E8', flexShrink: 0 }} />;

const FloatingToolbar = ({ logic, onColorClick, title, accentColor }) => {
    const t = logic.state.activeTool;
    return (
        <div
            onPointerDown={e => e.stopPropagation()}
            style={{
                background: 'white',
                padding: '4px 8px',
                borderRadius: 10,
                boxShadow: '0 2px 16px rgba(0,0,0,0.10), 0 0 0 1.5px ' + accentColor + '55',
                display: 'flex', gap: 2, alignItems: 'center',
                borderLeft: `3px solid ${accentColor}`,
                pointerEvents: 'auto',
                userSelect: 'none',
            }}
        >
            {/* Label dot */}
            <span style={{
                fontSize: 8, color: accentColor, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                paddingRight: 4, whiteSpace: 'nowrap',
            }}>{title}</span>

            <Sep />

            {/* History */}
            <Btn title="Undo (Ctrl+Z)"       icon={Undo2}        active={false} onClick={logic.actions.handleUndo} />
            <Btn title="Redo (Ctrl+Shift+Z)" icon={Redo2}        active={false} onClick={logic.actions.handleRedo} />

            <Sep />

            {/* Tools */}
            <Btn title="Select"     icon={MousePointer2} active={t === 'select'}        onClick={() => logic.actions.setActiveTool('select')}        activeColor={accentColor} />
            <Btn title="Pan"        icon={Hand}          active={t === 'hand'}          onClick={() => logic.actions.setActiveTool('hand')}          activeColor={accentColor} />
            <Btn title="Pen"        icon={PenTool}       active={t === TOOLS.PEN}       onClick={() => logic.actions.setActiveTool(TOOLS.PEN)}       activeColor={accentColor} />
            <Btn title="Dynamic"    icon={Pencil}        active={t === TOOLS.DYNAMIC}   onClick={() => logic.actions.setActiveTool(TOOLS.DYNAMIC)}   activeColor={accentColor} />
            <Btn title="Marker"     icon={Highlighter}   active={t === TOOLS.MARKER}    onClick={() => logic.actions.setActiveTool(TOOLS.MARKER)}    activeColor="#F59E0B" />
            <Btn title="Shape"      icon={Square}        active={t === 'shape'}         onClick={() => logic.actions.setActiveTool('shape')}         activeColor={accentColor} />
            <Btn title="Eraser"     icon={Eraser}        active={t === TOOLS.ERASER}    onClick={() => logic.actions.setActiveTool(TOOLS.ERASER)}    activeColor="#EF4444" />
            <Btn title="Voice (V)"  icon={Mic}           active={t === 'voice'}         onClick={() => logic.actions.setActiveTool(t === 'voice' ? TOOLS.DYNAMIC : 'voice')} activeColor="#8B5CF6" />

            <Sep />

            {/* Color swatch */}
            <button
                title="Pick color"
                onPointerDown={e => e.stopPropagation()}
                onClick={onColorClick}
                style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: logic.state.activeColor,
                    border: '2px solid #E0E0E0',
                    cursor: 'pointer', flexShrink: 0,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                }}
            />

            {/* Thickness */}
            <input
                type="range" min="1" max="20"
                value={logic.state.activeSize}
                title={`Thickness: ${logic.state.activeSize}`}
                onPointerDown={e => e.stopPropagation()}
                onChange={e => logic.actions.setActiveSize(parseInt(e.target.value))}
                style={{ width: 52, accentColor, cursor: 'pointer' }}
            />
        </div>
    );
};

// ── DocumentBoard ────────────────────────────────────────────────────────────

// Stable empty array — NEVER use [] inline here.
// useWhiteboardLogic has a sync effect that fires whenever initialElements changes.
// If we pass a new [] literal each render, it fires setElements([]) after every render,
// immediately erasing any stroke the user just drew.
const EMPTY_ELEMENTS = [];

const DocumentBoard = () => {
    const { id } = useParams();
    const [board, setBoard] = useState(null);
    const [loading, setLoading] = useState(true);

    const mainLogic = useWhiteboardLogic(id, EMPTY_ELEMENTS);
    const docLogic  = useWhiteboardLogic(id, EMPTY_ELEMENTS);

    const [docUrl,  setDocUrl]  = useState(null);
    const [docPage, setDocPage] = useState(1);
    const [annotations, setAnnotations] = useState({});

    const [canvasMode, setCanvasModeState] = useState('infinite');
    const [canvasPage, setCanvasPage]      = useState(1);
    const [canvasPages, setCanvasPages]    = useState({});
    const [totalCanvasPages, setTotalCanvasPages] = useState(1);

    const [uiMode,  setUiMode]  = useState('drawing');
    const [cpTarget, setCpTarget] = useState('main');

    // Voice Notes (shared across both panels)
    const [voiceNotes,    setVoiceNotes]    = useState([]);
    const [pendingDocPin, setPendingDocPin] = useState(null);
    const [pendingMainPin,setPendingMainPin]= useState(null);
    const voice = useVoiceRecorder();

    const { scale, offset, setTransform, handleWheel } = useCanvasTransform();
    const [dimensions, setDimensions] = useState({ width: window.innerWidth / 2, height: window.innerHeight });

    // Helpers to stop and save voice notes per panel
    const stopAndUploadVoice = async (panel, pinPos, clearPinFunc) => {
        const finalDuration = voice.duration;
        const blob = await voice.stop();
        if (!blob) {
            clearPinFunc(null);
            voice.markUploaded();
            return;
        }

        const noteId = Date.now().toString();
        const fd = new FormData();
        fd.append('audio', blob, `voice-${noteId}.webm`);
        fd.append('id',    noteId);
        fd.append('x',     pinPos.x.toString());
        fd.append('y',     pinPos.y.toString());
        fd.append('panel', panel);

        try {
            const { data: savedNote } = await uploadVoiceNote(id, fd);
            const newNote = { ...savedNote, duration: finalDuration };
            const updated = [...voiceNotes, newNote];
            setVoiceNotes(updated);
            updateBoard(id, { voiceNotes: updated });
        } catch (err) {
            console.error(`Voice upload error (${panel}):`, err);
        } finally {
            clearPinFunc(null);
            voice.markUploaded();
        }
    };

    const handleStopDocVoice = useCallback(() => {
        if (!pendingDocPin || voice.state !== 'recording') return;
        stopAndUploadVoice('doc', pendingDocPin, setPendingDocPin);
    }, [pendingDocPin, voice, voiceNotes]);

    const handleStopMainVoice = useCallback(() => {
        if (!pendingMainPin || voice.state !== 'recording') return;
        stopAndUploadVoice('canvas', pendingMainPin, setPendingMainPin);
    }, [pendingMainPin, voice, voiceNotes]);

    // Refs to avoid stale closures in callbacks ──────────────────────────────
    const canvasModeRef  = useRef(canvasMode);
    const canvasPageRef  = useRef(canvasPage);
    const canvasPagesRef = useRef(canvasPages);
    const boardRef       = useRef(board);

    useEffect(() => { canvasModeRef.current  = canvasMode;  }, [canvasMode]);
    useEffect(() => { canvasPageRef.current  = canvasPage;  }, [canvasPage]);
    useEffect(() => { canvasPagesRef.current = canvasPages; }, [canvasPages]);
    useEffect(() => { boardRef.current       = board;       }, [board]);

    // Track which panel is "active" for keyboard shortcuts
    // 'doc' = PDF side, 'main' = canvas/notebook side
    const activePanelRef = useRef('main');

    // ── Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo) ───────────────
    useEffect(() => {
        const handler = (e) => {
            const isUndo = (e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey;
            const isRedo = (e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && e.shiftKey;
            if (!isUndo && !isRedo && e.code !== 'KeyV') return;

            // Don't intercept when user is typing in an input / textarea
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            const logic = activePanelRef.current === 'doc' ? docLogic : mainLogic;

            if (e.code === 'KeyV') {
                if (!e.ctrlKey && !e.metaKey) {
                    if (voice.state === 'recording') {
                        if (pendingDocPin) handleStopDocVoice();
                        if (pendingMainPin) handleStopMainVoice();
                    } else if (voice.state === 'idle') {
                        logic.actions.setActiveTool(prev => prev === 'voice' ? TOOLS.DYNAMIC : 'voice');
                    }
                }
                return;
            }

            e.preventDefault();
            if (isUndo) logic.actions.handleUndo();
            if (isRedo) logic.actions.handleRedo();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [docLogic, mainLogic]);

    // ── Init ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchBoard = async () => {
            try {
                const { data } = await getBoard(id);
                setBoard(data);
                boardRef.current = data;

                if (data.elements) mainLogic.actions.setElements(data.elements.filter(e => e.points));
                if (data.documentUrl) setDocUrl(data.documentUrl);
                if (data.annotations) {
                    setAnnotations(data.annotations);
                    if (data.annotations[1]) docLogic.actions.setElements(data.annotations[1]);
                }
                if (data.canvasPages) {
                    setCanvasPages(data.canvasPages);
                    canvasPagesRef.current = data.canvasPages;
                    const max = Math.max(...Object.keys(data.canvasPages).map(Number), 1);
                    setTotalCanvasPages(max);
                }
                if (data.voiceNotes) setVoiceNotes(data.voiceNotes);

                if (data.mode === 'collaboration' || data.mode === 'document') {
                    initiateSocketConnection();
                    joinRoom(id);
                    subscribeToDrawings(el => mainLogic.actions.setElements(prev => [...prev, el]));
                }
                setLoading(false);
            } catch (e) { console.error(e); setLoading(false); }
        };
        fetchBoard();
        return () => disconnectSocket();
    }, [id]);

    useLayoutEffect(() => {
        const update = () => setDimensions({ width: window.innerWidth / 2, height: window.innerHeight });
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // ── PDF page change ───────────────────────────────────────────────────────
    const handleDocPageChange = useCallback((fn) => {
        const cur = docPage;
        const next = typeof fn === 'function' ? fn(cur) : fn;
        if (next < 1) return;
        const strokes = docLogic.state.elements;
        const ann = { ...annotations, [cur]: strokes };
        setAnnotations(ann);
        updateBoard(id, { annotations: ann });
        setDocPage(next);
        docLogic.actions.setElements(ann[next] || []);
        docLogic.actions.setHistory([]);
    }, [docPage, annotations, docLogic, id]);

    // ── Doc stroke end (save annotation) ─────────────────────────────────────
    const handleDocStrokeEnd = useCallback((newElements) => {
        const ann = { ...annotations, [docPage]: newElements };
        setAnnotations(ann);
        updateBoard(id, { annotations: ann });
    }, [annotations, docPage, id]);

    // ── Canvas page change ────────────────────────────────────────────────────
    const handleCanvasPageChange = useCallback((fn) => {
        const cur = canvasPageRef.current;
        const next = typeof fn === 'function' ? fn(cur) : fn;
        if (next < 1 || next > totalCanvasPages) return;
        const strokes = mainLogic.state.elements;
        const pages = { ...canvasPagesRef.current, [cur]: strokes };
        setCanvasPages(pages);
        canvasPagesRef.current = pages;
        updateBoard(id, { canvasPages: pages });
        setCanvasPage(next);
        canvasPageRef.current = next;
        mainLogic.actions.setElements(pages[next] || []);
        mainLogic.actions.setHistory([]);
    }, [totalCanvasPages, mainLogic, id]);

    // ── Add new page ──────────────────────────────────────────────────────────
    const handleAddPage = useCallback(() => {
        const cur = canvasPageRef.current;
        const pages = { ...canvasPagesRef.current, [cur]: mainLogic.state.elements };
        const next = totalCanvasPages + 1;
        setTotalCanvasPages(next);
        setCanvasPages(pages);
        canvasPagesRef.current = pages;
        updateBoard(id, { canvasPages: pages });
        setCanvasPage(next);
        canvasPageRef.current = next;
        mainLogic.actions.setElements([]);
        mainLogic.actions.setHistory([]);
    }, [totalCanvasPages, mainLogic, id]);

    // ── Canvas mode toggle ────────────────────────────────────────────────────
    const setCanvasMode = useCallback((newMode) => {
        if (newMode === canvasModeRef.current) return;
        if (newMode === 'pagewise') {
            updateBoard(id, { elements: mainLogic.state.elements });
            setCanvasModeState('pagewise');
            mainLogic.actions.setElements(canvasPagesRef.current[canvasPageRef.current] || []);
        } else {
            const pages = { ...canvasPagesRef.current, [canvasPageRef.current]: mainLogic.state.elements };
            setCanvasPages(pages);
            canvasPagesRef.current = pages;
            updateBoard(id, { canvasPages: pages });
            setCanvasModeState('infinite');
            getBoard(id).then(({ data }) => mainLogic.actions.setElements(data.elements || []));
        }
        mainLogic.actions.setHistory([]);
    }, [mainLogic, id]);

    // ── Right panel stroke end ─────────────────────────────────────────────────
    const handleRightStrokeEnd = useCallback((newElements) => {
        const b = boardRef.current;
        const newStroke = newElements[newElements.length - 1];
        if (b?.mode === 'collaboration' || b?.mode === 'document') {
            emitDrawing(id, newStroke);
        }
        if (canvasModeRef.current === 'infinite') {
            updateBoard(id, { elements: newElements });
        } else {
            const pages = { ...canvasPagesRef.current, [canvasPageRef.current]: newElements };
            setCanvasPages(pages);
            canvasPagesRef.current = pages;
            updateBoard(id, { canvasPages: pages });
        }
    }, [id]);

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999' }}>Loading workspace…</div>;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F5F5F7' }}>

            <UIManager>
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 50, pointerEvents: 'none' }}>
                    <div style={{ pointerEvents: 'auto' }}><TopBar title={board?.title || 'Document'} mode={board?.mode} /></div>
                </motion.div>

                {/* PDF toolbar — pill anchored to bottom-centre of left panel */}
                <div style={{
                    position: 'absolute', bottom: 20, left: '25%',
                    transform: 'translateX(-50%)', zIndex: 40,
                    pointerEvents: 'auto',
                }}>
                    <FloatingToolbar
                        logic={docLogic}
                        accentColor="#FF9500"
                        title="PDF"
                        onColorClick={() => { setUiMode('color_selection'); setCpTarget('doc'); }}
                    />
                </div>

                {/* Canvas toolbar — pill anchored to bottom-centre of right panel */}
                <div style={{
                    position: 'absolute', bottom: 20, left: '75%',
                    transform: 'translateX(-50%)', zIndex: 40,
                    pointerEvents: 'auto',
                }}>
                    <FloatingToolbar
                        logic={mainLogic}
                        accentColor="#0066FF"
                        title={canvasMode === 'infinite' ? 'Canvas' : 'Notebook'}
                        onColorClick={() => { setUiMode('color_selection'); setCpTarget('main'); }}
                    />
                </div>

                <AnimatePresence>
                    {uiMode === 'color_selection' && (
                        <ColorWheelPicker
                            activeColor={cpTarget === 'doc' ? docLogic.state.activeColor : mainLogic.state.activeColor}
                            onChange={(color) => {
                                if (cpTarget === 'doc') docLogic.actions.setActiveColor(color);
                                else mainLogic.actions.setActiveColor(color);
                                setUiMode('drawing');
                            }}
                            onClose={() => setUiMode('drawing')}
                        />
                    )}
                </AnimatePresence>
            </UIManager>

            {/* ── Split Layout ── */}
            <div style={{ flex: 1, display: 'flex', height: '100%', paddingTop: 60 }}>

                {/* Left: PDF Viewer */}
                <div style={{ width: '50%', height: '100%', position: 'relative' }}
                    onPointerDown={() => { activePanelRef.current = 'doc'; }}>
                    <DocumentViewer
                        boardId={id}
                        documentUrl={docUrl}
                        logic={docLogic}
                        isActive={false}
                        onFocus={() => { activePanelRef.current = 'doc'; }}
                        onUpload={setDocUrl}
                        page={docPage}
                        setPage={handleDocPageChange}
                        onStrokeEnd={handleDocStrokeEnd}
                        voiceNotes={voiceNotes}
                        voice={voice}
                        pendingPin={pendingDocPin}
                        onVoiceDrop={async (worldPos) => {
                            if (voice.state === 'recording' || voice.state === 'uploading') return;
                            if (voice.state !== 'idle') return;
                            setPendingDocPin(worldPos);
                            const started = await voice.start();
                            if (!started) {
                                setPendingDocPin(null);
                                voice.markUploaded();
                            }
                        }}
                        onDeleteVoiceNote={(noteId) => {
                            const updated = voiceNotes.filter(n => n.id !== noteId);
                            setVoiceNotes(updated);
                            updateBoard(id, { voiceNotes: updated });
                        }}
                    />
                </div>

                {/* Right: Notes Panel */}
                <div style={{ width: '50%', height: '100%', borderLeft: '1px solid #ddd', position: 'relative' }}
                    onPointerDown={() => { activePanelRef.current = 'main'; }}>
                    <RightPanel
                        logic={mainLogic}
                        canvasMode={canvasMode}
                        setCanvasMode={setCanvasMode}
                        canvasPage={canvasPage}
                        handleCanvasPageChange={handleCanvasPageChange}
                        totalCanvasPages={totalCanvasPages}
                        onAddPage={handleAddPage}
                        onStrokeEnd={handleRightStrokeEnd}
                        onVoiceDrop={async (worldPos) => {
                            if (voice.state === 'recording' || voice.state === 'uploading') return;
                            if (voice.state !== 'idle') return;
                            setPendingMainPin(worldPos);
                            const started = await voice.start();
                            if (!started) {
                                setPendingMainPin(null);
                                voice.markUploaded();
                            }
                        }}
                        scale={scale}
                        offset={offset}
                        handleWheel={handleWheel}
                        setTransform={setTransform}
                        dimensions={dimensions}
                        gridType={mainLogic.state.gridType}
                        theme={mainLogic.state.theme}
                    />
                    {/* Canvas-side voice notes overlay */}
                    <VoiceNotesLayer
                        voiceNotes={voiceNotes}
                        scale={scale}
                        offset={offset}
                        pendingPin={pendingMainPin}
                        recDuration={voice.duration}
                        isUploading={voice.state === 'uploading'}
                        onStopRecording={handleStopMainVoice}
                        onDeleteNote={(noteId) => {
                            const updated = voiceNotes.filter(n => n.id !== noteId);
                            setVoiceNotes(updated);
                            updateBoard(id, { voiceNotes: updated });
                        }}
                        panel="canvas"
                    />
                </div>
            </div>
        </div>
    );
};

export default DocumentBoard;