(() => {
  'use strict';

  const DATABASE = 'student-meter-vault';
  const VERSION = 1;
  const STORES = ['branches', 'semesters', 'subjects', 'items'];
  const TYPES = {
    note: { label: 'Notes', icon: '📝' },
    personal: { label: 'Personal Notes', icon: '📌' },
    question: { label: 'Important Questions', icon: '❓' },
    material: { label: 'Study Material', icon: '📄' },
    result: { label: 'Results / Marks', icon: '📊' },
    link: { label: 'Useful Links', icon: '🔗' }
  };
  const BACKUP_APP_DATA_KEYS = new Set([
    'profile', 'study', 'xp', 'studyDays', 'goals', 'challenges', 'challengeHistory',
    'challengeDays', 'mood', 'money', 'timer', 'routine', 'reminderSettings',
    'reminderState', 'theme'
  ]);
  const containsCredentialField = (value) => {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(containsCredentialField);
    return Object.entries(value).some(([key, child]) =>
      /password|token|secret|credential/i.test(key) || containsCredentialField(child));
  };
  const SINGULAR_TYPES = {
    note: 'Note',
    personal: 'Personal Note',
    question: 'Important Question',
    material: 'Study Material',
    result: 'Result',
    link: 'Useful Link'
  };
  const root = document.querySelector('#vault-app');
  const modal = document.querySelector('#vault-modal');
  const form = document.querySelector('#vault-modal-form');
  let database;
  let previousFocus;
  let current = { view: 'overview' };
  let searchFilter = 'all';
  let searchTerm = '';
  let toastTimer;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const stamp = () => new Date().toISOString();
  const uid = () => crypto.randomUUID();
  const records = (store) => request(store, 'readonly', (objectStore) => objectStore.getAll());

  function showMessage(message) {
    const toast = document.querySelector('#vault-toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('This browser does not support IndexedDB, which Student Vault needs to store your records.'));
        return;
      }
      const opening = indexedDB.open(DATABASE, VERSION);
      opening.onupgradeneeded = () => {
        const db = opening.result;
        if (!db.objectStoreNames.contains('branches')) {
          const store = db.createObjectStore('branches', { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
        }
        if (!db.objectStoreNames.contains('semesters')) {
          const store = db.createObjectStore('semesters', { keyPath: 'id' });
          store.createIndex('branchId', 'branchId', { unique: false });
        }
        if (!db.objectStoreNames.contains('subjects')) {
          const store = db.createObjectStore('subjects', { keyPath: 'id' });
          store.createIndex('semesterId', 'semesterId', { unique: false });
        }
        if (!db.objectStoreNames.contains('items')) {
          const store = db.createObjectStore('items', { keyPath: 'id' });
          store.createIndex('subjectId', 'subjectId', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      opening.onsuccess = () => {
        database = opening.result;
        database.onversionchange = () => {
          database.close();
          showMessage('Student Vault storage was updated in another tab. Refresh this page to continue.');
        };
        resolve(database);
      };
      opening.onerror = () => reject(opening.error || new Error('Unable to open Student Vault storage.'));
      opening.onblocked = () => reject(new Error('Student Vault storage is blocked by another open tab. Close other Student Meter tabs and refresh.'));
    });
  }

  function request(storeName, mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const result = operation(transaction.objectStore(storeName));
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error || new Error('Student Vault storage request failed.'));
      transaction.onabort = () => reject(transaction.error || new Error('Student Vault storage transaction was aborted.'));
    });
  }

  function put(storeName, value) {
    return request(storeName, 'readwrite', (store) => store.put(value));
  }

  function removeTree(storeName, id) {
    const transactionStores = storeName === 'branches' ? STORES :
      storeName === 'semesters' ? ['semesters', 'subjects', 'items'] :
        storeName === 'subjects' ? ['subjects', 'items'] : ['items'];
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(transactionStores, 'readwrite');
      const all = Object.fromEntries(transactionStores.map((name) => [name, transaction.objectStore(name).getAll()]));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Could not remove this Student Vault record.'));
      transaction.onabort = () => reject(transaction.error || new Error('Delete operation was cancelled.'));
      const pending = new Set(transactionStores);
      const results = {};
      transactionStores.forEach((name) => {
        all[name].onsuccess = () => {
          results[name] = all[name].result;
          pending.delete(name);
          if (pending.size) return;
          let semesterIds = new Set();
          let subjectIds = new Set();
          if (storeName === 'branches') {
            semesterIds = new Set(results.semesters.filter((semester) => semester.branchId === id).map((semester) => semester.id));
            subjectIds = new Set(results.subjects.filter((subject) => semesterIds.has(subject.semesterId)).map((subject) => subject.id));
            results.branches.find((branch) => branch.id === id) && transaction.objectStore('branches').delete(id);
            semesterIds.forEach((semesterId) => transaction.objectStore('semesters').delete(semesterId));
            subjectIds.forEach((subjectId) => transaction.objectStore('subjects').delete(subjectId));
            results.items.filter((item) => subjectIds.has(item.subjectId)).forEach((item) => transaction.objectStore('items').delete(item.id));
          } else if (storeName === 'semesters') {
            semesterIds.add(id);
            subjectIds = new Set(results.subjects.filter((subject) => subject.semesterId === id).map((subject) => subject.id));
            transaction.objectStore('semesters').delete(id);
            subjectIds.forEach((subjectId) => transaction.objectStore('subjects').delete(subjectId));
            results.items.filter((item) => subjectIds.has(item.subjectId)).forEach((item) => transaction.objectStore('items').delete(item.id));
          } else if (storeName === 'subjects') {
            transaction.objectStore('subjects').delete(id);
            results.items.filter((item) => item.subjectId === id).forEach((item) => transaction.objectStore('items').delete(item.id));
          } else {
            transaction.objectStore('items').delete(id);
          }
        };
        all[name].onerror = () => transaction.abort();
      });
    });
  }

  function replaceData(data) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES, 'readwrite');
      STORES.forEach((name) => {
        const store = transaction.objectStore(name);
        store.clear();
        data[name].forEach((record) => store.put(record));
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Could not restore the Student Vault backup.'));
      transaction.onabort = () => reject(transaction.error || new Error('Restore operation was cancelled.'));
    });
  }

  async function snapshot() {
    const data = {};
    for (const store of STORES) data[store] = await records(store);
    return data;
  }

  async function allData() {
    const [branches, semesters, subjects, items] = await Promise.all(STORES.map(records));
    return { branches, semesters, subjects, items };
  }

  function breadcrumbs(data) {
    const parts = [{ label: 'Student Vault', action: 'overview' }];
    if (current.branchId) {
      const branch = data.branches.find((record) => record.id === current.branchId);
      if (branch) parts.push({ label: branch.shortName || branch.name, action: 'branch', id: branch.id });
    }
    if (current.semesterId) {
      const semester = data.semesters.find((record) => record.id === current.semesterId);
      if (semester) parts.push({ label: semester.name, action: 'semester', id: semester.id });
    }
    if (current.subjectId) {
      const subject = data.subjects.find((record) => record.id === current.subjectId);
      if (subject) parts.push({ label: subject.name, action: 'subject', id: subject.id });
    }
    return `<nav class="vault-breadcrumbs" aria-label="Breadcrumb">${parts.map((part, index) =>
      `${index ? '<span aria-hidden="true">›</span>' : ''}<button type="button" data-vault-action="${part.action}" ${part.id ? `data-id="${escapeHtml(part.id)}"` : ''} ${index === parts.length - 1 ? 'aria-current="page"' : ''}>${escapeHtml(part.label)}</button>`
    ).join('')}</nav>`;
  }

  function viewHeader(data, eyebrow, title, description, buttons = '') {
    return `${breadcrumbs(data)}<div class="vault-section-heading"><div><span class="eyebrow">${eyebrow}</span><h2>${escapeHtml(title)}</h2><p class="muted">${escapeHtml(description)}</p></div><div class="vault-actions">${buttons}</div></div>`;
  }

  function branchCard(branch, semesters) {
    return `<article class="vault-card vault-branch-card">
      <button class="vault-card-open" type="button" data-vault-action="branch" data-id="${escapeHtml(branch.id)}">
        <span class="feature-icon">🎓</span><span class="vault-card-label">${escapeHtml(branch.shortName || 'BRANCH / COURSE')}</span>
        <strong>${escapeHtml(branch.name)}</strong><span class="muted small">${semesters.length} ${semesters.length === 1 ? 'semester' : 'semesters'} · ${escapeHtml(branch.shortName || branch.name)}</span>
      </button>
      <div class="vault-card-actions"><button class="mini-button" type="button" data-vault-action="edit-branch" data-id="${escapeHtml(branch.id)}">✏️ Edit</button><button class="mini-button danger-text" type="button" data-vault-action="delete-branch" data-id="${escapeHtml(branch.id)}">🗑️ Delete</button></div>
    </article>`;
  }

  function renderSummary(data) {
    const notes = data.items.filter((item) => item.type === 'note' || item.type === 'personal').length;
    const questions = data.items.filter((item) => item.type === 'question').length;
    return `<section class="vault-summary-grid" aria-label="Vault summary">
      ${summaryCard('🎓', 'Branches', data.branches.length)}
      ${summaryCard('📚', 'Semesters', data.semesters.length)}
      ${summaryCard('📖', 'Subjects', data.subjects.length)}
      ${summaryCard('📝', 'Notes', notes)}
      ${summaryCard('❓', 'Important Questions', questions)}
    </section>`;
  }

  function summaryCard(icon, label, value) {
    return `<article class="stat-card"><span class="stat-icon">${icon}</span><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong></article>`;
  }

  function renderOverview(data) {
    const branchContent = data.branches.length
      ? `<div class="vault-card-grid">${data.branches.slice().sort((a, b) => a.name.localeCompare(b.name)).map((branch) =>
        branchCard(branch, data.semesters.filter((semester) => semester.branchId === branch.id))).join('')}</div>`
      : `<div class="vault-empty"><span>🎓</span><h3>No branch added yet.</h3><p>Create your first academic branch to start organizing your courses.</p><button class="button" type="button" data-vault-action="add-branch">＋ Add Branch</button></div>`;
    const recent = data.items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
    const recentlyAdded = data.items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    return `${renderSummary(data)}
      <section class="panel vault-section-panel">
        ${viewHeader(data, '🎓 Academic Structure', 'Your branches and courses', 'Create your own academic structure. Branches, semesters and subjects are fully customizable.', '<button class="button" type="button" data-vault-action="add-branch">＋ Add Branch</button>')}
        ${branchContent}
      </section>
      <section class="vault-two-column">
        <article class="panel vault-section-panel"><div class="vault-section-heading compact"><div><span class="eyebrow">🆕 Recently Added</span><h2>Fresh in your vault</h2></div><button class="button-secondary" type="button" data-vault-action="search">See all</button></div>${renderRecent(recentlyAdded, data)}</article>
        <article class="panel vault-section-panel"><div class="vault-section-heading compact"><div><span class="eyebrow">🕘 Recently Updated</span><h2>Pick up where you left off</h2></div><button class="button-secondary" type="button" data-vault-action="search">Search</button></div>${renderRecent(recent, data)}</article>
      </section>
      <section class="panel vault-section-panel">${renderFavorites(data, true)}</section>`;
  }

  function renderRecent(items, data) {
    if (!items.length) return '<div class="empty-state">Your recently added academic items will appear here.</div>';
    return `<div class="vault-recent-list">${items.map((item) => {
      const context = itemContext(item, data);
      return `<button class="vault-recent-item" type="button" data-vault-action="open-item" data-id="${escapeHtml(item.id)}"><span>${TYPES[item.type]?.icon || '📚'}</span><span class="vault-recent-main"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(context)}</small></span><span aria-hidden="true">→</span></button>`;
    }).join('')}</div>`;
  }

  function renderBranch(data, branch) {
    const semesters = data.semesters.filter((semester) => semester.branchId === branch.id).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const cards = semesters.length ? `<div class="vault-card-grid">${semesters.map((semester) => {
      const subjects = data.subjects.filter((subject) => subject.semesterId === semester.id);
      return `<article class="vault-card"><button class="vault-card-open" type="button" data-vault-action="semester" data-id="${escapeHtml(semester.id)}"><span class="feature-icon">📚</span><span class="vault-card-label">${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'}</span><strong>${escapeHtml(semester.name)}</strong><span class="muted small">Open semester →</span></button><div class="vault-card-actions"><button class="mini-button" type="button" data-vault-action="edit-semester" data-id="${escapeHtml(semester.id)}">✏️ Edit</button><button class="mini-button danger-text" type="button" data-vault-action="delete-semester" data-id="${escapeHtml(semester.id)}">🗑️ Delete</button></div></article>`;
    }).join('')}</div>` : `<div class="vault-empty"><span>📚</span><h3>No semesters added yet.</h3><p>Create a semester for this branch. You can give it any name that suits your course.</p><button class="button" type="button" data-vault-action="add-semester" data-branch-id="${escapeHtml(branch.id)}">＋ Add Semester</button></div>`;
    return `${viewHeader(data, 'Academic Structure', branch.name, `${branch.shortName ? `${branch.shortName} · ` : ''}Add a custom semester for this branch.`, `<button class="button-secondary" type="button" data-vault-action="edit-branch" data-id="${escapeHtml(branch.id)}">✏️ Edit Branch</button><button class="button" type="button" data-vault-action="add-semester" data-branch-id="${escapeHtml(branch.id)}">＋ Add Semester</button>`)}
      ${cards}<article class="panel vault-result-summary">${semesterResultSummary(data, branch.id)}</article>`;
  }

  function semesterResultSummary(data, branchId, semesterId = null) {
    const semesterIds = semesterId ? [semesterId] : data.semesters.filter((record) => record.branchId === branchId).map((record) => record.id);
    const subjects = data.subjects.filter((subject) => semesterIds.includes(subject.semesterId));
    const subjectIds = new Set(subjects.map((subject) => subject.id));
    const results = data.items.filter((item) => item.type === 'result' && subjectIds.has(item.subjectId));
    const maximum = results.reduce((sum, item) => sum + (Number(item.maxMarks) || 0), 0);
    const obtained = results.reduce((sum, item) => sum + (Number(item.obtainedMarks) || 0), 0);
    const percent = maximum ? `${(obtained / maximum * 100).toFixed(2)}%` : '—';
    const sgpa = semesterId ? data.semesters.find((record) => record.id === semesterId)?.sgpa : '';
    const cgpa = semesterId ? data.semesters.find((record) => record.id === semesterId)?.cgpa : '';
    const backlogs = semesterId ? data.semesters.find((record) => record.id === semesterId)?.backlogs : '';
    return `<div class="vault-section-heading compact"><div><span class="eyebrow">📊 ${semesterId ? 'Semester Result' : 'Results overview'}</span><h3>${semesterId ? 'Marks entered by subject' : 'Results for this branch'}</h3></div>${semesterId ? `<button class="button-secondary" type="button" data-vault-action="edit-semester-result" data-id="${escapeHtml(semesterId)}">✏️ Edit SGPA / CGPA</button>` : ''}</div>
      <div class="vault-result-stats">${summaryCard('📖', 'Subjects', subjects.length)}${summaryCard('📊', 'Marks total', maximum ? `${obtained} / ${maximum}` : '—')}${summaryCard('✅', 'Percentage', percent)}${semesterId ? summaryCard('🎓', 'SGPA / CGPA', `${sgpa || '—'} / ${cgpa || '—'}`) : ''}${semesterId ? summaryCard('📌', 'Backlogs', backlogs === '' || backlogs == null ? '—' : backlogs) : ''}</div>
      <p class="muted small">Percentages use the maximum and obtained marks you enter. SGPA, CGPA and backlog values remain manually entered; no grading formula is assumed.</p>`;
  }

  function renderSemester(data, semester) {
    const branch = data.branches.find((item) => item.id === semester.branchId);
    const subjects = data.subjects.filter((subject) => subject.semesterId === semester.id).sort((a, b) => a.name.localeCompare(b.name));
    const cards = subjects.length ? `<div class="vault-card-grid">${subjects.map((subject) => {
      const items = data.items.filter((item) => item.subjectId === subject.id);
      return `<article class="vault-card"><button class="vault-card-open" type="button" data-vault-action="subject" data-id="${escapeHtml(subject.id)}"><span class="feature-icon">📖</span><span class="vault-card-label">${items.length} saved items</span><strong>${escapeHtml(subject.name)}</strong><span class="muted small">${escapeHtml([subject.code, subject.teacher].filter(Boolean).join(' · ') || 'Open subject')}</span></button><div class="vault-card-actions"><button class="mini-button" type="button" data-vault-action="edit-subject" data-id="${escapeHtml(subject.id)}">✏️ Edit</button><button class="mini-button danger-text" type="button" data-vault-action="delete-subject" data-id="${escapeHtml(subject.id)}">🗑️ Delete</button></div></article>`;
    }).join('')}</div>` : `<div class="vault-empty"><span>📚</span><h3>No subjects added yet.</h3><p>Add any subject to start saving notes, questions, materials and results.</p><button class="button" type="button" data-vault-action="add-subject" data-semester-id="${escapeHtml(semester.id)}">＋ Add Subject</button></div>`;
    return `${viewHeader(data, 'Academic Structure', semester.name, branch ? `${branch.name} · Manage subjects and semester results.` : 'Manage your subjects and semester results.', `<button class="button-secondary" type="button" data-vault-action="edit-semester" data-id="${escapeHtml(semester.id)}">✏️ Edit Semester</button><button class="button" type="button" data-vault-action="add-subject" data-semester-id="${escapeHtml(semester.id)}">＋ Add Subject</button>`)}
      <article class="panel vault-result-summary">${semesterResultSummary(data, semester.branchId, semester.id)}</article>${cards}`;
  }

  function renderSubject(data, subject) {
    const semester = data.semesters.find((item) => item.id === subject.semesterId);
    const type = current.section || 'note';
    const items = data.items.filter((item) => item.subjectId === subject.id && item.type === type)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const tabs = ['note', 'material', 'question', 'result', 'link', 'personal'];
    const tabHtml = tabs.map((itemType) => `<button type="button" class="vault-tab${type === itemType ? ' active' : ''}" data-vault-action="subject-section" data-section="${itemType}">${TYPES[itemType].icon} ${TYPES[itemType].label}</button>`).join('');
    const addButton = `<button class="button" type="button" data-vault-action="add-item" data-type="${type}" data-subject-id="${escapeHtml(subject.id)}">＋ Add ${SINGULAR_TYPES[type]}</button>`;
    const itemHtml = items.length ? `<div class="vault-item-grid">${items.map((item) => itemCard(item, data)).join('')}</div>` :
      `<div class="vault-empty compact-empty"><span>${TYPES[type].icon}</span><h3>No ${TYPES[type].label.toLowerCase()} yet.</h3><p>Add your first ${TYPES[type].label.toLowerCase().replace(/s$/, '')} for ${escapeHtml(subject.name)}.</p>${addButton}</div>`;
    return `${viewHeader(data, `${TYPES[type].icon} Subject Dashboard`, subject.name, `${semester ? `${semester.name} · ` : ''}${[subject.code, subject.teacher, subject.credits ? `${subject.credits} credits` : ''].filter(Boolean).join(' · ') || 'Keep everything for this subject together.'}`, `<button class="button-secondary" type="button" data-vault-action="edit-subject" data-id="${escapeHtml(subject.id)}">✏️ Edit Subject</button><button class="button" type="button" data-vault-action="add-item" data-type="${type}" data-subject-id="${escapeHtml(subject.id)}">＋ Add</button>`)}
      <div class="vault-tabs" role="tablist" aria-label="Subject content">${tabHtml}</div><div class="vault-section-heading compact"><div><span class="eyebrow">${TYPES[type].icon} ${TYPES[type].label}</span><h2>${TYPES[type].label}</h2></div>${items.length ? addButton : ''}</div>${type === 'result' ? renderSubjectResultList(data, subject.id) : ''}${itemHtml}`;
  }

  function itemCard(item, data) {
    const detail = item.type === 'question' ? `${item.importance || 'Medium'} importance${item.topic ? ` · ${item.topic}` : ''}` :
      item.type === 'result' ? `${item.assessment || 'Assessment'} · ${item.obtainedMarks} / ${item.maxMarks}${item.grade ? ` · Grade ${item.grade}` : ''}` :
        [item.topic, item.category, item.date].filter(Boolean).join(' · ');
    const tags = Array.isArray(item.tags) && item.tags.length
      ? `<div class="vault-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : '';
    const content = item.content ? `<p class="vault-item-content">${escapeHtml(item.content)}</p>` : '';
    let safeUrl = '';
    if (item.url) {
      try {
        const parsed = new URL(item.url);
        if (['https:', 'http:'].includes(parsed.protocol)) safeUrl = parsed.href;
      } catch {
        safeUrl = '';
      }
    }
    const link = safeUrl ? `<a class="vault-item-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">Open link ↗</a>` : '';
    return `<article class="vault-item-card" id="vault-item-${escapeHtml(item.id)}">
      <div class="vault-item-top"><span class="feature-icon">${TYPES[item.type]?.icon || '📚'}</span><button class="favorite-button${item.favorite ? ' favorited' : ''}" type="button" data-vault-action="favorite" data-id="${escapeHtml(item.id)}" aria-label="${item.favorite ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${Boolean(item.favorite)}">${item.favorite ? '⭐' : '☆'}</button></div>
      <span class="vault-card-label">${escapeHtml(TYPES[item.type]?.label || item.type)}</span><h3>${escapeHtml(item.title)}</h3>
      ${detail ? `<p class="vault-item-meta">${escapeHtml(detail)}</p>` : ''}${content}${tags}${link}
      <div class="vault-item-footer"><span>Updated ${escapeHtml(new Date(item.updatedAt).toLocaleDateString())}</span><div><button class="mini-button" type="button" data-vault-action="edit-item" data-id="${escapeHtml(item.id)}">✏️ Edit</button><button class="mini-button danger-text" type="button" data-vault-action="delete-item" data-id="${escapeHtml(item.id)}">🗑️ Delete</button></div></div>
    </article>`;
  }

  function renderSubjectResultList(data, subjectId) {
    const results = data.items.filter((item) => item.type === 'result' && item.subjectId === subjectId);
    if (!results.length) return '';
    const maximum = results.reduce((sum, item) => sum + Number(item.maxMarks), 0);
    const obtained = results.reduce((sum, item) => sum + Number(item.obtainedMarks), 0);
    return `<div class="vault-result-inline"><strong>Result total: ${obtained} / ${maximum}${maximum ? ` (${(obtained / maximum * 100).toFixed(2)}%)` : ''}</strong></div>`;
  }

  function itemContext(item, data) {
    const subject = data.subjects.find((record) => record.id === item.subjectId);
    const semester = subject && data.semesters.find((record) => record.id === subject.semesterId);
    const branch = semester && data.branches.find((record) => record.id === semester.branchId);
    return [branch?.shortName || branch?.name, semester?.name, subject?.name, TYPES[item.type]?.label].filter(Boolean).join(' › ');
  }

  function renderFavorites(data, short = false) {
    const favorites = data.items.filter((item) => item.favorite).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const content = favorites.length
      ? `<div class="vault-item-grid">${favorites.slice(0, short ? 3 : undefined).map((item) => itemCard(item, data)).join('')}</div>`
      : '<div class="empty-state">Tap ☆ on a note, question, material or result to keep it close here.</div>';
    return `<div class="vault-section-heading compact"><div><span class="eyebrow">⭐ Favorites</span><h2>${short ? 'Pinned for quick access' : 'Your saved favorites'}</h2></div></div>${content}`;
  }

  function matchingEntries(data) {
    const query = searchTerm.trim().toLocaleLowerCase();
    const itemTypes = searchFilter === 'all' ? Object.keys(TYPES) :
      searchFilter === 'notes' ? ['note', 'personal'] :
        searchFilter === 'questions' ? ['question'] :
          searchFilter === 'materials' ? ['material', 'link'] : ['result'];
    const matches = [];
    const includes = (value) => String(value || '').toLocaleLowerCase().includes(query);
    data.branches.forEach((item) => {
      if ((!query || includes(item.name) || includes(item.shortName)) && searchFilter === 'all') matches.push({ kind: 'branch', id: item.id, title: item.name, detail: `Branch / course · ${item.shortName || item.name}`, icon: '🎓' });
    });
    data.semesters.forEach((item) => {
      if ((!query || includes(item.name)) && searchFilter === 'all') matches.push({ kind: 'semester', id: item.id, title: item.name, detail: `Semester · ${item.branchName || ''}`, icon: '📚' });
    });
    data.subjects.forEach((item) => {
      if ((!query || includes(item.name) || includes(item.code) || includes(item.teacher)) && searchFilter === 'all') matches.push({ kind: 'subject', id: item.id, title: item.name, detail: `Subject · ${item.code || item.teacher || ''}`, icon: '📖' });
    });
    data.items.filter((item) => itemTypes.includes(item.type)).forEach((item) => {
      const search = [item.title, item.content, item.topic, item.tags?.join(' '), item.question, item.category, item.assessment, item.grade, item.remarks, item.maxMarks, item.obtainedMarks, itemContext(item, data)].join(' ');
      if (!query || includes(search)) matches.push({ kind: 'item', id: item.id, title: item.title, detail: `${itemContext(item, data)} · ${item.type === 'result' ? `${item.obtainedMarks}/${item.maxMarks}` : item.topic || ''}`, icon: TYPES[item.type].icon, record: item });
    });
    return matches;
  }

  function renderSearch(data) {
    const matches = matchingEntries(data);
    const filters = [['all', 'All'], ['notes', 'Notes'], ['questions', 'Questions'], ['materials', 'Materials'], ['results', 'Results']];
    return `${viewHeader(data, '🔍 Search Student Vault', 'Find your academic items', 'Search branches, semesters, subjects, notes, tags, questions, materials, results and useful links.', '')}
      <section class="panel vault-search-panel"><label class="vault-search-box"><span>🔍</span><input id="vault-search-input" type="search" value="${escapeHtml(searchTerm)}" placeholder="Try “DBMS”, “Unit 2” or a tag…" autocomplete="off"><button class="button-secondary" type="button" data-vault-action="clear-search">Clear</button></label>
      <div class="vault-filter-list" role="group" aria-label="Filter search results">${filters.map(([value, label]) => `<button type="button" class="vault-filter${searchFilter === value ? ' active' : ''}" data-vault-action="search-filter" data-filter="${value}">${label}</button>`).join('')}</div>
      <p class="muted small" id="search-result-count">${matches.length} ${matches.length === 1 ? 'result' : 'results'}${searchTerm ? ` for “${escapeHtml(searchTerm)}”` : ''}</p>
      <div class="vault-search-results">${matches.length ? matches.map((match) => `<button class="vault-search-result" type="button" data-vault-action="${match.kind === 'item' ? 'open-item' : match.kind}" data-id="${escapeHtml(match.id)}"><span>${match.icon}</span><span><strong>${escapeHtml(match.title)}</strong><small>${escapeHtml(match.detail)}</small></span><span>→</span></button>`).join('') : '<div class="empty-state">No matching items yet. Try a different search or add academic content to your vault.</div>'}</div></section>`;
  }

  function renderSettings() {
    return `${viewHeader({ branches: [], semesters: [], subjects: [] }, '⚙️ Student Vault', 'Vault Settings', 'Create a complete Student Meter backup, restore data or clear your academic records.', '')}
      <div class="vault-settings-grid">
        <article class="panel vault-setting-card"><span class="feature-icon">📤</span><h3>Export Data</h3><p class="muted small">Download a complete Student Meter backup with your profile, progress settings and academic records. Passwords and authentication sessions are excluded.</p><button class="button" type="button" data-vault-action="export">⬇️ Export JSON backup</button></article>
        <article class="panel vault-setting-card"><span class="feature-icon">📥</span><h3>Import Data</h3><p class="muted small">Restore a complete Student Meter backup. Replacing local profile, progress and Vault data requires confirmation.</p><label class="button-secondary vault-file-label" for="vault-import-file">Choose JSON backup</label><input id="vault-import-file" type="file" accept=".json,application/json"></article>
        <article class="panel vault-setting-card danger-setting"><span class="feature-icon">🗑️</span><h3>Clear Vault</h3><p class="muted small">Permanently remove all Student Vault branches, semesters, subjects, notes, questions, materials and results from this browser. When signed in, the deletion is also synced to your account.</p><button class="button-danger" type="button" data-vault-action="clear">Clear Student Vault</button></article>
      </div>
      <div class="notice vault-privacy"><span>🔒</span><span>Cloud sync follows the account status shown above. The local device cache is browser storage, not encrypted cloud storage; keep backups somewhere you trust.</span></div>`;
  }

  async function render() {
    const data = await allData();
    if (current.view === 'overview') root.innerHTML = renderOverview(data);
    else if (current.view === 'branch') {
      const branch = data.branches.find((record) => record.id === current.branchId);
      if (!branch) { current = { view: 'overview' }; return render(); }
      root.innerHTML = renderBranch(data, branch);
    } else if (current.view === 'semester') {
      const semester = data.semesters.find((record) => record.id === current.semesterId);
      if (!semester) { current = { view: 'overview' }; return render(); }
      current.branchId = semester.branchId;
      root.innerHTML = renderSemester(data, semester);
    } else if (current.view === 'subject') {
      const subject = data.subjects.find((record) => record.id === current.subjectId);
      if (!subject) { current = { view: 'overview' }; return render(); }
      current.semesterId = subject.semesterId;
      const semester = data.semesters.find((record) => record.id === subject.semesterId);
      current.branchId = semester?.branchId;
      root.innerHTML = renderSubject(data, subject);
      if (current.focusItemId) {
        const target = document.querySelector(`#vault-item-${CSS.escape(current.focusItemId)}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target?.classList.add('vault-item-highlight');
        current.focusItemId = null;
      }
    } else if (current.view === 'favorites') root.innerHTML = `${breadcrumbs(data)}<section class="panel vault-section-panel">${renderFavorites(data)}</section>`;
    else if (current.view === 'search') {
      root.innerHTML = renderSearch(data);
      const input = document.querySelector('#vault-search-input');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    } else if (current.view === 'settings') root.innerHTML = renderSettings();
    updateNav();
  }

  function updateNav() {
    document.querySelectorAll('[data-vault-view]').forEach((link) => {
      link.classList.toggle('active', link.dataset.vaultView === current.view);
      if (link.dataset.vaultView === current.view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function valueField(name, label, value = '', options = {}) {
    const id = `vault-field-${name}`;
    const full = options.full ? ' full' : '';
    const required = options.required ? ' required' : '';
    const placeholder = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : '';
    if (options.select) {
      const choices = options.select.map((choice) => `<option value="${escapeHtml(choice.value)}" ${String(value) === String(choice.value) ? 'selected' : ''}>${escapeHtml(choice.label)}</option>`).join('');
      return `<div class="field${full}"><label for="${id}">${escapeHtml(label)}</label><select id="${id}" name="${name}"${required}>${choices}</select></div>`;
    }
    if (options.textarea) return `<div class="field${full}"><label for="${id}">${escapeHtml(label)}</label><textarea id="${id}" name="${name}" maxlength="${options.maxlength || 12000}"${required}${placeholder}>${escapeHtml(value)}</textarea></div>`;
    return `<div class="field${full}"><label for="${id}">${escapeHtml(label)}</label><input id="${id}" name="${name}" type="${options.type || 'text'}" value="${escapeHtml(value)}" ${options.min != null ? `min="${options.min}"` : ''} ${options.max != null ? `max="${options.max}"` : ''} ${options.step ? `step="${options.step}"` : ''} maxlength="${options.maxlength || 160}"${required}${placeholder}></div>`;
  }

  function formFields(kind, record = {}) {
    if (kind === 'branch') return [
      valueField('name', 'Branch / Course Name', record.name, { required: true, maxlength: 100, placeholder: 'e.g. Computer Science & Engineering' }),
      valueField('shortName', 'Optional short name', record.shortName, { maxlength: 30, placeholder: 'e.g. CSE' })
    ].join('');
    if (kind === 'semester') return [
      valueField('name', 'Semester name', record.name, { required: true, maxlength: 70, placeholder: 'e.g. 1st Semester or Final Semester' }),
      valueField('branchId', 'Branch / Course', record.branchId || current.branchId, { required: true, select: branchesOptions })
    ].join('');
    if (kind === 'subject') return [
      valueField('name', 'Subject name', record.name, { required: true, maxlength: 100, placeholder: 'e.g. Advanced Java' }),
      valueField('code', 'Subject code (optional)', record.code, { maxlength: 30, placeholder: 'e.g. CS501' }),
      valueField('teacher', 'Teacher name (optional)', record.teacher, { maxlength: 80 }),
      valueField('credits', 'Credits (optional)', record.credits, { type: 'number', min: 0, max: 100, step: '0.5' }),
      valueField('semesterId', 'Semester', record.semesterId || current.semesterId, { required: true, select: semesterOptions })
    ].join('');
    if (kind === 'semester-result') return [
      valueField('sgpa', 'SGPA (optional, enter manually)', record.sgpa, { type: 'number', min: 0, step: '0.01', placeholder: 'Use your institution’s scale' }),
      valueField('cgpa', 'CGPA (optional, enter manually)', record.cgpa, { type: 'number', min: 0, step: '0.01' }),
      valueField('backlogs', 'Backlog count (optional)', record.backlogs, { type: 'number', min: 0, max: 999, step: '1' })
    ].join('');
    const type = kind;
    const commonTitle = valueField('title', type === 'question' ? 'Question' : type === 'result' ? 'Subject / Result title' : 'Title', record.title, { required: true, full: true, maxlength: 150 });
    if (type === 'note' || type === 'personal') return commonTitle + [
      valueField('topic', 'Chapter / Topic (optional)', record.topic, { maxlength: 80 }),
      valueField('date', 'Date', record.date || SM.today(), { type: 'date' }),
      valueField('tags', 'Tags (comma separated)', (record.tags || []).join(', '), { full: true, maxlength: 300, placeholder: 'e.g. Java, OOP, Exam' }),
      valueField('content', 'Description / Content', record.content, { textarea: true, full: true })
    ].join('');
    if (type === 'question') return commonTitle + [
      valueField('topic', 'Unit / Chapter', record.topic, { maxlength: 80 }),
      valueField('importance', 'Importance', record.importance || 'Medium', { select: [{ value: 'High', label: '⭐ High' }, { value: 'Medium', label: 'Medium' }, { value: 'Low', label: 'Low' }] }),
      valueField('content', 'Extra notes (optional)', record.content, { textarea: true, full: true })
    ].join('');
    if (type === 'material') return commonTitle + [
      valueField('description', 'Description (optional)', record.content, { textarea: true, full: true }),
      valueField('url', 'Link (optional)', record.url, { type: 'url', full: true, maxlength: 1000, placeholder: 'https://example.com' }),
      valueField('category', 'Category', record.category || 'PDF', { select: ['PDF', 'Video', 'Website', 'Question Paper', 'Other'].map((value) => ({ value, label: value })) })
    ].join('');
    if (type === 'link') return commonTitle + [
      valueField('url', 'Website URL', record.url, { type: 'url', required: true, full: true, maxlength: 1000, placeholder: 'https://example.com' }),
      valueField('description', 'Description (optional)', record.content, { textarea: true, full: true })
    ].join('');
    return commonTitle + [
      valueField('assessment', 'Exam / Assessment name', record.assessment, { required: true }),
      valueField('maxMarks', 'Maximum marks', record.maxMarks, { type: 'number', required: true, min: 0.01, max: 100000, step: '0.01' }),
      valueField('obtainedMarks', 'Obtained marks', record.obtainedMarks, { type: 'number', required: true, min: 0, max: 100000, step: '0.01' }),
      valueField('grade', 'Grade (optional; enter manually)', record.grade, { maxlength: 20 }),
      valueField('credits', 'Credits (optional)', record.credits, { type: 'number', min: 0, max: 100, step: '0.5' }),
      valueField('remarks', 'Remarks (optional)', record.remarks, { textarea: true, full: true })
    ].join('');
  }

  let branchesOptions = [];
  let semesterOptions = [];

  async function openForm(kind, id = null, options = {}) {
    const data = await allData();
    branchesOptions = data.branches.map((branch) => ({ value: branch.id, label: branch.name }));
    semesterOptions = data.semesters.map((semester) => ({ value: semester.id, label: `${data.branches.find((branch) => branch.id === semester.branchId)?.shortName || data.branches.find((branch) => branch.id === semester.branchId)?.name || 'Branch'} · ${semester.name}` }));
    let store = 'items';
    if (kind === 'branch') store = 'branches';
    if (kind === 'semester' || kind === 'semester-result') store = 'semesters';
    if (kind === 'subject') store = 'subjects';
    const record = id ? (kind === 'semester-result'
      ? data.semesters.find((item) => item.id === id)
      : data[store].find((item) => item.id === id)) || {} : {};
    const type = options.type || kind;
    if (kind === 'semester' && !id) record.branchId = options.branchId || current.branchId;
    if (kind === 'subject' && !id) record.semesterId = options.semesterId || current.semesterId;
    const titles = {
      branch: id ? 'Edit Branch / Course' : 'Add Branch / Course',
      semester: id ? 'Edit Semester' : 'Add Semester',
      subject: id ? 'Edit Subject' : 'Add Subject',
      'semester-result': 'Edit Semester Result Details',
      note: id ? 'Edit Note' : 'Add Note',
      personal: id ? 'Edit Personal Note' : 'Add Personal Note',
      question: id ? 'Edit Important Question' : 'Add Important Question',
      material: id ? 'Edit Study Material' : 'Add Study Material',
      result: id ? 'Edit Result Entry' : 'Add Result Entry',
      link: id ? 'Edit Useful Link' : 'Add Useful Link'
    };
    document.querySelector('#vault-modal-title').textContent = titles[kind] || 'Edit item';
    document.querySelector('#vault-modal-eyebrow').textContent = kind === 'semester-result' ? 'Semester result' : id ? 'Edit your academic record' : 'Add to your Student Vault';
    form.dataset.kind = kind;
    form.dataset.type = type;
    form.dataset.recordId = id || '';
    form.dataset.parentId = options.subjectId || current.subjectId || '';
    form.innerHTML = `<div class="field-grid">${formFields(kind === 'semester-result' ? kind : type, record)}</div><div class="form-actions"><button class="button" type="submit">${id ? 'Save changes' : 'Save to Vault'}</button><button class="button-secondary" type="button" data-vault-modal-close>Cancel</button></div>`;
    previousFocus = document.activeElement;
    modal.hidden = false;
    modal.querySelector('input:not([type="hidden"]), select, textarea')?.focus();
  }

  function closeForm() {
    modal.hidden = true;
    form.reset();
    previousFocus?.focus?.();
  }

  async function saveForm(event) {
    event.preventDefault();
    const data = new FormData(form);
    const kind = form.dataset.kind;
    const id = form.dataset.recordId || uid();
    const existing = form.dataset.recordId !== '';
    const createdAt = existing ? (await getRecord(kind, id))?.createdAt || stamp() : stamp();
    const now = stamp();
    const stringValue = (name) => String(data.get(name) || '').trim();
    try {
      if (kind === 'branch') {
        const name = stringValue('name');
        if (!name) return showMessage('Enter a branch or course name.');
        const all = await records('branches');
        if (all.some((item) => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return showMessage('A branch with that name already exists.');
        await put('branches', { id, name, shortName: stringValue('shortName'), createdAt, updatedAt: now });
        current = existing ? current : { view: 'overview' };
      } else if (kind === 'semester') {
        const name = stringValue('name');
        const branchId = stringValue('branchId');
        if (!name || !branchId) return showMessage('Enter a semester name and choose its branch.');
        const [semesters, branches] = await Promise.all([records('semesters'), records('branches')]);
        if (!branches.some((branch) => branch.id === branchId)) return showMessage('That branch no longer exists. Choose a branch again.');
        if (semesters.some((item) => item.id !== id && item.branchId === branchId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return showMessage('That semester name already exists in this branch.');
        await put('semesters', { id, branchId, name, sgpa: existing ? (await getRecord('semester', id))?.sgpa || '' : '', cgpa: existing ? (await getRecord('semester', id))?.cgpa || '' : '', backlogs: existing ? (await getRecord('semester', id))?.backlogs ?? '' : '', createdAt, updatedAt: now });
        current = { view: 'branch', branchId };
      } else if (kind === 'subject') {
        const name = stringValue('name');
        const semesterId = stringValue('semesterId');
        if (!name || !semesterId) return showMessage('Enter a subject name and choose its semester.');
        const [subjects, semesters] = await Promise.all([records('subjects'), records('semesters')]);
        if (!semesters.some((semester) => semester.id === semesterId)) return showMessage('That semester no longer exists. Choose a semester again.');
        if (subjects.some((item) => item.id !== id && item.semesterId === semesterId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return showMessage('That subject already exists in this semester.');
        const semester = semesters.find((item) => item.id === semesterId);
        await put('subjects', { id, semesterId, name, code: stringValue('code'), teacher: stringValue('teacher'), credits: stringValue('credits'), createdAt, updatedAt: now });
        current = { view: 'semester', branchId: semester.branchId, semesterId };
      } else if (kind === 'semester-result') {
        const old = await getRecord('semester', id);
        if (!old) return showMessage('That semester could not be found.');
        const sgpa = stringValue('sgpa');
        const cgpa = stringValue('cgpa');
        const backlogs = stringValue('backlogs');
        if ([sgpa, cgpa].some((value) => value && (!Number.isFinite(Number(value)) || Number(value) < 0))) return showMessage('Enter a non-negative SGPA / CGPA value, or leave it blank.');
        if (backlogs && (!Number.isInteger(Number(backlogs)) || Number(backlogs) < 0)) return showMessage('Backlog count must be a non-negative whole number.');
        await put('semesters', { ...old, sgpa, cgpa, backlogs, updatedAt: now });
      } else {
        const type = kind;
        const title = stringValue('title');
        const subjectId = existing ? (await getRecord('item', id))?.subjectId : form.dataset.parentId;
        if (!title || !subjectId) return showMessage('Enter a title and choose a valid subject.');
        const subject = await getRecord('subject', subjectId);
        if (!subject) return showMessage('That subject no longer exists. Open a subject and try again.');
        const base = existing ? await getRecord('item', id) : {};
        const item = {
          ...base,
          id, subjectId, type, title, content: stringValue(type === 'material' || type === 'link' ? 'description' : 'content'),
          topic: stringValue('topic'), date: stringValue('date'), tags: stringValue('tags').split(',').map((tag) => tag.trim()).filter(Boolean),
          importance: stringValue('importance') || 'Medium', category: stringValue('category'), url: stringValue('url'),
          assessment: stringValue('assessment'), grade: stringValue('grade'), credits: stringValue('credits'),
          remarks: stringValue('remarks'), createdAt, updatedAt: now, favorite: Boolean(base.favorite)
        };
        if (type === 'material' || type === 'link') {
          if (item.url) {
            let parsed;
            try { parsed = new URL(item.url); } catch { return showMessage('Enter a valid full URL, including https://.'); }
            if (!['https:', 'http:'].includes(parsed.protocol)) return showMessage('Only HTTP and HTTPS links are supported.');
          }
          if (type === 'link' && !item.url) return showMessage('Enter a URL for this useful link.');
        }
        if (type === 'result') {
          item.maxMarks = Number(data.get('maxMarks'));
          item.obtainedMarks = Number(data.get('obtainedMarks'));
          item.assessment = stringValue('assessment');
          item.credits = stringValue('credits');
          if (!Number.isFinite(item.maxMarks) || item.maxMarks <= 0) return showMessage('Maximum marks must be greater than zero.');
          if (!Number.isFinite(item.obtainedMarks) || item.obtainedMarks < 0) return showMessage('Obtained marks must be zero or more.');
          if (item.obtainedMarks > item.maxMarks) return showMessage('Obtained marks cannot exceed maximum marks.');
          if (!item.assessment) return showMessage('Enter an exam or assessment name.');
        }
        await put('items', item);
        const semester = await getRecord('semester', subject.semesterId);
        current = { view: 'subject', branchId: semester?.branchId, semesterId: subject.semesterId, subjectId, section: type };
      }
      closeForm();
      await render();
      document.dispatchEvent(new CustomEvent('student-meter:vaultchange'));
      showMessage(existing ? 'Changes saved to your Student Vault.' : 'Added to your Student Vault.');
    } catch (error) {
      console.error('Could not save Student Vault record.', error);
      showMessage(error.message || 'Could not save this item. Please try again.');
    }
  }

  async function getRecord(kind, id) {
    const store = kind === 'branch' ? 'branches' :
      kind === 'semester' || kind === 'semester-result' ? 'semesters' :
        kind === 'subject' ? 'subjects' : kind === 'item' || TYPES[kind] ? 'items' : null;
    if (!store) return null;
    return request(store, 'readonly', (objectStore) => objectStore.get(id));
  }

  function openLocation(record, kind, data) {
    if (kind === 'branch') current = { view: 'branch', branchId: record.id };
    else if (kind === 'semester') current = { view: 'semester', branchId: record.branchId, semesterId: record.id };
    else if (kind === 'subject') {
      const semester = data.semesters.find((item) => item.id === record.semesterId);
      current = { view: 'subject', branchId: semester?.branchId, semesterId: record.semesterId, subjectId: record.id, section: 'note' };
    } else {
      const subject = data.subjects.find((item) => item.id === record.subjectId);
      const semester = data.semesters.find((item) => item.id === subject?.semesterId);
      current = { view: 'subject', branchId: semester?.branchId, semesterId: subject?.semesterId, subjectId: subject?.id, section: record.type, focusItemId: record.id };
    }
    render().catch(handleError);
  }

  async function handleAction(button) {
    const action = button.dataset.vaultAction;
    const id = button.dataset.id;
    const data = await allData();
    if (action === 'overview') { current = { view: 'overview' }; return render(); }
    if (action === 'favorites') { current = { view: 'favorites' }; return render(); }
    if (action === 'search') { current = { view: 'search' }; searchTerm = ''; return render(); }
    if (action === 'settings') { current = { view: 'settings' }; return render(); }
    if (action === 'branch') {
      if (!id) { current = { view: 'overview' }; return render(); }
      const branch = data.branches.find((item) => item.id === id);
      if (branch) { current = { view: 'branch', branchId: id }; return render(); }
    }
    if (action === 'semester') {
      const semester = data.semesters.find((item) => item.id === id);
      if (semester) { current = { view: 'semester', branchId: semester.branchId, semesterId: id }; return render(); }
    }
    if (action === 'subject') {
      if (button.dataset.section) {
        current.section = button.dataset.section;
        return render();
      }
      const subject = data.subjects.find((item) => item.id === id);
      if (subject) {
        const semester = data.semesters.find((item) => item.id === subject.semesterId);
        current = { view: 'subject', branchId: semester?.branchId, semesterId: subject.semesterId, subjectId: id, section: 'note' };
        return render();
      }
    }
    if (action === 'subject-section') { current.section = button.dataset.section; return render(); }
    if (action === 'add-branch') return openForm('branch');
    if (action === 'add-semester') return openForm('semester', null, { branchId: button.dataset.branchId });
    if (action === 'add-subject') return openForm('subject', null, { semesterId: button.dataset.semesterId });
    if (action === 'add-item') return openForm(button.dataset.type || 'note', null, { subjectId: button.dataset.subjectId });
    if (action === 'edit-branch') return openForm('branch', id);
    if (action === 'edit-semester') return openForm('semester', id);
    if (action === 'edit-subject') return openForm('subject', id);
    if (action === 'edit-semester-result') return openForm('semester-result', id);
    if (action === 'edit-item') {
      const item = data.items.find((record) => record.id === id);
      if (item) return openForm(item.type, id);
    }
    if (action === 'delete-branch' && window.confirm('Delete this branch, all its semesters, subjects and academic content? This cannot be undone.')) {
      await removeTree('branches', id);
      document.dispatchEvent(new CustomEvent('student-meter:vaultchange'));
      current = { view: 'overview' };
      showMessage('Branch and its academic records were deleted.');
      return render();
    }
    if (action === 'delete-semester' && window.confirm('Delete this semester, its subjects and academic content? This cannot be undone.')) {
      await removeTree('semesters', id);
      document.dispatchEvent(new CustomEvent('student-meter:vaultchange'));
      current = { view: 'branch', branchId: button.dataset.branchId || current.branchId };
      showMessage('Semester and its academic records were deleted.');
      return render();
    }
    if (action === 'delete-subject' && window.confirm('Delete this subject and all of its notes, questions, materials and results? This cannot be undone.')) {
      const subject = data.subjects.find((item) => item.id === id);
      await removeTree('subjects', id);
      document.dispatchEvent(new CustomEvent('student-meter:vaultchange'));
      current = { view: 'semester', branchId: data.semesters.find((item) => item.id === subject?.semesterId)?.branchId, semesterId: subject?.semesterId };
      showMessage('Subject and its academic content were deleted.');
      return render();
    }
    if (action === 'delete-item' && window.confirm('Delete this academic item? This cannot be undone.')) {
      const item = data.items.find((record) => record.id === id);
      await removeTree('items', id);
      document.dispatchEvent(new CustomEvent('student-meter:vaultchange'));
      showMessage('Academic item deleted.');
      if (item) openLocation({ ...item, type: current.section || item.type }, 'item', data);
      return;
    }
    if (action === 'favorite') {
      const item = data.items.find((record) => record.id === id);
      if (item) {
        item.favorite = !item.favorite;
        item.updatedAt = stamp();
        await put('items', item);
        document.dispatchEvent(new CustomEvent('student-meter:vaultchange'));
        showMessage(item.favorite ? 'Added to Favorites.' : 'Removed from Favorites.');
        return render();
      }
    }
    if (action === 'open-item') {
      const item = data.items.find((record) => record.id === id);
      if (item) return openLocation(item, 'item', data);
    }
    if (action === 'export') return exportBackup();
    if (action === 'clear') return clearVault();
    if (action === 'search-filter') {
      searchFilter = button.dataset.filter || 'all';
      return render();
    }
    if (action === 'clear-search') { searchTerm = ''; return render(); }
  }

  function handleError(error) {
    console.error('Student Vault operation failed.', error);
    showMessage(error.message || 'Something went wrong in Student Vault. Please try again.');
  }

  function validateBackup(data) {
    const isLegacy = data?.format === 'student-meter-vault' && data.version === 1;
    const isComplete = data?.format === 'student-meter' && data.version === 2;
    const snapshot = isComplete ? data.data?.vault : data?.data;
    if ((!isLegacy && !isComplete) || !snapshot ||
      !STORES.every((store) => Array.isArray(snapshot[store]))) {
      throw new Error('This file is not a supported Student Vault backup.');
    }
    for (const store of STORES) {
      const ids = new Set();
      for (const record of snapshot[store]) {
        if (!record || typeof record.id !== 'string' || !record.id || ids.has(record.id)) throw new Error(`The backup contains an invalid or duplicate ${store} record.`);
        ids.add(record.id);
      }
    }
    const branches = new Set(snapshot.branches.map((item) => item.id));
    const semesters = new Set(snapshot.semesters.map((item) => item.id));
    const subjects = new Set(snapshot.subjects.map((item) => item.id));
    if (snapshot.branches.some((item) => !item.name?.trim()) ||
      snapshot.semesters.some((item) => !item.name?.trim() || !branches.has(item.branchId)) ||
      snapshot.subjects.some((item) => !item.name?.trim() || !semesters.has(item.semesterId)) ||
      snapshot.items.some((item) => !item.title?.trim() || !subjects.has(item.subjectId) || !TYPES[item.type])) {
      throw new Error('The backup is missing required names or contains references to missing academic records.');
    }
    for (const item of snapshot.items.filter((record) => record.type === 'result')) {
      if (!Number.isFinite(Number(item.maxMarks)) || Number(item.maxMarks) <= 0 ||
        !Number.isFinite(Number(item.obtainedMarks)) || Number(item.obtainedMarks) < 0 ||
        Number(item.obtainedMarks) > Number(item.maxMarks)) throw new Error('The backup contains an invalid result entry.');
    }
    for (const item of snapshot.items.filter((record) => record.url)) {
      let parsed;
      try { parsed = new URL(item.url); } catch { throw new Error('The backup contains an invalid material or useful-link URL.'); }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('The backup contains an unsupported link. Only HTTP and HTTPS URLs are allowed.');
    }
    const appData = isComplete ? data.data.appData : {};
    if (!appData || typeof appData !== 'object' || Array.isArray(appData) ||
      Object.keys(appData).some((key) => !BACKUP_APP_DATA_KEYS.has(key)) ||
      containsCredentialField(appData)) {
      throw new Error('The backup contains invalid Student Meter settings.');
    }
    return { vault: snapshot, appData };
  }

  async function exportBackup() {
    try {
      const data = window.SM.Cloud ? await window.SM.Cloud.exportSnapshot() : { version: 1, appData: {}, vault: await snapshot() };
      const backup = { format: 'student-meter', version: 2, exportedAt: stamp(), data };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `student-meter-backup-${SM.today()}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showMessage('Complete Student Meter backup exported. Authentication credentials are not included.');
    } catch (error) {
      handleError(error);
    }
  }

  async function importBackup(file) {
    if (!file) return;
    const importInput = document.querySelector('#vault-import-file');
    try {
      const parsed = JSON.parse(await file.text());
      const data = validateBackup(parsed);
      if (!window.confirm('Importing this backup may replace existing Student Meter settings and Student Vault records on this device. Authentication credentials are never imported. Continue?')) return;
      await replaceData(data.vault);
      if (parsed.version === 2) {
        const protectedKeys = new Set(['student-meter:cloud-sync-marker', 'student-meter:cloud-sync-pending']);
        const localKeys = [];
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (key?.startsWith('student-meter:') && !protectedKeys.has(key)) localKeys.push(key);
        }
        localKeys.forEach((key) => localStorage.removeItem(key));
        Object.entries(data.appData).forEach(([key, value]) => localStorage.setItem(`student-meter:${key}`, JSON.stringify(value)));
        document.dispatchEvent(new CustomEvent('student-meter:datachange'));
      }
      document.dispatchEvent(new CustomEvent('student-meter:vaultchange'));
      current = { view: 'overview' };
      showMessage('Student Vault backup restored.');
      await render();
    } catch (error) {
      if (error instanceof SyntaxError) {
        showMessage('That file is not valid JSON.');
      } else {
        console.error('Could not import Student Vault backup.', error);
        showMessage(error.message || 'Could not import this backup.');
      }
    } finally {
      if (importInput) importInput.value = '';
    }
  }

  async function clearVault() {
    if (!window.confirm('This will permanently remove all Student Vault data from this browser/device. If signed in, the deletion will sync to your account when online. This cannot be undone.')) return;
    try {
      await replaceData({ branches: [], semesters: [], subjects: [], items: [] });
      document.dispatchEvent(new CustomEvent('student-meter:vaultchange'));
      current = { view: 'overview' };
      showMessage('Student Vault data cleared on this device. Any cloud deletion will sync when online.');
      await render();
    } catch (error) {
      handleError(error);
    }
  }

  function navigate(action) {
    current = { view: action };
    if (action === 'overview') searchTerm = '';
    render().catch(handleError);
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-vault-action]');
    if (button) handleAction(button).catch(handleError);
  });
  root.addEventListener('input', (event) => {
    if (event.target.id !== 'vault-search-input') return;
    searchTerm = event.target.value;
    const selectionStart = event.target.selectionStart;
    const selectionEnd = event.target.selectionEnd;
    render().then(() => {
      const input = document.querySelector('#vault-search-input');
      input?.focus();
      input?.setSelectionRange(selectionStart, selectionEnd);
    }).catch(handleError);
  });
  form.addEventListener('submit', (event) => saveForm(event).catch(handleError));
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-vault-modal-close]')) closeForm();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) closeForm();
  });
  document.querySelector('.vault-nav').addEventListener('click', (event) => {
    const link = event.target.closest('[data-vault-view]');
    if (!link) return;
    event.preventDefault();
    navigate(link.dataset.vaultView);
  });
  document.querySelector('[data-vault-action="search"]')?.addEventListener('click', () => navigate('search'));
  document.querySelector('[data-vault-action="add-branch"]')?.addEventListener('click', () => openForm('branch').catch(handleError));
  root.addEventListener('change', (event) => {
    if (event.target.id === 'vault-import-file') importBackup(event.target.files?.[0]);
  });

  async function initialize() {
    try {
      await openDatabase();
      await render();
    } catch (error) {
      console.error('Student Vault could not initialize.', error);
      root.innerHTML = `<section class="panel"><span class="eyebrow">Storage unavailable</span><h2>Student Vault could not open.</h2><p class="muted">${escapeHtml(error.message)} Your existing Student Meter data is unaffected.</p><button class="button-secondary" type="button" data-vault-action="retry">Try again</button></section>`;
      root.addEventListener('click', (event) => {
        if (event.target.closest('[data-vault-action="retry"]')) initialize();
      }, { once: true });
    }
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-vault-action="retry"]')) initialize();
  });
  initialize();
})();
