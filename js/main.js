(() => {
  const STORAGE_PREFIX = 'student-meter:';
  const today = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(STORAGE_PREFIX + key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.error(`Could not read Student Meter data "${key}".`, error);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      if (localStorage.getItem('student-meter:cloud-sync-marker')) {
        localStorage.setItem('student-meter:cloud-sync-pending', 'local');
      }
      document.dispatchEvent(new CustomEvent('student-meter:datachange', { detail: { key } }));
      return true;
    } catch (error) {
      console.error(`Could not save Student Meter data "${key}".`, error);
      notify('Your browser could not save this change. Check your storage settings.');
      return false;
    }
  }

  function notify(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.hidden = true;
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(notify.timeout);
    notify.timeout = setTimeout(() => { toast.hidden = true; }, 2800);
  }

  function addXp(amount) {
    const xp = Math.max(0, Number(read('xp', 0)) || 0) + amount;
    write('xp', xp);
    renderXp();
    return xp;
  }

  function streak(key) {
    const days = new Set(read(key, []));
    const cursor = new Date();
    if (!days.has(today(cursor))) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (days.has(today(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  function renderXp() {
    const xp = Number(read('xp', 0)) || 0;
    const level = Math.floor(xp / 500) + 1;
    document.querySelectorAll('[data-xp]').forEach((el) => { el.textContent = xp; });
    document.querySelectorAll('[data-level]').forEach((el) => { el.textContent = level; });
    document.querySelectorAll('[data-level-progress]').forEach((el) => {
      el.style.width = `${(xp % 500) / 5}%`;
    });
  }

  function profile() {
    return read('profile', { name: '', college: '', branch: '', semester: '', studyGoal: 120 });
  }

  function updateHome() {
    const user = profile();
    const greeting = document.querySelector('[data-greeting]');
    if (greeting && user.name) greeting.textContent = `Welcome back, ${user.name}`;

    const study = read('study', { sessions: [], subjects: [] });
    const minsToday = (study.sessions || []).filter((item) => item.date === today()).reduce((sum, item) => sum + item.minutes, 0);
    const goals = read('goals', []);
    const challenges = read('challenges', { date: today(), completed: [] });
    const streakDays = streak('studyDays');
    document.querySelectorAll('[data-home-study]').forEach((el) => { el.textContent = `${minsToday}m`; });
    document.querySelectorAll('[data-home-streak]').forEach((el) => { el.textContent = streakDays; });
    document.querySelectorAll('[data-home-goals]').forEach((el) => { el.textContent = goals.filter((goal) => goal.done).length; });
    document.querySelectorAll('[data-home-challenges]').forEach((el) => { el.textContent = (challenges.completed || []).length; });
  }

  function setUpTheme() {
    const saved = read('theme', 'dark');
    if (saved === 'light') document.body.classList.add('light');
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
      button.addEventListener('click', () => {
        document.body.classList.toggle('light');
        const theme = document.body.classList.contains('light') ? 'light' : 'dark';
        write('theme', theme);
        button.textContent = theme === 'light' ? '☀️' : '🌙';
      });
    });
  }

  function setUpProfile() {
    const form = document.querySelector('[data-profile-form]');
    if (!form) return;
    const user = profile();
    for (const [key, value] of Object.entries(user)) {
      const input = form.elements.namedItem(key);
      if (input) input.value = value;
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const updatedProfile = {
        name: String(data.get('name') || '').trim(),
        college: String(data.get('college') || '').trim(),
        branch: String(data.get('branch') || '').trim(),
        semester: String(data.get('semester') || '').trim(),
        studyGoal: Math.max(1, Number(data.get('studyGoal')) || 120)
      };
      if (!write('profile', updatedProfile)) return;
      const study = read('study', { goal: updatedProfile.studyGoal, subjects: [], sessions: [] });
      study.goal = updatedProfile.studyGoal;
      if (!write('study', study)) return;
      const reminderSettings = getReminderSettings();
      reminderSettings.targetMinutes = updatedProfile.studyGoal;
      write('reminderSettings', reminderSettings);
      notify('Profile saved. Your dashboard is up to date!');
      renderProfileStats();
    });
    renderProfileStats();
  }

  function renderProfileStats() {
    const streakDays = streak('studyDays');
    const goals = read('goals', []);
    const challenges = read('challengeHistory', []);
    document.querySelectorAll('[data-profile-streak]').forEach((el) => { el.textContent = streakDays; });
    document.querySelectorAll('[data-profile-goals]').forEach((el) => { el.textContent = goals.filter((goal) => goal.done).length; });
    document.querySelectorAll('[data-profile-challenges]').forEach((el) => { el.textContent = challenges.length; });
  }

  function setUpStudentLife() {
    const situation = document.querySelector('[data-life-situation]');
    const response = document.querySelector('[data-life-response]');
    if (situation && response) {
      const scenarios = [
        ['Assignment kal submit karna hai aur aaj yaad aaya? 😭', ['Panic mode', 'Make a 20-min plan', 'Ask a friend']],
        ['Exam ke ek din pehle padhai start karna is not a strategy 😂', ['Speedrun the syllabus', 'Pick important topics', 'Take a deep breath']],
        ['Your notes are looking at you like “ab toh padh le” 📚', ['Open the first page', 'Organize everything first', 'One topic at a time']],
        ['Group project mein “I will do it tonight” ka time aa gaya 💻', ['Start a tiny task', 'Make a checklist', 'Message the team']]
      ];
      const replies = [
        ['Bold strategy 😅 Try a 20-minute sprint and start with the easiest bit.', 'Future-you says thanks. One small step beats a perfect plan.', 'Teamwork makes the deadline less dramatic. Send one clear message.'],
        ['Plot twist: a focused shortlist beats reading every page in panic mode.', 'Choose the high-value topics, then take a proper short break.', 'Breathe in, breathe out. You can make a calm plan from here.']
      ];
      const setScenario = () => {
        const [prompt, choices] = scenarios[Math.floor(Math.random() * scenarios.length)];
        situation.textContent = prompt;
        const box = document.querySelector('[data-life-choices]');
        box.replaceChildren();
        choices.forEach((choice, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'button-secondary';
          button.textContent = choice;
          button.addEventListener('click', () => {
            response.textContent = replies[Math.floor(Math.random() * replies.length)][index % 3];
          });
          box.append(button);
        });
        response.textContent = 'Pick your move — no judgement, just student-life strategy.';
      };
      document.querySelector('[data-life-reroll]')?.addEventListener('click', setScenario);
      setScenario();
    }
    document.querySelectorAll('[data-relationship]').forEach((button) => {
      button.addEventListener('click', () => {
        const result = document.querySelector('[data-relationship-result]');
        result.textContent = button.dataset.relationship === 'partner'
          ? 'Thoda time baat kar lo, but apni padhai ko completely ignore mat karna 😄📚'
          : 'Toh phir tumhare paas padhai, skills aur apne goals ke liye extra time hai 😎📚';
      });
    });
    const quoteEl = document.querySelector('[data-life-quote]');
    if (quoteEl) {
      const quotes = ['Small progress is still progress. Keep showing up. ✨', 'You do not have to do it all today. Just start somewhere. 🌱', 'Your future self is cheering for today’s effort. 📣', 'A little focus now, a little more freedom later. ☀️'];
      quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
      document.querySelector('[data-life-new-quote]')?.addEventListener('click', () => {
        quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
      });
    }
  }

  const LADKA_MESSAGE = 'EEI LADKA, AAJ KYUN NHI PADHA H? MAA BAAP KO DHOKHA DE RAHA H.';
  const LADKI_MESSAGE = 'EEI LADKI, AAJ KYUN NHI PADHI H? MAA BAAP KO DHOKHA DE RAHI H.';
  const reminderPrefix = 'student-meter:';
  const defaultReminderSettings = () => {
    const study = read('study', { goal: 120 });
    return {
      enabled: false,
      studentType: 'LADKA',
      targetMinutes: Math.max(1, Number(study.goal) || 120),
      intervalMinutes: 60,
      mode: 'Friendly',
      browserNotifications: false
    };
  };

  function getReminderSettings() {
    return { ...defaultReminderSettings(), ...read('reminderSettings', {}) };
  }

  function getReminderState() {
    const currentDate = today();
    let state = read('reminderState', null);
    if (!state || state.date !== currentDate) {
      state = {
        date: currentDate,
        enabledAt: getReminderSettings().enabled ? new Date().toISOString() : null,
        lastReminderAt: null,
        nextReminderAt: null,
        acknowledgedDate: null,
        history: Array.isArray(state?.history) ? state.history : []
      };
      write('reminderState', state);
    }
    if (!Array.isArray(state.history)) state.history = [];
    return state;
  }

  function studyReminderStats() {
    const settings = getReminderSettings();
    const study = read('study', { sessions: [] });
    const completedMinutes = (study.sessions || [])
      .filter((session) => session.date === today())
      .reduce((sum, session) => sum + Math.max(0, Number(session.minutes) || 0), 0);
    const targetMinutes = Math.max(1, Number(settings.targetMinutes) || 120);
    return {
      settings,
      completedMinutes,
      targetMinutes,
      remainingMinutes: Math.max(0, targetMinutes - completedMinutes),
      progress: Math.min(100, Math.round(completedMinutes / targetMinutes * 100)),
      complete: completedMinutes >= targetMinutes
    };
  }

  function formatStudyTime(minutes) {
    const value = Math.max(0, Math.floor(Number(minutes) || 0));
    const hours = Math.floor(value / 60);
    const remainder = value % 60;
    if (hours && remainder) return `${hours}h ${remainder}m`;
    if (hours) return `${hours}h`;
    return `${remainder}m`;
  }

  function reminderMessage(settings = getReminderSettings()) {
    const exact = settings.studentType === 'LADKI' ? LADKI_MESSAGE : LADKA_MESSAGE;
    const supportive = {
      Friendly: 'Chal, thoda padh le 😭📚',
      Serious: 'Bas thoda sa aur focus kar, target complete kar de.',
      Strict: 'Ab ek focused session shuru kar — progress tere haath mein.',
      'Funny Roast': 'Books tumhara wait karte karte bore ho gayi 😭📚'
    };
    return { exact, supportive: supportive[settings.mode] || supportive.Friendly };
  }

  let previousFocus = null;
  function closeReminderPopup() {
    const popup = document.querySelector('#study-reminder-modal');
    if (!popup) return;
    popup.hidden = true;
    previousFocus?.focus?.();
  }

  function ensureReminderPopup() {
    let popup = document.querySelector('#study-reminder-modal');
    if (popup) return popup;
    popup = document.createElement('div');
    popup.id = 'study-reminder-modal';
    popup.className = 'reminder-overlay';
    popup.hidden = true;
    popup.innerHTML = `
      <section class="reminder-dialog" role="dialog" aria-modal="true" aria-labelledby="reminder-modal-title">
        <button class="reminder-close" type="button" data-reminder-close aria-label="Close reminder">×</button>
        <div class="reminder-warning" aria-hidden="true">⚠️</div>
        <span class="eyebrow">A gentle nudge from Student Meter</span>
        <h2 id="reminder-modal-title">📚 Study Reminder</h2>
        <p class="reminder-exact" data-reminder-message></p>
        <p class="reminder-support" data-reminder-support></p>
        <div class="reminder-modal-actions">
          <a class="button" href="study.html">START STUDYING</a>
          <button class="button-secondary" type="button" data-reminder-later>REMIND ME LATER</button>
          <button class="button-secondary" type="button" data-reminder-close>CLOSE</button>
          <button class="button-secondary" type="button" data-target-complete hidden>MARK TARGET COMPLETE</button>
        </div>
      </section>`;
    document.body.append(popup);
    popup.addEventListener('click', (event) => {
      if (event.target === popup || event.target.closest('[data-reminder-close]')) closeReminderPopup();
      if (event.target.closest('[data-reminder-later]')) snoozeReminder();
      if (event.target.closest('[data-target-complete]')) acknowledgeTarget();
    });
    return popup;
  }

  function showReminderPopup() {
    const popup = ensureReminderPopup();
    const stats = studyReminderStats();
    const message = reminderMessage(stats.settings);
    popup.querySelector('[data-reminder-message]').textContent = message.exact;
    popup.querySelector('[data-reminder-support]').textContent = message.supportive;
    popup.querySelector('[data-target-complete]').hidden = !stats.complete;
    previousFocus = document.activeElement;
    popup.hidden = false;
    popup.querySelector('[data-reminder-close]').focus();
  }

  function snoozeReminder() {
    const state = getReminderState();
    state.nextReminderAt = new Date(Date.now() + 15 * 60000).toISOString();
    write('reminderState', state);
    closeReminderPopup();
    renderReminderSurfaces();
    notify('Okay — I’ll remind you again in 15 minutes.');
  }

  function acknowledgeTarget() {
    const stats = studyReminderStats();
    if (!stats.complete) {
      notify('Log enough study time to reach your target before marking it complete.');
      return;
    }
    const state = getReminderState();
    state.acknowledgedDate = today();
    write('reminderState', state);
    closeReminderPopup();
    renderReminderSurfaces();
    notify('Today’s study target is complete. Great work!');
  }

  function sendBrowserNotification(stats) {
    if (!stats.settings.browserNotifications || !window.isSecureContext ||
      !('Notification' in window) || Notification.permission !== 'granted') return;
    const message = reminderMessage(stats.settings);
    try {
      const notification = new Notification('STUDENT METER — STUDY REMINDER', {
        body: `${message.exact}\n${message.supportive}`,
        tag: `student-meter-study-${today()}`,
        renotify: false
      });
      notification.onclick = () => {
        window.focus();
        window.location.href = 'study.html';
        notification.close();
      };
    } catch (error) {
      console.error('Could not display browser study reminder.', error);
      notify('The in-page reminder appeared, but the browser notification could not be displayed.');
    }
  }

  function checkStudyReminder() {
    const stats = studyReminderStats();
    const state = getReminderState();
    if (!stats.settings.enabled || stats.complete) {
      if (stats.complete && !document.querySelector('#study-reminder-modal')?.hidden) closeReminderPopup();
      renderReminderSurfaces(stats, state);
      return;
    }
    const now = Date.now();
    const nextReminderAt = state.nextReminderAt;
    const baseline = state.lastReminderAt || state.enabledAt;
    const dueAt = nextReminderAt ? Date.parse(nextReminderAt) :
      baseline ? Date.parse(baseline) + Number(stats.settings.intervalMinutes) * 60000 : Infinity;
    if (now < dueAt) {
      renderReminderSurfaces(stats, state);
      return;
    }
    const notice = {
      date: today(),
      at: new Date().toISOString(),
      studentType: stats.settings.studentType,
      mode: stats.settings.mode,
      message: reminderMessage(stats.settings).exact
    };
    state.lastReminderAt = notice.at;
    state.nextReminderAt = null;
    state.history.unshift(notice);
    state.history = state.history.slice(0, 100);
    if (!write('reminderState', state)) return;
    showReminderPopup();
    sendBrowserNotification(stats);
    renderReminderSurfaces(stats, state);
  }

  function renderReminderHistory(history) {
    const container = document.querySelector('#reminder-history');
    if (!container) return;
    container.replaceChildren();
    if (!history.length) {
      container.innerHTML = '<div class="empty-state">Your reminder notices will appear here when they are sent.</div>';
      return;
    }
    history.forEach((notice) => {
      const row = document.createElement('article');
      row.className = 'list-item reminder-history-item';
      const icon = document.createElement('span');
      icon.textContent = '🔔';
      const main = document.createElement('div');
      main.className = 'list-item-main';
      const message = document.createElement('span');
      message.className = 'list-item-title';
      message.textContent = notice.message;
      const meta = document.createElement('span');
      meta.className = 'list-item-meta';
      meta.textContent = `${new Date(notice.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · ${notice.studentType} · ${notice.mode}`;
      main.append(message, meta);
      row.append(icon, main);
      container.append(row);
    });
  }

  function renderReminderSurfaces(stats = studyReminderStats(), state = getReminderState()) {
    document.querySelectorAll('[data-reminder-target]').forEach((el) => { el.textContent = formatStudyTime(stats.targetMinutes); });
    document.querySelectorAll('[data-reminder-completed]').forEach((el) => { el.textContent = formatStudyTime(stats.completedMinutes); });
    document.querySelectorAll('[data-reminder-remaining]').forEach((el) => { el.textContent = formatStudyTime(stats.remainingMinutes); });
    document.querySelectorAll('[data-reminder-progress]').forEach((el) => { el.style.width = `${stats.progress}%`; });
    document.querySelectorAll('[data-reminder-progress-label]').forEach((el) => { el.textContent = `${stats.progress}%`; });
    document.querySelectorAll('[data-reminder-status]').forEach((el) => {
      el.textContent = stats.complete ? "🟢 TODAY'S STUDY TARGET COMPLETED" :
        stats.settings.enabled ? '🟡 TARGET NOT COMPLETED' : '⚪ REMINDERS OFF';
      el.classList.toggle('status-complete', stats.complete);
      el.classList.toggle('status-pending', !stats.complete && stats.settings.enabled);
    });
    document.querySelectorAll('[data-reminder-last]').forEach((el) => {
      el.textContent = state.lastReminderAt
        ? new Date(state.lastReminderAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : 'No reminder sent today';
    });
    document.querySelectorAll('[data-reminder-latest-message]').forEach((el) => {
      const latest = state.history.find((item) => item.date === today()) || state.history[0];
      el.textContent = latest ? latest.message : reminderMessage(stats.settings).exact;
    });
    document.querySelectorAll('[data-reminder-settings-status]').forEach((el) => {
      el.textContent = stats.settings.enabled ? 'Study Reminder is on' : 'Study Reminder is off';
    });
    document.querySelectorAll('[data-target-complete-page]').forEach((el) => {
      el.hidden = !stats.complete || state.acknowledgedDate === today();
    });
    document.querySelectorAll('[data-reminder-on]').forEach((el) => { el.textContent = stats.settings.enabled ? 'ON' : 'OFF'; });
    if (document.querySelector('#reminder-history')) renderReminderHistory(state.history);
  }

  function setUpStudyReminderNavigation() {
    const header = document.querySelector('.site-header');
    if (!header || document.querySelector('.utility-nav')) return;
    const nav = document.createElement('nav');
    nav.className = 'utility-nav';
    nav.setAttribute('aria-label', 'Student Meter shortcuts');
    const noticeLink = document.createElement('a');
    noticeLink.className = 'reminder-nav-link';
    noticeLink.href = 'notifications.html';
    noticeLink.dataset.reminderNav = 'notice';
    noticeLink.setAttribute('aria-current', location.pathname.endsWith('notifications.html') ? 'page' : 'false');
    noticeLink.textContent = '🔔 Notice Center';
    const settingsLink = document.createElement('a');
    settingsLink.className = 'reminder-nav-link';
    settingsLink.href = 'settings.html';
    settingsLink.dataset.reminderNav = 'settings';
    settingsLink.setAttribute('aria-current', location.pathname.endsWith('settings.html') ? 'page' : 'false');
    settingsLink.textContent = '⚙️ Settings';
    const vaultLink = document.createElement('a');
    vaultLink.className = 'reminder-nav-link';
    vaultLink.href = 'student-vault.html';
    vaultLink.dataset.reminderNav = 'vault';
    vaultLink.setAttribute('aria-current', location.pathname.endsWith('student-vault.html') ? 'page' : 'false');
    vaultLink.textContent = '📚 Student Vault';
    const accountLink = document.createElement('a');
    accountLink.className = 'reminder-nav-link';
    accountLink.href = 'account.html';
    accountLink.dataset.accountNav = 'true';
    accountLink.textContent = '☁️ Account';
    nav.append(noticeLink, settingsLink, vaultLink, accountLink);
    header.after(nav);
  }

  window.SM = {
    read, write, notify, addXp, renderXp, today, profile, streak,
    Reminders: {
      getSettings: getReminderSettings,
      getState: getReminderState,
      stats: studyReminderStats,
      formatTime: formatStudyTime,
      message: reminderMessage,
      check: checkStudyReminder,
      render: renderReminderSurfaces,
      acknowledge: acknowledgeTarget
    }
  };
  setUpTheme();
  setUpProfile();
  setUpStudentLife();
  setUpStudyReminderNavigation();
  renderXp();
  updateHome();
  checkStudyReminder();
  window.setInterval(checkStudyReminder, 15000);
  window.addEventListener('focus', checkStudyReminder);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkStudyReminder();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeReminderPopup();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === `${reminderPrefix}study` || event.key === `${reminderPrefix}reminderSettings`) {
      checkStudyReminder();
      updateHome();
    }
  });
})();
