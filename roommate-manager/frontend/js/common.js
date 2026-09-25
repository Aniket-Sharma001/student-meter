document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');

  if (!token) {
    if (window.location.pathname.includes('index.html') === false && window.location.pathname.includes('register.html') === false) {
      window.location.href = '../index.html';
    }
    return;
  }

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '../index.html';
    });
  }
});
