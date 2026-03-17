// ===== STUDENT RESULT MANAGEMENT SYSTEM — FRONTEND APP =====

const API_BASE = '/api';
let currentUser = null;
let currentPage = 'dashboard';

// ===== API SERVICE =====
const api = {
  getToken() {
    return localStorage.getItem('srms_token');
  },

  setToken(token) {
    localStorage.setItem('srms_token', token);
  },

  clearToken() {
    localStorage.removeItem('srms_token');
    localStorage.removeItem('srms_user');
  },

  async request(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers }
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          this.clearToken();
          showLogin();
        }
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  get(endpoint) { return this.request(endpoint); },
  post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
};

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '✅'}</span>
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4000);
}

// ===== MODAL =====
function showModal(title, bodyHtml, footerHtml = '') {
  const container = document.getElementById('modalContainer');
  container.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    </div>
  `;
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
}

function closeModal() {
  document.getElementById('modalContainer').innerHTML = '';
}

// ===== AUTH =====
function showLogin() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('appContainer').classList.remove('active');
  currentUser = null;
}

function showApp(user) {
  currentUser = user;
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('appContainer').classList.add('active');

  // Update user display
  document.getElementById('userName').textContent = user.full_name;
  document.getElementById('userRole').textContent = user.role;
  document.getElementById('userAvatar').textContent = user.full_name.charAt(0).toUpperCase();

  // Show admin nav
  if (user.role === 'admin') {
    document.getElementById('adminNavLabel').style.display = '';
    document.getElementById('navUsers').style.display = '';
  } else {
    document.getElementById('adminNavLabel').style.display = 'none';
    document.getElementById('navUsers').style.display = 'none';
  }

  navigateTo('dashboard');
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errDiv = document.getElementById('loginError');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span>';
  errDiv.style.display = 'none';

  try {
    const data = await api.post('/auth/login', { username, password });
    api.setToken(data.token);
    localStorage.setItem('srms_user', JSON.stringify(data.user));
    showApp(data.user);
    showToast(`Welcome back, ${data.user.full_name}!`);
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  api.clearToken();
  showLogin();
  showToast('Logged out successfully', 'warning');
});

// ===== NAVIGATION =====
function navigateTo(page) {
  currentPage = page;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Show correct page section
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.remove('active');
  });

  const titles = {
    dashboard: 'Dashboard',
    students: 'Students',
    subjects: 'Subjects',
    results: 'Results',
    lookup: 'Student Lookup',
    users: 'User Management'
  };

  const pageElement = document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1));
  if (pageElement) pageElement.classList.add('active');
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

  // Load page data
  const loaders = {
    dashboard: loadDashboard,
    students: loadStudents,
    subjects: loadSubjects,
    results: loadResults,
    users: loadUsers
  };
  if (loaders[page]) loaders[page]();

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// Mobile menu
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
});

document.getElementById('sidebarOverlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
});

// ===== DASHBOARD =====
async function loadDashboard() {
  try {
    const data = await api.get('/results/analytics');
    const { stats, gradeDistribution, topStudents, recentResults } = data;

    // Stats cards
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card primary">
        <div class="stat-card-header">
          <span class="stat-label">Total Students</span>
          <div class="stat-icon">👨‍🎓</div>
        </div>
        <div class="stat-value">${stats.totalStudents}</div>
        <div class="stat-sub">Registered students</div>
      </div>
      <div class="stat-card success">
        <div class="stat-card-header">
          <span class="stat-label">Total Subjects</span>
          <div class="stat-icon">📚</div>
        </div>
        <div class="stat-value">${stats.totalSubjects}</div>
        <div class="stat-sub">Active subjects</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-card-header">
          <span class="stat-label">Total Results</span>
          <div class="stat-icon">📝</div>
        </div>
        <div class="stat-value">${stats.totalResults}</div>
        <div class="stat-sub">Results recorded</div>
      </div>
      <div class="stat-card info">
        <div class="stat-card-header">
          <span class="stat-label">Avg Percentage</span>
          <div class="stat-icon">📊</div>
        </div>
        <div class="stat-value">${stats.avgPercentage}%</div>
        <div class="stat-sub">Overall average</div>
      </div>
    `;

    // Top students
    const topList = document.getElementById('topStudentsList');
    if (topStudents.length === 0) {
      topList.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div><p>No results data yet</p></div>';
    } else {
      topList.innerHTML = topStudents.map((s, i) => `
        <div class="top-student-item">
          <div class="rank-badge ${i < 3 ? `rank-${i + 1}` : 'rank-other'}">${i + 1}</div>
          <div class="top-student-info">
            <div class="ts-name">${escapeHtml(s.name)}</div>
            <div class="ts-details">${escapeHtml(s.roll_no)} · ${escapeHtml(s.class)}</div>
          </div>
          <div class="ts-percentage">${s.avg_percentage}%</div>
        </div>
      `).join('');
    }

    // Grade distribution
    const gradeDiv = document.getElementById('gradeDistribution');
    if (gradeDistribution.length === 0) {
      gradeDiv.innerHTML = '<div class="empty-state"><div class="empty-icon">📈</div><p>No grade data yet</p></div>';
    } else {
      const total = gradeDistribution.reduce((sum, g) => sum + g.count, 0);
      gradeDiv.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;">
        ${gradeDistribution.map(g => {
          const pct = ((g.count / total) * 100).toFixed(1);
          return `
            <div style="display:flex;align-items:center;gap:12px;">
              <span class="badge badge-grade ${getGradeBadgeClass(g.grade)}" style="min-width:42px;">${g.grade}</span>
              <div style="flex:1;height:8px;background:var(--bg-glass);border-radius:4px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:var(--gradient-primary);border-radius:4px;transition:width 0.6s ease;"></div>
              </div>
              <span style="font-size:12px;color:var(--text-muted);min-width:40px;text-align:right;">${g.count} (${pct}%)</span>
            </div>
          `;
        }).join('')}
      </div>`;
    }

    // Recent results
    const tbody = document.getElementById('recentResultsBody');
    if (recentResults.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No results yet</td></tr>';
    } else {
      tbody.innerHTML = recentResults.map(r => `
        <tr>
          <td class="td-name">${escapeHtml(r.student_name)}</td>
          <td>${escapeHtml(r.roll_no)}</td>
          <td>${escapeHtml(r.subject_name)} (${escapeHtml(r.subject_code)})</td>
          <td>${r.marks_obtained}/${r.max_marks}</td>
          <td><span class="badge badge-grade ${getGradeBadgeClass(r.grade)}">${r.grade}</span></td>
          <td style="color:var(--text-muted);font-size:12px;">${formatDate(r.created_at)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

// ===== STUDENTS =====
async function loadStudents() {
  try {
    const search = document.getElementById('studentSearch').value;
    const cls = document.getElementById('studentClassFilter').value;
    let query = '/students?';
    if (search) query += `search=${encodeURIComponent(search)}&`;
    if (cls) query += `class=${encodeURIComponent(cls)}&`;

    const data = await api.get(query);
    const tbody = document.getElementById('studentsTableBody');

    // Populate class filter with unique classes
    const classes = [...new Set(data.students.map(s => s.class))];
    const classFilter = document.getElementById('studentClassFilter');
    const currentVal = classFilter.value;
    classFilter.innerHTML = '<option value="">All Classes</option>' +
      classes.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join('');

    if (data.students.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👨‍🎓</div><h4>No Students Found</h4><p>Add your first student to get started</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = data.students.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.roll_no)}</strong></td>
        <td class="td-name">${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.class)}</td>
        <td>Sem ${s.semester}</td>
        <td style="color:var(--text-muted)">${s.email || '—'}</td>
        <td style="color:var(--text-muted)">${s.phone || '—'}</td>
        <td>
          <div class="td-actions">
            <button class="btn-icon" onclick="editStudent(${s.id})" title="Edit">✏️</button>
            <button class="btn-icon danger" onclick="deleteStudent(${s.id}, '${escapeHtml(s.name)}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load students: ' + err.message, 'error');
  }
}

// Debounced search
let studentSearchTimeout;
document.getElementById('studentSearch').addEventListener('input', () => {
  clearTimeout(studentSearchTimeout);
  studentSearchTimeout = setTimeout(loadStudents, 300);
});
document.getElementById('studentClassFilter').addEventListener('change', loadStudents);

document.getElementById('addStudentBtn').addEventListener('click', () => showStudentModal());

function showStudentModal(student = null) {
  const isEdit = !!student;
  showModal(isEdit ? 'Edit Student' : 'Add New Student', `
    <form id="studentForm">
      <div class="form-grid">
        <div class="form-group">
          <label>Roll Number <span class="required">*</span></label>
          <input type="text" class="form-control" id="sRollNo" value="${student?.roll_no || ''}" placeholder="e.g., CS2024001" required>
        </div>
        <div class="form-group">
          <label>Full Name <span class="required">*</span></label>
          <input type="text" class="form-control" id="sName" value="${student?.name || ''}" placeholder="Full name" required>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Class <span class="required">*</span></label>
          <input type="text" class="form-control" id="sClass" value="${student?.class || ''}" placeholder="e.g., CSE-A, ECE-B" required>
        </div>
        <div class="form-group">
          <label>Semester <span class="required">*</span></label>
          <select class="form-control" id="sSemester" required>
            ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}" ${student?.semester === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Email</label>
          <input type="email" class="form-control" id="sEmail" value="${student?.email || ''}" placeholder="student@example.com">
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="text" class="form-control" id="sPhone" value="${student?.phone || ''}" placeholder="Phone number">
        </div>
      </div>
    </form>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveStudent(${student?.id || 'null'})">${isEdit ? 'Update' : 'Add'} Student</button>
  `);
}

async function saveStudent(id) {
  const data = {
    roll_no: document.getElementById('sRollNo').value.trim(),
    name: document.getElementById('sName').value.trim(),
    class: document.getElementById('sClass').value.trim(),
    semester: document.getElementById('sSemester').value,
    email: document.getElementById('sEmail').value.trim(),
    phone: document.getElementById('sPhone').value.trim()
  };

  if (!data.roll_no || !data.name || !data.class) {
    showToast('Please fill all required fields', 'warning');
    return;
  }

  try {
    if (id) {
      await api.put(`/students/${id}`, data);
      showToast('Student updated successfully!');
    } else {
      await api.post('/students', data);
      showToast('Student added successfully!');
    }
    closeModal();
    loadStudents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editStudent(id) {
  try {
    const data = await api.get(`/students/${id}`);
    showStudentModal(data.student);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteStudent(id, name) {
  showModal('Confirm Delete', `
    <p style="color:var(--text-secondary)">Are you sure you want to delete student <strong>${name}</strong>? This will also delete all their results.</p>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-danger" onclick="confirmDeleteStudent(${id})">Delete</button>
  `);
}

async function confirmDeleteStudent(id) {
  try {
    await api.delete(`/students/${id}`);
    showToast('Student deleted successfully!');
    closeModal();
    loadStudents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== SUBJECTS =====
async function loadSubjects() {
  try {
    const data = await api.get('/subjects');
    const tbody = document.getElementById('subjectsTableBody');

    if (data.subjects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📚</div><h4>No Subjects Found</h4><p>Add your first subject to get started</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = data.subjects.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.code)}</strong></td>
        <td class="td-name">${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.class)}</td>
        <td>${s.semester ? 'Sem ' + s.semester : 'All'}</td>
        <td>${s.max_marks}</td>
        <td>
          <div class="td-actions">
            <button class="btn-icon" onclick="editSubject(${s.id})" title="Edit">✏️</button>
            <button class="btn-icon danger" onclick="deleteSubject(${s.id}, '${escapeHtml(s.name)}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load subjects: ' + err.message, 'error');
  }
}

document.getElementById('addSubjectBtn').addEventListener('click', () => showSubjectModal());

function showSubjectModal(subject = null) {
  const isEdit = !!subject;
  showModal(isEdit ? 'Edit Subject' : 'Add New Subject', `
    <form id="subjectForm">
      <div class="form-grid">
        <div class="form-group">
          <label>Subject Code <span class="required">*</span></label>
          <input type="text" class="form-control" id="subCode" value="${subject?.code || ''}" placeholder="e.g., CS101" required>
        </div>
        <div class="form-group">
          <label>Subject Name <span class="required">*</span></label>
          <input type="text" class="form-control" id="subName" value="${subject?.name || ''}" placeholder="e.g., Data Structures" required>
        </div>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Class <span class="required">*</span></label>
          <input type="text" class="form-control" id="subClass" value="${subject?.class || ''}" placeholder="e.g., CSE-A" required>
        </div>
        <div class="form-group">
          <label>Semester</label>
          <select class="form-control" id="subSemester">
            <option value="">All Semesters</option>
            ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}" ${subject?.semester === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Max Marks</label>
        <input type="number" class="form-control" id="subMaxMarks" value="${subject?.max_marks || 100}" min="1" max="1000">
      </div>
    </form>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveSubject(${subject?.id || 'null'})">${isEdit ? 'Update' : 'Add'} Subject</button>
  `);
}

async function saveSubject(id) {
  const data = {
    code: document.getElementById('subCode').value.trim(),
    name: document.getElementById('subName').value.trim(),
    class: document.getElementById('subClass').value.trim(),
    semester: document.getElementById('subSemester').value || null,
    max_marks: parseInt(document.getElementById('subMaxMarks').value) || 100
  };

  if (!data.code || !data.name || !data.class) {
    showToast('Please fill all required fields', 'warning');
    return;
  }

  try {
    if (id) {
      await api.put(`/subjects/${id}`, data);
      showToast('Subject updated successfully!');
    } else {
      await api.post('/subjects', data);
      showToast('Subject added successfully!');
    }
    closeModal();
    loadSubjects();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editSubject(id) {
  try {
    const data = await api.get(`/subjects/${id}`);
    showSubjectModal(data.subject);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSubject(id, name) {
  showModal('Confirm Delete', `
    <p style="color:var(--text-secondary)">Are you sure you want to delete subject <strong>${name}</strong>? This will also delete all related results.</p>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-danger" onclick="confirmDeleteSubject(${id})">Delete</button>
  `);
}

async function confirmDeleteSubject(id) {
  try {
    await api.delete(`/subjects/${id}`);
    showToast('Subject deleted successfully!');
    closeModal();
    loadSubjects();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== RESULTS =====
async function loadResults() {
  try {
    const cls = document.getElementById('resultClassFilter').value;
    const semester = document.getElementById('resultSemesterFilter').value;
    const exam = document.getElementById('resultExamFilter').value;

    let query = '/results?';
    if (cls) query += `class=${encodeURIComponent(cls)}&`;
    if (semester) query += `semester=${semester}&`;
    if (exam) query += `exam_type=${exam}&`;

    const data = await api.get(query);
    const tbody = document.getElementById('resultsTableBody');

    // Populate class filter
    const classes = [...new Set(data.results.map(r => r.student_class))];
    const classFilter = document.getElementById('resultClassFilter');
    const curVal = classFilter.value;
    classFilter.innerHTML = '<option value="">All Classes</option>' +
      classes.map(c => `<option value="${c}" ${c === curVal ? 'selected' : ''}>${c}</option>`).join('');

    if (data.results.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📝</div><h4>No Results Found</h4><p>Add results for students to see them here</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = data.results.map(r => {
      const pct = ((r.marks_obtained / r.max_marks) * 100).toFixed(1);
      return `
        <tr>
          <td><strong>${escapeHtml(r.roll_no)}</strong></td>
          <td class="td-name">${escapeHtml(r.student_name)}</td>
          <td>${escapeHtml(r.subject_name)} <span style="color:var(--text-muted);font-size:11px;">(${escapeHtml(r.subject_code)})</span></td>
          <td>${r.marks_obtained}</td>
          <td style="color:var(--text-muted)">${r.max_marks}</td>
          <td>${pct}%</td>
          <td><span class="badge badge-grade ${getGradeBadgeClass(r.grade)}">${r.grade}</span></td>
          <td style="text-transform:capitalize;font-size:12px;">${r.exam_type}</td>
          <td>
            <div class="td-actions">
              <button class="btn-icon danger" onclick="deleteResult(${r.id})" title="Delete">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Failed to load results: ' + err.message, 'error');
  }
}

document.getElementById('resultClassFilter').addEventListener('change', loadResults);
document.getElementById('resultSemesterFilter').addEventListener('change', loadResults);
document.getElementById('resultExamFilter').addEventListener('change', loadResults);

document.getElementById('addResultBtn').addEventListener('click', () => showResultModal());

async function showResultModal() {
  // Load students and subjects for dropdowns
  try {
    const [studentsData, subjectsData] = await Promise.all([
      api.get('/students'),
      api.get('/subjects')
    ]);

    showModal('Add Result', `
      <form id="resultForm">
        <div class="form-group">
          <label>Student <span class="required">*</span></label>
          <select class="form-control" id="rStudent" required>
            <option value="">Select Student</option>
            ${studentsData.students.map(s => `<option value="${s.id}">${s.roll_no} — ${s.name} (${s.class})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Subject <span class="required">*</span></label>
          <select class="form-control" id="rSubject" required onchange="updateMaxMarks()">
            <option value="">Select Subject</option>
            ${subjectsData.subjects.map(s => `<option value="${s.id}" data-max="${s.max_marks}">${s.code} — ${s.name} (Max: ${s.max_marks})</option>`).join('')}
          </select>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Marks Obtained <span class="required">*</span></label>
            <input type="number" class="form-control" id="rMarks" min="0" step="0.5" placeholder="Enter marks" required oninput="previewGrade()">
          </div>
          <div class="form-group">
            <label>Semester <span class="required">*</span></label>
            <select class="form-control" id="rSemester" required>
              ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Exam Type</label>
            <select class="form-control" id="rExamType">
              <option value="final">Final</option>
              <option value="midterm">Midterm</option>
              <option value="internal">Internal</option>
            </select>
          </div>
          <div class="form-group">
            <label>Grade Preview</label>
            <div id="gradePreview" style="padding:10px 14px;background:var(--bg-glass);border-radius:8px;text-align:center;font-size:20px;font-weight:800;color:var(--text-muted);">—</div>
          </div>
        </div>
        <div class="form-group">
          <label>Remarks</label>
          <input type="text" class="form-control" id="rRemarks" placeholder="Optional remarks">
        </div>
      </form>
    `, `
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" onclick="saveResult()">Save Result</button>
    `);
  } catch (err) {
    showToast('Failed to load data: ' + err.message, 'error');
  }
}

function updateMaxMarks() {
  previewGrade();
}

function previewGrade() {
  const marksInput = document.getElementById('rMarks');
  const subjectSelect = document.getElementById('rSubject');
  const preview = document.getElementById('gradePreview');

  if (!marksInput || !subjectSelect || !preview) return;

  const marks = parseFloat(marksInput.value);
  const selectedOption = subjectSelect.options[subjectSelect.selectedIndex];
  const maxMarks = selectedOption ? parseInt(selectedOption.dataset.max) : 100;

  if (isNaN(marks) || !maxMarks) {
    preview.textContent = '—';
    preview.style.color = 'var(--text-muted)';
    return;
  }

  const pct = (marks / maxMarks) * 100;
  let grade, color;
  if (pct >= 90) { grade = 'A+'; color = '#4ade80'; }
  else if (pct >= 80) { grade = 'A'; color = '#86efac'; }
  else if (pct >= 70) { grade = 'B+'; color = '#67e8f9'; }
  else if (pct >= 60) { grade = 'B'; color = '#a5f3fc'; }
  else if (pct >= 50) { grade = 'C'; color = '#fcd34d'; }
  else if (pct >= 40) { grade = 'D'; color = '#fde68a'; }
  else { grade = 'F'; color = '#fca5a5'; }

  preview.textContent = `${grade} (${pct.toFixed(1)}%)`;
  preview.style.color = color;
}

async function saveResult() {
  const data = {
    student_id: parseInt(document.getElementById('rStudent').value),
    subject_id: parseInt(document.getElementById('rSubject').value),
    marks_obtained: parseFloat(document.getElementById('rMarks').value),
    semester: parseInt(document.getElementById('rSemester').value),
    exam_type: document.getElementById('rExamType').value,
    remarks: document.getElementById('rRemarks').value.trim()
  };

  if (!data.student_id || !data.subject_id || isNaN(data.marks_obtained)) {
    showToast('Please fill all required fields', 'warning');
    return;
  }

  try {
    await api.post('/results', data);
    showToast('Result saved successfully!');
    closeModal();
    loadResults();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteResult(id) {
  showModal('Confirm Delete', `
    <p style="color:var(--text-secondary)">Are you sure you want to delete this result?</p>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-danger" onclick="confirmDeleteResult(${id})">Delete</button>
  `);
}

async function confirmDeleteResult(id) {
  try {
    await api.delete(`/results/${id}`);
    showToast('Result deleted successfully!');
    closeModal();
    loadResults();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== STUDENT LOOKUP (PUBLIC) =====
document.getElementById('lookupBtn').addEventListener('click', lookupStudent);
document.getElementById('lookupRollNo').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') lookupStudent();
});

async function lookupStudent() {
  const rollNo = document.getElementById('lookupRollNo').value.trim();
  if (!rollNo) {
    showToast('Please enter a roll number', 'warning');
    return;
  }

  const resultsDiv = document.getElementById('lookupResults');

  try {
    const data = await api.request(`/results/student/${encodeURIComponent(rollNo)}`);
    resultsDiv.style.display = 'block';

    if (data.results.length === 0) {
      resultsDiv.innerHTML = `
        <div class="glass-card">
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h4>No Results Found</h4>
            <p>No results found for ${escapeHtml(data.student.name)} (${escapeHtml(rollNo)})</p>
          </div>
        </div>
      `;
      return;
    }

    resultsDiv.innerHTML = `
      <div class="glass-card" style="text-align:center; margin-bottom:20px;">
        <h3 style="margin-bottom:4px;">${escapeHtml(data.student.name)}</h3>
        <p style="color:var(--text-muted);font-size:13px;">
          Roll No: ${escapeHtml(data.student.roll_no)} · Class: ${escapeHtml(data.student.class)} · Semester: ${data.student.semester}
        </p>
      </div>

      <div class="result-summary">
        <div class="summary-item">
          <div class="summary-value">${data.summary.totalSubjects}</div>
          <div class="summary-label">Subjects</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${data.summary.totalMarks}/${data.summary.totalMaxMarks}</div>
          <div class="summary-label">Total Marks</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${data.summary.percentage}%</div>
          <div class="summary-label">Percentage</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color:${getGradeColor(data.summary.grade)}">${data.summary.grade}</div>
          <div class="summary-label">Overall Grade</div>
        </div>
      </div>

      <div class="glass-card">
        <div class="card-header"><h3>📋 Detailed Results</h3></div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Code</th>
                <th>Marks</th>
                <th>Max</th>
                <th>%</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              ${data.results.map(r => {
                const pct = ((r.marks_obtained / r.max_marks) * 100).toFixed(1);
                return `
                  <tr>
                    <td class="td-name">${escapeHtml(r.subject_name)}</td>
                    <td>${escapeHtml(r.subject_code)}</td>
                    <td>${r.marks_obtained}</td>
                    <td style="color:var(--text-muted)">${r.max_marks}</td>
                    <td>${pct}%</td>
                    <td><span class="badge badge-grade ${getGradeBadgeClass(r.grade)}">${r.grade}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = `
      <div class="glass-card">
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <h4>Student Not Found</h4>
          <p>${err.message}</p>
        </div>
      </div>
    `;
  }
}

// ===== USER MANAGEMENT =====
async function loadUsers() {
  if (!currentUser || currentUser.role !== 'admin') return;

  try {
    const data = await api.get('/auth/users');
    const tbody = document.getElementById('usersTableBody');

    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td class="td-name">${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.full_name)}</td>
        <td style="color:var(--text-muted)">${escapeHtml(u.email)}</td>
        <td><span class="badge badge-${u.role}">${u.role}</span></td>
        <td style="color:var(--text-muted);font-size:12px;">${formatDate(u.created_at)}</td>
      </tr>
    `).join('');
  } catch (err) {
    showToast('Failed to load users: ' + err.message, 'error');
  }
}

document.getElementById('addUserBtn').addEventListener('click', () => {
  showModal('Register New User', `
    <form id="userForm">
      <div class="form-group">
        <label>Username <span class="required">*</span></label>
        <input type="text" class="form-control" id="uUsername" placeholder="Username" required>
      </div>
      <div class="form-group">
        <label>Full Name <span class="required">*</span></label>
        <input type="text" class="form-control" id="uFullName" placeholder="Full name" required>
      </div>
      <div class="form-group">
        <label>Email <span class="required">*</span></label>
        <input type="email" class="form-control" id="uEmail" placeholder="email@example.com" required>
      </div>
      <div class="form-group">
        <label>Password <span class="required">*</span></label>
        <input type="password" class="form-control" id="uPassword" placeholder="Min 6 characters" required>
      </div>
      <div class="form-group">
        <label>Role</label>
        <select class="form-control" id="uRole">
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>
      </div>
    </form>
  `, `
    <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveUser()">Register User</button>
  `);
});

async function saveUser() {
  const data = {
    username: document.getElementById('uUsername').value.trim(),
    full_name: document.getElementById('uFullName').value.trim(),
    email: document.getElementById('uEmail').value.trim(),
    password: document.getElementById('uPassword').value,
    role: document.getElementById('uRole').value
  };

  if (!data.username || !data.full_name || !data.email || !data.password) {
    showToast('Please fill all required fields', 'warning');
    return;
  }

  try {
    await api.post('/auth/register', data);
    showToast('User registered successfully!');
    closeModal();
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== HELPERS =====
function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getGradeBadgeClass(grade) {
  const map = {
    'A+': 'badge-a-plus', 'A': 'badge-a',
    'B+': 'badge-b-plus', 'B': 'badge-b',
    'C': 'badge-c', 'D': 'badge-d', 'F': 'badge-f'
  };
  return map[grade] || 'badge-c';
}

function getGradeColor(grade) {
  const map = {
    'A+': '#4ade80', 'A': '#86efac',
    'B+': '#67e8f9', 'B': '#a5f3fc',
    'C': '#fcd34d', 'D': '#fde68a', 'F': '#fca5a5'
  };
  return map[grade] || '#94a3b8';
}

// ===== INIT =====
(function init() {
  const token = api.getToken();
  const savedUser = localStorage.getItem('srms_user');

  if (token && savedUser) {
    try {
      const user = JSON.parse(savedUser);
      showApp(user);
    } catch {
      showLogin();
    }
  } else {
    showLogin();
  }
})();
