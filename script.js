const scoreCircle = document.getElementById('scoreCircle');
const themeToggle = document.getElementById('themeToggle');
const xpFill = document.getElementById('xpFill');
const timerDisplay = document.getElementById('timerDisplay');
const startTimerButton = document.getElementById('startTimer');
const pauseTimerButton = document.getElementById('pauseTimer');
const resetTimerButton = document.getElementById('resetTimer');
const rewardButton = document.getElementById('rewardButton');
const spinWheelButton = document.getElementById('spinWheel');
const wheel = document.getElementById('fortuneWheel');
const wheelResult = document.getElementById('wheelResult');
const moodButtons = document.querySelectorAll('.mood');
const missionItems = document.querySelectorAll('.mission');
const actionButtons = document.querySelectorAll('.action');

const score = 86;
const totalSeconds = 25 * 60;
let remainingSeconds = totalSeconds;
let intervalId = null;

function updateScore() {
  scoreCircle.style.setProperty('--score', `${score}%`);
  document.getElementById('scoreValue').textContent = score;
}

function updateXpBar() {
  xpFill.style.width = '72%';
}

function updateTimerDisplay() {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startTimer() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    if (remainingSeconds > 0) {
      remainingSeconds -= 1;
      updateTimerDisplay();
    } else {
      clearInterval(intervalId);
      intervalId = null;
      timerDisplay.textContent = '00:00';
    }
  }, 1000);
}

function pauseTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function resetTimer() {
  pauseTimer();
  remainingSeconds = totalSeconds;
  updateTimerDisplay();
}

function logReward() {
  const currentTotal = document.getElementById('moneyTotal');
  const formatted = currentTotal.textContent.replace(/[₹,]/g, '');
  const numeric = Number(formatted) || 0;
  const updated = numeric + 120;
  currentTotal.textContent = `₹${updated.toLocaleString('en-IN')}`;
  rewardButton.textContent = 'Logged ✓';
  rewardButton.disabled = true;
}

function spinWheel() {
  const rewards = ['Study boost +15%', 'Pocket ₹50', 'Free break', 'Focus +10%', 'Bonus XP', 'Keep going!'];
  const index = Math.floor(Math.random() * rewards.length);
  const rotation = 720 + index * 60;
  wheel.style.transform = `rotate(${rotation}deg)`;
  wheelResult.textContent = rewards[index];
}

function toggleTheme() {
  document.body.classList.toggle('dark');
  themeToggle.textContent = document.body.classList.contains('dark') ? '☀' : '☾';
}

moodButtons.forEach((button) => {
  button.addEventListener('click', () => {
    moodButtons.forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
  });
});

missionItems.forEach((mission) => {
  mission.addEventListener('click', () => {
    mission.classList.toggle('done');
  });
});

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    const labels = {
      study: 'Study session started',
      gym: 'Workout logged',
      notes: 'Notes opened',
      break: 'Break timer set'
    };
    wheelResult.textContent = labels[action] || 'Action started';
  });
});

startTimerButton.addEventListener('click', startTimer);
pauseTimerButton.addEventListener('click', pauseTimer);
resetTimerButton.addEventListener('click', resetTimer);
rewardButton.addEventListener('click', logReward);
spinWheelButton.addEventListener('click', spinWheel);
themeToggle.addEventListener('click', toggleTheme);

updateScore();
updateXpBar();
updateTimerDisplay();
