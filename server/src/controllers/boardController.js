const Board = require('../models/Board');
const path = require('path');
const fs = require('fs');

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

        const updatedBoard = await board.save();
        res.json(updatedBoard);
    } else {
        res.status(404).json({ message: 'Board not found' });
    }
};

module.exports = { getBoards, createBoard, getBoardById, updateBoard, uploadDocument };
