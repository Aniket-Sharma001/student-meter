(() => {
  function renderAccount() {
    const cloud = window.SM?.Cloud;
    const email = cloud?.user?.email || 'Not signed in';
    document.querySelectorAll('[data-profile-email]').forEach((element) => {
      element.textContent = email;
    });
    document.querySelectorAll('[data-profile-change-password], [data-profile-logout]').forEach((button) => {
      button.hidden = !cloud?.user;
    });
  }
  document.addEventListener('student-meter:cloud-status', renderAccount);
  window.SM?.Cloud?.ready.then(renderAccount);
  document.querySelector('[data-profile-change-password]')?.addEventListener('click', () => {
    location.href = 'account.html#change-password';
  });
  document.querySelector('[data-profile-logout]')?.addEventListener('click', async () => {
    try {
      await SM.Cloud.signOut();
      SM.notify('You are logged out. This device’s local data has been kept.');
      renderAccount();
    } catch (error) {
      SM.notify(error.message || 'Could not log out.');
    }
  });
})();
