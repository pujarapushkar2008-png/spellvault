/**
 * ============================================================
 * vault-db.js — IndexedDB storage layer for SpellVault
 * ============================================================
 * Preserves 100% backward compatibility with Guptam & SpellVault:
 * DB_NAME = 'spellvault'
 * Stores: 'mails', 'apps', 'settings', 'vault'
 * Fully offline, local IndexedDB.
 * ============================================================
 */

const VaultDB = (() => {
  const DB_NAME    = 'spellvault';
  const DB_VERSION = 1;

  let db          = null;
  let mails       = [];
  let apps        = [];
  let nextMailId  = 1;
  let nextAppId   = 1;
  let appLockEnabled = false;
  let masterKey      = null;

  // ── Open database ───────────────────────────────────────────
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('mails'))    d.createObjectStore('mails',    { keyPath: 'id' });
        if (!d.objectStoreNames.contains('apps'))     d.createObjectStore('apps',     { keyPath: 'id' });
        if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('vault'))    d.createObjectStore('vault',    { keyPath: 'id' });
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(); };
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── IDB helpers ─────────────────────────────────────────────
  const tx   = (store, mode) => db.transaction(store, mode).objectStore(store);
  const iGet = (store, key)  => new Promise((res, rej) => { const r = tx(store,'readonly').get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const iAll = (store)       => new Promise((res, rej) => { const r = tx(store,'readonly').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const iPut = (store, val)  => new Promise((res, rej) => { const r = tx(store,'readwrite').put(val); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const iDel = (store, key)  => new Promise((res, rej) => { const r = tx(store,'readwrite').delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
  const iClr = (store)       => new Promise((res, rej) => { const r = tx(store,'readwrite').clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });

  // ── Settings ────────────────────────────────────────────────
  async function getSetting(key)        { const r = await iGet('settings', key); return r ? r.value : undefined; }
  async function setSetting(key, value) { await iPut('settings', { key, value }); }
  async function delSetting(key)        { await iDel('settings', key); }

  // ── Plain mode load/save ────────────────────────────────────
  async function loadPlain() {
    mails = await iAll('mails');
    apps  = await iAll('apps');
    recalcIds();
  }

  // ── Vault mode load/save ────────────────────────────────────
  async function loadVault() {
    const rec = await iGet('vault', 'main');
    if (!rec) { mails = []; apps = []; recalcIds(); return; }
    const iv   = new Uint8Array(VaultCrypto.base64ToBuffer(rec.iv));
    const json = await VaultCrypto.decrypt(VaultCrypto.base64ToBuffer(rec.data), masterKey, iv);
    const p    = JSON.parse(json);
    mails      = p.mails  || [];
    apps       = p.apps   || [];
    nextMailId = p.nextMailId || 1;
    nextAppId  = p.nextAppId  || 1;
  }

  async function saveVault() {
    const json = JSON.stringify({ mails, apps, nextMailId, nextAppId });
    const iv   = VaultCrypto.generateIV();
    const enc  = await VaultCrypto.encrypt(json, masterKey, iv);
    await iPut('vault', {
      id:   'main',
      data: VaultCrypto.bufferToBase64(enc),
      iv:   VaultCrypto.bufferToBase64(iv),
    });
  }

  function recalcIds() {
    nextMailId = mails.reduce((m, r) => Math.max(m, r.id + 1), 1);
    nextAppId  = apps.reduce((m, r)  => Math.max(m, r.id + 1), 1);
  }

  // ── Init ────────────────────────────────────────────────────
  async function init() {
    await openDB();
    const lock = await getSetting('appLock');
    if (lock && lock.enabled) { appLockEnabled = true; return { needsUnlock: true }; }
    await loadPlain();
    return { needsUnlock: false };
  }

  // ── Unlock ──────────────────────────────────────────────────
  async function unlock(passphrase) {
    const lock = await getSetting('appLock');
    if (!lock) return false;
    const salt = new Uint8Array(VaultCrypto.base64ToBuffer(lock.salt));
    const key  = await VaultCrypto.deriveKey(passphrase, salt);
    try {
      const vIv   = new Uint8Array(VaultCrypto.base64ToBuffer(lock.verifyIv));
      const plain = await VaultCrypto.decrypt(VaultCrypto.base64ToBuffer(lock.verify), key, vIv);
      if (plain !== 'SPELLVAULT_VERIFY') return false;
    } catch { return false; }
    masterKey = key;
    await loadVault();
    return true;
  }

  // ── Enable App Lock ─────────────────────────────────────────
  async function enableAppLock(passphrase) {
    const salt = VaultCrypto.generateSalt();
    const key  = await VaultCrypto.deriveKey(passphrase, salt);
    const vIv  = VaultCrypto.generateIV();
    const vEnc = await VaultCrypto.encrypt('SPELLVAULT_VERIFY', key, vIv);
    await setSetting('appLock', {
      enabled:  true,
      salt:     VaultCrypto.bufferToBase64(salt),
      verify:   VaultCrypto.bufferToBase64(vEnc),
      verifyIv: VaultCrypto.bufferToBase64(vIv),
    });
    masterKey = key; appLockEnabled = true;
    await saveVault();
    await iClr('mails'); await iClr('apps');
  }

  // ── Disable App Lock ────────────────────────────────────────
  async function disableAppLock() {
    appLockEnabled = false; masterKey = null;
    for (const m of mails) await iPut('mails', m);
    for (const a of apps)  await iPut('apps',  a);
    await iClr('vault');
    await delSetting('appLock');
  }

  function isLocked() { return appLockEnabled; }

  // ── CRUD: Mails ─────────────────────────────────────────────
  async function addMail(address) {
    const mail = { id: nextMailId++, address, createdAt: Date.now() };
    mails.push(mail);
    if (appLockEnabled) await saveVault(); else await iPut('mails', mail);
    return mail.id;
  }
  function getMails()     { return [...mails]; }
  function getMail(id)    { return mails.find(m => m.id === id) || null; }
  function getAppCount(mailId) { return apps.filter(a => a.mailId === mailId).length; }

  async function updateMail(id, address) {
    const mail = mails.find(m => m.id === id); if (!mail) return;
    mail.address = address;
    if (appLockEnabled) await saveVault(); else await iPut('mails', mail);
  }

  async function deleteMail(id) {
    const related = apps.filter(a => a.mailId === id);
    mails = mails.filter(m => m.id !== id);
    apps  = apps.filter(a => a.mailId !== id);
    if (appLockEnabled) {
      await saveVault();
    } else {
      await iDel('mails', id);
      for (const a of related) await iDel('apps', a.id);
    }
  }

  // ── CRUD: Apps ──────────────────────────────────────────────
  async function addApp(mailId, data) {
    const app = {
      id: nextAppId++,
      mailId,
      name: data.name,
      username: data.username || '',
      password: data.password,
      note: data.note || '',
      locked: data.locked || false,
      salt: data.salt || '',
      iv: data.iv || '',
      favorite: data.favorite || false,
      createdAt: data.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    apps.push(app);
    if (appLockEnabled) await saveVault(); else await iPut('apps', app);
    return app.id;
  }

  function getAllApps()    { return [...apps]; }
  function getApps(mailId) { return apps.filter(a => a.mailId === mailId); }
  function getApp(id)      { return apps.find(a => a.id === id) || null; }

  async function updateApp(id, data) {
    const app = apps.find(a => a.id === id); if (!app) return;
    Object.assign(app, data, { updatedAt: Date.now() });
    if (appLockEnabled) await saveVault(); else await iPut('apps', app);
  }

  async function toggleFavorite(id) {
    const app = apps.find(a => a.id === id); if (!app) return;
    app.favorite = !app.favorite;
    app.updatedAt = Date.now();
    if (appLockEnabled) await saveVault(); else await iPut('apps', app);
    return app.favorite;
  }

  async function deleteApp(id) {
    apps = apps.filter(a => a.id !== id);
    if (appLockEnabled) await saveVault(); else await iDel('apps', id);
  }

  // ── Export / Import ─────────────────────────────────────────
  function exportAll() { return { mails: [...mails], apps: [...apps] }; }

  async function importAll(data) {
    mails = data.mails || []; apps = data.apps || []; recalcIds();
    if (appLockEnabled) {
      await saveVault();
    } else {
      await iClr('mails'); await iClr('apps');
      for (const m of mails) await iPut('mails', m);
      for (const a of apps)  await iPut('apps',  a);
    }
  }

  return {
    init, unlock, enableAppLock, disableAppLock, isLocked,
    getSetting, setSetting,
    addMail, getMails, getMail, getAppCount, updateMail, deleteMail,
    addApp, getAllApps, getApps, getApp, updateApp, toggleFavorite, deleteApp,
    exportAll, importAll,
  };
})();
