(() => {
  const challengePool = [
    { id: 'study-30', icon: '📚', title: 'Study for 30 minutes', detail: 'One focused block counts. Breaks are allowed.' },
    { id: 'drink-water', icon: '💧', title: 'Drink enough water', detail: 'Pause and have a glass of water.' },
    { id: 'phone-break', icon: '📵', title: 'Take a break from unnecessary phone use', detail: 'Try one phone-free focus block.' },
    { id: 'assignment', icon: '📝', title: "Make progress on today's assignment", detail: 'Even a small first step is progress.' },
    { id: 'study-space', icon: '🧹', title: 'Tidy your study space', detail: 'A two-minute reset is plenty.' },
    { id: 'coding-practice', icon: '💻', title: 'Practice coding', detail: 'Try one small exercise or revisit a concept.' },
    { id: 'revise-topic', icon: '📖', title: "Revise yesterday's topic", detail: 'Recall a few key ideas from memory.' }
  ];
  let state = SM.read('challenges', { date: SM.today(), completed: [] });
  if (state.date !== SM.today()) state = { date: SM.today(), completed: [] };
  if (!Array.isArray(state.completed)) state.completed = [];

  function dailyChallenges() {
    const date = new Date(`${SM.today()}T12:00:00`);
    const start = new Date(date.getFullYear(), 0, 1);
    const day = Math.floor((date - start) / 86400000);
    return Array.from({ length: 5 }, (_, index) => challengePool[(day + index * 2) % challengePool.length]);
  }

  function getStreak() {
    return SM.streak('challengeDays');
  }

  function render() {
    const items = dailyChallenges();
    const completedCount = items.filter((item) => state.completed.includes(item.id)).length;
    const percent = Math.round(completedCount / items.length * 100);
    const dateLabel = new Date(`${SM.today()}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    document.querySelector('#challenge-date').textContent = dateLabel;
    document.querySelector('#challenge-xp').textContent = completedCount * 20;
    document.querySelector('#challenge-count').textContent = `${completedCount} / ${items.length}`;
    document.querySelector('#challenge-percent').textContent = `${percent}%`;
    document.querySelector('#challenge-streak').textContent = getStreak();
    document.querySelector('#challenge-progress').style.width = `${percent}%`;
    const container = document.querySelector('#challenge-list');
    container.replaceChildren();
    items.forEach((challenge) => {
      const done = state.completed.includes(challenge.id);
      const row = document.createElement('div');
      row.className = `list-item${done ? ' done' : ''}`;
      const check = document.createElement('button');
      check.className = 'check-button';
      check.type = 'button';
      check.textContent = done ? '✓' : '○';
      check.setAttribute('aria-label', `${done ? 'Completed' : 'Complete'}: ${challenge.title}`);
      check.setAttribute('aria-pressed', String(done));
      check.disabled = done;
      check.addEventListener('click', () => {
        if (state.completed.includes(challenge.id)) return;
        state.completed.push(challenge.id);
        if (!SM.write('challenges', state)) return;
        SM.addXp(20);
        const history = SM.read('challengeHistory', []);
        history.push({ date: SM.today(), id: challenge.id });
        SM.write('challengeHistory', history);
        const nowComplete = items.every((item) => state.completed.includes(item.id));
        if (nowComplete) {
          const days = new Set(SM.read('challengeDays', []));
          days.add(SM.today());
          SM.write('challengeDays', [...days]);
        }
        render();
        SM.notify(nowComplete ? 'All of today’s challenges complete — amazing! +20 XP' : 'Challenge complete. +20 XP');
      });
      const main = document.createElement('div');
      main.className = 'list-item-main';
      const title = document.createElement('span');
      title.className = 'list-item-title';
      title.textContent = `${challenge.icon} ${challenge.title}`;
      const detail = document.createElement('span');
      detail.className = 'list-item-meta';
      detail.textContent = challenge.detail;
      main.append(title, detail);
      const xp = document.createElement('strong');
      xp.textContent = done ? 'Earned' : '+20 XP';
      row.append(check, main, xp);
      container.append(row);
    });
  }

  const stored = SM.read('challenges', null);
  if (!stored || stored.date !== SM.today()) SM.write('challenges', state);
  render();
})();
