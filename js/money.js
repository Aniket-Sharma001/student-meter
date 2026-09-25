(() => {
  let money = SM.read('money', { balance: 0, savingsGoal: 0, transactions: [] });
  money.balance = Math.max(0, Number(money.balance) || 0);
  money.savingsGoal = Math.max(0, Number(money.savingsGoal) || 0);
  if (!Array.isArray(money.transactions)) money.transactions = [];
  const currency = (amount) => `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  function render() {
    const today = SM.today();
    const daily = money.transactions.filter((item) => item.type === 'expense' && item.date === today).reduce((total, item) => total + item.amount, 0);
    const balance = money.balance + money.transactions.reduce((total, item) => total + (item.type === 'income' ? item.amount : -item.amount), 0);
    const remaining = Math.max(0, money.savingsGoal - Math.max(0, balance));
    document.querySelector('#balance-value').textContent = currency(balance);
    document.querySelector('#daily-spending').textContent = currency(daily);
    document.querySelector('#savings-remaining').textContent = currency(remaining);
    document.querySelector('#transaction-count').textContent = money.transactions.length;
    document.querySelector('#starting-balance').value = money.balance;
    document.querySelector('#savings-goal').value = money.savingsGoal;
    const progress = money.savingsGoal > 0 ? Math.min(100, Math.round(Math.max(0, balance) / money.savingsGoal * 100)) : 0;
    document.querySelector('#savings-progress-label').textContent = `${progress}%`;
    document.querySelector('#savings-progress').style.width = `${progress}%`;

    const body = document.querySelector('#transaction-list');
    body.replaceChildren();
    money.transactions.slice().reverse().slice(0, 50).forEach((item) => {
      const row = document.createElement('tr');
      const label = document.createElement('td');
      label.textContent = item.note || (item.type === 'income' ? 'Income' : 'Expense');
      const category = document.createElement('td');
      category.textContent = item.category;
      const date = document.createElement('td');
      date.textContent = item.date;
      const amount = document.createElement('td');
      amount.className = item.type === 'income' ? 'amount-positive' : 'amount-negative';
      amount.textContent = `${item.type === 'income' ? '+' : '−'}${currency(item.amount)}`;
      const action = document.createElement('td');
      const remove = document.createElement('button');
      remove.className = 'mini-button';
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete ${item.note || item.category} transaction`);
      remove.addEventListener('click', () => {
        money.transactions = money.transactions.filter((transaction) => transaction.id !== item.id);
        if (SM.write('money', money)) render();
      });
      action.append(remove);
      row.append(label, category, date, amount, action);
      body.append(row);
    });
    document.querySelector('#transaction-empty').hidden = money.transactions.length > 0;
  }

  document.querySelector('#money-settings-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    money.balance = Number(values.get('balance'));
    money.savingsGoal = Number(values.get('savingsGoal'));
    if (!Number.isFinite(money.balance) || money.balance < 0 || !Number.isFinite(money.savingsGoal) || money.savingsGoal < 0) {
      SM.notify('Enter valid non-negative balance and savings amounts.');
      return;
    }
    if (SM.write('money', money)) {
      render();
      SM.notify('Balance and savings goal saved.');
    }
  });

  document.querySelector('#transaction-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const amount = Number(values.get('amount'));
    if (!Number.isFinite(amount) || amount <= 0) {
      SM.notify('Enter an amount greater than zero.');
      return;
    }
    money.transactions.push({
      id: crypto.randomUUID(),
      type: String(values.get('type')),
      amount,
      category: String(values.get('category')),
      note: String(values.get('note') || '').trim(),
      date: SM.today()
    });
    if (SM.write('money', money)) {
      event.currentTarget.reset();
      render();
      SM.notify('Transaction saved.');
    }
  });

  render();
})();
