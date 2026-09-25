(() => {
  const form = document.querySelector('#account-form');
  const authPanel = document.querySelector('#account-auth-panel');
  const sessionPanel = document.querySelector('#account-session-panel');
  const submit = document.querySelector('#account-submit');
  const migrationMessage = document.querySelector('#account-migration-message');
  const migrationActions = document.querySelector('#account-migration-actions');
  let mode = 'login';

  function notify(message) {
    if (window.SM?.notify) window.SM.notify(message);
    else document.querySelector('#account-config-message').textContent = message;
  }

  function setMode(next) {
    mode = next;
    document.querySelectorAll('[data-account-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.accountTab === mode);
    });
    document.querySelectorAll('[data-account-name-field]').forEach((field) => {
      field.hidden = mode !== 'signup';
      field.querySelector('input').required = false;
    });
    const passwordField = document.querySelector('[data-account-password-field]');
    passwordField.hidden = mode === 'reset';
    document.querySelector('#account-password').required = mode !== 'reset';
    document.querySelector('#account-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    submit.textContent = ({ login: 'Login', signup: 'Create account', reset: 'Send reset link' })[mode];
    document.querySelector('#account-config-message').textContent = mode === 'reset'
      ? 'We will send a password reset link if an account exists for that email.'
      : 'Cloud accounts need your Supabase project and the public browser configuration. Until configured, Student Meter remains local-only.';
  }

  function renderSession() {
    const cloud = SM.Cloud;
    authPanel.hidden = Boolean(cloud.user);
    sessionPanel.hidden = !cloud.user;
    if (!cloud.user) return;
    document.querySelector('#account-email-label').textContent = cloud.user.email || 'Signed-in account';
    const state = cloud.migration;
    migrationActions.hidden = !state || !['choice', 'conflict'].includes(state.kind);
    if (!state) {
      migrationMessage.textContent = 'Checking your local data and account backup…';
    } else if (state.kind === 'choice') {
      const local = state.localHasData;
      const cloudExists = Boolean(state.cloud);
      const cloudHasData = state.cloudHasData;
      migrationMessage.textContent = cloudHasData
        ? 'Cloud data and/or local Student Meter data were found. Choose how to continue; no data will be overwritten without your selection.'
        : cloudExists && local
          ? 'Local Student Meter data was found and this account has an empty cloud backup. Choose whether to upload local data or start fresh.'
        : local
          ? 'Local Student Meter data found. Upload it to your account, or start with a fresh local dataset.'
          : 'No saved data was found yet. Add your first study record and it will sync to your account.';
      document.querySelector('[data-migration-action="upload"]').hidden = !local || cloudHasData;
      document.querySelector('[data-migration-action="cloud"]').hidden = !cloudExists;
      document.querySelector('[data-migration-action="merge"]').hidden = !local || !cloudHasData;
      document.querySelector('[data-migration-action="replace"]').hidden = !local || !cloudHasData;
      document.querySelector('[data-migration-action="fresh"]').hidden = !local && !cloudHasData;
    } else if (state.kind === 'conflict') {
      migrationMessage.textContent = `Your local changes are safe, but another device updated the cloud version. ${state.error || 'Choose a version to continue.'}`;
      document.querySelector('[data-migration-action="upload"]').hidden = !state.localHasData || Boolean(state.cloud);
      document.querySelector('[data-migration-action="cloud"]').hidden = !state.cloud;
      document.querySelector('[data-migration-action="merge"]').hidden = !state.localHasData || !state.cloud;
      document.querySelector('[data-migration-action="replace"]').hidden = !state.localHasData || !state.cloud;
      document.querySelector('[data-migration-action="fresh"]').hidden = true;
    } else if (state.kind === 'error') {
      migrationMessage.textContent = `Local data is unchanged. Cloud check failed: ${state.error}`;
    } else {
      migrationMessage.textContent = 'Your data is synced. The local cache remains available on this device.';
      migrationActions.hidden = true;
    }
  }

  document.querySelectorAll('[data-account-tab]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.accountTab));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const email = String(values.get('email') || '').trim();
    submit.disabled = true;
    try {
      if (mode === 'login') {
        await SM.Cloud.signIn(email, String(values.get('password') || ''));
        notify('Signed in. Check the data choices below before continuing.');
      } else if (mode === 'signup') {
        const profile = {
          name: String(values.get('name') || '').trim(),
          course: String(values.get('course') || '').trim(),
          college: String(values.get('college') || '').trim()
        };
        const result = await SM.Cloud.signUp(email, String(values.get('password') || ''), profile);
        if (!result.session) notify('Account created successfully. Check your email to confirm your account, then log in.');
        else notify('Account created successfully.');
      } else {
        await SM.Cloud.sendPasswordReset(email);
        notify('If an account exists for that email, a password reset link has been sent.');
      }
      renderSession();
    } catch (error) {
      notify(error.message || 'The account request failed. Please try again.');
    } finally {
      submit.disabled = !SM.Cloud.client;
    }
  });

  migrationActions.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-migration-action]');
    if (!button) return;
    const action = button.dataset.migrationAction;
    migrationActions.querySelectorAll('button').forEach((item) => { item.disabled = true; });
    try {
      await SM.Cloud.resolveMigration(action);
      notify('Student Meter cloud sync is ready.');
      renderSession();
    } catch (error) {
      notify(error.message || 'Could not complete that data choice.');
      renderSession();
    } finally {
      migrationActions.querySelectorAll('button').forEach((item) => { item.disabled = false; });
    }
  });

  document.querySelector('[data-account-logout]').addEventListener('click', async () => {
    try {
      await SM.Cloud.signOut();
      notify('You are logged out. This device’s local data has been kept.');
      renderSession();
    } catch (error) { notify(error.message || 'Could not log out.'); }
  });

  document.querySelector('[data-account-change-password]').addEventListener('click', async () => {
    const passwordForm = document.querySelector('#account-change-password-form');
    passwordForm.hidden = false;
    passwordForm.querySelector('input').focus();
  });

  document.querySelector('[data-account-cancel-password]').addEventListener('click', () => {
    const passwordForm = document.querySelector('#account-change-password-form');
    passwordForm.reset();
    passwordForm.hidden = true;
  });

  document.querySelector('#account-change-password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password');
    try {
      await SM.Cloud.changePassword(String(password));
      event.currentTarget.reset();
      event.currentTarget.hidden = true;
      notify('Password updated.');
    } catch (error) { notify(error.message || 'Could not update the password.'); }
  });

  document.querySelector('#password-recovery-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password');
    try {
      await SM.Cloud.updatePassword(String(password));
      document.querySelector('#password-recovery-panel').hidden = true;
      notify('Password updated. You can now sign in with your new password.');
    } catch (error) { notify(error.message || 'Could not update the password.'); }
  });

  document.addEventListener('student-meter:cloud-status', renderSession);
  document.querySelector('#account-config-message').textContent = SM.Cloud.configured()
    ? 'Supabase public client settings detected. Passwords are handled by Supabase Auth and are never stored by Student Meter.'
    : 'Cloud accounts need a Supabase project and the public browser configuration. Until configured, Student Meter remains local-only.';
  submit.disabled = true;
  const url = new URL(location.href);
  if (url.hash.includes('type=recovery')) {
    document.querySelector('#password-recovery-panel').hidden = false;
    setMode('login');
  }
  setMode('login');
  SM.Cloud.ready.then(() => {
    submit.disabled = !SM.Cloud.client;
    if (SM.Cloud.client) {
      document.querySelector('#account-config-message').textContent =
        'Supabase public client settings detected. Passwords are handled by Supabase Auth and are never stored by Student Meter.';
    } else if (SM.Cloud.configured()) {
      document.querySelector('#account-config-message').textContent =
        'The Supabase client could not be initialized. Check the project URL, public key and network connection.';
    }
    renderSession();
    if (url.hash === '#change-password' && SM.Cloud.user) {
      document.querySelector('#account-change-password-form').hidden = false;
      document.querySelector('#account-new-password').focus();
    }
  });
})();
