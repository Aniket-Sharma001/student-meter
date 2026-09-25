(() => {
  let routine = SM.read('routine', { date: SM.today(), tasks: [] });
  if (!Array.isArray(routine.tasks)) routine.tasks = [];
  if (routine.date !== SM.today()) {
    routine.tasks = routine.tasks.map((task) => ({ ...task, done: false, xpAwarded: false }));
    routine.date = SM.today();
    SM.write('routine', routine);
  }

  function render() {
    const total = routine.tasks.length;
    const completed = routine.tasks.filter((task) => task.done).length;
    const percent = total ? Math.round(completed / total * 100) : 0;
    document.querySelector('#routine-completed').textContent = `${completed} / ${total}`;
    document.querySelector('#routine-percent').textContent = `${percent}%`;
    document.querySelector('#routine-total').textContent = total;
    document.querySelector('#routine-progress-caption').textContent = `${completed} of ${total} tasks`;
    document.querySelector('#routine-progress-label').textContent = `${percent}%`;
    document.querySelector('#routine-progress').style.width = `${percent}%`;
    document.querySelectorAll('[data-period-list]').forEach((container) => {
      const period = container.dataset.periodList;
      container.replaceChildren();
      const tasks = routine.tasks.filter((task) => task.period === period).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      tasks.forEach((task) => {
        const row = document.createElement('div');
        row.className = `list-item${task.done ? ' done' : ''}`;
        const check = document.createElement('button');
        check.className = 'check-button';
        check.type = 'button';
        check.setAttribute('aria-label', task.done ? `Mark ${task.title} incomplete` : `Complete ${task.title}`);
        check.setAttribute('aria-pressed', String(task.done));
        check.textContent = task.done ? '✓' : '○';
        check.addEventListener('click', () => {
          task.done = !task.done;
          SM.write('routine', routine);
          render();
          if (task.done && !task.xpAwarded) {
            task.xpAwarded = true;
            SM.write('routine', routine);
            SM.addXp(5);
          }
        });
        const main = document.createElement('div');
        main.className = 'list-item-main';
        const title = document.createElement('span');
        title.className = 'list-item-title';
        title.textContent = task.title;
        const meta = document.createElement('span');
        meta.className = 'list-item-meta';
        meta.textContent = task.time || 'Any time';
        main.append(title, meta);
        const remove = document.createElement('button');
        remove.className = 'mini-button';
        remove.type = 'button';
        remove.textContent = 'Delete';
        remove.setAttribute('aria-label', `Delete ${task.title}`);
        remove.addEventListener('click', () => {
          routine.tasks = routine.tasks.filter((item) => item.id !== task.id);
          SM.write('routine', routine);
          render();
        });
        row.append(check, main, remove);
        container.append(row);
      });
      if (!tasks.length) container.innerHTML = '<div class="empty-state">Nothing planned yet.</div>';
    });
  }

  document.querySelector('#routine-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const title = String(values.get('title') || '').trim();
    if (!title) return;
    routine.tasks.push({ id: crypto.randomUUID(), title, time: String(values.get('time') || ''), period: String(values.get('period')), done: false });
    if (SM.write('routine', routine)) {
      event.currentTarget.reset();
      render();
      SM.notify('Task added to your routine.');
    }
  });

  render();
})();
