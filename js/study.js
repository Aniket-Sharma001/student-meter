(() => {
  const form = document.querySelector('#session-form');
  const subjectSelect = document.querySelector('#subject');
  const studyGoal = document.querySelector('#daily-goal');
  const store = () => SM.read('study', { goal: Number(SM.profile().studyGoal) || 120, subjects: [], sessions: [] });
  let data = store();

  function render() {
    const today = SM.today();
    const sessions = data.sessions || [];
    const minutesToday = sessions.filter((item) => item.date === today).reduce((sum, item) => sum + item.minutes, 0);
    const goal = Math.max(1, Number(data.goal) || 120);
    const percent = Math.min(100, Math.round(minutesToday / goal * 100));
    document.querySelector('#today-time').textContent = `${minutesToday}m`;
    document.querySelector('#goal-label').textContent = `${goal}m`;
    document.querySelector('#progress-label').textContent = `${percent}%`;
    document.querySelector('#progress-percent').textContent = `${percent}%`;
    document.querySelector('#progress-caption').textContent = `${minutesToday} of ${goal} minutes`;
    document.querySelector('#study-progress').style.width = `${percent}%`;
    document.querySelector('#study-streak').textContent = SM.streak('studyDays');
    studyGoal.value = goal;

    const subjects = [...new Set([...(data.subjects || []), ...sessions.map((item) => item.subject)])].sort((a, b) => a.localeCompare(b));
    const previous = subjectSelect.value;
    subjectSelect.replaceChildren(new Option('Choose a subject', ''));
    subjects.forEach((subject) => subjectSelect.add(new Option(subject, subject)));
    if (subjects.includes(previous)) subjectSelect.value = previous;

    const sessionList = document.querySelector('#session-list');
    sessionList.replaceChildren();
    sessions.slice().reverse().slice(0, 12).forEach((item) => {
      const row = document.createElement('div');
      row.className = 'list-item';
      const main = document.createElement('div');
      main.className = 'list-item-main';
      const title = document.createElement('span');
      title.className = 'list-item-title';
      title.textContent = item.subject;
      const meta = document.createElement('span');
      meta.className = 'list-item-meta';
      meta.textContent = `${item.date} · ${item.minutes} minutes`;
      main.append(title, meta);
      const duration = document.createElement('strong');
      duration.textContent = `${item.minutes}m`;
      row.append(main, duration);
      sessionList.append(row);
    });
    if (!sessions.length) sessionList.innerHTML = '<div class="empty-state">No study sessions yet. Your first one can be just 10 minutes.</div>';

    const totals = new Map();
    sessions.forEach((item) => totals.set(item.subject, (totals.get(item.subject) || 0) + item.minutes));
    const subjectList = document.querySelector('#subject-list');
    subjectList.replaceChildren();
    [...totals.entries()].sort((a, b) => b[1] - a[1]).forEach(([subject, minutes]) => {
      const row = document.createElement('div');
      row.className = 'list-item';
      const label = document.createElement('span');
      label.className = 'list-item-main list-item-title';
      label.textContent = subject;
      const total = document.createElement('strong');
      total.textContent = `${minutes}m`;
      row.append(label, total);
      subjectList.append(row);
    });
    if (!totals.size) subjectList.innerHTML = '<div class="empty-state">Your subject totals will appear here.</div>';
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const newSubject = String(values.get('newSubject') || '').trim();
    const subject = newSubject || String(values.get('subject') || '');
    const minutes = Number(values.get('minutes'));
    if (!subject || !Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
      SM.notify('Choose a subject and enter between 1 and 1440 minutes.');
      return;
    }
    if (!data.subjects.includes(subject)) data.subjects.push(subject);
    data.sessions.push({ id: crypto.randomUUID(), subject, minutes, date: SM.today() });
    const days = new Set(SM.read('studyDays', []));
    days.add(SM.today());
    SM.write('studyDays', [...days]);
    if (!SM.write('study', data)) return;
    SM.addXp(10);
    form.reset();
    render();
    SM.Reminders.check();
    SM.notify(`Added ${minutes} minutes of ${subject}. +10 XP`);
  });

  document.querySelector('#goal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const goal = Number(new FormData(event.currentTarget).get('goal'));
    if (!Number.isFinite(goal) || goal < 1 || goal > 1440) {
      SM.notify('Your daily goal must be from 1 to 1440 minutes.');
      return;
    }
    data.goal = goal;
    if (SM.write('study', data)) {
      const profile = SM.profile();
      profile.studyGoal = goal;
      SM.write('profile', profile);
      const reminderSettings = SM.Reminders.getSettings();
      reminderSettings.targetMinutes = goal;
      SM.write('reminderSettings', reminderSettings);
      render();
      SM.Reminders.check();
      SM.notify('Daily study goal updated.');
    }
  });

  render();
})();
