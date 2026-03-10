import io from 'socket.io-client';

let socket;

export const initiateSocketConnection = () => {
    if (socket) return socket;
    socket = io('http://localhost:5000');
    return socket;
};

export const disconnectSocket = () => {
    if (socket) socket.disconnect();
};

export const joinRoom = (roomId) => {
    if (socket) socket.emit('join-room', roomId);
};

export const subscribeToDrawings = (cb) => {
    if (!socket) return;
    socket.on('draw-stroke', (element) => {
        console.log('Received stroke');
        cb(element);
    });
};

export const emitDrawing = (roomId, element) => {
    if (socket) socket.emit('draw-stroke', { roomId, element });
};
