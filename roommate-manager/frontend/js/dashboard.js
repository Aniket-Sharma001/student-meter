document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const welcomeName = document.getElementById('welcomeName');
  if (welcomeName && user.fullName) {
    welcomeName.textContent = `Welcome, ${user.fullName}`;
  }

  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'index.html';
    });
  }

  function formatMoney(value) {
    return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  }

  fetch('http://localhost:8080/api/dashboard', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Dashboard load failed.');
      }

      document.getElementById('membersCount').textContent = data.totalRoomMembers || 0;
      document.getElementById('monthlyRent').textContent = formatMoney(data.monthlyRent);
      document.getElementById('electricityBill').textContent = formatMoney(data.electricityBill);
      document.getElementById('monthlyExpense').textContent = formatMoney(data.totalMonthlyExpenses);
      document.getElementById('paidAmount').textContent = formatMoney(data.myPaidAmount);
      document.getElementById('pendingAmount').textContent = formatMoney(data.myPendingAmount);

      const recentExpensesTable = document.querySelectorAll('tbody')[0];
      recentExpensesTable.innerHTML = (data.recentExpenses || []).map((item) => `
        <tr>
          <td>${item.title}</td>
          <td>${item.category}</td>
          <td>${formatMoney(item.amount)}</td>
          <td>${item.paidBy}</td>
        </tr>
      `).join('') || '<tr><td colspan="4">No recent expenses</td></tr>';

      const recentPaymentsTable = document.querySelectorAll('tbody')[1];
      recentPaymentsTable.innerHTML = (data.recentPayments || []).map((item) => `
        <tr>
          <td>${item.payer}</td>
          <td>${item.receiver}</td>
          <td>${formatMoney(item.amount)}</td>
        </tr>
      `).join('') || '<tr><td colspan="3">No recent payments</td></tr>';

      if (welcomeName && user.fullName) {
        welcomeName.textContent = `Welcome, ${user.fullName}`;
      }
    })
    .catch((error) => {
      console.error(error);
      alert(error.message || 'Unable to load dashboard.');
    });
});
