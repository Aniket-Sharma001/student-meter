(() => {
  const presets = { 25: 'Pomodoro focus', 5: 'Short break', 50: 'Deep focus' };
  const display = document.querySelector('#timer-display');
  const face = document.querySelector('#timer-face');
  const label = document.querySelector('#timer-label');
  const record = () => SM.read('timer', { sessions: [] });
  let timerData = record();
  let initialSeconds = 25 * 60;
  let remaining = initialSeconds;
  let interval = null;
  let currentMode = 'focus';

  function renderTime() {
    display.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }

  function renderHistory() {
    const focusSessions = timerData.sessions.filter((session) => session.mode !== 'break');
    document.querySelector('#session-count').textContent = focusSessions.length;
    document.querySelector('#timer-xp').textContent = focusSessions.reduce((total, session) => total + session.xp, 0);
    const list = document.querySelector('#timer-history');
    list.replaceChildren();
    focusSessions.slice().reverse().slice(0, 5).forEach((session) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const icon = document.createElement('span');
      icon.textContent = '✨';
      const main = document.createElement('div');
      main.className = 'list-item-main';
      const title = document.createElement('span');
      title.className = 'list-item-title';
      title.textContent = session.label;
      const meta = document.createElement('span');
      meta.className = 'list-item-meta';
      meta.textContent = `${session.date} · ${session.minutes} minutes`;
      main.append(title, meta);
      const reward = document.createElement('strong');
      reward.textContent = `+${session.xp} XP`;
      item.append(icon, main, reward);
      list.append(item);
    });
    if (!focusSessions.length) list.innerHTML = '<div class="empty-state">Your completed focus sessions will show up here.</div>';
  }

  function stop() {
    clearInterval(interval);
    interval = null;
    face.classList.remove('running');
  }

  function complete() {
    stop();
    remaining = 0;
    renderTime();
    const minutes = Math.round(initialSeconds / 60);
    const isBreak = currentMode === 'break';
    const session = { id: crypto.randomUUID(), label: label.textContent, minutes, mode: currentMode, xp: isBreak ? 0 : 25, date: SM.today() };
    timerData.sessions.push(session);
    if (!SM.write('timer', timerData)) return;
    if (!isBreak) {
      SM.addXp(25);
      const study = SM.read('study', { goal: Number(SM.profile().studyGoal) || 120, subjects: ['Focus session'], sessions: [] });
      study.subjects ||= [];
      if (!study.subjects.includes('Focus session')) study.subjects.push('Focus session');
      study.sessions ||= [];
      study.sessions.push({ id: crypto.randomUUID(), subject: 'Focus session', minutes, date: SM.today() });
      SM.write('study', study);
      const days = new Set(SM.read('studyDays', []));
      days.add(SM.today());
      SM.write('studyDays', [...days]);
      SM.Reminders.check();
      SM.notify('Focus session complete — nice work! +25 XP');
    } else {
      SM.notify('Break complete. Take a breath and choose what is next.');
    }
    renderHistory();
  }

  function reset(seconds = initialSeconds, mode = currentMode, description = label.textContent) {
    stop();
    initialSeconds = seconds;
    remaining = seconds;
    currentMode = mode;
    label.textContent = description;
    renderTime();
  }

  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-preset]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const mins = Number(button.dataset.preset);
      const mode = mins === 5 ? 'break' : 'focus';
      reset(mins * 60, mode, presets[mins]);
    });
  });
  document.querySelector('#custom-timer-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const mins = Number(new FormData(event.currentTarget).get('minutes'));
    if (!Number.isInteger(mins) || mins < 1 || mins > 180) {
      SM.notify('Choose a custom duration from 1 to 180 minutes.');
      return;
    }
    document.querySelectorAll('[data-preset]').forEach((item) => item.classList.remove('active'));
    reset(mins * 60, 'focus', 'Custom focus');
    SM.notify(`Custom ${mins}-minute focus timer is ready.`);
  });
  document.querySelector('#timer-start').addEventListener('click', () => {
    if (interval || remaining === 0) return;
    face.classList.add('running');
    interval = setInterval(() => {
      remaining -= 1;
      renderTime();
      if (remaining <= 0) complete();
    }, 1000);
  });
  document.querySelector('#timer-pause').addEventListener('click', stop);
  document.querySelector('#timer-reset').addEventListener('click', () => reset());

  renderTime();
  renderHistory();
})();
