const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename(req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const checkFileType = (file, cb) => {
    const filetypes = /pdf|jpg|jpeg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Images or PDFs only!');
    }
};

const checkAudioType = (file, cb) => {
    const audioMimes = /audio\/webm|audio\/ogg|audio\/mp4|audio\/mpeg|video\/webm/;
    if (audioMimes.test(file.mimetype)) {
        return cb(null, true);
    }
    cb('Audio files only (webm/ogg/mp4)!');
};

const memoryStorage = multer.memoryStorage();

const upload = multer({
    storage,
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

const audioUpload = multer({
    storage: memoryStorage,
    fileFilter: function (req, file, cb) {
        checkAudioType(file, cb);
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max for MongoDB Base64 storage
});

module.exports = { upload, audioUpload };
