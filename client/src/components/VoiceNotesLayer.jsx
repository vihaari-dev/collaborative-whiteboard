import VoiceNoteItem from './VoiceNoteItem';

/**
 * VoiceNotesLayer
 *
 * Renders all voice note items over the canvas mapping world -> screen coordinates.
 *
 * Props:
 *   voiceNotes     : array of note objects: { id, x, y, audioUrl, duration }
 *   scale          : current canvas scale
 *   offset         : { x, y } current canvas pan offset
 *   pendingPin     : { x, y } | null — world coordinates of the note currently being recorded
 *   isRecording    : boolean — whether mic capture is active
 *   recDuration    : number — seconds elapsed for the pending pin
 *   onStopRecording: () => void - user clicked stop on the recording widget
 *   onDeleteNote   : (id) => void
 *   onUpdateNotePos: (id, worldX, worldY) => void
 *   panel          : 'canvas' | 'doc' — only render notes for this panel (default 'canvas')
 */
const VoiceNotesLayer = ({
    voiceNotes = [],
    scale = 1,
    offset = { x: 0, y: 0 },
    pendingPin = null,
    isRecording = false,
    recDuration = 0,
    onStopRecording,
    onDeleteNote,
    onUpdateNotePos,
    panel = 'canvas',
}) => {
    // Project world-space (x,y) → screen-space
    const toScreen = (wx, wy) => ({
        x: wx * scale + offset.x,
        y: wy * scale + offset.y,
    });

    // Project screen-space (x,y) → world-space
    const toWorld = (sx, sy) => ({
        x: (sx - offset.x) / scale,
        y: (sy - offset.y) / scale,
    });

    const panelNotes = voiceNotes.filter(n => (n.panel || 'canvas') === panel);

    // Draggable calls onStop with relative movement. To get exact new center,
    // we take original screen pos, add delta, convert to world, and save.
    const handleDragStop = (id, newScreenX, newScreenY) => {
        const worldPos = toWorld(newScreenX, newScreenY);
        // Add a slight offset because Draggable tracks top-left of the bounding box relative to its initial start point, Check VoiceNoteItem defaultPosition.
        // But since we use defaultPosition {x:0, y:0} and translate(-50%, -100%), the data.x and data.y from react-draggable
        // is the delta applied. The final absolute screen position is (initialScreenX + deltaX), (initialScreenY + deltaY).
        if (onUpdateNotePos) {
            onUpdateNotePos(id, worldPos.x, worldPos.y);
        }
    };

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none', // Let clicks fall through to canvas
            overflow: 'hidden',
            zIndex: 50, // Above canvas, below UI
        }}>
            <style>{`
                @keyframes vn-pulse {
                    0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
                    70%  { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
                    100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
                }
                @keyframes vn-wave {
                    from { transform: scaleY(0.4); }
                    to   { transform: scaleY(1); }
                }
            `}</style>

            {/* Render saved notes */}
            {panelNotes.map(note => {
                const screenPos = toScreen(note.x, note.y);
                return (
                    <VoiceNoteItem
                        key={note.id}
                        note={note}
                        screenX={screenPos.x}
                        screenY={screenPos.y}
                        onDelete={onDeleteNote}
                        onDragStop={(id, dX, dY) => {
                            // Calculate new absolute screen position based on initial pos + drag delta
                            handleDragStop(id, screenPos.x + dX, screenPos.y + dY);
                        }}
                    />
                );
            })}

            {/* Render pending recording pin */}
            {pendingPin && isRecording && (() => {
                const screenPos = toScreen(pendingPin.x, pendingPin.y);
                return (
                    <VoiceNoteItem
                        key="recording-pin"
                        note={{ id: '__rec__', audioUrl: null, duration: 0 }}
                        screenX={screenPos.x}
                        screenY={screenPos.y}
                        isRecording={true}
                        recDuration={recDuration}
                        onStop={onStopRecording}
                        onDelete={() => {}}
                        onDragStop={() => {}}
                    />
                );
            })()}
        </div>
    );
};

export default VoiceNotesLayer;
