(() => {
  const moodMessages = {
    Great: 'That’s lovely — enjoy this energy and celebrate what is going well. ✨',
    Good: 'Glad things are feeling good. Keep a little space for rest too. 🌿',
    Okay: 'Okay is a perfectly valid place to be. Take today one step at a time. 💜',
    Tired: 'Your body may be asking for a gentler pace. A break and some water can help. ☕',
    Stressed: 'That sounds like a lot. Try one slow breath, then choose just one small next step. 🌱'
  };
  let history = SM.read('mood', []);
  if (!Array.isArray(history)) history = [];
  let selectedMood = '';

  function render() {
    const list = document.querySelector('#mood-history');
    list.replaceChildren();
    history.slice().reverse().slice(0, 14).forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'list-item';
      const emoji = document.createElement('span');
      emoji.textContent = ({ Great: '😀', Good: '🙂', Okay: '😐', Tired: '😴', Stressed: '😓' })[entry.mood] || '💜';
      const main = document.createElement('div');
      main.className = 'list-item-main';
      const title = document.createElement('span');
      title.className = 'list-item-title';
      title.textContent = `${entry.mood} · energy ${entry.energy}/10`;
      const note = document.createElement('span');
      note.className = 'list-item-meta';
      note.textContent = `${entry.date}${entry.note ? ` · ${entry.note}` : ''}`;
      main.append(title, note);
      row.append(emoji, main);
      list.append(row);
    });
    if (!history.length) list.innerHTML = '<div class="empty-state">Your saved check-ins will appear here.</div>';
    const todayEntry = history.find((entry) => entry.date === SM.today());
    if (todayEntry) {
      selectedMood = todayEntry.mood;
      document.querySelector('#mood-value').value = selectedMood;
      document.querySelector('#energy-level').value = todayEntry.energy;
      document.querySelector('#energy-label').textContent = todayEntry.energy;
      document.querySelector('#mood-note').value = todayEntry.note;
      document.querySelectorAll('[data-mood]').forEach((button) => button.classList.toggle('selected', button.dataset.mood === selectedMood));
      const message = document.querySelector('#mood-message');
      message.textContent = moodMessages[selectedMood];
      message.hidden = false;
    }
  }

  document.querySelectorAll('[data-mood]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedMood = button.dataset.mood;
      document.querySelector('#mood-value').value = selectedMood;
      document.querySelectorAll('[data-mood]').forEach((item) => item.classList.toggle('selected', item === button));
    });
  });
  document.querySelector('#energy-level').addEventListener('input', (event) => {
    document.querySelector('#energy-label').textContent = event.currentTarget.value;
  });
  document.querySelector('#mood-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!selectedMood) {
      SM.notify('Choose the mood that best describes today before saving.');
      return;
    }
    const values = new FormData(event.currentTarget);
    const entry = {
      date: SM.today(),
      mood: selectedMood,
      energy: Number(values.get('energy')),
      note: String(values.get('note') || '').trim()
    };
    const firstEntryToday = !history.some((item) => item.date === SM.today());
    history = history.filter((item) => item.date !== SM.today());
    history.push(entry);
    if (SM.write('mood', history)) {
      const message = document.querySelector('#mood-message');
      message.textContent = moodMessages[selectedMood];
      message.hidden = false;
      render();
      if (firstEntryToday) SM.addXp(5);
      SM.notify('Check-in saved. Thanks for taking a moment for yourself.');
    }
  });

  render();
})();
