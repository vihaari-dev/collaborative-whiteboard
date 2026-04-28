const Board = require('../models/Board');
const path = require('path');
const fs = require('fs');

// @desc    Upload voice note audio to board
// @route   POST /api/boards/:id/voice
// @access  Private
const uploadVoiceNote = async (req, res) => {
    try {
        const board = await Board.findById(req.params.id);
        if (!board) return res.status(404).json({ message: 'Board not found' });

        if (!req.file) return res.status(400).json({ message: 'No audio file uploaded' });

        // Convert the audio buffer to a Base64 Data URI so it can be stored directly in MongoDB
        const base64Audio = req.file.buffer.toString('base64');
        const dataUri = `data:${req.file.mimetype};base64,${base64Audio}`;

        const note = {
            id:        req.body.id || Date.now().toString(),
            url:       dataUri, // Store the full base64 string instead of a local file path
            x:         parseFloat(req.body.x)  || 0,
            y:         parseFloat(req.body.y)  || 0,
            label:     req.body.label          || '',
            panel:     req.body.panel          || 'canvas', // 'canvas' | 'doc'
            createdAt: new Date().toISOString(),
        };

        board.voiceNotes = [...(board.voiceNotes || []), note];
        await board.save();
        res.json(note);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error uploading voice note' });
    }
};

// @desc    Upload document to board
// @route   POST /api/boards/:id/upload
// @access  Private
const uploadDocument = async (req, res) => {
    const board = await Board.findById(req.params.id);

    if (!board) {
        return res.status(404).json({ message: 'Board not found' });
    }

    if (req.file) {
        board.documentUrl = `/uploads/${req.file.filename}`;
        await board.save();
        res.json({ documentUrl: board.documentUrl });
    } else {
        res.status(400).json({ message: 'No file uploaded' });
    }
};

// @desc    Get all boards for current user
// @route   GET /api/boards
// @access  Private
const getBoards = async (req, res) => {
    const boards = await Board.find({ user: req.user._id });
    res.json(boards);
};

// @desc    Create a new board
// @route   POST /api/boards
// @access  Private
const createBoard = async (req, res) => {
    const { title, mode } = req.body;

    if (!title) {
        return res.status(400).json({ message: 'Title is required' });
    }

    const board = await Board.create({
        user: req.user._id,
        title,
        mode: mode || 'solo',
        elements: [],
    });

    res.status(201).json(board);
};

// @desc    Get single board by ID
// @route   GET /api/boards/:id
// @access  Private
const getBoardById = async (req, res) => {
    const board = await Board.findById(req.params.id);

    if (board) {
        // In the future, check for collaborators access here
        res.json(board);
    } else {
        res.status(404).json({ message: 'Board not found' });
    }
};

// @desc    Update board elements (Save State)
// @route   PUT /api/boards/:id
// @access  Private
const updateBoard = async (req, res) => {
    const board = await Board.findById(req.params.id);

    if (board) {
        board.elements = req.body.elements || board.elements;
        board.title = req.body.title || board.title;
        if (req.body.annotations) {
            board.annotations = req.body.annotations;
        }
        if (req.body.canvasPages) {
            board.canvasPages = req.body.canvasPages;
        }
        // Voice notes are managed through their own endpoints now
        // but keep this for backward compatibility
        if (req.body.voiceNotes !== undefined) {
            board.voiceNotes = req.body.voiceNotes;
        }

        const updatedBoard = await board.save();
        res.json(updatedBoard);
    } else {
        res.status(404).json({ message: 'Board not found' });
    }
};

// @desc    Delete a single voice note from board
// @route   DELETE /api/boards/:id/voice/:noteId
// @access  Private
const deleteVoiceNote2 = async (req, res) => {
    try {
        const board = await Board.findById(req.params.id);
        if (!board) return res.status(404).json({ message: 'Board not found' });

        const noteId = req.params.noteId;
        board.voiceNotes = (board.voiceNotes || []).filter(n => n.id !== noteId);
        await board.save();
        res.json({ message: 'Voice note deleted', noteId });
    } catch (err) {
        console.error('Delete voice note error:', err.message);
        res.status(500).json({ message: 'Server error deleting voice note' });
    }
};

// @desc    Update voice note position
// @route   PATCH /api/boards/:id/voice/:noteId/position
// @access  Private
const updateVoiceNotePosition = async (req, res) => {
    try {
        const board = await Board.findById(req.params.id);
        if (!board) return res.status(404).json({ message: 'Board not found' });

        const { x, y } = req.body;
        const noteId = req.params.noteId;
        let found = false;
        board.voiceNotes = (board.voiceNotes || []).map(n => {
            if (n.id === noteId) {
                found = true;
                return { ...n, x: parseFloat(x), y: parseFloat(y) };
            }
            return n;
        });

        if (!found) return res.status(404).json({ message: 'Voice note not found' });

        board.markModified('voiceNotes');
        await board.save();
        res.json({ message: 'Position updated', noteId });
    } catch (err) {
        console.error('Update voice note position error:', err.message);
        res.status(500).json({ message: 'Server error updating voice note position' });
    }
};

module.exports = { getBoards, createBoard, getBoardById, updateBoard, uploadDocument, uploadVoiceNote, deleteVoiceNote2, updateVoiceNotePosition };
