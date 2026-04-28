const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const boardRoutes = require('./src/routes/boardRoutes');

dotenv.config();

// Hardcoded environment variables for Railway deployment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://vundavallivihaari_db_user:8SdKzYadbimjqKAI@notodbcluster.olivm5n.mongodb.net/?appName=notodbcluster';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';
process.env.PORT = process.env.PORT || 5000;

connectDB();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);

// Serve frontend client
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/dist')));
    app.get(/.*/, (req, res) => {
        res.sendFile(path.resolve(__dirname, '../client', 'dist', 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('API is running...');
    });
}

// Make uploads folder static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------------------------------------------------------------------------
// Socket.IO — In-Memory Collaboration
// ---------------------------------------------------------------------------
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST'],
    },
});

// Colour palette cycled per new user in a room
const PALETTE = [
    '#FF3B5C', '#0066FF', '#FF9500', '#8E55EA',
    '#00C7BE', '#FF2D55', '#5856D6', '#34C759',
];

const ADJECTIVES = ['Swift', 'Bold', 'Calm', 'Deft', 'Keen', 'Bright', 'Sharp', 'Wild'];
const NOUNS     = ['Fox', 'Owl', 'Wolf', 'Hawk', 'Bear', 'Lynx', 'Puma', 'Kite'];

const randomName = () =>
    `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} ${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;

/**
 * rooms[roomId] = {
 *   sockets : Set<socketId>,
 *   users   : Map<socketId, { id, name, color, cursor: {x,y} }>
 *   colorIdx: number   — rolling colour cursor
 * }
 */
const rooms = {};

io.on('connection', (socket) => {
    console.log('[socket] connected:', socket.id);

    let currentRoom = null;
    let myName      = null;
    let myColor     = null;

    // ── JOIN ROOM ──────────────────────────────────────────────────────────
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        currentRoom = roomId;

        if (!rooms[roomId]) {
            rooms[roomId] = { sockets: new Set(), users: new Map(), colorIdx: 0 };
        }

        const room = rooms[roomId];

        // Assign stable identity
        myColor = PALETTE[room.colorIdx % PALETTE.length];
        room.colorIdx++;
        myName  = randomName();

        room.sockets.add(socket.id);
        room.users.set(socket.id, {
            id:     socket.id,
            name:   myName,
            color:  myColor,
            cursor: { x: 0, y: 0 },
        });

        const count         = room.sockets.size;
        const existingUsers = [...room.users.values()].filter(u => u.id !== socket.id);

        console.log(`[room:${roomId}] "${myName}" joined. users=${count}`);

        // Tell the new user: their identity + a snapshot of who else is here
        socket.emit('room-joined', {
            myId:   socket.id,
            myName,
            myColor,
            users:  existingUsers,
            count,
        });

        // Tell everyone else: new user arrived
        socket.to(roomId).emit('user-joined', {
            id:     socket.id,
            name:   myName,
            color:  myColor,
            cursor: { x: 0, y: 0 },
        });

        // Broadcast updated count to all
        io.to(roomId).emit('room-user-count', count);
    });

    // ── DRAWING ────────────────────────────────────────────────────────────
    socket.on('draw-stroke', ({ roomId, element }) => {
        socket.to(roomId).emit('draw-stroke', element);
    });

    // ── CURSOR MOVE ────────────────────────────────────────────────────────
    socket.on('cursor-move', ({ roomId, x, y }) => {
        if (!currentRoom || !rooms[roomId]) return;
        const user = rooms[roomId].users.get(socket.id);
        if (user) user.cursor = { x, y };

        // Broadcast to everyone else in the room
        socket.to(roomId).emit('cursor-move', {
            id:    socket.id,
            name:  myName,
            color: myColor,
            x,
            y,
        });
    });

    // ── DISCONNECT ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        console.log(`[socket] disconnected: ${socket.id} ("${myName}")`);
        if (currentRoom && rooms[currentRoom]) {
            const room = rooms[currentRoom];
            room.sockets.delete(socket.id);
            room.users.delete(socket.id);

            const count = room.sockets.size;
            console.log(`[room:${currentRoom}] "${myName}" left. users=${count}`);

            io.to(currentRoom).emit('room-user-count', count);
            io.to(currentRoom).emit('user-left', socket.id);

            if (count === 0) {
                delete rooms[currentRoom];
                console.log(`[room:${currentRoom}] cleaned up (empty)`);
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
