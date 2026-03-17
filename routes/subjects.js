const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db/database');
const { authenticate } = require('../middleware/auth');

// GET /api/subjects — List all subjects
router.get('/', authenticate, (req, res) => {
  try {
    const { class: subjectClass, semester } = req.query;
    let query = 'SELECT * FROM subjects WHERE 1=1';
    const params = [];

    if (subjectClass) {
      query += ' AND class = ?';
      params.push(subjectClass);
    }
    if (semester) {
      query += ' AND (semester = ? OR semester IS NULL)';
      params.push(parseInt(semester));
    }

    query += ' ORDER BY code ASC';
    const subjects = queryAll(query, params);
    res.json({ subjects, total: subjects.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/subjects/:id — Get single subject
router.get('/:id', authenticate, (req, res) => {
  try {
    const subject = queryOne('SELECT * FROM subjects WHERE id = ?', [parseInt(req.params.id)]);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found.' });
    }
    res.json({ subject });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/subjects — Create subject
router.post('/', authenticate, (req, res) => {
  try {
    const { name, code, max_marks, class: subjectClass, semester } = req.body;

    if (!name || !code || !subjectClass) {
      return res.status(400).json({ error: 'Name, code, and class are required.' });
    }

    const existing = queryOne('SELECT id FROM subjects WHERE code = ?', [code.toUpperCase()]);
    if (existing) {
      return res.status(409).json({ error: 'A subject with this code already exists.' });
    }

    const result = runSql(
      'INSERT INTO subjects (name, code, max_marks, class, semester) VALUES (?, ?, ?, ?, ?)',
      [name, code.toUpperCase(), max_marks || 100, subjectClass, semester ? parseInt(semester) : null]
    );

    const subject = queryOne('SELECT * FROM subjects WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Subject added successfully.', subject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/subjects/:id — Update subject
router.put('/:id', authenticate, (req, res) => {
  try {
    const { name, code, max_marks, class: subjectClass, semester } = req.body;
    const existing = queryOne('SELECT * FROM subjects WHERE id = ?', [parseInt(req.params.id)]);

    if (!existing) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    runSql(
      `UPDATE subjects SET
        name = COALESCE(?, name),
        code = COALESCE(?, code),
        max_marks = COALESCE(?, max_marks),
        class = COALESCE(?, class),
        semester = COALESCE(?, semester)
      WHERE id = ?`,
      [
        name || null, code ? code.toUpperCase() : null,
        max_marks || null, subjectClass || null,
        semester ? parseInt(semester) : null, parseInt(req.params.id)
      ]
    );

    const subject = queryOne('SELECT * FROM subjects WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: 'Subject updated successfully.', subject });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/subjects/:id — Delete subject
router.delete('/:id', authenticate, (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM subjects WHERE id = ?', [parseInt(req.params.id)]);
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    runSql('DELETE FROM results WHERE subject_id = ?', [parseInt(req.params.id)]);
    runSql('DELETE FROM subjects WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: 'Subject deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
