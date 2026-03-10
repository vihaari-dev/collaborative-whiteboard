export const getMouseCoordinates = (event, scale, offset) => {
    const { clientX, clientY } = event;
    return {
        x: (clientX - offset.x) / scale,
        y: (clientY - offset.y) / scale
    };
};

export const drawElement = (ctx, element) => {
    const { type, color, points, x, y, width, height, text } = element;

    ctx.beginPath();
    ctx.strokeStyle = color || '#000000';
    ctx.fillStyle = color || '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (type === 'line') {
        if (points.length < 2) return;
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
    } else if (type === 'rectangle') {
        ctx.strokeRect(x, y, width, height);
    } else if (type === 'circle') {
        ctx.beginPath();
        const radius = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)) / 2;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        ctx.arc(centerX, centerY, Math.abs(radius), 0, 2 * Math.PI);
        ctx.stroke();
    } else if (type === 'text') {
        ctx.font = '24px Inter, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(text || '', x, y);
    }
};

export const isPointInElement = (x, y, element) => {
    // Simple hit detection (bounding box mostly)
    // For MVP we just check bounding box for all types or near-line for standard lines
    // This is a placeholder for selection logic
    return false;
};
