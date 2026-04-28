import { Mic } from 'lucide-react';

/**
 * VoiceNoteButton
 *
 * Floating toolbar button to activate voice note placement mode.
 *
 * Props:
 *   active    : boolean — is placement mode currently on?
 *   recording : boolean — is a recording currently in progress?
 *   onClick   : () => void
 */
const VoiceNoteButton = ({ active, recording, onClick }) => {
    const isLive = active || recording;

    return (
        <div
            title="Voice Note (V)"
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
        >
            {/* Pulsing ring shown when placement or recording mode is active */}
            {isLive && (
                <span style={{
                    position: 'absolute',
                    inset: -3,
                    borderRadius: '50%',
                    border: `2px solid ${recording ? '#EF4444' : '#0066FF'}`,
                    animation: 'vn-btn-pulse 1.5s ease-in-out infinite',
                    pointerEvents: 'none',
                }} />
            )}

            <button
                onClick={onClick}
                style={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: isLive
                        ? (recording ? '#FEE2E2' : '#EBF5FF')
                        : 'transparent',
                    color: isLive
                        ? (recording ? '#EF4444' : '#0066FF')
                        : '#666',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                    pointerEvents: 'auto',
                    flexShrink: 0,
                }}
            >
                <Mic size={20} />
            </button>

            <style>{`
                @keyframes vn-btn-pulse {
                    0%   { transform: scale(1);   opacity: 1; }
                    70%  { transform: scale(1.3); opacity: 0; }
                    100% { transform: scale(1);   opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default VoiceNoteButton;
