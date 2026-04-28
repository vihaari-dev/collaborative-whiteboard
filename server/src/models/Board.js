const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    title: {
        type: String,
        required: true,
        default: 'Untitled Board',
    },
    mode: {
        type: String,
        enum: ['collaboration', 'solo', 'document'],
        default: 'solo',
    },
    elements: {
        type: Array, // Stores pure canvas data (lines, shapes)
        default: [],
    },
    documentUrl: {
        type: String, // For document mode
        default: null,
    },
    annotations: {
        type: Object, // Map of pageIndex -> elements array (PDF Overlay)
        default: {},
    },
    canvasPages: {
        type: Object, // Map of pageIndex -> elements array (Right Side Notes)
        default: {},
    },
    voiceNotes: {
        type: Array, // [{ id, url, x, y, label, createdAt, panel }]
        default: [],
    },
    collaborators: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true,
});

module.exports = mongoose.model('Board', boardSchema);
