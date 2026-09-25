(() => {
  'use strict';

  const DATABASE = 'student-meter-vault';
  const STORES = ['branches', 'semesters', 'subjects', 'items'];
  const PREFIX = 'student-meter:';
  const APP_DATA_KEYS = new Set([
    'profile', 'study', 'xp', 'studyDays', 'goals', 'challenges', 'challengeHistory',
    'challengeDays', 'mood', 'money', 'timer', 'routine', 'reminderSettings',
    'reminderState', 'theme'
  ]);
  const MARKER_KEY = 'student-meter:cloud-sync-marker';
  const PENDING_KEY = 'student-meter:cloud-sync-pending';
  const EMPTY_VAULT = { branches: [], semesters: [], subjects: [], items: [] };
  let client = null;
  let user = null;
  let revision = null;
  let migration = null;
  let applyingCloudData = false;
  let syncTimer = null;
  let status = 'unconfigured';
  let activeSessionId = null;
  let activeSessionWork = null;

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) =>
        `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function containsCredentialField(value) {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(containsCredentialField);
    return Object.entries(value).some(([key, child]) =>
      /password|token|secret|credential/i.test(key) || containsCredentialField(child));
  }

  function snapshotsEqual(first, second) {
    const normalize = (snapshot) => ({
      ...snapshot,
      vault: Object.fromEntries(STORES.map((name) => [
        name,
        [...snapshot.vault[name]].sort((a, b) => a.id.localeCompare(b.id))
      ]))
    });
    return stableStringify(normalize(first)) === stableStringify(normalize(second));
  }

  function configured() {
    const config = window.STUDENT_METER_CLOUD_CONFIG || {};
    return typeof config.supabaseUrl === 'string' &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl) &&
      typeof config.supabaseAnonKey === 'string' &&
      config.supabaseAnonKey.length > 20;
  }

  function setStatus(next, message) {
    status = next;
    document.querySelectorAll('[data-cloud-status]').forEach((element) => {
      element.textContent = message;
      element.dataset.cloudState = next;
    });
    document.querySelectorAll('[data-cloud-privacy]').forEach((element) => {
      element.textContent = user && next === 'synced'
        ? 'Your Student Meter data is synced to your account and stored in the Student Meter cloud database. You can export a backup of your data at any time.'
        : user
          ? 'You are signed in, but sync is not complete. Your latest data is currently stored locally on this device/browser; resolve the sync status before assuming it is in the cloud.'
          : 'Your data is currently stored locally on this device/browser. You can export a backup of your data at any time.';
    });
    document.dispatchEvent(new CustomEvent('student-meter:cloud-status', {
      detail: { status: next, message, user, migration }
    }));
  }

  function showError(message) {
    if (window.SM?.notify) window.SM.notify(message);
    else {
      const target = document.querySelector('#account-config-message');
      if (target) target.textContent = message;
    }
  }

  function openVaultDatabase() {
    return new Promise((resolve, reject) => {
      const opening = indexedDB.open(DATABASE, 1);
      opening.onupgradeneeded = () => {
        const db = opening.result;
        if (!db.objectStoreNames.contains('branches')) db.createObjectStore('branches', { keyPath: 'id' }).createIndex('name', 'name');
        if (!db.objectStoreNames.contains('semesters')) db.createObjectStore('semesters', { keyPath: 'id' }).createIndex('branchId', 'branchId');
        if (!db.objectStoreNames.contains('subjects')) db.createObjectStore('subjects', { keyPath: 'id' }).createIndex('semesterId', 'semesterId');
        if (!db.objectStoreNames.contains('items')) {
          const store = db.createObjectStore('items', { keyPath: 'id' });
          store.createIndex('subjectId', 'subjectId');
          store.createIndex('type', 'type');
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error || new Error('Could not access the local Student Vault.'));
      opening.onblocked = () => reject(new Error('Close other Student Vault tabs, then try syncing again.'));
    });
  }

  async function readVault() {
    const db = await openVaultDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES, 'readonly');
        const result = {};
        let remaining = STORES.length;
        STORES.forEach((name) => {
          const request = transaction.objectStore(name).getAll();
          request.onsuccess = () => {
            result[name] = request.result;
            remaining -= 1;
            if (!remaining) resolve(result);
          };
          request.onerror = () => reject(request.error || new Error('Could not read local Student Vault data.'));
        });
        transaction.onerror = () => reject(transaction.error || new Error('Could not read local Student Vault data.'));
      });
    } finally {
      db.close();
    }
  }

  async function writeVault(vault) {
    if (!vault || !STORES.every((name) => Array.isArray(vault[name]))) throw new Error('The cloud backup has an unsupported Student Vault structure.');
    const db = await openVaultDatabase();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES, 'readwrite');
        STORES.forEach((name) => {
          const store = transaction.objectStore(name);
          store.clear();
          vault[name].forEach((record) => {
            if (!record || typeof record.id !== 'string') {
              transaction.abort();
              reject(new Error('The cloud backup contains an invalid Student Vault record.'));
              return;
            }
            store.put(record);
          });
        });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('Could not restore cloud Student Vault data.'));
        transaction.onabort = () => reject(transaction.error || new Error('Cloud Student Vault restore was cancelled.'));
      });
    } finally {
      db.close();
    }
  }

  async function captureSnapshot() {
    const appData = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(PREFIX) || key === MARKER_KEY || key === PENDING_KEY) continue;
      const dataKey = key.slice(PREFIX.length);
      if (!APP_DATA_KEYS.has(dataKey)) throw new Error(`The local "${dataKey}" entry is not a recognized Student Meter setting and was not synced.`);
      try {
        appData[dataKey] = JSON.parse(localStorage.getItem(key));
      } catch (error) {
        throw new Error(`The local "${key.slice(PREFIX.length)}" setting is not valid JSON and could not be synced.`);
      }
    }
    if (containsCredentialField(appData)) {
      throw new Error('Student Meter data contains a credential-like field and was not included in the cloud backup.');
    }
    return { version: 1, appData, vault: await readVault() };
  }

  async function restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== 1 || !snapshot.appData ||
      typeof snapshot.appData !== 'object' || Array.isArray(snapshot.appData) ||
      Object.keys(snapshot.appData).some((key) => !APP_DATA_KEYS.has(key)) ||
      containsCredentialField(snapshot.appData) ||
      !snapshot.vault || !STORES.every((name) => Array.isArray(snapshot.vault[name]))) {
      throw new Error('The cloud backup has an unsupported Student Meter data format.');
    }
    for (const name of STORES) {
      if (snapshot.vault[name].some((record) => !record || typeof record.id !== 'string' || !record.id)) {
        throw new Error('The cloud backup contains an invalid Student Vault record.');
      }
    }
    applyingCloudData = true;
    try {
      await writeVault(snapshot.vault);
      const keys = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(PREFIX) && key !== MARKER_KEY && key !== PENDING_KEY) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
      Object.entries(snapshot.appData).forEach(([key, value]) => {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
      });
    } finally {
      applyingCloudData = false;
    }
    window.dispatchEvent(new Event('student-meter:cloud-restored'));
  }

  function hasData(snapshot) {
    if (STORES.some((name) => snapshot.vault[name].length)) return true;
    return Object.entries(snapshot.appData).some(([key, value]) => {
      if (key === 'theme' || value === null || value === '') return false;
      if (key === 'profile' && value && typeof value === 'object') {
        return Boolean(value.name || value.college || value.branch || value.semester ||
          (Number(value.studyGoal) || 120) !== 120);
      }
      return !(Array.isArray(value) && value.length === 0) &&
        !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
    });
  }

  async function fetchCloudData() {
    const { data, error } = await client.rpc('get_student_meter_data');
    if (error) throw error;
    return data;
  }

  async function upload(snapshot, expectedRevision = null) {
    if (!navigator.onLine) throw new Error("You're offline. Your changes are saved locally and will sync when you're back online.");
    setStatus('syncing', '🟡 Syncing...');
    const profile = snapshot.appData.profile || {};
    const metadata = user?.user_metadata || {};
    const dataToUpload = {
      ...snapshot,
      profile: {
        name: String(profile.name || metadata.name || '').slice(0, 80),
        course: String(profile.branch || metadata.course || '').slice(0, 100),
        college: String(profile.college || metadata.college || '').slice(0, 120)
      }
    };
    const { data, error } = await client.rpc('sync_student_meter_data', {
      p_snapshot: dataToUpload,
      p_expected_revision: expectedRevision
    });
    if (error) {
      if (error.message?.includes('SYNC_CONFLICT')) {
        throw new Error('Cloud data changed on another device. Open Account to choose which version to keep.');
      }
      throw error;
    }
    revision = Number(data);
    localStorage.setItem(MARKER_KEY, JSON.stringify({ userId: user.id, revision }));
    localStorage.removeItem(PENDING_KEY);
    setStatus('synced', '🟢 Synced');
    return { revision };
  }

  async function pushLocal() {
    const snapshot = await captureSnapshot();
    let remote;
    try { remote = await fetchCloudData(); } catch (error) {
      setStatus('offline', '🔴 Offline / not synced');
      throw error;
    }
    if (remote) {
      const marker = JSON.parse(localStorage.getItem(MARKER_KEY) || 'null');
      const expected = marker?.userId === user.id ? marker.revision : null;
      if (expected === null) throw new Error('Cloud data already exists. Choose Keep Cloud, Replace Cloud or Merge on the Account page.');
      await upload(snapshot, expected);
    } else {
      await upload(snapshot);
    }
  }

  function saveMarker(cloudRevision) {
    revision = cloudRevision;
    localStorage.setItem(MARKER_KEY, JSON.stringify({ userId: user.id, revision }));
    localStorage.removeItem(PENDING_KEY);
  }

  async function prepareMigration() {
    const [local, remote] = await Promise.all([captureSnapshot(), fetchCloudData()]);
    const marker = JSON.parse(localStorage.getItem(MARKER_KEY) || 'null');
    if (marker?.userId === user.id) {
      if (localStorage.getItem(PENDING_KEY) === user.id) {
        revision = marker.revision;
        try {
          await upload(local, revision);
          migration = { kind: 'synced', localHasData: hasData(local), cloud: await fetchCloudData() };
          return;
        } catch (error) {
          migration = { kind: 'conflict', local, cloud: await fetchCloudData(), error: error.message };
          setStatus('conflict', '🟠 Sync conflict');
          return;
        }
      }
      if (localStorage.getItem(PENDING_KEY) === 'local') {
        migration = { kind: 'conflict', local, cloud: remote, error: 'This device has local changes made while logged out. Choose which copy to keep.' };
        setStatus('conflict', '🟠 Choose a data version');
        return;
      }
      if (remote) {
        const unchanged = snapshotsEqual(local, remote.snapshot);
        if (!unchanged) await restoreSnapshot(remote.snapshot);
        saveMarker(remote.revision);
        migration = { kind: 'synced', localHasData: hasData(remote.snapshot), cloud: remote };
        setStatus('synced', '🟢 Synced');
        if (!unchanged && !location.pathname.endsWith('/account.html') && !location.pathname.endsWith('account.html')) {
          location.reload();
        }
        return;
      }
    }

    migration = {
      kind: 'choice',
      local,
      cloud: remote,
      localHasData: hasData(local),
      cloudHasData: remote ? hasData(remote.snapshot) : false
    };
    if (remote && !migration.localHasData && !migration.cloudHasData) {
      await restoreSnapshot(remote.snapshot);
      saveMarker(remote.revision);
      migration.kind = 'synced';
      setStatus('synced', '🟢 Synced');
      return;
    }
    if (!remote && !migration.localHasData) {
      await upload(local);
      migration.kind = 'synced';
    } else {
      setStatus('choice', '🟡 Choose how to sync');
    }
  }

  function mergeSnapshots(local, cloud) {
    const merged = {
      version: 1,
      appData: { ...cloud.appData },
      vault: {}
    };
    Object.entries(local.appData).forEach(([key, value]) => {
      if (Object.prototype.hasOwnProperty.call(cloud.appData, key) &&
        stableStringify(cloud.appData[key]) !== stableStringify(value)) {
        throw new Error(`Both devices changed the "${key}" setting. Choose Keep Cloud or Replace Cloud instead of merging.`);
      }
      merged.appData[key] = value;
    });
    for (const store of STORES) {
      const byId = new Map(cloud.vault[store].map((record) => [record.id, record]));
      local.vault[store].forEach((record) => {
        const existing = byId.get(record.id);
        if (existing && stableStringify(existing) !== stableStringify(record)) {
          throw new Error(`Both devices changed the same ${store} record. Choose Keep Cloud or Replace Cloud instead of merging.`);
        }
        byId.set(record.id, record);
      });
      merged.vault[store] = [...byId.values()];
    }
    return merged;
  }

  async function resolveMigration(action) {
    if (!user || !migration) throw new Error('Sign in before choosing a data-sync option.');
    const local = migration.local || await captureSnapshot();
    const remote = migration.cloud;
    if (action === 'cloud') {
      if (!remote) {
        await upload(local);
      } else {
        await restoreSnapshot(remote.snapshot);
        saveMarker(remote.revision);
        setStatus('synced', '🟢 Synced');
      }
    } else if (action === 'upload' || action === 'replace') {
      if (action === 'replace' && remote &&
        !window.confirm('Replace the existing cloud backup with the local data from this device? This cannot be undone.')) return;
      await upload(local, remote ? remote.revision : null);
    } else if (action === 'fresh') {
      const empty = { version: 1, appData: {}, vault: EMPTY_VAULT };
      if (hasData(local) && !window.confirm('Start fresh by replacing the local Student Meter data on this device? This cannot be undone.')) return;
      if (remote && !window.confirm('Start fresh by replacing this account’s cloud data with an empty Student Meter? This cannot be undone.')) return;
      await restoreSnapshot(empty);
      await upload(empty, remote ? remote.revision : null);
    } else if (action === 'merge') {
      if (!remote) {
        await upload(local);
      } else {
        const merged = mergeSnapshots(local, remote.snapshot);
        await upload(merged, remote.revision);
        await restoreSnapshot(merged);
      }
    }
    const latest = await fetchCloudData();
    migration = { kind: 'synced', localHasData: latest ? hasData(latest.snapshot) : false, cloud: latest };
    document.dispatchEvent(new CustomEvent('student-meter:cloud-status', {
      detail: { status, message: '🟢 Synced', user, migration }
    }));
  }

  function queueSync() {
    if (applyingCloudData) return;
    if (!user) {
      if (localStorage.getItem(MARKER_KEY)) localStorage.setItem(PENDING_KEY, 'local');
      return;
    }
    localStorage.setItem(PENDING_KEY, user.id);
    setStatus(navigator.onLine ? 'syncing' : 'offline',
      navigator.onLine ? '🟡 Syncing...' : '🔴 Offline / not synced');
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      pushLocal().catch((error) => {
        console.error('Student Meter cloud sync failed.', error);
        if (navigator.onLine && error.message?.includes('changed on another device')) {
          Promise.all([captureSnapshot(), fetchCloudData()]).then(([local, cloud]) => {
            migration = { kind: 'conflict', local, cloud, localHasData: hasData(local), error: error.message };
            setStatus('conflict', '🟠 Sync conflict');
          }).catch((conflictError) => {
            console.error('Could not load the conflicting cloud version.', conflictError);
            setStatus('error', '🔴 Not synced');
          });
        } else {
          setStatus(navigator.onLine ? 'error' : 'offline',
            navigator.onLine ? '🔴 Not synced' : '🔴 Offline / not synced');
        }
        showError(error.message || 'Could not sync Student Meter data. Your local data is still saved.');
      });
    }, 900);
  }

  async function onSession(session) {
    const nextUser = session?.user || null;
    const nextId = nextUser?.id || null;
    if (activeSessionWork && activeSessionId === nextId) return activeSessionWork;
    if (nextId && user?.id === nextId && migration) return;
    user = nextUser;
    migration = null;
    activeSessionId = nextId;
    const task = (async () => {
      if (!user) {
        revision = null;
        setStatus(configured() ? 'local' : 'unconfigured',
          configured() ? '⚪ Local only' : '⚪ Cloud not configured');
        return;
      }
      setStatus('syncing', '🟡 Checking account...');
      try {
        await prepareMigration();
      } catch (error) {
        console.error('Student Meter could not load account data.', error);
        setStatus(navigator.onLine ? 'error' : 'offline',
          navigator.onLine ? '🔴 Cloud unavailable' : '🔴 Offline / not synced');
        migration = { kind: 'error', error: error.message };
        showError(navigator.onLine
          ? `Your local data is unchanged. Cloud account check failed: ${error.message}`
          : "You're offline. Your local data is unchanged and will sync when you're back online.");
      }
    })();
    activeSessionWork = task;
    try {
      await task;
    } finally {
      if (activeSessionWork === task) {
        activeSessionWork = null;
        activeSessionId = null;
      }
    }
  }

  async function initialize() {
    if (!configured()) {
      setStatus('unconfigured', '⚪ Cloud not configured');
      return;
    }
    if (!window.supabase?.createClient) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Could not load Supabase JS. Check your internet connection and retry.'));
        document.head.append(script);
      });
    }
    if (!window.supabase?.createClient) {
      setStatus('error', '🔴 Supabase library unavailable');
      showError('Could not load the Supabase browser library. Check your internet connection and try again.');
      return;
    }
    const config = window.STUDENT_METER_CLOUD_CONFIG;
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    await onSession(data.session);
    client.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => onSession(session));
    });
  }

  window.addEventListener('online', () => {
    if (user && localStorage.getItem(PENDING_KEY) === user.id) queueSync();
    else if (user) prepareMigration().catch((error) => {
      console.error('Student Meter could not resume cloud sync.', error);
      setStatus('error', '🔴 Not synced');
    });
  });
  window.addEventListener('offline', () => {
    if (user) setStatus('offline', '🔴 Offline / not synced');
  });
  document.addEventListener('student-meter:datachange', queueSync);
  document.addEventListener('student-meter:vaultchange', queueSync);

  window.SM = window.SM || {};
  window.SM.Cloud = {
    ready: initialize().catch((error) => {
      console.error('Student Meter cloud initialization failed.', error);
      setStatus('error', '🔴 Cloud unavailable');
    }),
    configured,
    get client() { return client; },
    get user() { return user; },
    get status() { return status; },
    get migration() { return migration; },
    exportSnapshot: captureSnapshot,
    getProfile: async () => {
      if (!client || !user) return null;
      const { data, error } = await client.from('profiles').select('name,course,college')
        .eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    resolveMigration,
    sync: pushLocal,
    signOut: async () => {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw error;
      await onSession(null);
    },
    changePassword: async (password) => {
      if (!client || !user) throw new Error('Sign in to change your password.');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
    },
    signIn: async (email, password) => {
      if (!client) throw new Error('Cloud accounts are not configured. Add your Supabase public project settings first.');
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await onSession(data.session);
      return data;
    },
    signUp: async (email, password, profile) => {
      if (!client) throw new Error('Cloud accounts are not configured. Add your Supabase public project settings first.');
      const { data, error } = await client.auth.signUp({
        email, password,
        options: { data: { name: profile.name, course: profile.course, college: profile.college } }
      });
      if (error) throw error;
      if (data.session) await onSession(data.session);
      return data;
    },
    sendPasswordReset: async (email) => {
      if (!client) throw new Error('Cloud accounts are not configured. Add your Supabase public project settings first.');
      if (!/^https?:$/.test(location.protocol)) throw new Error('Password reset links need the website to run from localhost or HTTPS. Start the local web server and try again.');
      const redirectTo = new URL('account.html', location.href).href;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    },
    updatePassword: async (password) => {
      if (!client) throw new Error('Cloud accounts are not configured.');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
    }
  };
})();
