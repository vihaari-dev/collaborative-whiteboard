import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { drawElement, getMouseCoordinates } from '../utils/canvasUtils';

const Canvas = ({
    elements,
    activeTool,
    strokeColor,
    scale,
    offset,
    onElementsChange,
    onDrawing,
    onWheel,
    onMouseDownPan // Callback to tell parent we started panning (for Hand tool)
}) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentElement, setCurrentElement] = useState(null);
    const [startPan, setStartPan] = useState(null); // Local pan state for middle-mouse drag
    const [localIsPanning, setLocalIsPanning] = useState(false);

    // Render Loop
    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const { width, height } = canvas.getBoundingClientRect();

        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        ctx.resetTransform(); // Clear previous transforms
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        // Clear Background
        ctx.clearRect(0, 0, width, height);

        // Apply Infinite Canvas Transform
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // Render Existing Elements
        elements.forEach(element => drawElement(ctx, element));

        // Render Current Action
        if (currentElement) {
            drawElement(ctx, currentElement);
        }

        ctx.restore();
    }, [elements, currentElement, scale, offset, window.devicePixelRatio]);

    const handleMouseDown = (e) => {
        // 1. Hand Tool or Middle Click -> Pan
        if (activeTool === 'hand' || e.button === 1) {
            setLocalIsPanning(true);
            setStartPan({ x: e.clientX, y: e.clientY });
            // Notify parent if they need to track it, or handle locally via props if wanted
            // For now, we'll try to handle pan updates via a callback or local bridging?
            // Actually, pan updates modify 'offset', which is comprised of props.
            // So we need a callback `onPan` or just reuse `onMouseDownPan` to let parent handle the move listeners.
            if (onMouseDownPan) onMouseDownPan(e);
            return;
        }

        // 2. Drawing Tools
        const { x, y } = getMouseCoordinates(e.nativeEvent, scale, offset);
        setIsDrawing(true);
        const id = Date.now().toString();

        let newEl = null;

        if (activeTool === 'pen') {
            newEl = {
                id, type: 'line', points: [{ x, y }], color: strokeColor
            };
        } else if (activeTool === 'shape' || activeTool === 'rectangle') {
            newEl = {
                id, type: 'rectangle', x, y, width: 0, height: 0, color: strokeColor
            };
        } else if (activeTool === 'text') {
            // Text logic can be handled here or parent. 
            // For MVP simplicity, let's just log click.
            // Text input usually requires an overlay.
        }

        setCurrentElement(newEl);
    };

    const handleMouseMove = (e) => {
        // If we are panning locally (middle click override), we need to calculate delta and tell parent
        // But since we want "Fit to Screen" etc, parent owns state.
        // We will assume `onMouseDownPan` sets up the window listeners in parent (BoardView).
        // OR we just use this current mouse move if `isDrawing`.

        if (!isDrawing || !currentElement) return;

        const { x, y } = getMouseCoordinates(e.nativeEvent, scale, offset);

        if (activeTool === 'pen') {
            setCurrentElement(prev => ({
                ...prev,
                points: [...prev.points, { x, y }]
            }));
        } else if (activeTool === 'shape' || activeTool === 'rectangle') {
            setCurrentElement(prev => ({
                ...prev,
                width: x - prev.x,
                height: y - prev.y
            }));
        }
    };

    const handleMouseUp = () => {
        if (isDrawing && currentElement) {
            setIsDrawing(false);
            onElementsChange([...elements, currentElement]);
            if (onDrawing) onDrawing(currentElement);
            setCurrentElement(null);
        }
        setLocalIsPanning(false);
    };

    return (
        <canvas
            ref={canvasRef}
            style={{
                display: 'block',
                width: '100%',
                height: '100%',
                cursor: activeTool === 'hand' ? 'grab' : 'crosshair',
                touchAction: 'none' // Important for limiting browser gestures
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={onWheel} // Pass wheel event up to hook
            onContextMenu={e => e.preventDefault()} // Prevent context menu
        />
    );
};

export default Canvas;
