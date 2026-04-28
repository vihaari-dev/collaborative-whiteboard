import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    initiateSocketConnection,
    disconnectSocket,
    joinRoom,
    subscribeToDrawings,
    emitDrawing,
    emitCursorMove,
    subscribeToCursors,
    subscribeToUserCount,
    subscribeToUserJoined,
    subscribeToUserLeft,
    cleanupRoomListeners,
} from '../services/socket';
import CanvasLayer    from '../components/CanvasLayer';
import VoiceNotesLayer from '../components/VoiceNotesLayer';
import VoiceNoteButton from '../components/VoiceNoteButton';
import UIManager      from '../components/UIManager';
import LiveCursors    from '../components/LiveCursors';
import { ColorWheelPicker } from '../components/ColorWheelPicker';
import { CanvasSettings }   from '../components/CanvasControls';
import { useCanvasTransform } from '../hooks/useCanvasTransform';
import { useVoiceRecorder }   from '../hooks/useVoiceRecorder';
import { TOOLS, simplifyStroke } from '../utils/StrokeUtils';
import {
    MousePointer2, Square, Type, PenTool, Share,
    ChevronRight, ZoomIn, ZoomOut, Hand, Grid, Undo, Redo, Sparkles, Users,
} from 'lucide-react';
import '../styles/grids.css';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const generateId = () => Math.random().toString(36).substring(2, 9);

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const TopBar = ({ roomId, myName, myColor, userCount, onShare }) => (
    <div style={{
        height: '60px',
        borderBottom: '1px solid #E5E5E5',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        justifyContent: 'space-between',
        zIndex: 20,
        pointerEvents: 'auto',
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
                width: '32px', height: '32px', background: '#0066FF', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 'bold', fontSize: '13px',
            }}>DW</div>
            <div style={{ height: '24px', width: '1px', background: '#E5E5E5' }} />
            <div>
                <h2 style={{ fontSize: '14px', margin: 0 }}>Collaboration Canvas</h2>
                <div style={{ fontSize: '11px', color: '#999', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>DeepWork OS</span>
                    <ChevronRight size={10} />
                    <span>Room: <strong style={{ color: '#555' }}>{roomId}</strong></span>
                </div>
            </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Me badge */}
            {myName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: myColor, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '12px', color: '#555', fontWeight: '500' }}>
                        {myName}
                    </span>
                </div>
            )}

            {/* User count */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', color: '#666',
                background: '#F5F5F7', padding: '6px 10px', borderRadius: '8px',
            }}>
                <Users size={14} />
                <span>{userCount}</span>
            </div>

            <button
                className="btn btn-primary"
                onClick={onShare}
                style={{ padding: '8px 16px', fontSize: '13px' }}
            >
                <Share size={14} /> Share
            </button>
        </div>
    </div>
);

