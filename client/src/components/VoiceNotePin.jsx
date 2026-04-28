import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Play, Pause, X, Square } from 'lucide-react';

/**
 * VoiceNotePin
 *
 * A single draggable voice note pin rendered over the canvas (in screen space).
 * Props:
 *   note      : { id, url, x, y, label, createdAt, duration }
 *   onDelete  : (id) => void
 *   isRecording: bool  — this pin is the one being recorded into
 *   recDuration: number — seconds elapsed during recording
 *   onStopRecording: () => void - called when user clicks the recording pin to stop
 */
const VoiceNotePin = ({ note, onDelete, isRecording = false, recDuration = 0, onStopRecording }) => {
    const [playState, setPlayState] = useState('idle'); // 'idle' | 'playing' | 'paused'
    const [progress,  setProgress]  = useState(0);      // 0–1
    const [hovered,   setHovered]   = useState(false);
    const audioRef = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        };
    }, []);

    const togglePlay = useCallback((e) => {
        e.stopPropagation();
        // Resolve audio source: prefer audioUrl (frontend), fallback to url (from DB)
        const audioSrc = note.audioUrl || note.url;
        if (!audioSrc) return;

        // If it's a local /uploads path, prepend server origin. Data URIs and blob URLs work as-is.
        const src = audioSrc.startsWith('/uploads')
            ? `http://localhost:5000${audioSrc}`
            : audioSrc;

        if (!audioRef.current) {
            const audio = new Audio(src);
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
            audio.onerror = (err) => {
                console.error("Audio playback error:", err);
                setPlayState('idle');
                setProgress(0);
            };
        }

        if (playState === 'playing') {
            audioRef.current.pause();
            setPlayState('paused');
        } else {
            // Play returns a promise we must catch
            audioRef.current.play().catch(e => console.error("Play failed", e));
            setPlayState('playing');
        }
    }, [note.audioUrl, note.url, playState]);

    const handleDelete = useCallback((e) => {
        e.stopPropagation();
        onDelete(note.id);
    }, [note.id, onDelete]);

    const fmt = (sec) => {
        const s = Math.floor(sec) % 60;
        const m = Math.floor(sec / 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    // --- Recording state ---
    if (isRecording) {
        return (
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    if (onStopRecording) onStopRecording();
                }}
                style={{
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'white',
                    borderRadius: 20,
                    padding: '4px 10px 4px 6px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.18), 0 0 0 2px #EF4444',
                    pointerEvents: 'auto', // Must be auto to catch clicks
                    transform: 'translate(-50%, -100%) translateY(-6px)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    zIndex: 9999, // Ensure it's on top
                }}
            >
                {/* Stop button / Pulsing red mic */}
                <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#EF4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'vn-pulse 1.5s ease-in-out infinite',
                }}>
                    <Square size={10} color="white" fill="white" />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', letterSpacing: '0.04em' }}>
                    {fmt(recDuration)}
                </span>
                <WaveformBars active />
            </div>
        );
    }

    // --- Uploading state (waiting for server) ---
    if (note.id === '__uploading__') {
       return (
            <div
                style={{
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'white',
                    borderRadius: 20,
                    padding: '4px 10px 4px 6px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                    pointerEvents: 'none',
                    transform: 'translate(-50%, -100%) translateY(-6px)',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                }}
            >
                <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{ width: 10, height: 10, border: '2px solid #9CA3AF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'vn-spin 1s linear infinite' }} />
                </div>
                <span style={{ fontSize: 11, color: '#6B7280' }}>Saving...</span>
            </div>
       );
    }

    // --- Idle / Playing / Paused state ---
    const dur = note.duration ? fmt(note.duration) : null;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'white',
                borderRadius: 20,
                padding: '3px 8px 3px 4px',
                boxShadow: hovered
                    ? '0 4px 18px rgba(0,0,0,0.18), 0 0 0 1.5px #0066FF'
                    : '0 2px 10px rgba(0,0,0,0.13), 0 0 0 1px #E0E0E0',
                transform: 'translate(-50%, -100%) translateY(-6px)',
                whiteSpace: 'nowrap',
                cursor: 'default',
                transition: 'box-shadow 0.15s',
                zIndex: hovered ? 20 : 10,
                userSelect: 'none',
                pointerEvents: 'auto',
            }}
            onClick={e => e.stopPropagation()}
        >
            {/* Play/pause button */}
            <button
                onClick={togglePlay}
                style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: playState === 'playing' ? '#0066FF' : '#F0F4FF',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'background 0.15s',
                }}
            >
                {playState === 'playing'
                    ? <Pause size={10} color="white" />
                    : <Play  size={10} color="#0066FF" style={{ marginLeft: 1 }} />
                }
            </button>

            {/* Waveform / progress */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <WaveformBars active={playState === 'playing'} />
                {/* progress overlay */}
                {playState !== 'idle' && (
                    <div style={{
                        position: 'absolute', inset: 0, left: `${progress * 100}%`,
                        background: 'rgba(255,255,255,0.65)',
                        pointerEvents: 'none',
                    }} />
                )}
            </div>

            {/* Duration */}
            {dur && (
                <span style={{ fontSize: 10, color: '#888', letterSpacing: '0.03em' }}>{dur}</span>
            )}

            {/* Label */}
            {note.label && (
                <span style={{ fontSize: 10, color: '#444', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {note.label}
                </span>
            )}

            {/* Delete button — visible on hover */}
            {hovered && (
                <button
                    onClick={handleDelete}
                    style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#FEE2E2', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginLeft: 2,
                    }}
                >
                    <X size={9} color="#EF4444" />
                </button>
            )}

            {/* Stem */}
            <div style={{
                position: 'absolute',
                bottom: -6, left: '50%',
                transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft:  '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop:   '6px solid white',
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))',
            }} />
        </div>
    );
};

/** Mini animated waveform bars */
const WaveformBars = ({ active }) => {
    const bars = [3, 5, 7, 5, 3, 6, 4];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 14 }}>
            {bars.map((h, i) => (
                <div key={i} style={{
                    width: 2, height: active ? h : Math.max(h - 3, 2),
                    borderRadius: 2,
                    background: active ? '#0066FF' : '#C0C8D8',
                    animation: active ? `vn-wave ${0.6 + i * 0.08}s ease-in-out infinite alternate` : 'none',
                    animationDelay: `${i * 0.07}s`,
                    transition: 'height 0.2s',
                }} />
            ))}
        </div>
    );
};

export default VoiceNotePin;
