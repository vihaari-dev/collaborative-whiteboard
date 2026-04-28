import { useState, useRef, useCallback } from 'react';

/**
 * useVoiceRecorder
 * Clean, server-independent voice recording hook.
 *
 * States: 'idle' | 'recording'
 *
 * Returns:
 *   state    : 'idle' | 'recording'
 *   duration : seconds elapsed while recording
 *   error    : string | null — last error message
 *   start()  : () => Promise<boolean> — resolves true if mic access granted
 *   stop()   : () => Promise<Blob | null> — stops and returns the audio blob
 *   cancel() : () => void — stops without producing a blob, resets state
 */
export const useVoiceRecorder = () => {
    const [state,    setState]    = useState('idle');
    const [duration, setDuration] = useState(0);
    const [error,    setError]    = useState(null);

    const mediaRecorderRef = useRef(null);
    const chunksRef        = useRef([]);
    const streamRef        = useRef(null);
    const timerRef         = useRef(null);

    const _clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const _stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    /** Begin mic capture and recording. Returns true on success. */
    const start = useCallback(async () => {
        setError(null);
        setDuration(0);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Pick the best supported MIME type
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : '';

            const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
            mediaRecorderRef.current = mr;
            chunksRef.current = [];

            mr.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };

            mr.start(100); // collect in 100ms chunks for reliable data
            setState('recording');

            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

            return true;
        } catch (err) {
            console.error('[useVoiceRecorder] mic error:', err);
            const msg = err.name === 'NotAllowedError'
                ? 'Microphone access denied. Please allow mic access and try again.'
                : err.message || 'Could not access microphone.';
            setError(msg);
            setState('idle');
            _stopStream();
            return false;
        }
    }, []);

    /** Stop recording. Returns a Promise<Blob | null>. Resets state to 'idle'. */
    const stop = useCallback(() => {
        _clearTimer();

        return new Promise(resolve => {
            const mr = mediaRecorderRef.current;
            if (!mr || mr.state === 'inactive') {
                _stopStream();
                setState('idle');
                setDuration(0);
                resolve(null);
                return;
            }

            mr.onstop = () => {
                const blob = new Blob(chunksRef.current, {
                    type: mr.mimeType || 'audio/webm',
                });
                chunksRef.current = [];
                _stopStream();
                setState('idle');
                // Do NOT reset duration here — the caller reads it before stop()
                resolve(blob.size > 0 ? blob : null);
            };

            mr.stop();
        });
    }, []);

    /** Cancel without producing output */
    const cancel = useCallback(() => {
        _clearTimer();
        const mr = mediaRecorderRef.current;
        if (mr && mr.state !== 'inactive') {
            mr.onstop = null; // Suppress onstop handler
            mr.stop();
        }
        chunksRef.current = [];
        _stopStream();
        setState('idle');
        setDuration(0);
        setError(null);
    }, []);

    return { state, duration, error, start, stop, cancel };
};
