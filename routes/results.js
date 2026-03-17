const express = require('express');
const router = express.Router();
const { queryAll, queryOne, runSql } = require('../db/database');
const { authenticate } = require('../middleware/auth');

// Calculate grade based on percentage
function calculateGrade(marks, maxMarks) {
  const percentage = (marks / maxMarks) * 100;
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}

// GET /api/results — List all results with filters
router.get('/', authenticate, (req, res) => {
  try {
    const { student_id, subject_id, semester, class: resultClass, exam_type } = req.query;
    let query = `
      SELECT r.*, s.name as student_name, s.roll_no, s.class as student_class,
             sub.name as subject_name, sub.code as subject_code, sub.max_marks,
             u.full_name as created_by_name
      FROM results r
      JOIN students s ON r.student_id = s.id
      JOIN subjects sub ON r.subject_id = sub.id
      LEFT JOIN users u ON r.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (student_id) {
      query += ' AND r.student_id = ?';
      params.push(parseInt(student_id));
    }
    if (subject_id) {
      query += ' AND r.subject_id = ?';
      params.push(parseInt(subject_id));
    }
    if (semester) {
      query += ' AND r.semester = ?';
      params.push(parseInt(semester));
    }
    if (resultClass) {
      query += ' AND s.class = ?';
      params.push(resultClass);
    }
    if (exam_type) {
      query += ' AND r.exam_type = ?';
      params.push(exam_type);
    }

    query += ' ORDER BY s.roll_no ASC, sub.code ASC';
    const results = queryAll(query, params);
    res.json({ results, total: results.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/results/analytics — Dashboard analytics
router.get('/analytics', authenticate, (req, res) => {
  try {
    const totalStudents = queryOne('SELECT COUNT(*) as count FROM students').count;
    const totalSubjects = queryOne('SELECT COUNT(*) as count FROM subjects').count;
    const totalResults = queryOne('SELECT COUNT(*) as count FROM results').count;

    const avgMarks = queryOne(`
      SELECT ROUND(AVG(r.marks_obtained * 100.0 / sub.max_marks), 1) as avg_percentage
      FROM results r JOIN subjects sub ON r.subject_id = sub.id
    `);

    const gradeDistribution = queryAll(`
      SELECT grade, COUNT(*) as count FROM results GROUP BY grade ORDER BY grade
    `);

    const topStudents = queryAll(`
      SELECT s.name, s.roll_no, s.class,
             ROUND(AVG(r.marks_obtained * 100.0 / sub.max_marks), 1) as avg_percentage
      FROM results r
      JOIN students s ON r.student_id = s.id
      JOIN subjects sub ON r.subject_id = sub.id
      GROUP BY r.student_id
      ORDER BY avg_percentage DESC
      LIMIT 5
    `);

    const recentResults = queryAll(`
      SELECT r.*, s.name as student_name, s.roll_no,
             sub.name as subject_name, sub.code as subject_code, sub.max_marks
      FROM results r
      JOIN students s ON r.student_id = s.id
      JOIN subjects sub ON r.subject_id = sub.id
      ORDER BY r.created_at DESC
      LIMIT 10
    `);

    res.json({
      stats: {
        totalStudents,
        totalSubjects,
        totalResults,
        avgPercentage: avgMarks ? (avgMarks.avg_percentage || 0) : 0
      },
      gradeDistribution,
      topStudents,
      recentResults
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/results/student/:rollNo — Public student result lookup
router.get('/student/:rollNo', (req, res) => {
  try {
    const student = queryOne('SELECT * FROM students WHERE roll_no = ?', [req.params.rollNo]);

    if (!student) {
      return res.status(404).json({ error: 'Student not found with this roll number.' });
    }

    const results = queryAll(`
      SELECT r.*, sub.name as subject_name, sub.code as subject_code, sub.max_marks
      FROM results r
      JOIN subjects sub ON r.subject_id = sub.id
      WHERE r.student_id = ?
      ORDER BY r.semester ASC, sub.code ASC
    `, [student.id]);

    // Calculate overall stats
    let totalMarks = 0, totalMaxMarks = 0;
    results.forEach(r => {
      totalMarks += r.marks_obtained;
      totalMaxMarks += r.max_marks;
    });

    const overallPercentage = totalMaxMarks > 0 ? ((totalMarks / totalMaxMarks) * 100).toFixed(1) : 0;
    const overallGrade = totalMaxMarks > 0 ? calculateGrade(totalMarks, totalMaxMarks) : 'N/A';

    res.json({
      student: {
        name: student.name,
        roll_no: student.roll_no,
        class: student.class,
        semester: student.semester
      },
      results,
      summary: {
        totalSubjects: results.length,
        totalMarks,
        totalMaxMarks,
        percentage: overallPercentage,
        grade: overallGrade
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/results — Create or update result
router.post('/', authenticate, (req, res) => {
  try {
    const { student_id, subject_id, marks_obtained, semester, exam_type, remarks } = req.body;

    if (!student_id || !subject_id || marks_obtained === undefined || !semester) {
      return res.status(400).json({ error: 'Student, subject, marks, and semester are required.' });
    }

    // Validate student and subject exist
    const student = queryOne('SELECT * FROM students WHERE id = ?', [parseInt(student_id)]);
    if (!student) return res.status(404).json({ error: 'Student not found.' });

    const subject = queryOne('SELECT * FROM subjects WHERE id = ?', [parseInt(subject_id)]);
    if (!subject) return res.status(404).json({ error: 'Subject not found.' });

    const marks = parseFloat(marks_obtained);
    if (marks < 0 || marks > subject.max_marks) {
      return res.status(400).json({ error: `Marks must be between 0 and ${subject.max_marks}.` });
    }

    const grade = calculateGrade(marks, subject.max_marks);
    const examType = exam_type || 'final';

    // Check if result already exists (upsert)
    const existing = queryOne(
      'SELECT id FROM results WHERE student_id = ? AND subject_id = ? AND semester = ? AND exam_type = ?',
      [parseInt(student_id), parseInt(subject_id), parseInt(semester), examType]
    );

    if (existing) {
      runSql(
        'UPDATE results SET marks_obtained = ?, grade = ?, remarks = ?, created_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [marks, grade, remarks || null, req.user.id, existing.id]
      );
      const result = queryOne(`
        SELECT r.*, s.name as student_name, s.roll_no,
               sub.name as subject_name, sub.code as subject_code, sub.max_marks
        FROM results r
        JOIN students s ON r.student_id = s.id
        JOIN subjects sub ON r.subject_id = sub.id
        WHERE r.id = ?
      `, [existing.id]);
      res.json({ message: 'Result updated successfully.', result });
    } else {
      const insertResult = runSql(
        'INSERT INTO results (student_id, subject_id, marks_obtained, grade, semester, exam_type, remarks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [parseInt(student_id), parseInt(subject_id), marks, grade, parseInt(semester), examType, remarks || null, req.user.id]
      );
      const result = queryOne(`
        SELECT r.*, s.name as student_name, s.roll_no,
               sub.name as subject_name, sub.code as subject_code, sub.max_marks
        FROM results r
        JOIN students s ON r.student_id = s.id
        JOIN subjects sub ON r.subject_id = sub.id
        WHERE r.id = ?
      `, [insertResult.lastInsertRowid]);
      res.status(201).json({ message: 'Result created successfully.', result });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/results/:id — Delete result
router.delete('/:id', authenticate, (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM results WHERE id = ?', [parseInt(req.params.id)]);
    if (!existing) {
      return res.status(404).json({ error: 'Result not found.' });
    }

    runSql('DELETE FROM results WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ message: 'Result deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
