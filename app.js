// ============================================================================
// HEALTH AI - UNIFIED JAVASCRIPT FILE WITH FIREBASE AUTHENTICATION
// ============================================================================

// ============================================================================
// GLOBAL CONFIGURATION & STATE
// ============================================================================

const CONFIG = {
  API_BASE_URL: 'http://127.0.0.1:5000',
  STORAGE_KEYS: {
    USER_DATA: 'userData',
    HEALTH_ENTRIES: 'healthEntries',
    MEDICAL_REPORTS: 'medicalReports'
  }
};

// Global user state
let currentUser = null;

// ============================================================================
// FIREBASE AUTHENTICATION HELPERS
// ============================================================================

const FirebaseAuth = {
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return firebase.auth().currentUser !== null;
  },

  /**
   * Get current user
   */
  getCurrentUser() {
    return firebase.auth().currentUser;
  },

  /**
   * Sign up new user
   */
  async signUp(email, password, username) {
    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      
      // Update user profile with username
      await userCredential.user.updateProfile({
        displayName: username
      });

      return userCredential.user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  },

  /**
   * Sign in existing user
   */
  async signIn(email, password) {
    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      return userCredential.user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  },

  /**
   * Sign out user
   */
  async signOut() {
    try {
      await firebase.auth().signOut();
      currentUser = null;
      localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  },

  /**
   * Handle Firebase authentication errors
   */
  handleAuthError(error) {
    const errorMessages = {
      'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.'
    };

    return new Error(errorMessages[error.code] || error.message);
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChanged(callback) {
    return firebase.auth().onAuthStateChanged(callback);
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function loadUserData() {
  const user = FirebaseAuth.getCurrentUser();
  if (user) {
    currentUser = {
      uid: user.uid,
      username: user.displayName || user.email.split('@')[0],
      email: user.email,
      fullName: user.displayName || user.email.split('@')[0],
      memberSince: new Date(user.metadata.creationTime).toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      })
    };
    return currentUser;
  }
  return null;
}

function saveUserData(userData) {
  localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  currentUser = userData;
}

function updateNavUsername() {
  const navUsernameEl = document.getElementById('navUsername');
  if (navUsernameEl && currentUser) {
    navUsernameEl.textContent = currentUser.username;
  }
}

function isAuthenticated() {
  return FirebaseAuth.isAuthenticated();
}

function logoutUser() {
  if (confirm('Are you sure you want to logout?')) {
    FirebaseAuth.signOut().then(() => {
      alert('Logged out successfully!');
      window.location.href = 'login_sign.html';
    }).catch(error => {
      alert('Error logging out: ' + error.message);
    });
  }
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// ============================================================================
// AUTHENTICATION CHECK FOR PROTECTED PAGES (DEPRECATED - Using onAuthStateChanged instead)
// ============================================================================

// This function is now deprecated in favor of Firebase's onAuthStateChanged listener
// Keeping it for backward compatibility but it's no longer actively used
function checkAuth() {
  if (window.location.pathname.includes('login_sign.html')) {
    return;
  }
  
  if (!isAuthenticated()) {
    console.warn('User not authenticated');
    return false;
  }
  return true;
}

// ============================================================================
// MAIN.HTML - AI DOCTOR PAGE
// ============================================================================

const MainPage = {
  SYMPTOMS: [
    "Fever", "Cough (Dry)", "Cough (Productive)", "Sore Throat",
    "Runny Nose", "Nasal Congestion", "Sneezing", "Headache (General)",
    "Headache (Throbbing)", "Body Aches", "Fatigue", "Chills",
    "Shortness of Breath", "Chest Pain (Sharp)", "Chest Tightness",
    "Nausea", "Vomiting", "Diarrhea", "Abdominal Pain (General)",
    "Abdominal Pain (Lower Right)", "Loss of Appetite", "Loss of Smell/Taste",
    "Dizziness", "Rash", "Itching", "Eye Redness", "Ear Pain"
  ],
  selectedSymptoms: new Set(),
  elements: {},

  init() {
    if (!document.getElementById('multiselectRoot')) return;

    this.elements = {
      dropdownPanel: document.getElementById('dropdownPanel'),
      selectedContainer: document.getElementById('selectedContainer'),
      symptomSearch: document.getElementById('symptomSearch'),
      multiselectRoot: document.getElementById('multiselectRoot'),
      predictBtn: document.getElementById('predictBtn'),
      loadingSpinner: document.getElementById('loadingSpinner'),
      resultSection: document.getElementById('resultSection')
    };

    this.bindEvents();
    this.renderDropdown();
    this.updateSelectedUI();
  },

  bindEvents() {
    const { symptomSearch, multiselectRoot, predictBtn, dropdownPanel } = this.elements;

    symptomSearch.addEventListener('input', (e) => {
      this.renderDropdown(e.target.value);
    });

    multiselectRoot.addEventListener('click', () => {
      symptomSearch.focus();
      this.renderDropdown(symptomSearch.value);
    });

    document.addEventListener('click', (e) => {
      if (!multiselectRoot.contains(e.target)) {
        dropdownPanel.style.display = 'none';
      }
    });

    multiselectRoot.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        this.renderDropdown(symptomSearch.value);
        e.preventDefault();
      }
    });

    predictBtn.addEventListener('click', () => {
      const arr = Array.from(this.selectedSymptoms);
      this.callPredict(arr);
    });

    symptomSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.selectedSymptoms.size > 0) {
          this.callPredict(Array.from(this.selectedSymptoms));
        }
      }
    });
  },

  renderDropdown(filter = '') {
    const { dropdownPanel } = this.elements;
    dropdownPanel.innerHTML = '';
    const q = filter.trim().toLowerCase();
    const items = this.SYMPTOMS.filter(s => s.toLowerCase().includes(q));
    
    if (items.length === 0) {
      dropdownPanel.innerHTML = '<div style="padding:12px; text-align:center; color:#64748b;">No symptoms found</div>';
      dropdownPanel.style.display = 'block';
      return;
    }
    
    items.forEach(sym => {
      const div = document.createElement('div');
      div.className = 'symptom-item';
      div.tabIndex = 0;
      div.innerHTML = `
        <input type="checkbox" ${this.selectedSymptoms.has(sym) ? 'checked' : ''} style="width:18px;height:18px;" />
        <div style="flex:1">${sym}</div>
      `;
      div.addEventListener('click', () => {
        if (this.selectedSymptoms.has(sym)) {
          this.selectedSymptoms.delete(sym);
        } else {
          this.selectedSymptoms.add(sym);
        }
        this.updateSelectedUI();
        this.renderDropdown(this.elements.symptomSearch.value);
      });
      div.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter') div.click(); 
      });
      dropdownPanel.appendChild(div);
    });
    dropdownPanel.style.display = 'block';
    dropdownPanel.setAttribute('aria-expanded', 'true');
  },

  updateSelectedUI() {
    const { selectedContainer, predictBtn } = this.elements;
    selectedContainer.innerHTML = '';
    
    if (this.selectedSymptoms.size === 0) {
      const hint = document.createElement('span');
      hint.className = 'text-muted small';
      hint.textContent = 'Click to select symptoms';
      selectedContainer.appendChild(hint);
    } else {
      this.selectedSymptoms.forEach(sym => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.innerHTML = `<span>${sym}</span><i class="bi bi-x-circle-fill" title="Remove"></i>`;
        chip.querySelector('i').addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectedSymptoms.delete(sym);
          this.updateSelectedUI();
          this.renderDropdown(this.elements.symptomSearch.value);
        });
        selectedContainer.appendChild(chip);
      });
    }

    predictBtn.disabled = this.selectedSymptoms.size === 0;
  },

  async callPredict(symptomsArray) {
    if (!Array.isArray(symptomsArray) || symptomsArray.length === 0) return;

    const { loadingSpinner, predictBtn, resultSection } = this.elements;

    loadingSpinner.classList.remove('d-none');
    loadingSpinner.style.display = 'flex';
    predictBtn.disabled = true;

    try {
      const resp = await fetch(`${CONFIG.API_BASE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: symptomsArray })
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Server error: ${resp.status} ${txt}`);
      }

      const data = await resp.json();
      this.renderResults(data);

    } catch (err) {
      resultSection.innerHTML = `
        <div class="result-card">
          <div class="d-flex align-items-center gap-2 mb-2">
            <i class="bi bi-exclamation-triangle-fill" style="color:#ef4444; font-size:1.5rem;"></i>
            <div class="small" style="color:#ef4444; font-weight:600;">Prediction Failed</div>
          </div>
          <div class="text-muted small">${err.message}</div>
          <div class="text-muted small mt-2">Please ensure your server is running on ${CONFIG.API_BASE_URL}</div>
        </div>`;
    } finally {
      loadingSpinner.classList.add('d-none');
      predictBtn.disabled = this.selectedSymptoms.size === 0;
    }
  },

  renderResults(data) {
    const { resultSection } = this.elements;
    resultSection.innerHTML = '';

    const mainCard = document.createElement('div');
    mainCard.className = 'result-card';

    const titleRow = document.createElement('div');
    titleRow.className = 'd-flex align-items-center justify-content-between mb-3';
    titleRow.innerHTML = `
      <div>
        <div class="small text-muted">Predicted Condition</div>
        <div style="font-size:1.4rem; font-weight:700; color:#60a5fa; margin-top:4px;">${data.prediction}</div>
      </div>
      <div class="text-end">
        <div class="small text-muted">Confidence</div>
        <div style="font-size:1.2rem; font-weight:600; color:#3b82f6; margin-top:4px;">${Math.round(data.top3[0].confidence)}%</div>
      </div>
    `;
    mainCard.appendChild(titleRow);

    const top3Div = document.createElement('div');
    top3Div.style.marginTop = '1.5rem';
    top3Div.innerHTML = `<div class="small text-muted mb-3" style="font-weight:600;">Top 3 Possibilities</div>`;
    data.top3.forEach(item => {
      const row = document.createElement('div');
      row.style.marginBottom = '14px';
      const percent = Math.round(item.confidence);
      row.innerHTML = `
        <div class="d-flex justify-content-between small mb-2">
          <div style="font-weight:600; color:#cbd5e1;">${item.disease}</div>
          <div style="color:#60a5fa; font-weight:600;">${percent}%</div>
        </div>
        <div class="progress">
          <div class="progress-bar" role="progressbar" style="width:${percent}%" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
      `;
      top3Div.appendChild(row);
    });
    mainCard.appendChild(top3Div);

    const shapDiv = document.createElement('div');
    shapDiv.style.marginTop = '1.5rem';
    shapDiv.innerHTML = `<div class="small text-muted mb-3" style="font-weight:600;">Contributing Symptoms (SHAP Analysis)</div>`;

    const list = document.createElement('div');
    list.className = 'shap-list';

    data.shap.forEach(item => {
      const row = document.createElement('div');
      row.className = 'shap-row';
      const val = Number(item.value);
      const absVal = Math.abs(val);
      row.innerHTML = `
        <div style="width:40%; font-size:0.92rem; color:#cbd5e1;">${item.symptom}</div>
        <div style="width:60%; display:flex; align-items:center; gap:10px;">
          <div style="flex:1; display:flex; align-items:center;">
            <div class="shap-bar" style="position:relative;">
              <div style="position:absolute; left:50%; top:0; bottom:0; width:1px; background:rgba(59, 130, 246, 0.3)"></div>
              <div style="position:absolute; ${val < 0 ? 'right:50%' : 'left:50%'}; top:0; bottom:0; height:100%; width:${Math.min(absVal*200, 100)}%; background:${val < 0 ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(90deg, #10b981, #059669)'}; border-radius:8px;"></div>
            </div>
          </div>
          <div style="min-width:60px; text-align:right; font-size:0.88rem; color:#94a3b8; font-family:monospace;">${val.toFixed(4)}</div>
        </div>
      `;
      list.appendChild(row);
    });

    shapDiv.appendChild(list);
    mainCard.appendChild(shapDiv);

    resultSection.appendChild(mainCard);
    mainCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};

