const express = require('express');
const router = express.Router();
const {
  getAllNotes,
  getUserNotes,
  createNote,
  updateNote,
  deleteNote
} = require('../controllers/adminNoteController');

// Admin notes routes
router.get('/', getAllNotes);
router.get('/user/:userId', getUserNotes);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

module.exports = router;