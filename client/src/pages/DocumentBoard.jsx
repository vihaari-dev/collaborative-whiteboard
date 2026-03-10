import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getBoard, updateBoard } from '../services/api';
import { initiateSocketConnection, disconnectSocket, joinRoom, subscribeToDrawings, emitDrawing } from '../services/socket';
import UIManager from '../components/UIManager';
import { ColorWheelPicker } from '../components/ColorWheelPicker';
import { useCanvasTransform } from '../hooks/useCanvasTransform';
import { useWhiteboardLogic } from '../hooks/useWhiteboardLogic';
import DocumentViewer from '../components/DocumentViewer';
import RightPanel from '../components/RightPanel';
import { TOOLS } from '../utils/StrokeUtils';
import { MousePointer2, Square, PenTool, Share, ChevronRight, Hand, Eraser, Undo2, Redo2 } from 'lucide-react';
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

const Btn = ({ icon: Icon, active, color, onClick, title: tip }) => (
    <button title={tip} onClick={onClick} onPointerDown={e => e.stopPropagation()}
        style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: active ? (color || '#EBF5FF') : 'transparent', color: active ? '#0066FF' : '#666', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s' }}>
        <Icon size={16} />
    </button>
);

const FloatingToolbar = ({ logic, onColorClick, title, accentColor }) => (
    <div style={{ background: 'white', padding: 8, borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', display: 'flex', gap: 6, alignItems: 'center', border: `2px solid ${accentColor}` }}>
        <div style={{ fontSize: 9, color: accentColor, fontWeight: 800, writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.08em' }}>{title}</div>
        <div style={{ width: 1, height: 28, background: '#eee' }} />

        {/* Undo / Redo */}
        <Btn tip="Undo (Ctrl+Z)"         icon={Undo2} active={false} onClick={logic.actions.handleUndo} />
        <Btn tip="Redo (Ctrl+Shift+Z)"   icon={Redo2} active={false} onClick={logic.actions.handleRedo} />
        <div style={{ width: 1, height: 28, background: '#eee' }} />

        <Btn tip="Select"   icon={MousePointer2} active={logic.state.activeTool === 'select'}        onClick={() => logic.actions.setActiveTool('select')} />
        <Btn tip="Pan"      icon={Hand}          active={logic.state.activeTool === 'hand'}          onClick={() => logic.actions.setActiveTool('hand')} />
        <Btn tip="Pen"      icon={PenTool}       active={logic.state.activeTool === TOOLS.PEN}       onClick={() => logic.actions.setActiveTool(TOOLS.PEN)} />
        <Btn tip="Marker"   icon={Square}        active={logic.state.activeTool === TOOLS.MARKER}    onClick={() => logic.actions.setActiveTool(TOOLS.MARKER)} color="#FEF3C7" />
        <Btn tip="Eraser"   icon={Eraser}        active={logic.state.activeTool === TOOLS.ERASER}    onClick={() => logic.actions.setActiveTool(TOOLS.ERASER)} />
        <div style={{ width: 1, height: 28, background: '#eee' }} />
        <button onPointerDown={e => e.stopPropagation()} onClick={onColorClick}
            style={{ width: 22, height: 22, borderRadius: '50%', background: logic.state.activeColor, border: '2px solid #E5E5E5', cursor: 'pointer', flexShrink: 0 }} />
        <input type="range" min="1" max="20" value={logic.state.activeSize}
            onPointerDown={e => e.stopPropagation()}
            onChange={e => logic.actions.setActiveSize(parseInt(e.target.value))}
            style={{ width: 56 }} />
    </div>
);

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

    const { scale, offset, setTransform, handleWheel } = useCanvasTransform();
    const [dimensions, setDimensions] = useState({ width: window.innerWidth / 2, height: window.innerHeight });

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
            if (!isUndo && !isRedo) return;

            // Don't intercept when user is typing in an input / textarea
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;

            e.preventDefault();
            const logic = activePanelRef.current === 'doc' ? docLogic : mainLogic;
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

                {/* PDF toolbar (bottom-centre of left half) */}
                <div style={{ position: 'absolute', bottom: 30, left: '25%', transform: 'translateX(-50%)', zIndex: 40 }}>
                    <FloatingToolbar logic={docLogic}  accentColor="#FF9500" title="PDF"
                        onColorClick={() => { setUiMode('color_selection'); setCpTarget('doc'); }} />
                </div>

                {/* Canvas toolbar (bottom-centre of right half) */}
                <div style={{ position: 'absolute', bottom: 30, left: '75%', transform: 'translateX(-50%)', zIndex: 40 }}>
                    <FloatingToolbar logic={mainLogic} accentColor="#0066FF" title={canvasMode === 'infinite' ? 'Canvas' : 'Notebook'}
                        onColorClick={() => { setUiMode('color_selection'); setCpTarget('main'); }} />
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
                    />
                </div>

                {/* Right: Notes Panel */}
                <div style={{ width: '50%', height: '100%', borderLeft: '1px solid #ddd' }}
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
                        scale={scale}
                        offset={offset}
                        handleWheel={handleWheel}
                        setTransform={setTransform}
                        dimensions={dimensions}
                        gridType={mainLogic.state.gridType}
                        theme={mainLogic.state.theme}
                    />
                </div>
            </div>
        </div>
    );
};

export default DocumentBoard;