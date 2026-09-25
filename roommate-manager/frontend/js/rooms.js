document.addEventListener('DOMContentLoaded', () => {
  const roomForm = document.getElementById('roomForm');
  const roomTableBody = document.getElementById('roomTableBody');

  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../index.html';
    return;
  }

  const apiUrl = 'http://localhost:8080/api/rooms';

  async function loadRooms() {
    try {
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Could not load rooms.');
      }

      const rooms = await response.json();
      roomTableBody.innerHTML = rooms.length ? rooms.map(room => `
        <tr>
          <td>${room.roomName}</td>
          <td>${room.roomAddress || 'N/A'}</td>
          <td>${room.totalMembers || 0}</td>
          <td>₹${Number(room.monthlyRent || 0).toLocaleString('en-IN')}</td>
          <td><span class="status paid">Active</span></td>
        </tr>
      `).join('') : `<tr><td colspan="5">No rooms found yet.</td></tr>`;
    } catch (error) {
      roomTableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
    }
  }

  roomForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      roomName: document.getElementById('roomName').value.trim(),
      roomAddress: document.getElementById('roomAddress').value.trim(),
      totalMembers: Number(document.getElementById('totalMembers').value),
      monthlyRent: Number(document.getElementById('monthlyRent').value)
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Room creation failed.');
      }

      roomForm.reset();
      loadRooms();
    } catch (error) {
      alert(error.message);
    }
  });

  loadRooms();
});
