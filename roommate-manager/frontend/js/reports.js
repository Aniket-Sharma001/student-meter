document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../index.html';
    return;
  }

  const roomId = 1;
  fetch(`http://localhost:8080/api/reports/monthly?roomId=${roomId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById('totalRent').textContent = `₹${Number(data.totalRent || 0).toLocaleString('en-IN')}`;
      document.getElementById('totalElectricity').textContent = `₹${Number(data.totalElectricity || 0).toLocaleString('en-IN')}`;
      document.getElementById('totalGroceries').textContent = `₹${Number(data.totalGroceries || 0).toLocaleString('en-IN')}`;
      document.getElementById('totalFood').textContent = `₹${Number(data.totalFoodExpenses || 0).toLocaleString('en-IN')}`;
      document.getElementById('totalExpense').textContent = `₹${Number(data.totalMonthlyExpense || 0).toLocaleString('en-IN')}`;

      const reportTableBody = document.getElementById('reportTableBody');
      reportTableBody.innerHTML = (data.categoryBreakdown || []).map(item => `
        <tr>
          <td>${item.category}</td>
          <td>₹${Number(item.amount || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('');
    })
    .catch((error) => {
      console.error(error);
    });
});
