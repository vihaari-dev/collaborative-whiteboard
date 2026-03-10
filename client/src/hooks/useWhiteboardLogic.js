import { useState, useRef, useEffect } from 'react';
import { updateBoard } from '../services/api';
import { simplifyStroke } from '../utils/StrokeUtils';
import { TOOLS } from '../utils/StrokeUtils';
import { emitDrawing } from '../services/socket';

export const useWhiteboardLogic = (boardId, initialElements = [], mode = 'solo') => {
    const [elements, setElements] = useState(initialElements);
    const [history, setHistory] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [currentStroke, setCurrentStroke] = useState(null);

    // Tool State
    const [activeTool, setActiveTool] = useState(TOOLS.DYNAMIC);
    const [activeColor, setActiveColor] = useState('#000000');
    const [activeSize, setActiveSize] = useState(5);
    const [gridType, setGridType] = useState('dot');
    const [theme, setTheme] = useState('standard');

    // Refs
    // const containerRef = useRef(null); // Managed by consumer to attach events to div
    const isPanningRef = useRef(false);
    const lastPointerPos = useRef({ x: 0, y: 0 });

    // Sync initial elements
    useEffect(() => {
        setElements(initialElements);
    }, [initialElements]);

    // --- Actions ---

    const addToHistory = (elementsSnapshot) => {
        setHistory(prev => [...prev, elementsSnapshot]);
        setRedoStack([]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        const newHistory = history.slice(0, -1);

        setRedoStack(prev => [elements, ...prev]);
        setElements(previous);
        setHistory(newHistory);

        // Optimistic update - consumer should handle API call if needed, 
        // but often we want to save immediately.
        // For distinct document pages, we might need a callback to save.
    };

    const handleRedo = () => {
        if (redoStack.length === 0) return;
        const next = redoStack[0];
        const newRedo = redoStack.slice(1);

        setHistory(prev => [...prev, elements]);
        setElements(next);
        setRedoStack(newRedo);
    };

    const eraseStroke = (x, y, scale) => {
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
            addToHistory(elements);
            setElements(newElements);
            return newElements; // Return for saving
        }
        return null;
    };

    // --- Interaction Logic ---
    // These need to be called by the component with the event and context (scale, offset)

    const startDrawing = (x, y, pressure) => {
        const newStroke = {
            id: Date.now().toString(),
            tool: activeTool,
            color: activeColor,
            points: [{ x, y, pressure: pressure || 0.5 }],
            options: { size: activeSize }
        };
        setCurrentStroke(newStroke);
    };

    const continueDrawing = (pointEvents) => {
        if (!currentStroke) return;

        setCurrentStroke(prev => {
            const newPoints = pointEvents.map(p => ({ x: p.x, y: p.y, pressure: p.pressure }));
            return {
                ...prev,
                points: [...prev.points, ...newPoints]
            };
        });
    };

    const endDrawing = () => {
        if (currentStroke) {
            const finalStroke = { ...currentStroke, points: simplifyStroke(currentStroke.points) };
            addToHistory(elements);
            const newElements = [...elements, finalStroke];
            setElements(newElements);
            setCurrentStroke(null);
            return newElements;
        }
        return null;
    };

    return {
        state: {
            elements,
            currentStroke,
            history,
            redoStack,
            activeTool,
            activeColor,
            activeSize,
            gridType,
            theme
        },
        actions: {
            setElements,
            setHistory,
            setRedoStack,
            setActiveTool,
            setActiveColor,
            setActiveSize,
            setGridType,
            setTheme,
            handleUndo,
            handleRedo,
            eraseStroke,
            startDrawing,
            continueDrawing,
            endDrawing
        },
        refs: {
            isPanningRef,
            lastPointerPos
        }
    };
};
