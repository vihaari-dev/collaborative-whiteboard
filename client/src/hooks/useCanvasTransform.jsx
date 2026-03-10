import { useState, useCallback } from 'react';

export const useCanvasTransform = (initialScale = 1, initialOffset = { x: 0, y: 0 }) => {
    const [scale, setScale] = useState(initialScale);
    const [offset, setOffset] = useState(initialOffset);

    const zoomIn = () => {
        setScale(prev => Math.min(prev * 1.2, 5));
    };

    const zoomOut = () => {
        setScale(prev => Math.max(prev / 1.2, 0.1));
    };

    const setTransform = (newScale, newOffset) => {
        setScale(newScale);
        setOffset(newOffset);
    };

    const handleWheel = useCallback((e) => {
        // Prevent browser zoom if Ctrl is pressed
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
        }

        const { deltaX, deltaY, clientX, clientY, currentTarget } = e;
        const rect = currentTarget.getBoundingClientRect();

        // Mouse Position relative to canvas DOM
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;

        if (e.ctrlKey || e.metaKey) {
            // ZOOM logic
            const zoomSensitivity = 0.001;
            const delta = -deltaY * zoomSensitivity;
            // Limit zoom
            const newScale = Math.min(Math.max(scale + delta * scale, 0.1), 10);

            // Calculate new offset to keep mouse position stable
            // World = (Screen - Offset) / Scale
            // We want World point to stay same, Screen point stays same
            // (Screen - OldOffset) / OldScale = (Screen - NewOffset) / NewScale

            const mouseWorldX = (mouseX - offset.x) / scale;
            const mouseWorldY = (mouseY - offset.y) / scale;

            const newOffsetX = mouseX - mouseWorldX * newScale;
            const newOffsetY = mouseY - mouseWorldY * newScale;

            setScale(newScale);
            setOffset({ x: newOffsetX, y: newOffsetY });
        } else {
            // PAN logic
            setOffset(prev => ({
                x: prev.x - deltaX,
                y: prev.y - deltaY
            }));
        }
    }, [scale, offset]);

    return {
        scale,
        offset,
        zoomIn,
        zoomOut,
        setTransform,
        handleWheel
    };
};
