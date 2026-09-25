(() => {
  'use strict';

  const KEYS = Object.freeze({
    bestScore: 'studentMeter_glitch_best_score',
    gamesPlayed: 'studentMeter_glitch_games_played',
    bestTime: 'studentMeter_glitch_best_time'
  });
  const DIFFICULTIES = Object.freeze({
    easy: { label: 'Easy', seconds: 35, penalty: 2, bonus: 0, extraObjects: 0 },
    normal: { label: 'Normal', seconds: 20, penalty: 3, bonus: 20, extraObjects: 1 },
    hard: { label: 'Hard', seconds: 14, penalty: 4, bonus: 45, extraObjects: 2 }
  });
  const DECORATIONS = [
    { icon: '🗝️', name: 'Old key', detail: 'A little dusty' },
    { icon: '🕯️', name: 'Candle', detail: 'Wax untouched' },
    { icon: '📦', name: 'Small box', detail: 'Nothing inside' },
    { icon: '🧭', name: 'Compass', detail: 'North is north' },
    { icon: '🪞', name: 'Mirror', detail: 'Just your reflection' }
  ];
  const SCENARIOS = [
    { rule: 'Room note: both clocks are set to 09:15.', target: 'pocket-watch', objects: [
      ['🕰️', 'Wall clock', '09:15', 'wall-clock'], ['⌚', 'Pocket watch', '08:15', 'pocket-watch'],
      ['🪟', 'Window', 'Curtains closed', 'window'], ['🪴', 'Plant', 'Watered', 'plant'], ['🪑', 'Chair', 'Tucked in', 'chair']
    ] },
    { rule: 'Room note: every lamp is switched OFF.', target: 'desk-lamp', objects: [
      ['💡', 'Desk lamp', 'ON', 'desk-lamp'], ['💡', 'Floor lamp', 'OFF', 'floor-lamp'],
      ['🖼️', 'Picture', 'Hanging level', 'picture'], ['📚', 'Book stack', 'Neat', 'books'], ['🚪', 'Door', 'Closed', 'door']
    ] },
    { rule: 'Room note: both window latches are CLOSED.', target: 'east-window', objects: [
      ['🪟', 'West window', 'Latch closed', 'west-window'], ['🪟', 'East window', 'Latch open', 'east-window'],
      ['🪴', 'Plant', 'Facing the light', 'plant'], ['🪑', 'Chair', 'Tucked in', 'chair'], ['🕰️', 'Clock', '09:15', 'clock']
    ] },
    { rule: 'The plant sensors should all read MOIST.', target: 'fern-pot', objects: [
      ['🪴', 'Fern pot', 'SOIL: DRY', 'fern-pot'], ['🌱', 'Window pot', 'SOIL: MOIST', 'window-pot'],
      ['🕯️', 'Candle', 'Unlit', 'candle'], ['🖼️', 'Picture', 'Hanging level', 'picture'], ['🪟', 'Window', 'Closed', 'window']
    ] },
    { rule: 'Room note: every chair is tucked under its desk.', target: 'blue-chair', objects: [
      ['🪑', 'Red chair', 'Tucked in', 'red-chair'], ['🪑', 'Blue chair', 'Pulled out', 'blue-chair'],
      ['📦', 'Small box', 'Under the desk', 'box'], ['🪟', 'Window', 'Curtains closed', 'window'], ['💡', 'Lamp', 'OFF', 'lamp']
    ] },
    { rule: 'The frames in this room should hang perfectly level.', target: 'portrait-frame', objects: [
      ['🖼️', 'Landscape frame', 'Level · 0°', 'landscape-frame'], ['🖼️', 'Portrait frame', 'Tilted · 8°', 'portrait-frame'],
      ['🕰️', 'Clock', '09:15', 'clock'], ['🪴', 'Plant', 'Watered', 'plant'], ['🪑', 'Chair', 'Tucked in', 'chair']
    ] },
    { rule: 'Room note: every wall switch is pushed DOWN.', target: 'hall-switch', objects: [
      ['🔘', 'Desk switch', 'DOWN', 'desk-switch'], ['🔘', 'Hall switch', 'UP', 'hall-switch'],
      ['💡', 'Lamp', 'OFF', 'lamp'], ['🚪', 'Door', 'Closed', 'door'], ['📚', 'Books', 'In order', 'books']
    ] },
    { rule: 'The room checklist says every door is CLOSED.', target: 'closet-door', objects: [
      ['🚪', 'Entry door', 'Closed', 'entry-door'], ['🚪', 'Closet door', 'Slightly open', 'closet-door'],
      ['🪟', 'Window', 'Latch closed', 'window'], ['🪑', 'Chair', 'Tucked in', 'chair'], ['🕰️', 'Clock', '09:15', 'clock']
    ] },
    { rule: 'Every number display in the room should read 2048.', target: 'desk-display', objects: [
      ['🔢', 'Wall display', '2048', 'wall-display'], ['🔢', 'Desk display', '2049', 'desk-display'],
      ['🖼️', 'Picture', 'Hanging level', 'picture'], ['💡', 'Lamp', 'OFF', 'lamp'], ['🪴', 'Plant', 'Watered', 'plant']
    ] },
    { rule: 'All the shadows in this room fall to the LEFT.', target: 'plant-shadow', objects: [
      ['🌿', 'Plant shadow', 'Falls right →', 'plant-shadow'], ['🪑', 'Chair shadow', 'Falls left ←', 'chair-shadow'],
      ['🪟', 'Window', 'Facing east', 'window'], ['🕯️', 'Candle', 'Unlit', 'candle'], ['🖼️', 'Picture', 'Level', 'picture']
    ] },
    { rule: 'Inventory rule: one mug belongs on each coaster.', target: 'blue-coaster', objects: [
      ['☕', 'Red coaster', '1 mug', 'red-coaster'], ['☕', 'Blue coaster', '2 mugs', 'blue-coaster'],
      ['📚', 'Books', 'In order', 'books'], ['🪟', 'Window', 'Closed', 'window'], ['🪴', 'Plant', 'Watered', 'plant']
    ] },
    { rule: 'The bookshelf label says the books go A → Z.', target: 'shelf-books', objects: [
      ['📚', 'Shelf books', 'A · C · B · D', 'shelf-books'], ['📖', 'Open book', 'Page 12', 'open-book'],
      ['🕰️', 'Clock', '09:15', 'clock'], ['💡', 'Lamp', 'OFF', 'lamp'], ['🪴', 'Plant', 'Watered', 'plant']
    ] },
    { rule: 'Every sign in the room should say QUIET.', target: 'door-sign', objects: [
      ['🔇', 'Desk sign', 'QUIET', 'desk-sign'], ['🔇', 'Door sign', 'QUITE', 'door-sign'],
      ['🚪', 'Door', 'Closed', 'door'], ['🪟', 'Window', 'Closed', 'window'], ['🪑', 'Chair', 'Tucked in', 'chair']
    ] },
    { rule: 'The leaves are meant to face the sunny window.', target: 'corner-plant', objects: [
      ['🌿', 'Window plant', 'Leaves → window', 'window-plant'], ['🌿', 'Corner plant', 'Leaves → wall', 'corner-plant'],
      ['🪟', 'Window', 'Sunny', 'window'], ['💡', 'Lamp', 'OFF', 'lamp'], ['🕰️', 'Clock', '09:15', 'clock']
    ] },
    { rule: 'Room note: both lamps glow cool blue-white.', target: 'reading-lamp', objects: [
      ['💡', 'Bedside lamp', 'Cool white', 'bedside-lamp'], ['💡', 'Reading lamp', 'Warm amber', 'reading-lamp'],
      ['📚', 'Books', 'In order', 'books'], ['🪴', 'Plant', 'Watered', 'plant'], ['🪟', 'Window', 'Closed', 'window']
    ] },
    { rule: 'The floor tiles alternate BLUE, GREY, BLUE, GREY.', target: 'tile-three', objects: [
      ['🔵', 'Tile one', 'BLUE', 'tile-one'], ['⚪', 'Tile two', 'GREY', 'tile-two'],
      ['🔵', 'Tile three', 'BLUE', 'tile-three'], ['⚪', 'Tile four', 'GREY', 'tile-four'], ['🔵', 'Tile five', 'BLUE', 'tile-five']
    ] },
    { rule: 'The wall calendar is set to today: the 26th.', target: 'desk-calendar', objects: [
      ['📆', 'Wall calendar', '26', 'wall-calendar'], ['📆', 'Desk calendar', '62', 'desk-calendar'],
      ['🕰️', 'Clock', '09:15', 'clock'], ['🪟', 'Window', 'Closed', 'window'], ['🪑', 'Chair', 'Tucked in', 'chair']
    ] },
    { rule: 'The portraits all face toward the LEFT wall.', target: 'small-portrait', objects: [
      ['🖼️', 'Large portrait', 'Facing ←', 'large-portrait'], ['🖼️', 'Small portrait', 'Facing →', 'small-portrait'],
      ['🪴', 'Plant', 'Watered', 'plant'], ['💡', 'Lamp', 'OFF', 'lamp'], ['🚪', 'Door', 'Closed', 'door']
    ] }
  ];
  const EFFECTS = ['move', 'shrink', 'text', 'decoy', 'glitch', 'countdown', 'vanish', 'tint', 'instruction'];
  const POSITIONS = [[50, 52], [23, 30], [76, 32], [31, 72], [70, 73], [50, 24]];
  let scenarioDeck = [];
  const $ = (selector) => document.querySelector(selector);
  const intro = $('#glitch-intro');
  const puzzleScreen = $('#glitch-puzzle');
  const resultScreen = $('#glitch-result');
  const field = $('#glitch-button-field');
  const announcement = $('#glitch-announcement');
  let state = null;
  let ticker = null;
  let timeouts = new Set();
  let disposed = false;

  function randomIndex(length) {
    return Math.floor(Math.random() * length);
  }

  function shuffled(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = randomIndex(index + 1);
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function readStat(key) {
    try {
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch (error) {
      return 0;
    }
  }

  function setText(selector, text) {
    const element = $(selector);
    if (element) element.textContent = text;
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }

  function schedule(callback, delay) {
    const timeout = window.setTimeout(() => {
      timeouts.delete(timeout);
      if (!disposed) callback();
    }, delay);
    timeouts.add(timeout);
    return timeout;
  }

  function clearTimers() {
    if (ticker !== null) {
      window.clearInterval(ticker);
      ticker = null;
    }
    timeouts.forEach((timeout) => window.clearTimeout(timeout));
    timeouts.clear();
  }

  function setScreen(screen) {
    intro.hidden = screen !== 'intro';
    puzzleScreen.hidden = screen !== 'puzzle';
    resultScreen.hidden = screen !== 'result';
  }

  function updateScoreboard() {
    setText('#glitch-score', String(state?.score || 0));
    setText('#glitch-best', String(readStat(KEYS.bestScore)));
    setText('#glitch-attempts', String(state?.attempts || 0));
  }

  function beginGame() {
    clearTimers();
    const difficulty = DIFFICULTIES[$('#glitch-difficulty').value] ? $('#glitch-difficulty').value : 'normal';
    state = {
      difficulty,
      score: 0,
      attempts: 0,
      wrong: 0,
      solved: 0,
      roundIndex: 0,
      buttonClicks: 0,
      usedEffects: [],
      secretSeen: false,
      phase: 'button',
      startTime: Date.now(),
      puzzleEndsAt: 0,
      currentPuzzle: null,
      finished: false
    };
    $('#glitch-difficulty').disabled = true;
    $('#glitch-controls').hidden = true;
    scenarioDeck = shuffled(SCENARIOS);
    setScreen('intro');
    $('#glitch-button-room').hidden = false;
    announcement.textContent = 'A red button waits in the middle of the room.';
    $('#glitch-button-message').textContent = 'The sign says not to press it. The room seems oddly sure.';
    field.replaceChildren();
    field.classList.remove('glitch-tinted');
    placeButton();
    updateScoreboard();
    setText('#glitch-time', '—');
  }

  function makeButton(text, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', onClick);
    return button;
  }

  function placeButton() {
    const point = POSITIONS[randomIndex(POSITIONS.length)];
    let button = field.querySelector('.glitch-main-button:not(.glitch-decoy)');
    if (!button) {
      button = makeButton("DON'T PRESS ME", 'glitch-main-button', pressButton);
      button.setAttribute('aria-label', 'The button says: do not press me');
      field.append(button);
    }
    button.style.left = `${point[0]}%`;
    button.style.top = `${point[1]}%`;
  }

  function triggerSecret() {
    state.secretSeen = true;
    const secret = document.createElement('span');
    secret.className = 'glitch-secret';
    secret.textContent = 'DID YOU NOTICE THAT?';
    secret.setAttribute('aria-live', 'polite');
    field.append(secret);
    schedule(() => secret.remove(), 1900);
  }

  function selectEffect() {
    const choices = EFFECTS.filter((effect) => effect !== state.usedEffects.at(-1));
    const effect = choices[randomIndex(choices.length)];
    state.usedEffects.push(effect);
    return effect;
  }

  function pressButton(event) {
    if (!state || state.finished || state.phase !== 'button') return;
    const target = event?.currentTarget;
    if (target?.classList.contains('glitch-decoy')) {
      announcement.textContent = 'Decoy. The room has a sense of humor.';
      target.remove();
    } else {
      state.buttonClicks += 1;
      if (Math.random() < 0.06 && !state.secretSeen) triggerSecret();
      applyEffect(selectEffect());
    }
    if (state.buttonClicks >= 4) {
      state.phase = 'transition';
      const mainButton = field.querySelector('.glitch-main-button');
      field.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      announcement.textContent = 'The walls shifted. Something in the room is different now…';
      schedule(startRound, 800);
    }
  }

  function applyEffect(effect) {
    switch (effect) {
      case 'move':
        placeButton();
        announcement.textContent = 'It moved. You did press it, though.';
        break;
      case 'shrink': {
        const button = field.querySelector('.glitch-main-button');
        button?.classList.toggle('glitch-small-button');
        announcement.textContent = 'The button seems a little less confident now.';
        break;
      }
      case 'text': {
        const button = field.querySelector('.glitch-main-button');
        const labels = ['STILL HERE', 'I SAID DON’T', 'PRESS ME?', 'NICE TRY'];
        button.textContent = labels[randomIndex(labels.length)];
        announcement.textContent = 'The sign changed its mind. Or did it?';
        break;
      }
      case 'decoy': {
        field.querySelector('.glitch-decoy')?.remove();
        const decoy = makeButton("DON'T PRESS ME", 'glitch-main-button glitch-decoy', pressButton);
        decoy.style.left = `${25 + randomIndex(51)}%`;
        decoy.style.top = `${25 + randomIndex(46)}%`;
        field.append(decoy);
        announcement.textContent = 'It multiplied. One of these is probably fake.';
        break;
      }
      case 'glitch':
        field.classList.remove('glitch-jolt');
        void field.offsetWidth;
        field.classList.add('glitch-jolt');
        schedule(() => field.classList.remove('glitch-jolt'), 320);
        announcement.textContent = 'The room blinked. You did not.';
        break;
      case 'countdown':
        announcement.textContent = `COUNTDOWN STARTING… ${3 + randomIndex(5)}. Just kidding.`;
        break;
      case 'vanish': {
        const button = field.querySelector('.glitch-main-button');
        if (button) {
          button.hidden = true;
          announcement.textContent = 'It vanished. The room is pretending this is normal.';
          schedule(() => {
            button.hidden = false;
            announcement.textContent = 'It is back. The room is still pretending.';
          }, 900);
        }
        break;
      }
      case 'tint':
        field.classList.toggle('glitch-tinted');
        announcement.textContent = 'The room’s light changed. The walls look familiar.';
        break;
      case 'instruction':
        $('#glitch-button-message').textContent = [
          'Try not pressing the button. Oh.',
          'You may stop now. The room is not stopping.',
          'The exit is behind you. Probably.',
          'There is no timer. Not yet.'
        ][randomIndex(4)];
        announcement.textContent = 'A new instruction appeared. It may not be helpful.';
        break;
      default:
        placeButton();
    }
    if (state.buttonClicks >= 3 && Math.random() < 0.14 && !state.secretSeen) triggerSecret();
  }

  function createPuzzle() {
    if (!scenarioDeck.length) scenarioDeck = shuffled(SCENARIOS);
    const template = scenarioDeck.pop();
    const objects = template.objects.map(([icon, name, detail, id]) => ({ icon, name, detail, id }));
    const difficulty = DIFFICULTIES[state.difficulty];
    for (const decoration of shuffled(DECORATIONS).slice(0, difficulty.extraObjects)) {
      objects.push({ ...decoration, id: `decoration-${decoration.name}` });
    }
    return { rule: template.rule, target: template.target, objects: shuffled(objects) };
  }

  function startRound() {
    if (!state || state.finished) return;
    clearTimers();
    state.phase = 'puzzle';
    setScreen('puzzle');
    $('#glitch-button-room').hidden = true;
    state.currentPuzzle = createPuzzle();
    state.wrong = 0;
    const duration = DIFFICULTIES[state.difficulty].seconds;
    state.puzzleEndsAt = Date.now() + duration * 1000;
    setText('#glitch-round-label', `ROOM ${state.roundIndex + 1} OF 3`);
    setText('#glitch-countdown', String(duration));
    setText('#glitch-instruction', `YOU HAVE ${duration} SECONDS. Find the object that breaks the rule.`);
    setText('#glitch-rule', state.currentPuzzle.rule);
    setText('#glitch-wrong', '0');
    setText('#glitch-solved', String(state.solved));
    setText('#glitch-time', formatTime(Math.floor((Date.now() - state.startTime) / 1000)));
    const objects = $('#glitch-objects');
    objects.replaceChildren();
    state.currentPuzzle.objects.forEach((item, index) => {
      const button = makeButton('', 'glitch-object', () => guessObject(item.id));
      button.style.setProperty('--object-order', String(index));
      const icon = document.createElement('span');
      icon.className = 'glitch-object-icon';
      icon.textContent = item.icon;
      const name = document.createElement('strong');
      name.textContent = item.name;
      const detail = document.createElement('span');
      detail.className = 'glitch-object-detail';
      detail.textContent = item.detail;
      button.append(icon, name, detail);
      objects.append(button);
    });
    setText('#glitch-feedback', 'Look closely. Tap the object that breaks the room’s rule.');
    updateScoreboard();
    ticker = window.setInterval(updateTimer, 200);
    updateTimer();
    if (Math.random() < 0.08 && !state.secretSeen) {
      schedule(() => {
        if (!state || state.finished || puzzleScreen.hidden) return;
        state.secretSeen = true;
        setText('#glitch-feedback', 'Did you notice that? Something blinked in the corner…');
      }, 1400);
    }
  }

  function updateTimer() {
    if (!state || state.finished) return;
    const remaining = Math.max(0, (state.puzzleEndsAt - Date.now()) / 1000);
    setText('#glitch-countdown', String(Math.ceil(remaining)));
    setText('#glitch-time', formatTime(Math.floor((Date.now() - state.startTime) / 1000)));
    $('#glitch-countdown').classList.toggle('glitch-time-low', remaining <= 5);
    if (remaining <= 0) finishRound(false);
  }

  function guessObject(id) {
    if (!state || state.finished || !state.currentPuzzle) return;
    state.attempts += 1;
    if (id === state.currentPuzzle.target) {
      finishRound(true);
      return;
    }
    state.wrong += 1;
    state.puzzleEndsAt -= DIFFICULTIES[state.difficulty].penalty * 1000;
    setText('#glitch-wrong', String(state.wrong));
    setText('#glitch-feedback', 'Not that one. The room is still here—keep looking.');
    updateScoreboard();
    updateTimer();
  }

  function finishRound(found) {
    if (!state || state.finished || state.phase !== 'puzzle') return;
    state.phase = 'transition';
    if (ticker !== null) {
      window.clearInterval(ticker);
      ticker = null;
    }
    const buttons = $('#glitch-objects').querySelectorAll('button');
    buttons.forEach((button) => { button.disabled = true; });
    if (found) {
      const remaining = Math.max(0, (state.puzzleEndsAt - Date.now()) / 1000);
      const base = 60 + DIFFICULTIES[state.difficulty].bonus;
      const speedBonus = Math.floor(remaining * 2);
      const penalty = state.wrong * 12;
      const roundScore = Math.max(0, base + speedBonus - penalty);
      state.score += roundScore;
      state.solved += 1;
      setText('#glitch-feedback', `GLITCH FOUND. +${roundScore} points. The room changed again.`);
    } else {
      setText('#glitch-feedback', 'Time’s up. The room resets, but your run continues.');
    }
    state.roundIndex += 1;
    setText('#glitch-solved', String(state.solved));
    updateScoreboard();
    if (state.roundIndex >= 3) {
      schedule(() => endGame(), 850);
    } else {
      schedule(startRound, 950);
    }
  }

  function endingFor(duration) {
    if (state.solved === 0) return ['THE BUTTON WON', 'The room kept its secret this time. Ready for a rematch?'];
    if (state.solved === 3 && state.secretSeen && state.wrong === 0) return ['THE ROOM FOUND YOU', 'You noticed the thing the room hoped you would miss.'];
    if (state.solved === 3 && state.difficulty === 'hard' && state.wrong === 0) return ['YOU FOUND THE IMPOSSIBLE', 'Three rooms. Three glitches. Not a single false move.'];
    if (state.solved === 3 && duration <= 35) return ['GLITCH HUNTER', 'Fast eyes, steady nerves. The room never stood a chance.'];
    if (state.solved === 3) return ['ROOM ESCAPED', 'The final door opened. The room will remember you.'];
    return ['THE ROOM FOUND YOU', 'You found part of the truth. There is always another room.'];
  }

  function saveStatistics(duration) {
    let saved = true;
    try {
      const previousBest = readStat(KEYS.bestScore);
      const previousGames = readStat(KEYS.gamesPlayed);
      const previousTime = readStat(KEYS.bestTime);
      const completedRun = state.solved === 3;
      const bestTime = completedRun && previousTime > 0 ? Math.min(previousTime, duration) :
        completedRun ? duration : previousTime;
      localStorage.setItem(KEYS.gamesPlayed, String(previousGames + 1));
      localStorage.setItem(KEYS.bestScore, String(Math.max(previousBest, state.score)));
      localStorage.setItem(KEYS.bestTime, String(bestTime));
    } catch (error) {
      saved = false;
    }
    return saved;
  }

  function endGame() {
    if (!state || state.finished) return;
    clearTimers();
    state.finished = true;
    state.phase = 'result';
    const duration = Math.max(1, Math.floor((Date.now() - state.startTime) / 1000));
    const [ending, message] = endingFor(duration);
    const saved = saveStatistics(duration);
    const best = readStat(KEYS.bestScore);
    setScreen('result');
    $('#glitch-difficulty').disabled = false;
    setText('#glitch-ending', ending);
    setText('#glitch-result-message', saved ? message : `${message} Browser storage is unavailable, so this run could not be saved.`);
    setText('#glitch-final-score', String(state.score));
    setText('#glitch-result-time', `Time: ${formatTime(duration)}`);
    setText('#glitch-result-attempts', `Attempts: ${state.attempts}`);
    const bestTime = readStat(KEYS.bestTime);
    setText('#glitch-result-best', `Best time: ${bestTime ? formatTime(bestTime) : '—'} · Games played: ${readStat(KEYS.gamesPlayed)}`);
    setText('#glitch-best', String(best));
    setText('#glitch-time', formatTime(duration));
    setText('#glitch-score', String(state.score));
    setText('#glitch-attempts', String(state.attempts));
    const symbol = $('#glitch-result-symbol');
    symbol.textContent = state.solved === 3 ? '✦' : state.solved ? '◌' : '×';
    symbol.classList.toggle('glitch-result-secret', ending === 'THE ROOM FOUND YOU' && state.secretSeen);
  }

  function initialStats() {
    setText('#glitch-best', String(readStat(KEYS.bestScore)));
    setText('#glitch-score', '0');
    setText('#glitch-time', '—');
    setText('#glitch-attempts', '0');
  }

  $('#glitch-start').addEventListener('click', beginGame);
  $('#glitch-again').addEventListener('click', beginGame);
  field.addEventListener('animationend', (event) => {
    if (event.animationName === 'glitch-jolt') field.classList.remove('glitch-jolt');
  });
  window.addEventListener('pagehide', () => {
    disposed = true;
    clearTimers();
  }, { once: true });
  initialStats();
})();
