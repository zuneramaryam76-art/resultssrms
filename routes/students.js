const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db/database');
const { authenticate } = require('../middleware/auth');

// GET /api/students — List all students with optional filters
router.get('/', authenticate, (req, res) => {
  try {
    const { class: studentClass, semester, search } = req.query;
    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];

    if (studentClass) {
      query += ' AND class = ?';
      params.push(studentClass);
    }
    if (semester) {
      query += ' AND semester = ?';
      params.push(parseInt(semester));
    }
    if (search) {
      query += ' AND (name LIKE ? OR roll_no LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY roll_no ASC';
    const students = queryAll(query, params);
    res.json({ students, total: students.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/students/:id — Get single student
router.get('/:id', authenticate, (req, res) => {
  try {
    const student = queryOne('SELECT * FROM students WHERE id = ?', [parseInt(req.params.id)]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    res.json({ student });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/students — Create student
router.post('/', authenticate, (req, res) => {
  try {
    const { roll_no, name, email, class: studentClass, semester, phone } = req.body;

    if (!roll_no || !name || !studentClass || !semester) {
      return res.status(400).json({ error: 'Roll number, name, class, and semester are required.' });
    }

    // Check uniqueness
    const existing = queryOne('SELECT id FROM students WHERE roll_no = ?', [roll_no]);
    if (existing) {
      return res.status(409).json({ error: 'A student with this roll number already exists.' });
    }

    const result = runSql(
      'INSERT INTO students (roll_no, name, email, class, semester, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [roll_no, name, email || null, studentClass, parseInt(semester), phone || null]
    );

    const student = queryOne('SELECT * FROM students WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ message: 'Student added successfully.', student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/students/:id — Update student
router.put('/:id', authenticate, (req, res) => {
  try {
    const { roll_no, name, email, class: studentClass, semester, phone } = req.body;
    const existing = queryOne('SELECT * FROM students WHERE id = ?', [parseInt(req.params.id)]);

    if (!existing) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    runSql(
      `UPDATE students SET
        roll_no = COALESCE(?, roll_no),
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        class = COALESCE(?, class),
        semester = COALESCE(?, semester),
        phone = COALESCE(?, phone),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        roll_no || null, name || null, email || null,
        studentClass || null, semester ? parseInt(semester) : null,
        phone || null, parseInt(req.params.id)
      ]
    );

    const student = queryOne('SELECT * FROM students WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: 'Student updated successfully.', student });
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'A student with this roll number already exists.' });
    }
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/students/:id — Delete student
router.delete('/:id', authenticate, (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM students WHERE id = ?', [parseInt(req.params.id)]);
    if (!existing) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    runSql('DELETE FROM results WHERE student_id = ?', [parseInt(req.params.id)]);
    runSql('DELETE FROM students WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: 'Student deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
