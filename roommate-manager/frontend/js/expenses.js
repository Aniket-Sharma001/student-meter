document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../index.html';
    return;
  }

  const expenseForm = document.getElementById('expenseForm');
  const expenseTableBody = document.getElementById('expenseTableBody');

  const formatMoney = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

  async function loadExpenses() {
    try {
      const roomId = document.getElementById('roomId').value || 1;
      const response = await fetch(`http://localhost:8080/api/expenses?roomId=${roomId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Could not fetch expenses.');
      }

      const data = await response.json();
      expenseTableBody.innerHTML = data.length ? data.map(item => `
        <tr>
          <td>${item.title}</td>
          <td>${item.category}</td>
          <td>${formatMoney(item.amount)}</td>
          <td>${item.expenseDate}</td>
          <td>${item.paidBy || 'N/A'}</td>
        </tr>
      `).join('') : '<tr><td colspan="5">No expenses yet.</td></tr>';
    } catch (error) {
      expenseTableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
    }
  }

  expenseForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      roomId: Number(document.getElementById('roomId').value),
      title: document.getElementById('title').value.trim(),
      category: document.getElementById('category').value,
      amount: Number(document.getElementById('amount').value),
      expenseDate: document.getElementById('expenseDate').value,
      paidBy: document.getElementById('paidBy').value.trim(),
      description: document.getElementById('description').value.trim()
    };

    try {
      const response = await fetch('http://localhost:8080/api/expenses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Expense add failed.');

      expenseForm.reset();
      loadExpenses();
    } catch (error) {
      alert(error.message);
    }
  });

  loadExpenses();
});
