import React from 'react';

// Custom SVG cursor arrow matching Figma-style collab cursors
const CursorSVG = ({ color }) => (
    <svg
        width="18"
        height="22"
        viewBox="0 0 18 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }}
    >
        <path
            d="M0.5 0.5L0.5 17.5L4.5 13L8 21L10 20L6.5 12H13.5L0.5 0.5Z"
            fill={color}
            stroke="white"
            strokeWidth="1.2"
            strokeLinejoin="round"
        />
    </svg>
);

/**
 * LiveCursors
 *
 * Renders each remote user's cursor + clickable name tag as an absolutely-
 * positioned overlay inside the canvas container.
 *
 * Props:
 *   cursors           – { [socketId]: { id, name, color, x, y } }  (world coords)
 *   scale             – current canvas scale
 *   offset            – current canvas offset { x, y }
 *   containerSize     – { width, height } of the canvas container (excluding topbar)
 *   onNavigateTo      – (worldX, worldY) => void  — called when tag is clicked
 */
const LiveCursors = ({ cursors, scale, offset, containerSize, onNavigateTo }) => {
    if (!cursors || Object.keys(cursors).length === 0) return null;

    const { width = 0, height = 0 } = containerSize || {};

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 40,
                overflow: 'hidden',
            }}
        >
            {Object.values(cursors).map((cursor) => {
                const screenX = cursor.x * scale + offset.x;
                const screenY = cursor.y * scale + offset.y;

                // --- Off-screen edge indicator --------------------------------
                const offLeft   = screenX < -10;
                const offRight  = screenX > width  + 10;
                const offTop    = screenY < -10;
                const offBottom = screenY > height + 10;
                const isOffScreen = offLeft || offRight || offTop || offBottom;

                if (isOffScreen) {
                    // Clamp to edge and show a small coloured dot with name
                    const clampedX = Math.max(12, Math.min(width  - 80, screenX));
                    const clampedY = Math.max(12, Math.min(height - 28, screenY));

                    return (
                        <div
                            key={cursor.id}
                            onClick={() => onNavigateTo?.(cursor.x, cursor.y)}
                            style={{
                                position: 'absolute',
                                left: offLeft ? 12 : offRight ? width - 80 : clampedX,
                                top:  offTop  ? 12 : offBottom ? height - 28 : clampedY,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: cursor.color,
                                color: 'white',
                                padding: '4px 8px 4px 6px',
                                borderRadius: '20px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                                userSelect: 'none',
                                letterSpacing: '0.2px',
                                opacity: 0.92,
                                transition: 'left 0.15s, top 0.15s',
                            }}
                            title={`Jump to ${cursor.name}`}
                        >
                            <div style={{
                                width: 7, height: 7, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.7)',
                                flexShrink: 0,
                            }} />
                            {cursor.name}
                        </div>
                    );
                }

                // --- Normal on-screen cursor ----------------------------------
                return (
                    <div
                        key={cursor.id}
                        style={{
                            position: 'absolute',
                            left: screenX,
                            top:  screenY,
                            pointerEvents: 'none',
                            // Smooth micro-interpolation
                            transition: 'left 0.04s linear, top 0.04s linear',
                        }}
                    >
                        <CursorSVG color={cursor.color} />

                        {/* Clickable name tag */}
                        <div
                            onClick={() => onNavigateTo?.(cursor.x, cursor.y)}
                            style={{
                                position: 'absolute',
                                top: '18px',
                                left: '14px',
                                background: cursor.color,
                                color: 'white',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                userSelect: 'none',
                                letterSpacing: '0.3px',
                            }}
                            title={`Jump to ${cursor.name}`}
                        >
                            {cursor.name}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default LiveCursors;
