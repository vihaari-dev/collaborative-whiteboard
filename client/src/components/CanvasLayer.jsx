import { useRef, useLayoutEffect, useEffect } from 'react';
import { getStrokePoints, renderStrokeToContext, TOOLS } from '../utils/StrokeUtils';

const CanvasLayer = ({
    strokes,
    currentStroke,
    scale,
    offset,
    width,
    height
}) => {
    const canvasRef = useRef(null);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // CRITICAL: Use the canvas's ACTUAL CSS display size for the buffer.
        // Using prop width/height causes a scale mismatch when the CSS display
        // size differs from the prop value, which makes cursor and ink diverge.
        const { width: cssW, height: cssH } = canvas.getBoundingClientRect();
        const bufW = Math.max(cssW, 1);
        const bufH = Math.max(cssH, 1);

        canvas.width  = bufW * dpr;
        canvas.height = bufH * dpr;

        ctx.resetTransform();
        ctx.scale(dpr, dpr);

        // Clear background
        ctx.clearRect(0, 0, bufW, bufH);

        // --- CAMERA TRANSFORM ---
        // We apply the transform globally to the context
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // --- RENDER VISIBLE STROKES ---
        // Optimization: In a real app we'd cull off-screen strokes here

        strokes.forEach(stroke => {
            if (!stroke.points || stroke.points.length === 0) return;

            const strokePoints = getStrokePoints(stroke.points, stroke.tool, stroke.options);
            renderStrokeToContext(ctx, strokePoints, stroke.color, stroke.tool);
        });

        // --- RENDER CURRENT STROKE ---
        if (currentStroke && currentStroke.points && currentStroke.points.length > 0) {
            const strokePoints = getStrokePoints(currentStroke.points, currentStroke.tool, currentStroke.options);
            renderStrokeToContext(ctx, strokePoints, currentStroke.color, currentStroke.tool);
        }

        ctx.restore();

    }, [strokes, currentStroke, scale, offset, width, height]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                display: 'block',
                width: '100%',
                height: '100%',
                touchAction: 'none', // Prevents browser scrolling
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1 // Canvas is below UI
            }}
        />
    );
};

export default CanvasLayer;