const ToolbarButton = ({ icon: Icon, active, onClick, title }) => (
    <button
        onClick={onClick}
        onPointerDown={(e) => e.stopPropagation()}
        title={title}
        style={{
            width: '40px', height: '40px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none',
            background: active ? '#EBF5FF' : 'transparent',
            color: active ? '#0066FF' : '#666',
            borderRadius: '8px', cursor: 'pointer',
            transition: 'all 0.2s', pointerEvents: 'auto',
        }}
    >
        <Icon size={20} />
    </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const MemoryBoard = () => {
    // ── Room state ──────────────────────────────────────────────────────────
    const [roomId,    setRoomId]    = useState(null);
    const [myId,      setMyId]      = useState(null);
    const [myName,    setMyName]    = useState(null);
    const [myColor,   setMyColor]   = useState('#0066FF');
    const [userCount, setUserCount] = useState(1);

    // Remote cursors: { [socketId]: { id, name, color, x, y } }
    const [remoteCursors, setRemoteCursors] = useState({});

    // Toast
    const [showToast,    setShowToast]    = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // ── Canvas state ────────────────────────────────────────────────────────
    const [elements,      setElements]      = useState([]);
    const [currentStroke, setCurrentStroke] = useState(null);

    // Tools
    const [activeTool,  setActiveTool]  = useState(TOOLS.DYNAMIC);
    const [activeColor, setActiveColor] = useState('#000000');
    const [activeSize,  setActiveSize]  = useState(5);

    // UI
    const [uiMode,       setUiMode]       = useState('drawing');
    const [showSettings, setShowSettings] = useState(false);
    const [gridType,     setGridType]     = useState('dot');
    const [theme,        setTheme]        = useState('standard');

    // Voice
    const [voiceNotes, setVoiceNotes] = useState([]);
    const [pendingPin, setPendingPin] = useState(null);
    const voice = useVoiceRecorder();

    // Transform
    const { scale, offset, zoomIn, zoomOut, setTransform, handleWheel } = useCanvasTransform();
    const [dimensions, setDimensions] = useState({
        width: window.innerWidth,
        height: window.innerHeight - 60,
    });

    // Undo / Redo
    const [history,   setHistory]   = useState([]);
    const [redoStack, setRedoStack] = useState([]);

    // Refs
    const containerRef      = useRef(null);
    const isPanningRef      = useRef(false);
    const lastPointerPos    = useRef({ x: 0, y: 0 });
    const lastCursorEmit    = useRef(0);
    const roomIdRef         = useRef(null);   // always-current roomId for handlers
    const scaleRef          = useRef(scale);
    const offsetRef         = useRef(offset);

    // Keep refs in sync
    useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
    useEffect(() => { scaleRef.current  = scale;  }, [scale]);
    useEffect(() => { offsetRef.current = offset; }, [offset]);

    // ── Helpers ─────────────────────────────────────────────────────────────

    const toast = (msg, duration = 3000) => {
        setToastMessage(msg);
        setShowToast(true);
        setTimeout(() => setShowToast(false), duration);
    };

    const screenToWorld = useCallback((cx, cy) => {
        if (!containerRef.current) return { x: cx / scaleRef.current, y: cy / scaleRef.current };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (cx - rect.left - offsetRef.current.x) / scaleRef.current,
            y: (cy - rect.top  - offsetRef.current.y) / scaleRef.current,
        };
    }, []);

    /**
     * Teleport the viewport so that (worldX, worldY) is centred on screen.
     */
    const navigateToCursor = useCallback((worldX, worldY) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setTransform(scaleRef.current, {
            x: rect.width  / 2 - worldX * scaleRef.current,
            y: rect.height / 2 - worldY * scaleRef.current,
        });
    }, [setTransform]);

    // ── Undo / Redo ─────────────────────────────────────────────────────────

    const addToHistory    = (snap) => { setHistory(p => [...p, snap]); setRedoStack([]); };
    const handleUndo      = () => {
        if (!history.length) return;
        const prev  = history[history.length - 1];
        setRedoStack(p => [elements, ...p]);
        setElements(prev);
        setHistory(h => h.slice(0, -1));
    };
    const handleRedo      = () => {
        if (!redoStack.length) return;
        const next = redoStack[0];
        setHistory(h => [...h, elements]);
        setElements(next);
        setRedoStack(r => r.slice(1));
    };

    // ── Keyboard shortcuts ───────────────────────────────────────────────────

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (uiMode === 'color_selection') setUiMode('drawing');
                if (activeTool === 'voice' || voice.state === 'recording') {
                    voice.cancel(); setPendingPin(null); setActiveTool(TOOLS.DYNAMIC);
                }
                return;
            }
            if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) {
                if (voice.state === 'recording') handleStopVoiceNote();
                else if (voice.state === 'idle')
                    setActiveTool(p => p === 'voice' ? TOOLS.DYNAMIC : 'voice');
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                e.shiftKey ? handleRedo() : handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault(); handleRedo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [history, redoStack, elements, uiMode, activeTool, voice.state]);

    // ── Eraser ───────────────────────────────────────────────────────────────

    const eraseStroke = (x, y) => {
        const r = 10 / scaleRef.current;
        const idx = elements.findIndex(s =>
            s.points?.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < r * r)
        );
        if (idx !== -1) {
            const next = [...elements];
            next.splice(idx, 1);
            addToHistory(elements);
            setElements(next);
        }
    };

    // ── Initialisation ───────────────────────────────────────────────────────

    useEffect(() => {
        // Resolve / generate room ID
        const params = new URLSearchParams(window.location.search);
        let room = params.get('room');
        if (!room) {
            room = generateId();
            window.history.pushState(null, '', `${window.location.pathname}?room=${room}`);
        }
        setRoomId(room);
        roomIdRef.current = room;

        // Connect
        initiateSocketConnection();

        // Subscribe before joining so we never miss events
        subscribeToDrawings((element) => {
            setElements(prev => [...prev, element]);
        });

        subscribeToCursors(({ id, name, color, x, y }) => {
            setRemoteCursors(prev => ({ ...prev, [id]: { id, name, color, x, y } }));
        });

        subscribeToUserCount((count) => setUserCount(count));

        subscribeToUserJoined((user) => {
            setRemoteCursors(prev => ({ ...prev, [user.id]: { ...user } }));
        });

        subscribeToUserLeft((socketId) => {
            setRemoteCursors(prev => {
                const next = { ...prev };
                delete next[socketId];
                return next;
            });
        });

        // Join room — callback fires once the server echoes `room-joined`
        joinRoom(room, (data) => {
            setMyId(data.myId);
            setMyName(data.myName);
            setMyColor(data.myColor);
            setUserCount(data.count);

            // Seed remote cursors from existing users
            const initial = {};
            data.users.forEach(u => { initial[u.id] = u; });
            setRemoteCursors(initial);

            // Teleport viewport to first existing user's cursor so new joiner
            // doesn't get lost on the infinite canvas
            if (data.users.length > 0) {
                const host = data.users[0];
                // Only teleport if host cursor is non-zero (they've moved)
                if (host.cursor && (host.cursor.x !== 0 || host.cursor.y !== 0)) {
                    navigateToCursor(host.cursor.x, host.cursor.y);
                    toast(`Joined near ${host.name} 📍`, 3500);
                }
            }
        });

        return () => {
            cleanupRoomListeners();
            disconnectSocket();
        };
    }, []);  // eslint-disable-line react-hooks/exhaustive-deps

    useLayoutEffect(() => {
        const updateSize = () => setDimensions({
            width:  window.innerWidth,
            height: window.innerHeight - 60,
        });
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // ── Pointer handlers ─────────────────────────────────────────────────────

    const handlePointerDown = async (e) => {
        if (uiMode === 'color_selection') return;
        containerRef.current.setPointerCapture(e.pointerId);
        const { clientX, clientY, pressure } = e;
        const worldPos = screenToWorld(clientX, clientY);

        if (activeTool === 'hand' || e.button === 1 || e.buttons === 4) {
            isPanningRef.current = true;
            lastPointerPos.current = { x: clientX, y: clientY };
            return;
        }

        if (activeTool === 'voice') {
            if (voice.state !== 'idle') return;
            setPendingPin(worldPos);
            if (!(await voice.start())) setPendingPin(null);
            return;
        }

        if (activeTool === TOOLS.ERASER) { eraseStroke(worldPos.x, worldPos.y); return; }
        if (activeTool === 'select') return;

        setCurrentStroke({
            id:      generateId(),
            tool:    activeTool,
            color:   activeColor,
            points:  [{ x: worldPos.x, y: worldPos.y, pressure: pressure || 0.5 }],
            options: { size: activeSize },
        });
    };

    const handlePointerMove = (e) => {
        if (uiMode === 'color_selection') return;
        const { clientX, clientY } = e;
        const worldPos = screenToWorld(clientX, clientY);

        // Throttled cursor broadcast
        const now = Date.now();
        if (roomIdRef.current && now - lastCursorEmit.current > 50) {
            lastCursorEmit.current = now;
            emitCursorMove(roomIdRef.current, worldPos.x, worldPos.y);
        }

        if (isPanningRef.current) {
            const dx = clientX - lastPointerPos.current.x;
            const dy = clientY - lastPointerPos.current.y;
            setTransform(scaleRef.current, {
                x: offsetRef.current.x + dx,
                y: offsetRef.current.y + dy,
            });
            lastPointerPos.current = { x: clientX, y: clientY };
            return;
        }

        if (activeTool === TOOLS.ERASER && e.buttons === 1) {
            eraseStroke(worldPos.x, worldPos.y); return;
        }

        if (currentStroke) {
            const events = e.getCoalescedEvents?.() ?? [e];
            setCurrentStroke(prev => ({
                ...prev,
                points: [
                    ...prev.points,
                    ...events.map(ev => {
                        const wp = screenToWorld(ev.clientX, ev.clientY);
                        return { x: wp.x, y: wp.y, pressure: ev.pressure || 0.5 };
                    }),
                ],
            }));
        }
    };

    const handlePointerUp = () => {
        isPanningRef.current = false;
        if (!currentStroke) return;

        const finalStroke = { ...currentStroke, points: simplifyStroke(currentStroke.points) };
        addToHistory(elements);
        const next = [...elements, finalStroke];
        setElements(next);
        setCurrentStroke(null);

        if (roomIdRef.current) emitDrawing(roomIdRef.current, finalStroke);
    };

    // ── Voice note ───────────────────────────────────────────────────────────

    const handleStopVoiceNote = async () => {
        if (!pendingPin || voice.state !== 'recording') return;
        const dur  = voice.duration;
        const blob = await voice.stop();
        if (!blob) { setPendingPin(null); return; }

        const newNote = {
            id:       generateId(),
            x:        pendingPin.x,
            y:        pendingPin.y,
            audioUrl: URL.createObjectURL(blob),
            duration: dur,
            panel:    'canvas',
        };
        setVoiceNotes(prev => [...prev, newNote]);
        setPendingPin(null);
    };

    // ── Share ────────────────────────────────────────────────────────────────

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast('Link copied to clipboard! 🔗');
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div style={{
            height: '100vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', background: '#F5F5F7',
        }}>
            {/* ── UI overlay ── */}
            <UIManager>
                <AnimatePresence>
                    {uiMode === 'drawing' && (
                        <motion.div
                            key="toolbar"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 50, pointerEvents: 'none' }}
                        >
                            <div style={{ pointerEvents: 'auto' }}>
                                <TopBar
                                    roomId={roomId}
                                    myName={myName}
                                    myColor={myColor}
                                    userCount={userCount}
                                    onShare={handleShare}
                                />
                            </div>

                            {/* Left tool palette */}
                            <div style={{
                                position: 'absolute', left: '20px', top: '80px',
                                background: 'white', padding: '8px', borderRadius: '12px',
                                boxShadow: 'var(--shadow-md)', display: 'flex',
                                flexDirection: 'column', gap: '4px', pointerEvents: 'auto',
                            }}>
                                <ToolbarButton icon={MousePointer2} active={activeTool === 'select'}        onClick={() => setActiveTool('select')}        title="Select" />
                                <ToolbarButton icon={PenTool}       active={activeTool === TOOLS.PEN}       onClick={() => setActiveTool(TOOLS.PEN)}       title="Pen" />
                                <ToolbarButton icon={Type}          active={activeTool === TOOLS.FOUNTAIN}  onClick={() => setActiveTool(TOOLS.FOUNTAIN)}  title="Fountain" />
                                <ToolbarButton icon={Sparkles}      active={activeTool === TOOLS.DYNAMIC}   onClick={() => setActiveTool(TOOLS.DYNAMIC)}   title="Dynamic" />
                                <ToolbarButton icon={Square}        active={activeTool === TOOLS.MARKER}    onClick={() => setActiveTool(TOOLS.MARKER)}    title="Marker" />
                                <ToolbarButton icon={Square}        active={activeTool === TOOLS.ERASER}    onClick={() => setActiveTool(TOOLS.ERASER)}    title="Eraser" />
                                <VoiceNoteButton
                                    active={activeTool === 'voice'}
                                    recording={voice.state === 'recording'}
                                    onClick={() => setActiveTool(p => p === 'voice' ? TOOLS.DYNAMIC : 'voice')}
                                />

                                <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />
                                <ToolbarButton icon={Undo} onClick={handleUndo} title="Undo (Ctrl+Z)" />
                                <ToolbarButton icon={Redo} onClick={handleRedo} title="Redo (Ctrl+Y)" />
                                <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />

                                {/* Size slider */}
                                <div style={{ padding: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <input
                                        type="range" min="1" max="50" value={activeSize}
                                        onChange={(e) => setActiveSize(parseInt(e.target.value))}
                                        onPointerDown={e => e.stopPropagation()}
                                        style={{
                                            appearance: 'none', width: '2px', height: '60px',
                                            background: '#ddd', writingMode: 'vertical-lr',
                                            WebkitAppearance: 'slider-vertical', cursor: 'pointer', borderRadius: '2px',
                                        }}
                                        title={`Size: ${activeSize}px`}
                                    />
                                </div>

                                <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />

                                {/* Colour swatch */}
                                <button
                                    onPointerDown={e => e.stopPropagation()}
                                    onClick={() => setUiMode('color_selection')}
                                    style={{
                                        width: '40px', height: '40px', borderRadius: '50%',
                                        background: activeColor, border: '2px solid #E5E5E5',
                                        cursor: 'pointer', pointerEvents: 'auto', transition: 'transform 0.1s',
                                    }}
                                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                    onMouseOut={e  => e.currentTarget.style.transform = 'scale(1)'}
                                    title="Pick colour"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Colour picker */}
                <AnimatePresence>
                    {uiMode === 'color_selection' && (
                        <ColorWheelPicker
                            activeColor={activeColor}
                            onChange={(c) => { setActiveColor(c); setUiMode('drawing'); }}
                            onClose={() => setUiMode('drawing')}
                        />
                    )}
                </AnimatePresence>

                {/* Bottom-right controls */}
                <div style={{
                    position: 'absolute', bottom: '30px', right: '30px',
                    background: 'white', padding: '4px', borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)', display: 'flex',
                    flexDirection: 'column', gap: '4px', pointerEvents: 'auto',
                }}>
                    <ToolbarButton icon={ZoomIn}  onClick={zoomIn}  title="Zoom in" />
                    <ToolbarButton icon={ZoomOut} onClick={zoomOut} title="Zoom out" />
                    <div style={{ height: '1px', background: '#E5E5E5', margin: '4px 0' }} />
                    <div style={{ position: 'relative' }}>
                        <ToolbarButton icon={Grid} active={showSettings} onClick={() => setShowSettings(s => !s)} title="Grid settings" />
                        {showSettings && (
                            <div style={{ position: 'absolute', bottom: '10px', right: '50px', zIndex: 50 }}>
                                <CanvasSettings
                                    activeGrid={gridType}  onGridChange={setGridType}
                                    activeTheme={theme}    onThemeChange={setTheme}
                                />
                            </div>
                        )}
                    </div>
                    <ToolbarButton icon={Hand} active={activeTool === 'hand'} onClick={() => setActiveTool('hand')} title="Pan" />
                </div>

                {/* Zoom badge */}
                <div style={{
                    position: 'absolute', bottom: '20px', left: '20px',
                    background: 'rgba(0,0,0,0.5)', color: 'white',
                    padding: '4px 8px', borderRadius: '4px', fontSize: '12px', pointerEvents: 'none',
                }}>
                    {Math.round(scale * 100)}%
                </div>
            </UIManager>

            {/* ── Canvas container ── */}
            <div
                ref={containerRef}
                className={`grid-bg bg-grid-${gridType} theme-${theme}`}
                style={{ flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onWheel={handleWheel}
            >
                <CanvasLayer
                    strokes={elements}
                    currentStroke={currentStroke}
                    scale={scale}
                    offset={offset}
                    width={dimensions.width}
                    height={dimensions.height}
                />

                <VoiceNotesLayer
                    voiceNotes={voiceNotes}
                    scale={scale}
                    offset={offset}
                    pendingPin={pendingPin}
                    isRecording={voice.state === 'recording'}
                    recDuration={voice.duration}
                    onStopRecording={handleStopVoiceNote}
                    onDeleteNote={(id) => setVoiceNotes(prev => prev.filter(n => n.id !== id))}
                    onUpdateNotePos={(id, x, y) =>
                        setVoiceNotes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n))
                    }
                    panel="canvas"
                />

                {/* Live cursors overlay */}
                <LiveCursors
                    cursors={remoteCursors}
                    scale={scale}
                    offset={offset}
                    containerSize={dimensions}
                    onNavigateTo={navigateToCursor}
                />

                {/* Mic error toast */}
                {voice.error && (
                    <div style={{
                        position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
                        background: '#FEE2E2', color: '#991B1B',
                        padding: '12px 24px', borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontWeight: 500, zIndex: 9999, pointerEvents: 'none',
                    }}>
                        {voice.error}
                    </div>
                )}
            </div>

            {/* ── Toast ── */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        key="toast"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.25 }}
                        style={{
                            position: 'fixed', bottom: '40px', left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#1A1A1A', color: 'white',
                            padding: '12px 24px', borderRadius: '10px', zIndex: 200,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                            fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                        }}
                    >
                        {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MemoryBoard;
