const API_BASE_URL = 'http://localhost:8080/api';

function showMessage(elementId, message, type) {
  const box = document.getElementById(elementId);
  if (!box) return;

  box.textContent = message;
  box.className = `message ${type}`;
  box.classList.remove('hidden');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function loginUser(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!email || !password) {
    showMessage('loginMessage', 'Email and password are required.', 'error');
    return;
  }

  if (!validateEmail(email)) {
    showMessage('loginMessage', 'Please enter a valid email.', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed.');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify({
      email: data.email,
      fullName: data.fullName
    }));

    window.location.href = 'dashboard.html';
  } catch (error) {
    showMessage('loginMessage', error.message, 'error');
  }
}

async function registerUser(event) {
  event.preventDefault();

  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const mobileNumber = document.getElementById('mobileNumber').value.trim();
  const password = document.getElementById('password').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();

  if (!fullName || !email || !mobileNumber || !password || !confirmPassword) {
    showMessage('registerMessage', 'All fields are required.', 'error');
    return;
  }

  if (!validateEmail(email)) {
    showMessage('registerMessage', 'Please enter a valid email.', 'error');
    return;
  }

  if (password.length < 6) {
    showMessage('registerMessage', 'Password must be at least 6 characters.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showMessage('registerMessage', 'Passwords do not match.', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, mobileNumber, password, confirmPassword })
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : { message: await response.text() };

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed.');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify({
      email: data.email,
      fullName: data.fullName
    }));

    showMessage('registerMessage', 'Registration successful! Redirecting...', 'success');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 800);
  } catch (error) {
    showMessage('registerMessage', error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', loginUser);
  }

  if (registerForm) {
    registerForm.addEventListener('submit', registerUser);
  }
});
