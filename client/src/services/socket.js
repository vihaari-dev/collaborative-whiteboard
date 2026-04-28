import { io } from 'socket.io-client';

let socket = null;

// ─────────────────────────────────────────────────────────────────────────────
// Connection lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export const initiateSocketConnection = () => {
    // Return existing connected socket
    if (socket && (socket.connected || socket.connecting)) return socket;

    // Discard stale disconnected socket
    if (socket) socket = null;

    const url = import.meta.env.PROD ? undefined : 'http://localhost:5000';
    socket = io(url, { autoConnect: true });
    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;   // ← critical: clear singleton so next mount gets a fresh socket
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Room
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Join a room.  Waits for socket.connect() if needed, then emits.
 * Calls `onJoined(data)` when the server echoes `room-joined`.
 */
export const joinRoom = (roomId, onJoined) => {
    if (!socket) return;

    const doJoin = () => {
        socket.emit('join-room', roomId);
        if (onJoined) socket.once('room-joined', onJoined);
    };

    if (socket.connected) {
        doJoin();
    } else {
        socket.once('connect', doJoin);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Drawing
// ─────────────────────────────────────────────────────────────────────────────

export const emitDrawing = (roomId, element) => {
    if (socket?.connected) socket.emit('draw-stroke', { roomId, element });
};

export const subscribeToDrawings = (cb) => {
    if (!socket) return;
    socket.off('draw-stroke');
    socket.on('draw-stroke', cb);
};

export const unsubscribeFromDrawings = () => {
    socket?.off('draw-stroke');
};

// ─────────────────────────────────────────────────────────────────────────────
// Cursors
// ─────────────────────────────────────────────────────────────────────────────

export const emitCursorMove = (roomId, x, y) => {
    if (socket?.connected) socket.emit('cursor-move', { roomId, x, y });
};

export const subscribeToCursors = (cb) => {
    if (!socket) return;
    socket.off('cursor-move');
    socket.on('cursor-move', cb);
};

export const unsubscribeFromCursors = () => {
    socket?.off('cursor-move');
};

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────

export const subscribeToUserCount = (cb) => {
    if (!socket) return;
    socket.off('room-user-count');
    socket.on('room-user-count', cb);
};

export const subscribeToUserJoined = (cb) => {
    if (!socket) return;
    socket.off('user-joined');
    socket.on('user-joined', cb);
};

export const subscribeToUserLeft = (cb) => {
    if (!socket) return;
    socket.off('user-left');
    socket.on('user-left', cb);
};

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup (call on unmount)
// ─────────────────────────────────────────────────────────────────────────────

export const cleanupRoomListeners = () => {
    if (!socket) return;
    socket.off('draw-stroke');
    socket.off('cursor-move');
    socket.off('room-user-count');
    socket.off('user-joined');
    socket.off('user-left');
    socket.off('room-joined');
};