// ============================================================================
// HEALTH_TRACKER.HTML - DAILY HEALTH TRACKER
// ============================================================================

const HealthTracker = {
  healthEntries: [],
  elements: {},

  init() {
    if (!document.getElementById('healthForm')) return;

    this.elements = {
      healthForm: document.getElementById('healthForm'),
      trackerEntries: document.getElementById('trackerEntries'),
      entryCount: document.getElementById('entryCount'),
      entryDate: document.getElementById('entryDate')
    };

    const today = new Date().toISOString().split('T')[0];
    this.elements.entryDate.value = today;

    this.loadEntries();
    this.bindEvents();
  },

  loadEntries() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.HEALTH_ENTRIES);
    if (stored) {
      this.healthEntries = JSON.parse(stored);
    }
    this.renderEntries();
  },

  saveEntries() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.HEALTH_ENTRIES, JSON.stringify(this.healthEntries));
  },

  bindEvents() {
    const { healthForm } = this.elements;

    healthForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const entry = {
        id: Date.now(),
        date: document.getElementById('entryDate').value,
        mood: document.getElementById('moodSelect').value,
        sleep: document.getElementById('sleepQuality').value || 'Not specified',
        water: document.getElementById('waterIntake').value || 'Not specified',
        meals: document.getElementById('mealsInput').value || 'Not specified',
        notes: document.getElementById('notesInput').value || 'No notes',
        timestamp: new Date().toLocaleString()
      };

      this.healthEntries.unshift(entry);
      this.saveEntries();
      this.renderEntries();
      
      healthForm.reset();
      this.elements.entryDate.value = new Date().toISOString().split('T')[0];

      const btn = healthForm.querySelector('.btn-submit');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Saved!';
      btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
      }, 2000);
    });

    window.deleteEntry = (id) => this.deleteEntry(id);
  },

  deleteEntry(id) {
    if (confirm('Are you sure you want to delete this entry?')) {
      this.healthEntries = this.healthEntries.filter(entry => entry.id !== id);
      this.saveEntries();
      this.renderEntries();
    }
  },

  renderEntries() {
    const { trackerEntries, entryCount } = this.elements;

    if (this.healthEntries.length === 0) {
      trackerEntries.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-inbox"></i>
          <p>No entries yet. Start tracking your health by filling out the form above!</p>
        </div>
      `;
      entryCount.textContent = '0 entries';
      return;
    }

    entryCount.textContent = `${this.healthEntries.length} ${this.healthEntries.length === 1 ? 'entry' : 'entries'}`;

    trackerEntries.innerHTML = this.healthEntries.map(entry => `
      <div class="entry-card">
        <div class="entry-header">
          <div>
            <div class="entry-date">
              <i class="bi bi-calendar-check"></i>
              ${formatDate(entry.date)}
            </div>
            <div class="entry-time">${entry.timestamp}</div>
          </div>
          <button class="delete-btn" onclick="deleteEntry(${entry.id})">
            <i class="bi bi-trash"></i> Delete
          </button>
        </div>

        <div class="entry-info">
          <div class="info-item">
            <div class="info-label">Mood</div>
            <div class="info-value mood-emoji">${entry.mood}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Sleep Quality</div>
            <div class="info-value">${entry.sleep}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Water Intake</div>
            <div class="info-value">${entry.water}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Meals</div>
            <div class="info-value">${entry.meals}</div>
          </div>
        </div>

        ${entry.notes !== 'No notes' ? `
          <div class="entry-notes">
            <div class="notes-label">Notes & Observations</div>
            <div class="notes-text">${entry.notes}</div>
          </div>
        ` : ''}
      </div>
    `).join('');
  }
};

// ============================================================================
// MEDICAL_REPORTS.HTML - MEDICAL REPORTS MANAGER
// ============================================================================

const MedicalReports = {
  medicalReports: [],
  selectedFile: null,
  selectedFileData: null,
  elements: {},

  init() {
    if (!document.getElementById('uploadForm')) return;

    this.elements = {
      uploadArea: document.getElementById('uploadArea'),
      fileInput: document.getElementById('fileInput'),
      previewSection: document.getElementById('previewSection'),
      previewImage: document.getElementById('previewImage'),
      previewClose: document.getElementById('previewClose'),
      uploadForm: document.getElementById('uploadForm'),
      uploadBtn: document.getElementById('uploadBtn'),
      reportTitle: document.getElementById('reportTitle'),
      reportNotes: document.getElementById('reportNotes'),
      reportsGrid: document.getElementById('reportsGrid'),
      reportCount: document.getElementById('reportCount'),
      viewModal: document.getElementById('viewModal'),
      modalClose: document.getElementById('modalClose'),
      modalTitle: document.getElementById('modalTitle'),
      modalImage: document.getElementById('modalImage'),
      modalDate: document.getElementById('modalDate'),
      modalNotes: document.getElementById('modalNotes'),
      modalNotesRow: document.getElementById('modalNotesRow')
    };

    this.loadReports();
    this.bindEvents();
  },

  loadReports() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.MEDICAL_REPORTS);
    if (stored) {
      this.medicalReports = JSON.parse(stored);
    }
    this.renderReports();
  },

  saveReports() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.MEDICAL_REPORTS, JSON.stringify(this.medicalReports));
  },

  bindEvents() {
    const { uploadArea, fileInput, previewClose, uploadForm, reportTitle, modalClose, viewModal } = this.elements;

    uploadArea.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
      uploadArea.addEventListener(e, ev => { 
        ev.preventDefault(); 
        ev.stopPropagation(); 
      }, false);
    });

    ['dragenter', 'dragover'].forEach(e => {
      uploadArea.addEventListener(e, () => uploadArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(e => {
      uploadArea.addEventListener(e, () => uploadArea.classList.remove('dragover'), false);
    });

    uploadArea.addEventListener('drop', e => {
      const files = e.dataTransfer.files;
      if (files.length > 0) this.handleFile(files[0]);
    });

    fileInput.addEventListener('change', e => {
      if (e.target.files.length > 0) this.handleFile(e.target.files[0]);
    });

    previewClose.addEventListener('click', () => {
      this.selectedFile = null;
      this.selectedFileData = null;
      this.elements.previewSection.style.display = 'none';
      fileInput.value = '';
      this.validateForm();
    });

    reportTitle.addEventListener('input', () => this.validateForm());

    uploadForm.addEventListener('submit', (e) => this.handleUpload(e));

    modalClose.addEventListener('click', () => {
      viewModal.style.display = 'none';
    });

    viewModal.addEventListener('click', e => {
      if (e.target === viewModal) {
        viewModal.style.display = 'none';
      }
    });

    window.viewReport = (id) => this.viewReport(id);
    window.deleteReport = (id) => this.deleteReport(id);
  },

  handleFile(file) {
    if (!file.type.match('image/(png|jpeg|jpg)')) {
      alert('Please upload a PNG or JPG image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB.');
      return;
    }
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      this.selectedFileData = e.target.result;
      this.elements.previewImage.src = this.selectedFileData;
      this.elements.previewSection.style.display = 'block';
      this.validateForm();
    };
    reader.readAsDataURL(file);
  },

  validateForm() {
    this.elements.uploadBtn.disabled = !(this.selectedFile && this.elements.reportTitle.value.trim());
  },

  handleUpload(e) {
    e.preventDefault();
    
    const report = {
      id: Date.now(),
      title: this.elements.reportTitle.value.trim(),
      notes: this.elements.reportNotes.value.trim(),
      image: this.selectedFileData,
      fileName: this.selectedFile.name,
      uploadDate: new Date().toLocaleString(),
      timestamp: Date.now()
    };

    this.medicalReports.unshift(report);
    this.saveReports();
    this.renderReports();
    
    this.elements.uploadForm.reset();
    this.selectedFile = null;
    this.selectedFileData = null;
    this.elements.previewSection.style.display = 'none';
    this.elements.uploadBtn.disabled = true;

    const btn = this.elements.uploadBtn;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Uploaded!';
    btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    }, 2000);
  },

  renderReports() {
    const { reportsGrid, reportCount } = this.elements;

    if (this.medicalReports.length === 0) {
      reportsGrid.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-folder-x"></i>
          <p>No reports uploaded yet. Start by uploading your first medical report above!</p>
        </div>`;
      reportCount.textContent = '0 reports';
      return;
    }

    reportCount.textContent = `${this.medicalReports.length} ${this.medicalReports.length === 1 ? 'report' : 'reports'}`;
    
    reportsGrid.innerHTML = this.medicalReports.map(r => `
      <div class="report-card">
        <div class="report-image-container" onclick="viewReport(${r.id})">
          <img src="${r.image}" alt="${r.title}" class="report-image" />
        </div>
        <div class="report-info">
          <div class="report-title">${r.title}</div>
          <div class="report-meta">
            <span><i class="bi bi-calendar3"></i> ${r.uploadDate}</span>
          </div>
          <div class="report-actions">
            <button class="btn-action" onclick="viewReport(${r.id})">
              <i class="bi bi-eye"></i> View
            </button>
            <button class="btn-action delete" onclick="deleteReport(${r.id})">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  viewReport(id) {
    const report = this.medicalReports.find(r => r.id === id);
    if (!report) return;

    const { viewModal, modalTitle, modalImage, modalDate, modalNotes, modalNotesRow } = this.elements;
    
    modalTitle.textContent = report.title;
    modalImage.src = report.image;
    modalDate.textContent = report.uploadDate;
    
    if (report.notes) {
      modalNotes.textContent = report.notes;
      modalNotesRow.style.display = 'flex';
    } else {
      modalNotesRow.style.display = 'none';
    }
    
    viewModal.style.display = 'flex';
  },

  deleteReport(id) {
    if (confirm('Are you sure you want to delete this report?')) {
      this.medicalReports = this.medicalReports.filter(r => r.id !== id);
      this.saveReports();
      this.renderReports();
    }
  }
};

// ============================================================================
// LOGIN_SIGN.HTML - AUTHENTICATION PAGE WITH FIREBASE
// ============================================================================

const LoginPage = {
  elements: {},

  init() {
    if (!document.getElementById('loginFormElement')) return;

    this.elements = {
      loginForm: document.getElementById('loginForm'),
      signupForm: document.getElementById('signupForm'),
      loginFormElement: document.getElementById('loginFormElement'),
      signupFormElement: document.getElementById('signupFormElement'),
      showSignup: document.getElementById('showSignup'),
      showLogin: document.getElementById('showLogin'),
      loginAlert: document.getElementById('loginAlert'),
      signupAlert: document.getElementById('signupAlert'),
      loginEmail: document.getElementById('loginEmail'),
      loginPassword: document.getElementById('loginPassword'),
      toggleLoginPassword: document.getElementById('toggleLoginPassword'),
      signupUsername: document.getElementById('signupUsername'),
      signupEmail: document.getElementById('signupEmail'),
      signupPassword: document.getElementById('signupPassword'),
      signupConfirmPassword: document.getElementById('signupConfirmPassword'),
      toggleSignupPassword: document.getElementById('toggleSignupPassword'),
      toggleConfirmPassword: document.getElementById('toggleConfirmPassword')
    };

    this.bindEvents();
    this.checkExistingAuth();
  },

  checkExistingAuth() {
    // If user is already logged in, redirect to main page
    if (FirebaseAuth.isAuthenticated()) {
      window.location.href = 'main.html';
    }
  },

  bindEvents() {
    const { 
      loginFormElement, signupFormElement, showSignup, showLogin,
      toggleLoginPassword, toggleSignupPassword, toggleConfirmPassword,
      loginPassword, signupPassword, signupConfirmPassword
    } = this.elements;

    showSignup.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleForms('signup');
    });

    showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleForms('login');
    });

    toggleLoginPassword.addEventListener('click', () => {
      this.togglePasswordVisibility(loginPassword, toggleLoginPassword);
    });

    toggleSignupPassword.addEventListener('click', () => {
      this.togglePasswordVisibility(signupPassword, toggleSignupPassword);
    });

    toggleConfirmPassword.addEventListener('click', () => {
      this.togglePasswordVisibility(signupConfirmPassword, toggleConfirmPassword);
    });

    loginFormElement.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    signupFormElement.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSignup();
    });
  },

  toggleForms(formType) {
    const { loginForm, signupForm } = this.elements;
    
    if (formType === 'signup') {
      loginForm.style.display = 'none';
      signupForm.style.display = 'block';
      this.clearAlerts();
    } else {
      signupForm.style.display = 'none';
      loginForm.style.display = 'block';
      this.clearAlerts();
    }
  },

  togglePasswordVisibility(passwordInput, toggleIcon) {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggleIcon.classList.remove('bi-eye');
      toggleIcon.classList.add('bi-eye-slash');
    } else {
      passwordInput.type = 'password';
      toggleIcon.classList.remove('bi-eye-slash');
      toggleIcon.classList.add('bi-eye');
    }
  },

  showAlert(alertElement, message, isSuccess = false) {
    alertElement.className = isSuccess ? 'alert-custom alert-success' : 'alert-custom';
    alertElement.innerHTML = `
      <i class="bi ${isSuccess ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}"></i>
      <span>${message}</span>
    `;
    alertElement.style.display = 'flex';
  },

  clearAlerts() {
    this.elements.loginAlert.style.display = 'none';
    this.elements.signupAlert.style.display = 'none';
  },

  async handleLogin() {
    const { loginEmail, loginPassword, loginAlert, loginFormElement } = this.elements;
    
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !password) {
      this.showAlert(loginAlert, 'Please fill in all fields');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showAlert(loginAlert, 'Please enter a valid email address');
      return;
    }

    const submitBtn = loginFormElement.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Signing in...';

    try {
      // Firebase sign in
      const user = await FirebaseAuth.signIn(email, password);
      
      // Create user data object
      const userData = {
        uid: user.uid,
        username: user.displayName || email.split('@')[0],
        email: user.email,
        fullName: user.displayName || email.split('@')[0],
        memberSince: new Date(user.metadata.creationTime).toLocaleDateString('en-US', { 
          month: 'long', 
          year: 'numeric' 
        })
      };

      saveUserData(userData);
      
      this.showAlert(loginAlert, 'Login successful! Redirecting...', true);
      
      setTimeout(() => {
        window.location.href = 'main.html';
      }, 1000);

    } catch (error) {
      console.error('Login error:', error);
      this.showAlert(loginAlert, error.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Sign In';
    }
  },

  async handleSignup() {
    const { 
      signupUsername, signupEmail, signupPassword, 
      signupConfirmPassword, signupAlert, signupFormElement 
    } = this.elements;
    
    const username = signupUsername.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value.trim();
    const confirmPassword = signupConfirmPassword.value.trim();

    if (!username || !email || !password || !confirmPassword) {
      this.showAlert(signupAlert, 'Please fill in all fields');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showAlert(signupAlert, 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      this.showAlert(signupAlert, 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      this.showAlert(signupAlert, 'Passwords do not match');
      return;
    }

    const submitBtn = signupFormElement.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Creating account...';

    try {
      // Firebase sign up
      const user = await FirebaseAuth.signUp(email, password, username);
      
      this.showAlert(signupAlert, 'Account created successfully! Redirecting...', true);
      
      // Auto login after signup
      const userData = {
        uid: user.uid,
        username: username,
        email: user.email,
        fullName: username,
        memberSince: new Date().toLocaleDateString('en-US', { 
          month: 'long', 
          year: 'numeric' 
        })
      };

      saveUserData(userData);

      setTimeout(() => {
        window.location.href = 'main.html';
      }, 1500);

    } catch (error) {
      console.error('Signup error:', error);
      this.showAlert(signupAlert, error.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-person-plus"></i> Create Account';
    }
  },

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
};

// ============================================================================
// PROFILE.HTML - USER PROFILE PAGE
// ============================================================================

const ProfilePage = {
  elements: {},

  init() {
    if (!document.getElementById('viewMode')) return;

    this.elements = {
      viewMode: document.getElementById('viewMode'),
      editMode: document.getElementById('editMode'),
      editBtn: document.getElementById('editBtn'),
      saveBtn: document.getElementById('saveBtn'),
      cancelBtn: document.getElementById('cancelBtn'),
      logoutBtn: document.getElementById('logoutBtn'),
      displayName: document.getElementById('displayName'),
      displayEmail: document.getElementById('displayEmail'),
      viewUsername: document.getElementById('viewUsername'),
      viewEmail: document.getElementById('viewEmail'),
      viewMemberSince: document.getElementById('viewMemberSince'),
      navUsername: document.getElementById('navUsername'),
      avatar: document.getElementById('avatar'),
      avatarEdit: document.getElementById('avatarEdit'),
      editUsername: document.getElementById('editUsername'),
      editEmail: document.getElementById('editEmail')
    };

    this.loadProfile();
    this.bindEvents();
  },

  loadProfile() {
    loadUserData();

    const { displayName, displayEmail, viewUsername, viewEmail, viewMemberSince, navUsername, avatar, avatarEdit } = this.elements;

    displayName.textContent = currentUser.fullName;
    displayEmail.textContent = currentUser.email;
    viewUsername.textContent = currentUser.username;
    viewEmail.textContent = currentUser.email;
    viewMemberSince.textContent = currentUser.memberSince;
    navUsername.textContent = currentUser.username;

    const initial = currentUser.fullName.charAt(0).toUpperCase();
    avatar.textContent = initial;
    avatarEdit.textContent = initial;
  },

  bindEvents() {
    const { editBtn, saveBtn, cancelBtn, logoutBtn, viewMode, editMode, editUsername, editEmail } = this.elements;

    editBtn.addEventListener('click', () => {
      viewMode.style.display = 'none';
      editMode.style.display = 'block';
      
      editUsername.value = currentUser.username;
      editEmail.value = currentUser.email;
    });

    cancelBtn.addEventListener('click', () => {
      editMode.style.display = 'none';
      viewMode.style.display = 'block';
    });

    saveBtn.addEventListener('click', async () => {
      const newUsername = editUsername.value.trim();
      
      if (!newUsername) {
        alert('Username cannot be empty!');
        return;
      }

      try {
        // Update Firebase user profile
        const user = FirebaseAuth.getCurrentUser();
        await user.updateProfile({
          displayName: newUsername
        });

        // Update local user data
        currentUser.username = newUsername;
        currentUser.fullName = newUsername;
        
        saveUserData(currentUser);
        this.loadProfile();

        editMode.style.display = 'none';
        viewMode.style.display = 'block';

        alert('Profile updated successfully!');
      } catch (error) {
        console.error('Update error:', error);
        alert('Error updating profile: ' + error.message);
      }
    });

    logoutBtn.addEventListener('click', () => {
      logoutUser();
    });
  }
};

// ============================================================================
// GLOBAL INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize login page (if on login page)
  if (document.getElementById('loginFormElement')) {
    LoginPage.init();
    console.log('Login Page Initialized');
    return;
  }

  // For protected pages, wait for Firebase auth to initialize
  let authCheckComplete = false;

  // Set up Firebase auth state listener
  FirebaseAuth.onAuthStateChanged((user) => {
    if (authCheckComplete) return; // Prevent multiple initializations
    authCheckComplete = true;

    if (user) {
      // User is authenticated
      console.log('User is signed in:', user.email);
      loadUserData();
      updateNavUsername();

      // Initialize page-specific modules
      MainPage.init();
      HealthTracker.init();
      MedicalReports.init();
      ProfilePage.init();

      console.log('Health AI Application Initialized with Firebase');
      console.log('Current User:', currentUser);
    } else {
      // User is NOT authenticated - redirect to login
      console.log('User is not signed in');
      alert('Please sign in to access this page.');
      window.location.href = 'login_sign.html';
    }
  });
});