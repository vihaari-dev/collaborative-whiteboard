import getStroke from 'perfect-freehand';

export const TOOLS = {
    PEN: 'pen',
    FOUNTAIN: 'fountain',
    DYNAMIC: 'dynamic',
    MARKER: 'marker',
    PENCIL: 'pencil',
    ERASER: 'eraser'
};

const defaultOptions = {
    size: 10,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t) => t,
    start: {
        taper: 0,
        easing: (t) => t,
        cap: true,
    },
    end: {
        taper: 0,
        easing: (t) => t,
        cap: true,
    },
};

const toolOptions = {
    [TOOLS.PEN]: {
        size: 8,
        thinning: 0.3,
        smoothing: 0.5,
        streamline: 0.4, // Reduced from 0.5
    },
    [TOOLS.FOUNTAIN]: {
        size: 8,
        thinning: 0.9,
        smoothing: 0.5,
        streamline: 0.4, // Reduced
        start: { taper: 10, cap: true },
        end: { taper: 10, cap: true }
    },
    [TOOLS.DYNAMIC]: {
        size: 10,
        thinning: 0,
        smoothing: 0.4, // Reduced from 0.5
        streamline: 0.4, // Significantly reduced from 0.8
    },
    [TOOLS.MARKER]: {
        size: 20,
        thinning: 0,
        smoothing: 0.2,
        streamline: 0.3, // Reduced
        start: { taper: 0, cap: false },
        end: { taper: 0, cap: false }
    },
    [TOOLS.PENCIL]: {
        size: 5,
        thinning: 0.6,
        smoothing: 0.6,
        streamline: 0.4,
    },
    [TOOLS.ERASER]: {
        size: 30,
        thinning: 0.1,
        smoothing: 0.5,
        streamline: 0.5,
    }
};

export const getStrokePoints = (points, toolType, options = {}) => {
    const config = { ...defaultOptions, ...toolOptions[toolType], ...options };
    return getStroke(points, config);
};

export const getSvgPathFromStroke = (stroke) => {
    if (!stroke.length) return "";

    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ["M", ...stroke[0], "Q"]
    );

    d.push("Z");
    return d.join(" ");
};

// Helper to render on 2D context directly
export const renderStrokeToContext = (ctx, stroke, color, toolType) => {
    if (stroke.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(stroke[0][0], stroke[0][1]);

    for (let i = 1; i < stroke.length - 1; i++) {
        const [x0, y0] = stroke[i];
        const [x1, y1] = stroke[i + 1];
        ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    }

    ctx.closePath();

    ctx.fillStyle = color;

    // Special handling for Marker: Multiply blend mode
    if (toolType === TOOLS.MARKER) {
        ctx.globalCompositeOperation = 'multiply';
        // Marker usually has some transparency
        // We assume 'color' coming in might be opaque, so we might need to adjust alpha if not already handled
        // But for now let's respect the passed color. 
        // If it's pure hex, we might want to convert to rgba with opacity.
    } else if (toolType === TOOLS.ERASER) {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
    }

    ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; // Reset
};

// --- SIMPLIFICATION (Ramer-Douglas-Peucker) ---
export const simplifyStroke = (points, tolerance = 0.5) => {
    if (points.length <= 2) return points;

    const sqTolerance = tolerance * tolerance;

    // Find item with max distance
    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const d = getSqSegDist(points[i], points[0], points[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }

    if (dmax > sqTolerance) {
        const recResults1 = simplifyStroke(points.slice(0, index + 1), tolerance);
        const recResults2 = simplifyStroke(points.slice(index, end + 1), tolerance);

        return [...recResults1.slice(0, recResults1.length - 1), ...recResults2];
    } else {
        return [points[0], points[end]];
    }
};

const getSqSegDist = (p, p1, p2) => {
    let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {
        const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
            x = p2.x;
            y = p2.y;
        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = p.x - x;
    dy = p.y - y;

    return dx * dx + dy * dy;
};

