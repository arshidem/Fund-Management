const mongoose = require('mongoose');       

const audioMessageSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  },
  audioUrl: {
    type: String,
    required: true
  },
  duration: {
    type: Number, // in seconds
    required: true
  },
  fileSize: Number, // in bytes
  format: String, // mp3, wav, ogg, etc.
  sampleRate: Number, // 44100, 48000, etc.
  waveform: [Number], // for audio visualization
  transcription: String, // auto-generated text
  recordingDevice: String // mobile, web, etc.
}, {
  timestamps: true
});

module.exports = mongoose.model('AudioMessage', audioMessageSchema);