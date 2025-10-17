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

// Voice message specific storage
const voiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const voiceDir = path.join(UPLOAD_DIR, 'voice-messages');
    if (!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });
    cb(null, voiceDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm'; // Default to webm for voice recordings
    const name = `voice-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
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

const voiceFilter = (req, file, cb) => {
  // Allow common voice recording formats
  const allowedVoiceTypes = [
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/m4a'
  ];
  
  if (startsWith(file.mimetype, 'audio/') || allowedVoiceTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only voice audio files allowed (webm, mp4, mpeg, wav, ogg, aac, m4a)'), false);
  }
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

// Voice message upload instance (10 MB limit optimized for voice)
const uploadVoice = multer({
  storage: voiceStorage,
  fileFilter: voiceFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB for voice messages
    files: 1 // Only one voice file at a time
  }
});

// Pre-built middlewares
const uploadFiles = upload.array('files', 12); // field name 'files', max 12
const uploadSingleFile = upload.single('file'); // generic single file
const uploadImages = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFilter }).array('images', 8);
const uploadAudio = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: audioFilter }).single('audio');
const uploadVoiceMessage = uploadVoice.single('voice'); // field name 'voice'

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

// Helper: remove voice message files specifically
const removeVoiceFiles = (files) => {
  if (!files) return;
  const fileList = Array.isArray(files) ? files : (files.path ? [files] : []);
  fileList.forEach(f => {
    const p = f.path || f.filename;
    if (!p) return;
    const absolute = path.isAbsolute(p) ? p : path.join(UPLOAD_DIR, 'voice-messages', path.basename(p));
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

// Special mapper for voice messages
const mapVoiceFileToAttachment = (file) => {
  if (!file) return null;
  
  return {
    type: 'voice',
    url: `/uploads/voice-messages/${path.basename(file.path)}`,
    filename: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    duration: 0, // Will be set by the controller
    waveform: [] // Will be set by the controller
  };
};

// Get file type for voice message detection
const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.includes('pdf') || mimetype.includes('document') || mimetype.includes('text/')) return 'document';
  if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('7z')) return 'archive';
  return 'other';
};

// Get voice message specific file type
const getVoiceFileType = (mimetype) => {
  const voiceFormats = {
    'audio/webm': 'webm',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
    'audio/m4a': 'm4a'
  };
  return voiceFormats[mimetype] || 'audio';
};

module.exports = {
  UPLOAD_DIR,
  uploadFiles,
  uploadSingleFile,
  uploadImages,
  uploadAudio,
  uploadVoice: uploadVoiceMessage, // Export as uploadVoice for consistency
  removeUploadedFiles,
  removeVoiceFiles,
  mapFilesToAttachmentObjects,
  mapVoiceFileToAttachment,
  getFileType,
  getVoiceFileType
};