document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '../index.html';
    return;
  }

  const paymentForm = document.getElementById('paymentForm');
  const paymentTableBody = document.getElementById('paymentTableBody');

  async function loadPayments() {
    try {
      const roomId = document.getElementById('roomId').value || 1;
      const response = await fetch(`http://localhost:8080/api/payments?roomId=${roomId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Could not fetch payments.');
      }

      const data = await response.json();
      paymentTableBody.innerHTML = data.length ? data.map(item => `
        <tr>
          <td>${item.payer?.email || 'N/A'}</td>
          <td>${item.receiver?.email || 'N/A'}</td>
          <td>₹${Number(item.amount || 0).toLocaleString('en-IN')}</td>
          <td>${item.paymentMethod || 'N/A'}</td>
        </tr>
      `).join('') : '<tr><td colspan="4">No payments yet.</td></tr>';
    } catch (error) {
      paymentTableBody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
    }
  }

  paymentForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      roomId: Number(document.getElementById('roomId').value),
      payerEmail: document.getElementById('payerEmail').value.trim(),
      receiverEmail: document.getElementById('receiverEmail').value.trim(),
      amount: Number(document.getElementById('amount').value),
      paymentMethod: document.getElementById('paymentMethod').value,
      note: document.getElementById('note').value.trim()
    };

    try {
      const response = await fetch('http://localhost:8080/api/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Payment failed.');

      paymentForm.reset();
      loadPayments();
    } catch (error) {
      alert(error.message);
    }
  });

  loadPayments();
});
