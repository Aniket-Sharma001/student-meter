(() => {
  const intervalLabel = (minutes) => {
    if (minutes < 60) return `${minutes} minutes`;
    if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  function render() {
    const settings = SM.Reminders.getSettings();
    document.querySelectorAll('[data-reminder-interval]').forEach((el) => {
      el.textContent = intervalLabel(Number(settings.intervalMinutes) || 60);
    });
    document.querySelectorAll('[data-browser-notification-status]').forEach((el) => {
      if (!settings.browserNotifications) {
        el.textContent = 'Off';
      } else if (!window.isSecureContext || !('Notification' in window)) {
        el.textContent = 'Unavailable here';
      } else {
        el.textContent = Notification.permission === 'granted' ? 'Allowed' :
          Notification.permission === 'denied' ? 'Blocked in browser' : 'Permission not granted';
      }
    });
    SM.Reminders.render();
  }

  document.querySelector('[data-target-complete-page]')?.addEventListener('click', () => {
    SM.Reminders.acknowledge();
    render();
  });
  render();
})();
