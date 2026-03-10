import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getBoard, updateBoard } from '../services/api';
import { initiateSocketConnection, disconnectSocket, joinRoom, subscribeToDrawings, emitDrawing } from '../services/socket';
import CanvasLayer from '../components/CanvasLayer';
import UIManager from '../components/UIManager';
import { ColorWheelPicker } from '../components/ColorWheelPicker';
import { CanvasSettings } from '../components/CanvasControls';
import { useCanvasTransform } from '../hooks/useCanvasTransform';
import { TOOLS, simplifyStroke } from '../utils/StrokeUtils';
import {
    MousePointer2, Square, Type, PenTool, Share,
    ChevronRight, ZoomIn, ZoomOut, Hand, Grid, Palette, Undo, Redo, Sparkles
} from 'lucide-react';
import '../styles/grids.css';

// --- Toolbar Components ---
const TopBar = ({ title, mode }) => (
    <div style={{
        height: '60px',
        borderBottom: '1px solid #E5E5E5',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        justifyContent: 'space-between',
        zIndex: 20,
        pointerEvents: 'auto'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
                width: '32px', height: '32px', background: '#0066FF', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold'
            }}>DW</div>
            <div style={{ height: '24px', width: '1px', background: '#E5E5E5' }} />
            <div>
                <h2 style={{ fontSize: '14px', margin: 0 }}>{title}</h2>
                <div style={{ fontSize: '11px', color: '#999', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>DeepWork OS</span><ChevronRight size={10} /><span style={{ textTransform: 'capitalize' }}>{mode} Canvas</span>
                </div>
            </div>
        </div>
        <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
            <Share size={14} /> Share
        </button>
    </div>
);

const ToolbarButton = ({ icon: Icon, active, onClick }) => (
    <button
        onClick={onClick}
        onPointerDown={(e) => e.stopPropagation()} // Prevent canvas from catching click
        style={{
            width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: active ? '#EBF5FF' : 'transparent', color: active ? '#0066FF' : '#666',
            borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', pointerEvents: 'auto'
        }}
    >
        <Icon size={20} />
    </button>
);

const StandardBoard = () => {
    const { id } = useParams();
    const [board, setBoard] = useState(null);
    const [elements, setElements] = useState([]); // Array of strokes
    const [currentStroke, setCurrentStroke] = useState(null);
    const [loading, setLoading] = useState(true);

    // Tools & State
    const [activeTool, setActiveTool] = useState(TOOLS.DYNAMIC); // Default to Dynamic Pen
    const [activeColor, setActiveColor] = useState('#000000');
    const [activeSize, setActiveSize] = useState(5); // Default size

    // UI Modes
    // 'drawing' | 'color_selection'
    const [uiMode, setUiMode] = useState('drawing');
    const [showSettings, setShowSettings] = useState(false);
    const [gridType, setGridType] = useState('dot');
    const [theme, setTheme] = useState('standard');

    // Canvas Transform
    const { scale, offset, zoomIn, zoomOut, setTransform, handleWheel } = useCanvasTransform();
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

    // --- Undo/Redo State ---
    const [history, setHistory] = useState([]);
    const [redoStack, setRedoStack] = useState([]);

    const addToHistory = (elementsSnapshot) => {
        setHistory(prev => [...prev, elementsSnapshot]);
        setRedoStack([]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        const newHistory = history.slice(0, -1);

        // Push current to redo
        setRedoStack(prev => [elements, ...prev]);
        setElements(previous);
        setHistory(newHistory);
        updateBoard(id, { elements: previous });
    };

    const handleRedo = () => {
        if (redoStack.length === 0) return;
        const next = redoStack[0];
        const newRedo = redoStack.slice(1);

        // Push current to history
        setHistory(prev => [...prev, elements]);
        setElements(next);
        setRedoStack(newRedo);
        updateBoard(id, { elements: next });
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (uiMode === 'color_selection') setUiMode('drawing');
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) handleRedo();
                else handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, redoStack, elements, uiMode]);

    // --- Eraser Logic ---
    const eraseStroke = (x, y) => {
        const radius = 10 / scale;
        const thresholdSq = radius * radius;
        const strokeIndex = elements.findIndex(stroke => {
            return stroke.points && stroke.points.some(p => {
                const dx = p.x - x;
                const dy = p.y - y;
                return (dx * dx + dy * dy) < thresholdSq;
            });
        });

        if (strokeIndex !== -1) {
            const newElements = [...elements];
            newElements.splice(strokeIndex, 1);
            addToHistory(elements); // Save state before erase
            setElements(newElements);
            updateBoard(id, { elements: newElements });
        }
    };

    // Refs for interaction
    const containerRef = useRef(null);
    const isPanningRef = useRef(false);
    const lastPointerPos = useRef({ x: 0, y: 0 });

    // --- Initialization ---
    useEffect(() => {
        const fetchBoard = async () => {
            try {
                const { data } = await getBoard(id);
                setBoard(data);
                if (data.elements) {
                    const validElements = data.elements.filter(e => e.points);
                    setElements(validElements);
                }
                setLoading(false);
                if (data.mode === 'collaboration') {
                    initiateSocketConnection();
                    joinRoom(id);
                    subscribeToDrawings((newElement) => {
                        setElements((prev) => [...prev, newElement]);
                    });
                }
            } catch (error) {
                console.error(error);
                setLoading(false);
            }
        };
        fetchBoard();
        return () => disconnectSocket();
    }, [id]);

    useLayoutEffect(() => {
        const updateSize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // --- Interaction Handlers ---

    // Convert Screen (Client) Coords to World Coords
    const screenToWorld = (cx, cy) => {
        if (!containerRef.current) return { x: cx / scale, y: cy / scale };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (cx - rect.left - offset.x) / scale,
            y: (cy - rect.top - offset.y) / scale
        };
    };

    const handlePointerDown = (e) => {
        if (uiMode === 'color_selection') return; // Block interaction on canvas

        containerRef.current.setPointerCapture(e.pointerId);
        const { clientX, clientY, pressure, pointerType } = e;
        const worldPos = screenToWorld(clientX, clientY);

        // 1. Pan (Middle click or Space+Drag or Hand Tool)
        if (activeTool === 'hand' || e.button === 1 || e.buttons === 4) {
            isPanningRef.current = true;
            lastPointerPos.current = { x: clientX, y: clientY };
            return;
        }

        // 2. Eraser
        if (activeTool === TOOLS.ERASER) {
            eraseStroke(worldPos.x, worldPos.y);
            return;
        }

        // 3. Draw
        if (activeTool === 'select') return;

        const newStroke = {
            id: Date.now().toString(),
            tool: activeTool,
            color: activeColor,
            points: [{ x: worldPos.x, y: worldPos.y, pressure: pressure || 0.5 }],
            options: { size: activeSize } // Use state size
        };
        setCurrentStroke(newStroke);
    };

    const handlePointerMove = (e) => {
        if (uiMode === 'color_selection') return;

        const { clientX, clientY, pressure, pointerType } = e;
        const worldPos = screenToWorld(clientX, clientY);

        // Pan
        if (isPanningRef.current) {
            const dx = clientX - lastPointerPos.current.x;
            const dy = clientY - lastPointerPos.current.y;
            setTransform(scale, { x: offset.x + dx, y: offset.y + dy });
            lastPointerPos.current = { x: clientX, y: clientY };
            return;
        }

        // Eraser Drag
        if (activeTool === TOOLS.ERASER && e.buttons === 1) {
            eraseStroke(worldPos.x, worldPos.y);
            return;
        }

        // Draw
        if (currentStroke) {
            // "Coalesced Events" For higher precision
            const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];

            setCurrentStroke(prev => {
                const newPoints = events.map(ev => {
                    const wp = screenToWorld(ev.clientX, ev.clientY);
                    return { x: wp.x, y: wp.y, pressure: ev.pressure || 0.5 };
                });
                return {
                    ...prev,
                    points: [...prev.points, ...newPoints]
                };
            });
        }
    };

    const handlePointerUp = (e) => {
        isPanningRef.current = false;
        if (currentStroke) {
            // Apply Simplification
            const finalStroke = { ...currentStroke, points: simplifyStroke(currentStroke.points) };

            // Save state before this new stroke for Undo
            addToHistory(elements);

            const newElements = [...elements, finalStroke];
            setElements(newElements);
            setCurrentStroke(null);

            if (board?.mode === 'collaboration') {
                emitDrawing(id, finalStroke);
            }
            updateBoard(id, { elements: newElements });
        }
    };

    if (loading) return <div>Loading...</div>;
    if (!board) return <div>Board not found</div>;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F5F5F7' }}>

            {/* UI Layer */}
            <UIManager>

                {/* TOOLBAR (Hides in Color Mode) */}
                <AnimatePresence>
                    {uiMode === 'drawing' && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 50, pointerEvents: 'none' }}
                        >
                            <div style={{ pointerEvents: 'auto' }}>
                                <TopBar title={board.title} mode={board.mode} />
                            </div>

                            {/* Tools Palette */}
                            <div style={{
                                position: 'absolute', left: '20px', top: '80px',
                                background: 'white', padding: '8px', borderRadius: '12px',
                                boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column',
                                gap: '4px', pointerEvents: 'auto'
                            }}>
                                <ToolbarButton icon={MousePointer2} active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
                                <ToolbarButton icon={PenTool} active={activeTool === TOOLS.PEN} onClick={() => setActiveTool(TOOLS.PEN)} />
                                <ToolbarButton icon={Type} active={activeTool === TOOLS.FOUNTAIN} onClick={() => setActiveTool(TOOLS.FOUNTAIN)} />
                                <div title="Dynamic Pen"><ToolbarButton icon={Sparkles} active={activeTool === TOOLS.DYNAMIC} onClick={() => setActiveTool(TOOLS.DYNAMIC)} /></div>
                                <div title="Marker"><ToolbarButton icon={Square} active={activeTool === TOOLS.MARKER} onClick={() => setActiveTool(TOOLS.MARKER)} /></div>
                                <div title="Eraser"><ToolbarButton icon={Square} active={activeTool === TOOLS.ERASER} onClick={() => setActiveTool(TOOLS.ERASER)} /></div>

                                <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />
                                <ToolbarButton icon={Undo} onClick={handleUndo} />
                                <ToolbarButton icon={Redo} onClick={handleRedo} />

                                <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />

                                {/* Thickness Slider */}
                                <div style={{ padding: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <input
                                        type="range"
                                        min="1"
                                        max="50"
                                        value={activeSize}
                                        onChange={(e) => setActiveSize(parseInt(e.target.value))}
                                        style={{
                                            appearance: 'none',
                                            width: '2px',
                                            height: '60px',
                                            background: '#ddd',
                                            writingMode: 'vertical-lr',
                                            WebkitAppearance: 'slider-vertical',
                                            cursor: 'pointer',
                                            borderRadius: '2px'
                                        }}
                                        title={`Size: ${activeSize}px`}
                                    />
                                </div>

                                <div style={{ height: '1px', background: '#eee', margin: '4px 0' }} />

                                <button
                                    onClick={() => setUiMode('color_selection')}
                                    style={{
                                        width: '40px', height: '40px', borderRadius: '50%',
                                        background: activeColor, border: '2px solid #E5E5E5',
                                        cursor: 'pointer', pointerEvents: 'auto',
                                        transition: 'transform 0.1s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Color Selection Modal */}
                <AnimatePresence>
                    {uiMode === 'color_selection' && (
                        <ColorWheelPicker
                            activeColor={activeColor}
                            onChange={(color) => {
                                setActiveColor(color);
                                setUiMode('drawing'); // Auto close on select
                            }}
                            onClose={() => setUiMode('drawing')}
                        />
                    )}
                </AnimatePresence>

                {/* Bottom Rights (Always visible or Fade?) -> Let's keep them useful */}
                <div style={{ position: 'absolute', bottom: '30px', right: '30px', background: 'white', padding: '4px', borderRadius: '8px', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: '4px', pointerEvents: 'auto' }}>
                    <ToolbarButton icon={ZoomIn} onClick={zoomIn} />
                    <ToolbarButton icon={ZoomOut} onClick={zoomOut} />
                    <div style={{ height: '1px', background: '#E5E5E5', margin: '4px 0' }} />

                    <div style={{ position: 'relative' }}>
                        <ToolbarButton icon={Grid} active={showSettings} onClick={() => setShowSettings(!showSettings)} />
                        {showSettings && (
                            <div style={{ position: 'absolute', bottom: '10px', right: '50px', zIndex: 50 }}>
                                <CanvasSettings
                                    activeGrid={gridType}
                                    onGridChange={setGridType}
                                    activeTheme={theme}
                                    onThemeChange={setTheme}
                                />
                            </div>
                        )}
                    </div>
                    <ToolbarButton icon={Hand} active={activeTool === 'hand'} onClick={() => setActiveTool('hand')} />
                </div>

                {/* Zoom Badge */}
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.5)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', pointerEvents: 'none' }}>
                    {Math.round(scale * 100)}%
                </div>
            </UIManager>

            {/* Canvas Container */}
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
            </div>
        </div>
    );
};

export default StandardBoard;
