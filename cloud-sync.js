(function () {
  'use strict';

  const cfg = window.DG_CLOUD_CONFIG || {};
  if (!cfg.appId || !Array.isArray(cfg.keys)) return;

  const original = {
    setItem: localStorage.setItem.bind(localStorage),
    removeItem: localStorage.removeItem.bind(localStorage),
    clear: localStorage.clear.bind(localStorage)
  };
  const deviceId = localStorage.getItem('dgCloudDeviceId') || ('dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9));
  original.setItem('dgCloudDeviceId', deviceId);
  const metaKey = 'dgCloudMeta:' + cfg.appId;

  let currentUser = null;
  let unsubscribe = null;
  let applyingRemote = false;
  let uploadTimer = null;
  let uploadInProgress = false;
  let uploadQueued = false;

  const tracked = key => cfg.keys.includes(key) || (cfg.prefixes || []).some(prefix => key.startsWith(prefix));
  const readMeta = () => { try { return JSON.parse(localStorage.getItem(metaKey) || '{}'); } catch (_) { return {}; } };
  const writeMeta = patch => original.setItem(metaKey, JSON.stringify(Object.assign({}, readMeta(), patch)));

  function collect() {
    const data = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (tracked(key)) data[key] = localStorage.getItem(key);
    }
    return data;
  }

  function formatDate(value) {
    if (!value) return 'še ni bila izvedena';
    return new Intl.DateTimeFormat('sl-SI', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
  }

  function toast(message, error) {
    let node = document.getElementById('firebaseToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'firebaseToast';
      node.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:99999;padding:11px 15px;border-radius:12px;background:#17212b;color:white;font:700 13px system-ui;box-shadow:0 8px 30px #0005;opacity:0;transition:.2s;max-width:88vw;text-align:center';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.style.background = error ? '#a61b1b' : '#17212b';
    node.style.opacity = '1';
    clearTimeout(node._timer);
    node._timer = setTimeout(() => { node.style.opacity = '0'; }, 2600);
  }

  function setStatus(kind, text) {
    const node = document.getElementById('firebaseSyncStatus');
    if (!node) return;
    node.className = 'status ' + (kind === 'error' ? 'bad' : kind === 'warn' ? 'warn' : 'ok');
    node.textContent = text;
    updateUI();
  }

  function injectUI() {
    const settings = document.getElementById('settings');
    if (!settings || document.getElementById('firebaseCard')) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'firebaseCard';
    card.innerHTML = `
      <h2>Firebase – sinhronizacija in varnostne kopije</h2>
      <p class="small">Prijavi se z istim Google računom na vseh napravah. Spremembe se nato samodejno prenesejo med telefonom, tablico in računalnikom.</p>
      <div id="firebaseSyncStatus" class="status warn">Preverjam povezavo …</div>
      <div class="firebase-info-grid">
        <div><span>Uporabnik</span><b id="firebaseUser">Ni prijave</b></div>
        <div><span>Zadnja sinhronizacija</span><b id="firebaseLastSync">še ni bila izvedena</b></div>
        <div><span>Naprava</span><b id="firebaseDevice">${deviceId.slice(-8)}</b></div>
      </div>
      <div class="actions firebase-actions">
        <button id="firebaseLoginBtn">Prijava z Googlom</button>
        <button id="firebaseSyncNowBtn" class="secondary">Sinhroniziraj zdaj</button>
        <button id="firebaseRestoreCloudBtn" class="secondary">Obnovi iz oblaka</button>
        <button id="firebaseBackupBtn" class="secondary">Izvozi kopijo</button>
        <button id="firebaseRestoreFileBtn" class="secondary">Obnovi iz datoteke</button>
        <button id="firebaseLogoutBtn" class="danger">Odjava</button>
      </div>
      <input id="firebaseRestoreFile" type="file" accept="application/json,.json" hidden>
      <p class="small">Pred obnovo se ustvari lokalna reševalna kopija. Podatki drugega prijavljenega uporabnika niso dostopni.</p>`;
    const darkCard = settings.querySelector('.card:last-child');
    settings.insertBefore(card, darkCard || null);

    document.getElementById('firebaseLoginBtn').onclick = login;
    document.getElementById('firebaseLogoutBtn').onclick = logout;
    document.getElementById('firebaseSyncNowBtn').onclick = () => upload(true);
    document.getElementById('firebaseRestoreCloudBtn').onclick = restoreFromCloud;
    document.getElementById('firebaseBackupBtn').onclick = () => exportBackup(false);
    document.getElementById('firebaseRestoreFileBtn').onclick = () => document.getElementById('firebaseRestoreFile').click();
    document.getElementById('firebaseRestoreFile').onchange = importBackup;
    updateUI();
  }

  function updateUI() {
    const user = document.getElementById('firebaseUser');
    if (!user) return;
    const meta = readMeta();
    user.textContent = currentUser ? (currentUser.displayName || currentUser.email || 'Prijavljen uporabnik') : 'Ni prijave';
    document.getElementById('firebaseLastSync').textContent = formatDate(meta.lastSuccess);
    document.getElementById('firebaseLoginBtn').style.display = currentUser ? 'none' : '';
    document.getElementById('firebaseLogoutBtn').style.display = currentUser ? '' : 'none';
    ['firebaseSyncNowBtn', 'firebaseRestoreCloudBtn'].forEach(id => { document.getElementById(id).disabled = !currentUser || !navigator.onLine; });
  }

  function docRef() {
    return firebase.firestore().collection('users').doc(currentUser.uid).collection('apps').doc(cfg.appId);
  }

  async function login() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await firebase.auth().signInWithPopup(provider);
    } catch (error) {
      if (['auth/popup-blocked', 'auth/cancelled-popup-request', 'auth/operation-not-supported-in-this-environment'].includes(error.code)) {
        await firebase.auth().signInWithRedirect(new firebase.auth.GoogleAuthProvider());
      } else toast('Prijava ni uspela: ' + (error.message || error.code), true);
    }
  }

  async function logout() {
    if (!confirm('Odjavim Firebase sinhronizacijo na tej napravi? Lokalni podatki bodo ostali.')) return;
    await firebase.auth().signOut();
    toast('Odjava je uspešna');
  }

  function scheduleUpload() {
    if (applyingRemote || !currentUser) return;
    clearTimeout(uploadTimer);
    if (!navigator.onLine) {
      writeMeta({ pending: true });
      setStatus('warn', 'Brez povezave – spremembe so varno shranjene na napravi.');
      return;
    }
    setStatus('warn', 'Spremembe čakajo na sinhronizacijo …');
    uploadTimer = setTimeout(() => upload(false), 700);
  }

  localStorage.setItem = function (key, value) { original.setItem(key, value); if (tracked(key)) scheduleUpload(); };
  localStorage.removeItem = function (key) { original.removeItem(key); if (tracked(key)) scheduleUpload(); };
  localStorage.clear = function () { original.clear(); scheduleUpload(); };

  async function upload(manual) {
    if (!currentUser) { if (manual) toast('Najprej se prijavi z Googlom.', true); return; }
    if (!navigator.onLine) { writeMeta({ pending: true }); setStatus('warn', 'Brez internetne povezave.'); return; }
    if (uploadInProgress) { uploadQueued = true; return; }
    uploadInProgress = true;
    setStatus('warn', 'Sinhroniziram podatke …');
    const now = Date.now();
    try {
      await docRef().set({
        appId: cfg.appId,
        appName: cfg.appName || cfg.appId,
        data: collect(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAtMs: now,
        updatedByDevice: deviceId,
        schemaVersion: 4
      }, { merge: true });
      const backupDay = new Date(now).toISOString().slice(0, 10);
      const metaAfterUpload = readMeta();
      if (metaAfterUpload.lastBackupDay !== backupDay) {
        try {
          await docRef().collection('backups').doc(backupDay).set({
            data: collect(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAtMs: now,
            deviceId,
            schemaVersion: 4,
            appVersion: document.documentElement.dataset.appVersion || ''
          }, { merge: true });
          writeMeta({ lastBackupDay: backupDay });
        } catch (backupError) {
          console.warn('Samodejna dnevna varnostna kopija ni uspela.', backupError);
        }
      }
      writeMeta({ lastUpload: now, lastSuccess: now, pending: false });
      setStatus('ok', 'Vsi podatki so sinhronizirani.');
      if (manual) toast('Sinhronizacija je končana');
    } catch (error) {
      writeMeta({ pending: true, lastError: Date.now() });
      setStatus('error', 'Sinhronizacija ni uspela. Preveri Firebase nastavitve in internet.');
      if (manual) toast('Sinhronizacija ni uspela.', true);
      console.error(error);
    } finally {
      uploadInProgress = false;
      updateUI();
      if (uploadQueued) { uploadQueued = false; setTimeout(() => upload(false), 120); }
    }
  }

  function applyData(data) {
    applyingRemote = true;
    try {
      Object.keys(collect()).forEach(key => original.removeItem(key));
      Object.entries(data || {}).forEach(([key, value]) => { if (tracked(key)) original.setItem(key, value); });
    } finally { applyingRemote = false; }
  }

  async function restoreFromCloud() {
    if (!currentUser) return toast('Najprej se prijavi.', true);
    if (!confirm('Lokalne podatke zamenjam s podatki iz Firebase oblaka? Pred tem bo ustvarjena reševalna kopija.')) return;
    exportBackup(true);
    try {
      const snapshot = await docRef().get({ source: 'server' });
      if (!snapshot.exists || !snapshot.data().data) throw new Error('V oblaku še ni varnostne kopije.');
      applyData(snapshot.data().data);
      const now = Date.now();
      writeMeta({ lastRemote: snapshot.data().updatedAtMs || now, lastSuccess: now, pending: false });
      toast('Podatki so obnovljeni iz oblaka');
      setTimeout(() => location.reload(), 500);
    } catch (error) { toast(error.message || 'Obnova ni uspela.', true); }
  }

  function exportBackup(silent) {
    const payload = {
      format: 'DG Smart App Backup',
      schemaVersion: 4,
      appId: cfg.appId,
      appName: cfg.appName,
      appVersion: document.documentElement.dataset.appVersion || '',
      exportedAt: new Date().toISOString(),
      deviceId,
      data: collect()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${cfg.appId}-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    if (!silent) toast('Varnostna kopija je izvožena');
  }

  async function importBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!payload.data || typeof payload.data !== 'object') throw new Error('Datoteka ni veljavna varnostna kopija.');
      if (payload.appId && payload.appId !== cfg.appId) throw new Error('Kopija pripada drugi aplikaciji.');
      if (!confirm('Obnovim podatke iz izbrane datoteke? Trenutni podatki bodo pred tem izvoženi.')) return;
      exportBackup(true);
      applyData(payload.data);
      writeMeta({ pending: true });
      if (currentUser && navigator.onLine) await upload(false);
      toast('Podatki so obnovljeni iz datoteke');
      setTimeout(() => location.reload(), 500);
    } catch (error) { toast(error.message || 'Obnova ni uspela.', true); }
    finally { event.target.value = ''; }
  }

  async function startSync(user) {
    currentUser = user;
    updateUI();
    setStatus('warn', 'Povezujem s Firebase …');
    const ref = docRef();
    const snapshot = await ref.get();
    const meta = readMeta();
    if (!snapshot.exists) await upload(false);
    else {
      const remote = snapshot.data();
      const localTime = Math.max(meta.lastUpload || 0, meta.lastRemote || 0);
      if (Object.keys(collect()).length === 0 || (remote.updatedByDevice !== deviceId && (remote.updatedAtMs || 0) > localTime && !meta.pending)) {
        applyData(remote.data || {});
        const now = Date.now();
        writeMeta({ lastRemote: remote.updatedAtMs || now, lastSuccess: now, pending: false });
        setStatus('ok', 'Podatki iz oblaka so preneseni.');
        setTimeout(() => location.reload(), 450);
        return;
      }
      if (meta.pending || !meta.lastSuccess) await upload(false);
      else setStatus('ok', 'Vsi podatki so sinhronizirani.');
    }
    if (unsubscribe) unsubscribe();
    unsubscribe = ref.onSnapshot(snap => {
      if (!snap.exists) return;
      const remote = snap.data();
      const m = readMeta();
      const localTime = Math.max(m.lastUpload || 0, m.lastRemote || 0);
      if (!m.pending && remote.updatedByDevice !== deviceId && (remote.updatedAtMs || 0) > localTime) {
        applyData(remote.data || {});
        const now = Date.now();
        writeMeta({ lastRemote: remote.updatedAtMs || now, lastSuccess: now, pending: false });
        toast('Prejeti so novejši podatki z druge naprave');
        setTimeout(() => location.reload(), 600);
      }
    }, error => { console.error(error); setStatus('error', 'Povezava s Firebase je prekinjena.'); });
  }

  function stopSync() {
    currentUser = null;
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    setStatus('warn', 'Sinhronizacija ni vključena. Lokalni podatki ostajajo na tej napravi.');
    updateUI();
  }

  window.addEventListener('online', () => { updateUI(); if (currentUser) upload(false); });
  window.addEventListener('offline', () => { updateUI(); if (currentUser) setStatus('warn', 'Brez povezave – spremembe ostajajo na napravi.'); });

  function boot() {
    injectUI();
    if (!window.firebase) return setStatus('error', 'Firebase knjižnice se niso naložile. Funkcija deluje po objavi na Firebase Hosting.');
    try {
      firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(() => {});
      firebase.auth().onAuthStateChanged(user => user ? startSync(user).catch(error => { console.error(error); setStatus('error', 'Povezava s Firebase ni uspela.'); }) : stopSync());
    } catch (error) { console.error(error); setStatus('error', 'Firebase ni pravilno nastavljen.'); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}());
