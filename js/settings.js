(() => {
  const form = document.querySelector('#reminder-settings-form');
  const enabledInput = document.querySelector('#reminder-enabled');
  const targetPreset = document.querySelector('#target-preset');
  const intervalPreset = document.querySelector('#interval-preset');
  const customTargetField = document.querySelector('#custom-target-field');
  const customIntervalField = document.querySelector('#custom-interval-field');
  const permissionInfo = document.querySelector('#notification-permission-info');
  const targetOptions = new Set(['120', '180', '240']);
  const intervalOptions = new Set(['30', '60', '120']);

  function toggleCustomFields() {
    customTargetField.hidden = targetPreset.value !== 'custom';
    customIntervalField.hidden = intervalPreset.value !== 'custom';
    document.querySelector('#custom-target').required = !customTargetField.hidden;
    document.querySelector('#custom-interval').required = !customIntervalField.hidden;
  }

  function preview() {
    const message = SM.Reminders.message({
      studentType: document.querySelector('#student-type').value,
      mode: document.querySelector('#reminder-mode').value
    });
    document.querySelector('[data-settings-preview-message]').textContent = message.exact;
    document.querySelector('[data-settings-preview-support]').textContent = message.supportive;
  }

  function showPermissionStatus() {
    if (!window.isSecureContext || !('Notification' in window)) {
      permissionInfo.textContent = 'Browser notifications are not available in this context. Use HTTPS or localhost with a supported browser. In-page reminders still work while this site is open.';
    } else if (Notification.permission === 'granted') {
      permissionInfo.textContent = 'Browser notification permission is granted. Notifications will be sent when reminders are due and the option is enabled.';
    } else if (Notification.permission === 'denied') {
      permissionInfo.textContent = 'Browser notification permission is blocked. Allow it in your browser site settings if you want system notifications.';
    } else {
      permissionInfo.textContent = 'Permission is only requested after you enable Study Reminder, turn on Browser Notifications and save.';
    }
  }

  function populate() {
    const settings = SM.Reminders.getSettings();
    enabledInput.checked = Boolean(settings.enabled);
    document.querySelector('#student-type').value = settings.studentType === 'LADKI' ? 'LADKI' : 'LADKA';
    document.querySelector('#reminder-mode').value = ['Friendly', 'Serious', 'Strict', 'Funny Roast'].includes(settings.mode) ? settings.mode : 'Friendly';
    const target = Number(settings.targetMinutes) || 120;
    targetPreset.value = targetOptions.has(String(target)) ? String(target) : 'custom';
    document.querySelector('#custom-target').value = target;
    const interval = Number(settings.intervalMinutes) || 60;
    intervalPreset.value = intervalOptions.has(String(interval)) ? String(interval) : 'custom';
    document.querySelector('#custom-interval').value = interval;
    document.querySelector('#browser-notifications').checked = Boolean(settings.browserNotifications);
    toggleCustomFields();
    preview();
    showPermissionStatus();
  }

  targetPreset.addEventListener('change', toggleCustomFields);
  intervalPreset.addEventListener('change', toggleCustomFields);
  document.querySelector('#student-type').addEventListener('change', preview);
  document.querySelector('#reminder-mode').addEventListener('change', preview);
  document.querySelector('#browser-notifications').addEventListener('change', () => {
    if (document.querySelector('#browser-notifications').checked && !enabledInput.checked) {
      permissionInfo.textContent = 'Turn on Study Reminder and save before browser notification permission can be requested.';
    } else {
      showPermissionStatus();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const customTarget = targetPreset.value === 'custom';
    const customInterval = intervalPreset.value === 'custom';
    const targetMinutes = customTarget ? Number(data.get('customTarget')) : Number(targetPreset.value);
    const intervalMinutes = customInterval ? Number(data.get('customInterval')) : Number(intervalPreset.value);
    if (!Number.isInteger(targetMinutes) || targetMinutes < 1 || targetMinutes > 1440) {
      SM.notify('Set a daily target from 1 to 1440 minutes.');
      return;
    }
    if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 720) {
      SM.notify('Set a reminder interval from 5 to 720 minutes.');
      return;
    }

    const previous = SM.Reminders.getSettings();
    const settings = {
      enabled: enabledInput.checked,
      studentType: String(data.get('studentType')),
      targetMinutes,
      intervalMinutes,
      mode: String(data.get('mode')),
      browserNotifications: document.querySelector('#browser-notifications').checked
    };
    if (!SM.write('reminderSettings', settings)) return;

    const state = SM.Reminders.getState();
    if (!previous.enabled && settings.enabled) {
      state.enabledAt = new Date().toISOString();
      state.lastReminderAt = null;
      state.nextReminderAt = null;
    } else if (!settings.enabled) {
      state.enabledAt = null;
      state.nextReminderAt = null;
    }
    if (!SM.write('reminderState', state)) return;

    const study = SM.read('study', { goal: targetMinutes, subjects: [], sessions: [] });
    study.goal = targetMinutes;
    if (!SM.write('study', study)) return;
    const profile = SM.profile();
    profile.studyGoal = targetMinutes;
    if (!SM.write('profile', profile)) return;

    if (settings.enabled && settings.browserNotifications) {
      if (!window.isSecureContext || !('Notification' in window)) {
        permissionInfo.textContent = 'In-page reminders are enabled. Browser notifications require a supported secure context such as HTTPS or localhost.';
      } else if (Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch (error) {
          console.error('Could not request browser notification permission.', error);
          permissionInfo.textContent = 'The browser could not request notification permission. In-page reminders are still enabled.';
        }
      }
    }
    showPermissionStatus();
    SM.Reminders.check();
    SM.Reminders.render();
    preview();
    SM.notify('Study Reminder settings saved.');
  });

  populate();
})();
