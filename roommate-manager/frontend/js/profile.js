document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../index.html';
    return;
  }

  const profileForm = document.getElementById('profileForm');

  fetch('http://localhost:8080/api/profile', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById('fullName').value = data.fullName || '';
      document.getElementById('email').value = data.email || '';
      document.getElementById('mobileNumber').value = data.mobileNumber || '';
    })
    .catch((error) => {
      console.error(error);
    });

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      fullName: document.getElementById('fullName').value.trim(),
      mobileNumber: document.getElementById('mobileNumber').value.trim()
    };

    try {
      const response = await fetch('http://localhost:8080/api/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Profile update failed.');
      alert('Profile updated successfully.');
    } catch (error) {
      alert(error.message);
    }
  });
});
