const express = require('express');
const router = express.router ? express.router : express.Router();
const { getBoards, createBoard, getBoardById, updateBoard, uploadDocument } = require('../controllers/boardController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.route('/').get(protect, getBoards).post(protect, createBoard);
router.route('/:id').get(protect, getBoardById).put(protect, updateBoard);
router.route('/:id/upload').post(protect, upload.single('document'), uploadDocument);

module.exports = router;
