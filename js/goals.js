(() => {
  let goals = SM.read('goals', []);
  if (!Array.isArray(goals)) goals = [];

  function render() {
    const done = goals.filter((goal) => goal.done).length;
    const percent = goals.length ? Math.round(done / goals.length * 100) : 0;
    document.querySelector('#goal-completion').textContent = `${percent}%`;
    document.querySelector('#goal-summary').textContent = goals.length ? `${done} of ${goals.length} goals completed.` : 'No goals yet. Your first one can be small.';
    document.querySelector('#goal-progress').style.width = `${percent}%`;
    const container = document.querySelector('#goal-list');
    container.replaceChildren();
    if (!goals.length) {
      container.innerHTML = '<div class="empty-state" style="grid-column:1/-1">Your goals will show up here. Start with one you can move forward this week.</div>';
      return;
    }
    goals.forEach((goal) => {
      const card = document.createElement('article');
      card.className = 'feature-card';
      if (goal.done) card.style.borderColor = 'rgba(99,221,165,.4)';
      const icon = document.createElement('span');
      icon.className = 'feature-icon';
      icon.textContent = ({ Study: '📚', College: '🏫', Skill: '💻', Personal: '🌱' })[goal.category] || '🎯';
      const title = document.createElement('h3');
      title.textContent = goal.title;
      const meta = document.createElement('p');
      meta.textContent = `${goal.category}${goal.deadline ? ` · Due ${goal.deadline}` : ''}`;
      const percent = document.createElement('div');
      percent.className = 'progress-meta';
      const progressLabel = document.createElement('span');
      progressLabel.textContent = 'Progress';
      const progressValue = document.createElement('strong');
      progressValue.textContent = `${goal.done ? 100 : goal.progress}%`;
      percent.append(progressLabel, progressValue);
      const track = document.createElement('div');
      track.className = 'progress-track';
      const fill = document.createElement('div');
      fill.className = 'progress-fill';
      fill.style.width = `${goal.done ? 100 : goal.progress}%`;
      track.append(fill);
      const range = document.createElement('input');
      range.type = 'range';
      range.min = '0';
      range.max = '100';
      range.step = '5';
      range.value = goal.done ? 100 : goal.progress;
      range.setAttribute('aria-label', `Progress for ${goal.title}`);
      range.addEventListener('change', () => {
        if (goal.done) return;
        goal.progress = Number(range.value);
        if (SM.write('goals', goals)) render();
      });
      const actions = document.createElement('div');
      actions.className = 'form-actions';
      const complete = document.createElement('button');
      complete.className = goal.done ? 'button-secondary' : 'button';
      complete.type = 'button';
      complete.textContent = goal.done ? '✓ Completed' : 'Mark completed';
      complete.disabled = goal.done;
      complete.addEventListener('click', () => {
        goal.done = true;
        goal.progress = 100;
        if (SM.write('goals', goals)) {
          SM.addXp(50);
          SM.notify('Goal completed — well done! +50 XP');
          render();
        }
      });
      const remove = document.createElement('button');
      remove.className = 'button-danger';
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => {
        goals = goals.filter((item) => item.id !== goal.id);
        if (SM.write('goals', goals)) render();
      });
      actions.append(complete, remove);
      card.append(icon, title, meta, percent, track, range, actions);
      container.append(card);
    });
  }

  document.querySelector('#goal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const title = String(values.get('title') || '').trim();
    const deadline = String(values.get('deadline') || '');
    if (!title) return;
    if (deadline && deadline < SM.today()) {
      SM.notify('Choose a deadline today or later, or leave it blank.');
      return;
    }
    goals.push({ id: crypto.randomUUID(), title, category: String(values.get('category')), deadline, progress: 0, done: false });
    if (SM.write('goals', goals)) {
      event.currentTarget.reset();
      render();
      SM.notify('Goal added. You can move it forward at your own pace.');
    }
  });

  render();
})();
