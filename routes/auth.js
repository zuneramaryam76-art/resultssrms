const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryAll, queryOne, runSql } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// POST /api/auth/register — Register new user (admin only)
router.post('/register', authenticate, requireAdmin, (req, res) => {
  try {
    const { username, password, email, full_name, role } = req.body;

    if (!username || !password || !email || !full_name) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const validRoles = ['admin', 'teacher'];
    const userRole = validRoles.includes(role) ? role : 'teacher';

    // Check uniqueness
    const existing = queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = runSql(
      'INSERT INTO users (username, password, email, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, email, full_name, userRole]
    );

    res.status(201).json({
      message: 'User registered successfully.',
      user: { id: result.lastInsertRowid, username, email, full_name, role: userRole }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = queryOne('SELECT * FROM users WHERE username = ?', [username]);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/auth/me — Get current user
router.get('/me', authenticate, (req, res) => {
  try {
    const user = queryOne('SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/auth/users — List all users (admin only)
router.get('/users', authenticate, requireAdmin, (req, res) => {
  try {
    const users = queryAll('SELECT id, username, email, full_name, role, created_at FROM users');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
