import { useState, useRef, useEffect, useCallback } from 'react';
import Draggable from 'react-draggable';
import { Play, Pause, Square, X } from 'lucide-react';

/**
 * VoiceNoteItem
 *
 * A single draggable voice note card rendered in screen space.
 *
 * Props:
 *   note          : { id, audioUrl, duration } — the voice note data
 *   screenX       : number — initial screen X position
 *   screenY       : number — initial screen Y position
 *   isRecording   : boolean — this note is currently being recorded
 *   recDuration   : number — seconds elapsed during recording
 *   onStop        : () => void — user clicked stop during recording
 *   onDelete      : (id) => void
 *   onDragStop    : (id, deltaX, deltaY) => void — drag ended, delta in screen px
 */
const VoiceNoteItem = ({
    note,
    screenX,
    screenY,
    isRecording = false,
    recDuration = 0,
    onStop,
    onDelete,
    onDragStop,
}) => {
    const [playState, setPlayState] = useState('idle'); // 'idle' | 'playing' | 'paused'
    const [progress,  setProgress]  = useState(0);
    const [hovered,   setHovered]   = useState(false);
    const audioRef   = useRef(null);
    const nodeRef    = useRef(null); // for Draggable to avoid findDOMNode

    // Resolve audio source: prefer audioUrl (frontend), fallback to url (from DB)
    const audioSrc = note.audioUrl || note.url || null;

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
    }, []);

    // Reset audio when note url changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = audioSrc || '';
            audioRef.current.load();
            setPlayState('idle');
            setProgress(0);
        }
    }, [audioSrc]);

    const togglePlay = useCallback((e) => {
        e.stopPropagation();
        if (!audioSrc) return;

        if (!audioRef.current) {
            const audio = new Audio(audioSrc);
            audioRef.current = audio;

            audio.ontimeupdate = () => {
                if (audio.duration && isFinite(audio.duration)) {
                    setProgress(audio.currentTime / audio.duration);
                }
            };
            audio.onended = () => {
                setPlayState('idle');
                setProgress(0);
            };
            audio.onerror = () => {
                console.error('[VoiceNoteItem] Audio playback error');
                setPlayState('idle');
            };
        }

        if (playState === 'playing') {
            audioRef.current.pause();
            setPlayState('paused');
        } else {
            audioRef.current.play().catch(err => {
                console.error('[VoiceNoteItem] play() failed:', err);
                setPlayState('idle');
            });
            setPlayState('playing');
        }
    }, [audioSrc, playState]);

    const handleDelete = useCallback((e) => {
        e.stopPropagation();
        if (audioRef.current) audioRef.current.pause();
        onDelete(note.id);
    }, [note.id, onDelete]);

    const handleStop = useCallback((e) => {
        e.stopPropagation();
        if (onStop) onStop();
    }, [onStop]);

    const handleDragStop = useCallback((_, data) => {
        if (onDragStop) onDragStop(note.id, data.x, data.y);
    }, [note.id, onDragStop]);

    const fmt = (sec) => {
        const s = Math.floor(sec) % 60;
        const m = Math.floor(sec / 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    // ─── Recording State ───────────────────────────────────────────────────────
    if (isRecording) {
        return (
            <div
                ref={nodeRef}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                    position: 'absolute',
                    left: screenX,
                    top: screenY,
                    transform: 'translate(-50%, calc(-100% - 8px))',
                    zIndex: 9999,
                    pointerEvents: 'auto',
                    userSelect: 'none',
                }}
            >
                <div
                    onClick={handleStop}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'white',
                        borderRadius: 24,
                        padding: '6px 12px 6px 8px',
                        boxShadow: '0 2px 16px rgba(0,0,0,0.18), 0 0 0 2px #EF4444',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                    }}
                >
                    {/* Pulsing stop button */}
                    <div style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: '#EF4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'vn-pulse 1.4s ease-in-out infinite',
                        flexShrink: 0,
                    }}>
                        <Square size={10} color="white" fill="white" />
                    </div>

                    <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', letterSpacing: '0.05em', minWidth: 32 }}>
                        {fmt(recDuration)}
                    </span>

                    <WaveformBars active />

                    <span style={{ fontSize: 11, color: '#999', marginLeft: 2 }}>Click to stop</span>
                </div>

                {/* Stem */}
                <Stem color="#EF4444" />
            </div>
        );
    }

    // ─── Playback / Idle State ─────────────────────────────────────────────────
    const dur = note.duration != null ? fmt(note.duration) : null;
    const isPlaying = playState === 'playing';

    return (
        <Draggable
            nodeRef={nodeRef}
            defaultPosition={{ x: 0, y: 0 }}
            onStop={handleDragStop}
            cancel="button"
        >
            <div
                ref={nodeRef}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    position: 'absolute',
                    left: screenX,
                    top: screenY,
                    transform: 'translate(-50%, calc(-100% - 8px))',
                    zIndex: hovered ? 200 : 100,
                    pointerEvents: 'auto',
                    userSelect: 'none',
                    cursor: 'grab',
                }}
            >
                <div
                    onClick={e => e.stopPropagation()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'white',
                        borderRadius: 24,
                        padding: '5px 10px 5px 6px',
                        boxShadow: hovered
                            ? '0 4px 20px rgba(0,0,0,0.18), 0 0 0 1.5px #0066FF'
                            : '0 2px 10px rgba(0,0,0,0.12), 0 0 0 1px #E0E7F0',
                        whiteSpace: 'nowrap',
                        transition: 'box-shadow 0.15s',
                    }}
                >
                    {/* Play / Pause button */}
                    <button
                        onClick={togglePlay}
                        style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: isPlaying ? '#0066FF' : '#EBF3FF',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'background 0.15s',
                        }}
                    >
                        {isPlaying
                            ? <Pause size={11} color="white" />
                            : <Play  size={11} color="#0066FF" style={{ marginLeft: 1 }} />
                        }
                    </button>

                    {/* Waveform + progress */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <WaveformBars active={isPlaying} />
                        {isPlaying && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                left: `${progress * 100}%`,
                                background: 'rgba(255,255,255,0.7)',
                                pointerEvents: 'none',
                                transition: 'left 0.05s linear',
                            }} />
                        )}
                    </div>

                    {/* Duration label */}
                    {dur && (
                        <span style={{ fontSize: 11, color: '#888', letterSpacing: '0.02em', minWidth: 28 }}>
                            {dur}
                        </span>
                    )}

                    {/* Delete button — only on hover */}
                    {hovered && (
                        <button
                            onClick={handleDelete}
                            style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: '#FEE2E2',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginLeft: 2,
                                transition: 'background 0.15s',
                            }}
                        >
                            <X size={9} color="#EF4444" />
                        </button>
                    )}
                </div>

                {/* Stem */}
                <Stem color={hovered ? '#0066FF' : '#E0E7F0'} />
            </div>
        </Draggable>
    );
};

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Animated waveform bars */
const WaveformBars = ({ active }) => {
    const heights = [3, 6, 9, 6, 4, 7, 5, 3];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 14 }}>
            {heights.map((h, i) => (
                <div key={i} style={{
                    width: 2.5,
                    height: active ? h : Math.max(h - 4, 2),
                    borderRadius: 2,
                    background: active ? '#0066FF' : '#C5D0E0',
                    animation: active ? `vn-wave ${0.55 + i * 0.07}s ease-in-out infinite alternate` : 'none',
                    animationDelay: `${i * 0.06}s`,
                    transition: 'height 0.2s',
                }} />
            ))}
        </div>
    );
};

/** Downward pointing stem triangle */
const Stem = ({ color }) => (
    <div style={{
        position: 'absolute',
        bottom: -7,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `7px solid ${color}`,
        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.08))',
        transition: 'border-top-color 0.15s',
    }} />
);

export default VoiceNoteItem;
