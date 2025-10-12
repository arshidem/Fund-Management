// utils/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Generic disk storage with unique filenames
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});

// Allowed types helpers
const startsWith = (mimetype, prefix) => mimetype && mimetype.startsWith(prefix);

const imageFilter = (req, file, cb) => {
  if (startsWith(file.mimetype, 'image/')) cb(null, true);
  else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only image files allowed'), false);
};

const audioFilter = (req, file, cb) => {
  if (startsWith(file.mimetype, 'audio/')) cb(null, true);
  else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only audio files allowed'), false);
};

const genericFileFilter = (allowedPrefixes = ['image/', 'video/', 'audio/', 'application/']) => (req, file, cb) => {
  const ok = allowedPrefixes.some(p => startsWith(file.mimetype, p));
  if (ok) cb(null, true);
  else cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'File type not allowed'), false);
};

// Default upload instance (20 MB per file)
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// Pre-built middlewares
const uploadFiles = upload.array('files', 12); // field name 'files', max 12
const uploadSingleFile = upload.single('file'); // generic single file
const uploadImages = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFilter }).array('images', 8);
const uploadAudio = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: audioFilter }).single('audio');

// Helper: remove one file path or array of files (useful on errors)
const removeUploadedFiles = (files) => {
  if (!files) return;
  // req.files (array) or req.file (single) or array of paths
  const fileList = Array.isArray(files) ? files : (files.path ? [files] : []);
  fileList.forEach(f => {
    const p = f.path || f.filename || (f && f.url && path.join(UPLOAD_DIR, path.basename(f.url)));
    if (!p) return;
    const absolute = path.isAbsolute(p) ? p : path.join(UPLOAD_DIR, path.basename(p));
    if (fs.existsSync(absolute)) {
      try { fs.unlinkSync(absolute); } catch (err) { /* ignore */ }
    }
  });
};

// Convenience to build file metadata used by your controllers
const mapFilesToAttachmentObjects = (files) => {
  if (!files) return [];
  // multer .array -> files is array, .single -> multer sets req.file (object)
  const arr = Array.isArray(files) ? files : [files];
  return arr.map(f => ({
    type: (f.mimetype && f.mimetype.startsWith('image/')) ? 'image'
          : (f.mimetype && f.mimetype.startsWith('video/')) ? 'video'
          : (f.mimetype && f.mimetype.startsWith('audio/')) ? 'audio'
          : (f.mimetype && (f.mimetype.includes('pdf') || f.mimetype.includes('msword') || f.mimetype.includes('officedocument'))) ? 'document'
          : 'other',
    url: `/uploads/${path.basename(f.path)}`,
    filename: f.originalname,
    size: f.size,
    mimeType: f.mimetype
  }));
};

module.exports = {
  UPLOAD_DIR,
  uploadFiles,
  uploadSingleFile,
  uploadImages,
  uploadAudio,
  removeUploadedFiles,
  mapFilesToAttachmentObjects,
};
