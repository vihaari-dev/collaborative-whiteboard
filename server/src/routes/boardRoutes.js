const express = require('express');
const router = express.Router();
const { getBoards, createBoard, getBoardById, updateBoard, uploadDocument, uploadVoiceNote, deleteVoiceNote2, updateVoiceNotePosition } = require('../controllers/boardController');
const { protect } = require('../middleware/authMiddleware');
const { upload, audioUpload } = require('../middleware/uploadMiddleware');

router.route('/').get(protect, getBoards).post(protect, createBoard);
router.route('/:id').get(protect, getBoardById).put(protect, updateBoard);
router.route('/:id/upload').post(protect, upload.single('document'), uploadDocument);
router.route('/:id/voice').post(protect, audioUpload.single('audio'), uploadVoiceNote);
router.route('/:id/voice/:noteId').delete(protect, deleteVoiceNote2);
router.route('/:id/voice/:noteId/position').patch(protect, updateVoiceNotePosition);

module.exports = router;
