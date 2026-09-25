(() => {
  const badgeDefinitions = [
    { id: 'streak-3', icon: '🔥', name: '3 Day Streak', detail: 'Study on 3 days in a row', unlocked: (s) => s.streak >= 3 },
    { id: 'streak-7', icon: '🔥', name: '7 Day Streak', detail: 'Study on 7 days in a row', unlocked: (s) => s.streak >= 7 },
    { id: 'first-study', icon: '📚', name: 'First Study Session', detail: 'Log your first study session', unlocked: (s) => s.studySessions > 0 },
    { id: 'focus-master', icon: '⏱️', name: 'Focus Master', detail: 'Complete 10 focus sessions', unlocked: (s) => s.focusSessions >= 10 },
    { id: 'smart-saver', icon: '💰', name: 'Smart Saver', detail: 'Grow your balance above your start', unlocked: (s) => s.balance > s.startingBalance },
    { id: 'goal-getter', icon: '🎯', name: 'Goal Getter', detail: 'Complete a student goal', unlocked: (s) => s.completedGoals > 0 },
    { id: 'coding-beginner', icon: '💻', name: 'Coding Beginner', detail: 'Practice coding or set a coding goal', unlocked: (s) => s.coding },
    { id: 'champion', icon: '🏆', name: 'Student Meter Champion', detail: 'Earn 1,000 XP', unlocked: (s) => s.xp >= 1000 }
  ];

  function render() {
    const xp = Number(SM.read('xp', 0)) || 0;
    const study = SM.read('study', { sessions: [] });
    const timer = SM.read('timer', { sessions: [] });
    const money = SM.read('money', { balance: 0, transactions: [] });
    const goals = SM.read('goals', []);
    const normalizedMoney = Number(money.balance) + (money.transactions || []).reduce((sum, item) => sum + (item.type === 'income' ? Number(item.amount) : -Number(item.amount)), 0);
    const codingChallenge = SM.read('challengeHistory', []).some((item) => item.id === 'coding-practice');
    const state = {
      xp,
      streak: SM.streak('studyDays'),
      studySessions: (study.sessions || []).length,
      focusSessions: (timer.sessions || []).filter((session) => session.mode !== 'break').length,
      balance: normalizedMoney,
      startingBalance: Number(money.balance) || 0,
      completedGoals: (goals || []).filter((goal) => goal.done).length,
      coding: (goals || []).some((goal) => /cod(e|ing)/i.test(goal.title)) ||
        (study.sessions || []).some((session) => /cod(e|ing)/i.test(session.subject)) || codingChallenge
    };
    document.querySelector('#xp-next').textContent = (Math.floor(xp / 500) + 1) * 500;
    document.querySelector('#level-caption').textContent = `${xp % 500} / 500 XP`;
    const list = document.querySelector('#achievement-list');
    list.replaceChildren();
    let unlocked = 0;
    badgeDefinitions.forEach((badge) => {
      const earned = badge.unlocked(state);
      if (earned) unlocked += 1;
      const card = document.createElement('article');
      card.className = `badge-card${earned ? '' : ' locked'}`;
      const icon = document.createElement('span');
      icon.className = 'badge-icon';
      icon.textContent = badge.icon;
      const title = document.createElement('strong');
      title.textContent = badge.name;
      const description = document.createElement('small');
      description.textContent = earned ? `Unlocked · ${badge.detail}` : badge.detail;
      card.append(icon, title, description);
      list.append(card);
    });
    document.querySelector('#badge-count').textContent = `${unlocked} / ${badgeDefinitions.length}`;
  }

  render();
})();
