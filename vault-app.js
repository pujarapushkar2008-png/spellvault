/**
 * ============================================================
 * vault-app.js — Core Controller for SpellVault
 * ============================================================
 * Features:
 * - 4-screen flow (Gate -> Welcome -> Mails -> Apps -> Settings)
 * - Micro-interactions on Copy, Reveal, Delete & Save
 * - 3D Tilt Hover effect on Bento Cards
 * - Skeleton Shimmer Loading UI
 * - Rate-limited PIN locks & Web Crypto encryption
 * ============================================================
 */

const App = (() => {

  let currentMailId  = null;
  let revealTimers   = {};     // { appId: timeoutId }
  let clipboardTimer = null;
  const pinAttempts  = {};     // { appId: { count, lockedUntil } }

  const $ = (sel) => document.querySelector(sel);

  const screens = {
    gate     : $('#screen-gate'),
    welcome  : $('#screen-welcome'),
    mails    : $('#screen-mails'),
    apps     : $('#screen-apps'),
    settings : $('#screen-settings'),
  };

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
  }

  // ── Toast Pill ──────────────────────────────────────────────
  let toastTimeout = null;
  function toast(msg, duration = 3000) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove('show'), duration);
  }

  // ── Modal System (Morphing Animation) ───────────────────────
  const modalOverlay = $('#modal-overlay');
  const modalTitle   = $('#modal-title');
  const modalBody    = $('#modal-body');
  let modalOnClose   = null;

  function showModal(title, html, onClose) {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modalOnClose = onClose || null;
    modalOverlay.classList.add('active');
  }

  function hideModal() {
    modalOverlay.classList.remove('active');
    modalBody.innerHTML = '';
    if (modalOnClose) { modalOnClose(); modalOnClose = null; }
  }

  $('#modal-close')?.addEventListener('click', hideModal);
  modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) hideModal();
  });

  // ── Screen 2: Mails ─────────────────────────────────────────
  function renderMails(filter = '') {
    const list  = $('#mail-list');
    const empty = $('#mail-empty');
    const all   = VaultDB.getMails();
    const lower = filter.toLowerCase();

    const filtered = lower
      ? all.filter(m => m.address.toLowerCase().includes(lower))
      : all;

    list.innerHTML = '';

    if (filtered.length === 0) {
      empty.classList.add('visible');
    } else {
      empty.classList.remove('visible');
      filtered.forEach(mail => {
        const count = VaultDB.getAppCount(mail.id);
        const card  = document.createElement('div');
        card.className = 'mail-card card-glass tilt-card';
        card.innerHTML = `
          <div class="mail-info">
            <span class="mail-address">${esc(mail.address)}</span>
            <span class="mail-count">${count} app${count !== 1 ? 's' : ''} saved</span>
          </div>
          <div class="mail-actions">
            <button class="btn-icon edit-mail-card" data-id="${mail.id}" title="Edit">✏️</button>
            <button class="btn-icon btn-danger-icon delete-mail-card" data-id="${mail.id}" title="Delete">🗑️</button>
          </div>
        `;

        card.querySelector('.mail-info').addEventListener('click', () => {
          openApps(mail.id);
        });

        card.querySelector('.edit-mail-card').addEventListener('click', (e) => {
          e.stopPropagation();
          showEditMailForm(mail);
        });

        card.querySelector('.delete-mail-card').addEventListener('click', (e) => {
          e.stopPropagation();
          confirmDeleteMail(mail);
        });

        list.appendChild(card);
      });
    }
  }

  // ── Screen 3: Apps under selected Mail ───────────────────────
  function openApps(mailId) {
    currentMailId = mailId;
    const mail = VaultDB.getMail(mailId);
    if (!mail) return;

    $('#app-mail-title').textContent = mail.address;
    $('#app-search').value = '';
    renderApps();
    showScreen('apps');
  }

  function renderApps(filter = '') {
    const list  = $('#app-list');
    const empty = $('#app-empty');
    const all   = VaultDB.getApps(currentMailId);
    const lower = filter.toLowerCase();

    const filtered = lower
      ? all.filter(a => a.name.toLowerCase().includes(lower))
      : all;

    list.innerHTML = '';

    if (filtered.length === 0) {
      empty.classList.add('visible');
    } else {
      empty.classList.remove('visible');
      filtered.forEach(app => {
        const card = document.createElement('div');
        card.className = `app-card card-glass tilt-card ${app.locked ? 'pin-locked' : ''}`;
        card.id = `app-card-${app.id}`;

        const isLocked   = app.locked;
        const isRevealed = revealTimers[app.id] !== undefined;

        let pwHtml;
        if (isLocked && !isRevealed) {
          pwHtml = `<span class="password-display locked-label">🔒 Locked (PIN Protected)</span>`;
        } else if (isRevealed) {
          pwHtml = `<span class="password-display revealed" id="pw-text-${app.id}">••••••••</span>`;
        } else {
          pwHtml = `<span class="password-display" id="pw-text-${app.id}">••••••••</span>`;
        }

        let metaHtml = '';
        if (app.username) {
          metaHtml += `<span><strong>Username:</strong> ${esc(app.username)}</span><br>`;
        }
        if (app.note) {
          metaHtml += `<span><strong>Note:</strong> ${esc(app.note)}</span>`;
        }

        card.innerHTML = `
          <div class="app-header">
            <span class="app-name">
              ${esc(app.name)}
              ${isLocked ? '<span class="lock-badge">🔒</span>' : ''}
            </span>
            <div class="app-actions">
              <button class="btn-icon reveal-btn" data-id="${app.id}" title="Reveal">👁️</button>
              <button class="btn-icon copy-btn" data-id="${app.id}" title="Copy password">📋</button>
              <button class="btn-icon edit-btn" data-id="${app.id}" title="Edit">✏️</button>
              <button class="btn-icon btn-danger-icon del-btn" data-id="${app.id}" title="Delete">🗑️</button>
            </div>
          </div>
          <div class="app-password-row">${pwHtml}</div>
          ${metaHtml ? `<div class="app-meta">${metaHtml}</div>` : ''}
        `;

        card.querySelector('.reveal-btn').addEventListener('click', () => handleReveal(app));
        card.querySelector('.copy-btn').addEventListener('click', () => handleCopy(app));
        card.querySelector('.edit-btn').addEventListener('click', () => showEditAppForm(app));
        card.querySelector('.del-btn').addEventListener('click', () => confirmDeleteApp(app));

        list.appendChild(card);
      });
    }
  }

  // ── PIN Entry with 5-attempt Rate Limit ─────────────────────
  function askForPin(app) {
    return new Promise((resolve) => {
      const att = pinAttempts[app.id] || { count: 0, lockedUntil: 0 };
      const now = Date.now();
      if (att.lockedUntil > now) {
        const secs = Math.ceil((att.lockedUntil - now) / 1000);
        toast(`Too many attempts. Wait ${secs}s.`);
        return resolve(null);
      }

      showModal('Enter PIN', `
        <p class="muted" style="margin-bottom:14px;text-align:center;color:var(--text-1);">
          Enter the security PIN for <strong>${esc(app.name)}</strong>
        </p>
        <input type="password" id="pin-field" class="pin-input"
               inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="off">
        <p id="pin-error" class="error-text"></p>
        <div class="form-actions">
          <button class="btn-sm" id="pin-cancel">Cancel</button>
          <button class="btn-sm primary" id="pin-ok">Unlock</button>
        </div>
      `);

      const field   = $('#pin-field');
      const errorEl = $('#pin-error');
      field?.focus();

      field?.addEventListener('input', () => {
        field.value = field.value.replace(/\D/g, '');
      });

      async function tryUnlock() {
        const pin = field.value;
        if (pin.length < 4 || pin.length > 6) {
          errorEl.textContent = 'PIN must be 4–6 digits.';
          return;
        }

        const okBtn = $('#pin-ok');
        okBtn.innerHTML = '<span class="spinner"></span>';
        okBtn.disabled = true;

        const plain = await VaultCrypto.decryptWithPin(app.password, pin, app.salt, app.iv);

        if (plain !== null) {
          pinAttempts[app.id] = { count: 0, lockedUntil: 0 };
          hideModal();
          resolve(plain);
        } else {
          att.count++;
          pinAttempts[app.id] = att;

          if (att.count >= 5) {
            att.lockedUntil = Date.now() + 30_000;
            att.count = 0;
            hideModal();
            toast('5 wrong attempts. Locked for 30s.');
            resolve(null);
          } else {
            errorEl.textContent = `Wrong PIN. ${5 - att.count} attempt${5 - att.count !== 1 ? 's' : ''} left.`;
            okBtn.innerHTML = 'Unlock';
            okBtn.disabled = false;
            field.value = '';
            field.focus();
          }
        }
      }

      $('#pin-ok')?.addEventListener('click', tryUnlock);
      field?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tryUnlock();
      });
      $('#pin-cancel')?.addEventListener('click', () => {
        hideModal();
        resolve(null);
      });
    });
  }

  // ── Password Reveal (10s) & Copy (20s) ──────────────────────
  async function handleReveal(app) {
    if (revealTimers[app.id] !== undefined) {
      clearTimeout(revealTimers[app.id]);
      delete revealTimers[app.id];
      renderApps($('#app-search').value);
      return;
    }

    let plain;
    if (app.locked) {
      plain = await askForPin(app);
      if (!plain) return;
    } else {
      plain = app.password;
    }

    renderApps($('#app-search').value);

    const pwEl = document.getElementById(`pw-text-${app.id}`);
    if (pwEl) {
      pwEl.textContent = plain;
      pwEl.classList.add('revealed');
    }

    revealTimers[app.id] = setTimeout(() => {
      delete revealTimers[app.id];
      renderApps($('#app-search').value);
      toast('Password hidden.');
    }, 10_000);
  }

  async function handleCopy(app) {
    let plain;
    if (app.locked) {
      plain = await askForPin(app);
      if (!plain) return;
    } else {
      plain = app.password;
    }

    try {
      await navigator.clipboard.writeText(plain);
      toast('✓ Copied! Clipboard clears in 20s.');

      clearTimeout(clipboardTimer);
      clipboardTimer = setTimeout(async () => {
        try { await navigator.clipboard.writeText(''); } catch {}
        toast('Clipboard cleared.');
      }, 20_000);
    } catch {
      toast('Could not copy to clipboard.');
    }
  }

  // ── Forms: Add / Edit Mail ──────────────────────────────────
  function showAddMailForm() {
    showModal('Add a new mail', `
      <div class="form-group">
        <label>Email address</label>
        <input type="email" id="fm-address" placeholder="you@example.com" autocomplete="off">
      </div>
      <div class="form-actions">
        <button class="btn-sm" id="fm-cancel">Cancel</button>
        <button class="btn-sm primary" id="fm-save">Save</button>
      </div>
    `);

    $('#fm-address')?.focus();
    $('#fm-save')?.addEventListener('click', async () => {
      const addr = $('#fm-address').value.trim();
      if (!addr) { toast('Please enter an email address.'); return; }
      await VaultDB.addMail(addr);
      hideModal();
      renderMails($('#mail-search').value);
      toast('Mail added.');
    });
    $('#fm-cancel')?.addEventListener('click', hideModal);
    $('#fm-address')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#fm-save')?.click();
    });
  }

  function showEditMailForm(mail) {
    showModal('Edit mail', `
      <div class="form-group">
        <label>Email address</label>
        <input type="email" id="fm-address" value="${esc(mail.address)}" autocomplete="off">
      </div>
      <div class="form-actions">
        <button class="btn-sm" id="fm-cancel">Cancel</button>
        <button class="btn-sm primary" id="fm-save">Save</button>
      </div>
    `);

    $('#fm-address')?.focus();
    $('#fm-save')?.addEventListener('click', async () => {
      const addr = $('#fm-address').value.trim();
      if (!addr) { toast('Please enter an email address.'); return; }
      await VaultDB.updateMail(mail.id, addr);
      hideModal();
      renderMails($('#mail-search').value);
      if (currentMailId === mail.id) {
        $('#app-mail-title').textContent = addr;
      }
      toast('Mail updated.');
    });
    $('#fm-cancel')?.addEventListener('click', hideModal);
  }

  function confirmDeleteMail(mail) {
    const count = VaultDB.getAppCount(mail.id);
    showModal('Delete mail?', `
      <p class="confirm-text">
        Delete <strong>${esc(mail.address)}</strong>
        ${count > 0 ? ` and its <strong>${count} app${count > 1 ? 's' : ''}</strong>` : ''}?
        This cannot be undone.
      </p>
      <div class="form-actions">
        <button class="btn-sm" id="dc-cancel">Cancel</button>
        <button class="btn-sm danger" id="dc-delete">Delete</button>
      </div>
    `);

    $('#dc-delete')?.addEventListener('click', async () => {
      await VaultDB.deleteMail(mail.id);
      hideModal();
      if (currentMailId === mail.id) {
        currentMailId = null;
        showScreen('mails');
      }
      renderMails($('#mail-search').value);
      toast('Mail deleted.');
    });
    $('#dc-cancel')?.addEventListener('click', hideModal);
  }

  // ── Forms: Add / Edit App ───────────────────────────────────
  function showAddAppForm() {
    const mail = VaultDB.getMail(currentMailId);
    showModal('Add a new app', buildAppFormHtml({}, mail));
    initAppForm(null, mail);
  }

  async function showEditAppForm(app) {
    const mail = VaultDB.getMail(currentMailId);
    let plainPassword = '';
    if (app.locked) {
      plainPassword = await askForPin(app);
      if (plainPassword === null) return;
    } else {
      plainPassword = app.password;
    }

    showModal('Edit app', buildAppFormHtml({ ...app, password: plainPassword }, mail));
    initAppForm(app, mail);
  }

  function buildAppFormHtml(data, mail) {
    const { name = '', username = '', password = '', note = '', locked = false } = data;
    return `
      <div class="form-group">
        <label>App name</label>
        <input type="text" id="fa-name" value="${esc(name)}" placeholder="e.g. Instagram" autocomplete="off">
      </div>

      <div class="form-group">
        <label>Username <span class="muted" style="font-weight:400;color:var(--text-1);">(if different from ${esc(mail.address)})</span></label>
        <input type="text" id="fa-user" value="${esc(username)}" placeholder="Leave blank to use mail" autocomplete="off">
      </div>

      <div class="form-group">
        <label>Password</label>
        <div class="form-row">
          <input type="text" id="fa-pass" value="${esc(password)}" placeholder="Enter or generate" autocomplete="off">
          <button class="btn-sm" id="fa-gen" type="button" title="Generate strong password">🎲 Generate</button>
        </div>
        <div class="strength-bar"><div class="strength-fill" id="fa-strength-fill"></div></div>
        <div class="strength-label" id="fa-strength-label"></div>
      </div>

      <div class="form-group">
        <label>Note <span class="muted" style="font-weight:400;color:var(--text-1);">(optional)</span></label>
        <textarea id="fa-note" rows="2" placeholder="Any extra info…">${esc(note)}</textarea>
      </div>

      <div class="lock-row">
        <span>🔒 Lock this app</span>
        <label class="toggle">
          <input type="checkbox" id="fa-lock" ${locked ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div id="fa-pin-section" style="display:${locked ? 'block' : 'none'}">
        <div class="form-group">
          <label>Set a 4–6 digit PIN</label>
          <input type="password" id="fa-pin" class="pin-input"
                 inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Confirm PIN</label>
          <input type="password" id="fa-pin2" class="pin-input"
                 inputmode="numeric" maxlength="6" placeholder="••••" autocomplete="off">
        </div>
        <div class="warning-box">
          ⚠️ If you forget this PIN, this password cannot be recovered.
        </div>
      </div>

      <p id="fa-error" class="error-text"></p>

      <div class="form-actions">
        <button class="btn-sm" id="fa-cancel">Cancel</button>
        <button class="btn-sm primary" id="fa-save">Save</button>
      </div>
    `;
  }

  function initAppForm(existingApp, mail) {
    const nameEl    = $('#fa-name');
    const passEl    = $('#fa-pass');
    const lockCheck = $('#fa-lock');
    const pinSec    = $('#fa-pin-section');
    const pinEl     = $('#fa-pin');
    const pin2El    = $('#fa-pin2');
    const errorEl   = $('#fa-error');

    nameEl?.focus();

    [pinEl, pin2El].forEach(el => {
      el?.addEventListener('input', () => { el.value = el.value.replace(/\D/g, ''); });
    });

    lockCheck?.addEventListener('change', () => {
      pinSec.style.display = lockCheck.checked ? 'block' : 'none';
      if (lockCheck.checked) pinEl?.focus();
    });

    $('#fa-gen')?.addEventListener('click', () => {
      passEl.value = VaultCrypto.generatePassword(18);
      updateStrength(passEl.value);
    });

    passEl?.addEventListener('input', () => updateStrength(passEl.value));
    updateStrength(passEl.value);

    $('#fa-save')?.addEventListener('click', async () => {
      const name     = nameEl.value.trim();
      const username = $('#fa-user').value.trim();
      const password = passEl.value;
      const note     = $('#fa-note').value.trim();
      const wantLock = lockCheck.checked;

      if (!name)     { errorEl.textContent = 'App name is required.'; return; }
      if (!password) { errorEl.textContent = 'Password is required.'; return; }

      let finalPassword = password;
      let salt = '', iv = '';

      if (wantLock) {
        const pin  = pinEl.value;
        const pin2 = pin2El.value;

        if (pin.length < 4 || pin.length > 6) {
          errorEl.textContent = 'PIN must be 4–6 digits.';
          return;
        }
        if (pin !== pin2) {
          errorEl.textContent = 'PINs do not match.';
          return;
        }

        const saveBtn = $('#fa-save');
        saveBtn.innerHTML = '<span class="spinner"></span>';
        saveBtn.disabled = true;

        const encrypted = await VaultCrypto.encryptWithPin(password, pin);
        finalPassword = encrypted.encrypted;
        salt          = encrypted.salt;
        iv            = encrypted.iv;
      }

      const data = {
        name,
        username,
        password : finalPassword,
        note,
        locked   : wantLock,
        salt,
        iv,
      };

      if (existingApp) {
        await VaultDB.updateApp(existingApp.id, data);
        toast('App updated.');
      } else {
        await VaultDB.addApp(currentMailId, data);
        toast('App saved.');
      }

      hideModal();
      renderApps($('#app-search').value);
    });

    $('#fa-cancel')?.addEventListener('click', hideModal);
  }

  function confirmDeleteApp(app) {
    showModal('Delete app?', `
      <p class="confirm-text">
        Delete <strong>${esc(app.name)}</strong>?
        ${app.locked ? 'The encrypted password will be lost.' : ''}
        This cannot be undone.
      </p>
      <div class="form-actions">
        <button class="btn-sm" id="da-cancel">Cancel</button>
        <button class="btn-sm danger" id="da-delete">Delete</button>
      </div>
    `);

    $('#da-delete')?.addEventListener('click', async () => {
      await VaultDB.deleteApp(app.id);
      hideModal();
      renderApps($('#app-search').value);
      toast('App deleted.');
    });

    $('#da-cancel')?.addEventListener('click', hideModal);
  }

  function updateStrength(password) {
    const s    = VaultCrypto.checkStrength(password);
    const fill = document.getElementById('fa-strength-fill');
    const lbl  = document.getElementById('fa-strength-label');
    if (!fill || !lbl) return;

    fill.style.width      = s.percent + '%';
    fill.style.background = s.color;
    lbl.textContent       = s.label;
    lbl.style.color       = s.color;
  }

  // ── Settings Screen ─────────────────────────────────────────
  function openSettings() {
    $('#app-lock-toggle').checked = VaultDB.isLocked();
    showScreen('settings');
  }

  async function handleAppLockToggle() {
    const toggle = $('#app-lock-toggle');

    if (toggle.checked) {
      showModal('Set App Lock passphrase', `
        <p class="muted" style="margin-bottom:12px;color:var(--text-1);">Choose a passphrase to encrypt all your data.</p>
        <div class="form-group">
          <label>Passphrase</label>
          <input type="password" id="al-pass1" placeholder="Passphrase" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Confirm passphrase</label>
          <input type="password" id="al-pass2" placeholder="Confirm" autocomplete="off">
        </div>
        <div class="warning-box">
          ⚠️ If you forget this passphrase, all data will be permanently lost. There is no recovery.
        </div>
        <p id="al-error" class="error-text"></p>
        <div class="form-actions">
          <button class="btn-sm" id="al-cancel">Cancel</button>
          <button class="btn-sm primary" id="al-ok">Enable</button>
        </div>
      `, () => {
        toggle.checked = VaultDB.isLocked();
      });

      $('#al-pass1')?.focus();

      $('#al-ok')?.addEventListener('click', async () => {
        const p1 = $('#al-pass1').value;
        const p2 = $('#al-pass2').value;
        if (!p1 || p1.length < 4) {
          $('#al-error').textContent = 'Passphrase must be at least 4 characters.';
          return;
        }
        if (p1 !== p2) {
          $('#al-error').textContent = 'Passphrases do not match.';
          return;
        }

        const okBtn = $('#al-ok');
        okBtn.innerHTML = '<span class="spinner"></span>';
        okBtn.disabled = true;

        await VaultDB.enableAppLock(p1);
        hideModal();
        toast('App Lock enabled. Data is now encrypted.');
      });

      $('#al-cancel')?.addEventListener('click', hideModal);

    } else {
      showModal('Disable App Lock', `
        <p class="muted" style="margin-bottom:12px;color:var(--text-1);">Enter your current passphrase to decrypt all data.</p>
        <div class="form-group">
          <input type="password" id="al-pass" placeholder="Passphrase" autocomplete="off">
        </div>
        <p id="al-error" class="error-text"></p>
        <div class="form-actions">
          <button class="btn-sm" id="al-cancel">Cancel</button>
          <button class="btn-sm primary" id="al-ok">Disable</button>
        </div>
      `, () => {
        toggle.checked = VaultDB.isLocked();
      });

      $('#al-pass')?.focus();

      $('#al-ok')?.addEventListener('click', async () => {
        const pass = $('#al-pass').value;
        if (!pass) { $('#al-error').textContent = 'Enter your passphrase.'; return; }

        const okBtn = $('#al-ok');
        okBtn.innerHTML = '<span class="spinner"></span>';
        okBtn.disabled = true;

        const lockSetting = await VaultDB.getSetting('appLock');
        if (lockSetting) {
          const salt = new Uint8Array(VaultCrypto.base64ToBuffer(lockSetting.salt));
          const key  = await VaultCrypto.deriveKey(pass, salt);
          try {
            const vIv   = new Uint8Array(VaultCrypto.base64ToBuffer(lockSetting.verifyIv));
            const plain = await VaultCrypto.decrypt(
              VaultCrypto.base64ToBuffer(lockSetting.verify), key, vIv
            );
            if (plain !== 'SPELLVAULT_VERIFY') {
              $('#al-error').textContent = 'Wrong passphrase.';
              okBtn.innerHTML = 'Disable';
              okBtn.disabled = false;
              return;
            }
          } catch {
            $('#al-error').textContent = 'Wrong passphrase.';
            okBtn.innerHTML = 'Disable';
            okBtn.disabled = false;
            return;
          }
        }

        await VaultDB.disableAppLock();
        hideModal();
        toast('App Lock disabled. Data stored locally.');
      });

      $('#al-cancel')?.addEventListener('click', hideModal);
    }
  }

  // ── Backup & Restore ────────────────────────────────────────
  function handleExport() {
    showModal('Export backup', `
      <p class="muted" style="margin-bottom:12px;color:var(--text-1);">Download a JSON file of all your data.</p>
      <div style="display:flex;align-items:center;gap:8px;margin:10px 0;">
        <input type="checkbox" id="ex-encrypt" style="width:18px;height:18px;accent-color:var(--accent);">
        <label for="ex-encrypt">Encrypt backup with a passphrase</label>
      </div>

      <div id="ex-pass-section" style="display:none">
        <div class="form-group">
          <label>Passphrase</label>
          <input type="password" id="ex-pass" placeholder="Backup passphrase" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Confirm</label>
          <input type="password" id="ex-pass2" placeholder="Confirm" autocomplete="off">
        </div>
      </div>

      <div class="warning-box" id="ex-warning">
        ⚠️ Without a passphrase, the backup file is readable by anyone who gets it. PIN-locked passwords remain encrypted.
      </div>

      <p id="ex-error" class="error-text"></p>

      <div class="form-actions">
        <button class="btn-sm" id="ex-cancel">Cancel</button>
        <button class="btn-sm primary" id="ex-go">Export</button>
      </div>
    `);

    const encCheck = $('#ex-encrypt');
    const passSec  = $('#ex-pass-section');
    const warnBox  = $('#ex-warning');

    encCheck?.addEventListener('change', () => {
      passSec.style.display = encCheck.checked ? 'block' : 'none';
      warnBox.style.display = encCheck.checked ? 'none'  : 'block';
    });

    $('#ex-go')?.addEventListener('click', async () => {
      const data = VaultDB.exportAll();
      let output;

      if (encCheck.checked) {
        const p1 = $('#ex-pass').value;
        const p2 = $('#ex-pass2').value;
        if (!p1) { $('#ex-error').textContent = 'Enter a passphrase.'; return; }
        if (p1 !== p2) { $('#ex-error').textContent = 'Passphrases do not match.'; return; }

        const goBtn = $('#ex-go');
        goBtn.innerHTML = '<span class="spinner"></span>';
        goBtn.disabled = true;

        const enc = await VaultCrypto.encryptData(data, p1);
        output = {
          version   : 1,
          app       : 'SpellVault',
          encrypted : true,
          data      : enc.encrypted,
          salt      : enc.salt,
          iv        : enc.iv,
        };
      } else {
        output = {
          version   : 1,
          app       : 'SpellVault',
          encrypted : false,
          ...data,
        };
      }

      const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `spellvault-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      hideModal();
      toast('Backup exported.');
    });

    $('#ex-cancel')?.addEventListener('click', hideModal);
  }

  function handleImport() {
    $('#import-file')?.click();
  }

  async function processImportFile(file) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (json.app !== 'SpellVault' && json.app !== 'Guptam' && !json.mails && !json.data) {
        toast('This does not look like a SpellVault backup file.');
        return;
      }

      if (json.encrypted) {
        showModal('Encrypted backup', `
          <p class="muted" style="margin-bottom:12px;color:var(--text-1);">This backup is encrypted. Enter its passphrase.</p>
          <div class="form-group">
            <input type="password" id="im-pass" placeholder="Backup passphrase" autocomplete="off">
          </div>
          <p id="im-error" class="error-text"></p>
          <div class="form-actions">
            <button class="btn-sm" id="im-cancel">Cancel</button>
            <button class="btn-sm primary" id="im-ok">Decrypt & Import</button>
          </div>
        `);

        $('#im-pass')?.focus();

        $('#im-ok')?.addEventListener('click', async () => {
          const pass = $('#im-pass').value;
          if (!pass) { $('#im-error').textContent = 'Enter the passphrase.'; return; }

          const okBtn = $('#im-ok');
          okBtn.innerHTML = '<span class="spinner"></span>';
          okBtn.disabled = true;

          const decrypted = await VaultCrypto.decryptData(
            json.data, pass, json.salt, json.iv
          );

          if (!decrypted) {
            $('#im-error').textContent = 'Wrong passphrase.';
            okBtn.innerHTML = 'Decrypt & Import';
            okBtn.disabled = false;
            return;
          }

          confirmImport(decrypted);
        });

        $('#im-cancel')?.addEventListener('click', hideModal);
      } else {
        const data = { mails: json.mails, apps: json.apps };
        confirmImport(data);
      }
    } catch {
      toast('Could not read this file.');
    }
  }

  function confirmImport(data) {
    const mailCount = (data.mails || []).length;
    const appCount  = (data.apps  || []).length;

    showModal('Import backup?', `
      <p class="confirm-text">
        This will <strong>replace all existing data</strong> with:<br>
        ${mailCount} mail${mailCount !== 1 ? 's' : ''}, ${appCount} app${appCount !== 1 ? 's' : ''}.
      </p>
      <div class="warning-box">⚠️ Your current data will be erased.</div>
      <div class="form-actions">
        <button class="btn-sm" id="ci-cancel">Cancel</button>
        <button class="btn-sm danger" id="ci-import">Replace & Import</button>
      </div>
    `);

    $('#ci-import')?.addEventListener('click', async () => {
      await VaultDB.importAll(data);
      hideModal();
      renderMails('');
      toast(`Imported ${mailCount} mail(s) and ${appCount} app(s).`);
    });

    $('#ci-cancel')?.addEventListener('click', hideModal);
  }

  // ── Startup & Initialization ────────────────────────────────
  async function start() {
    const { needsUnlock } = await VaultDB.init();

    if (needsUnlock) {
      showScreen('gate');
      const gateBtn   = $('#gate-btn');
      const gateInput = $('#gate-input');
      const gateError = $('#gate-error');
      const gateEye   = $('#gate-eye');

      gateEye?.addEventListener('click', () => {
        gateInput.type = gateInput.type === 'password' ? 'text' : 'password';
        gateEye.textContent = gateInput.type === 'password' ? 'SHOW' : 'HIDE';
      });

      async function tryUnlock() {
        const pass = gateInput.value;
        if (!pass) { gateError.textContent = 'Enter your passphrase.'; return; }

        gateBtn.innerHTML = '<span class="spinner"></span> Unlocking…';
        gateBtn.disabled = true;

        const ok = await VaultDB.unlock(pass);
        if (ok) {
          proceedAfterUnlock();
        } else {
          gateError.textContent = 'Wrong passphrase.';
          gateBtn.innerHTML = 'Unlock Vault';
          gateBtn.disabled = false;
          gateInput.value = '';
          gateInput.focus();
        }
      }

      gateBtn?.addEventListener('click', tryUnlock);
      gateInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') tryUnlock();
      });
    } else {
      proceedAfterUnlock();
    }
  }

  async function proceedAfterUnlock() {
    const seen = await VaultDB.getSetting('welcomeSeen');

    if (!seen) {
      showScreen('welcome');
      $('#welcome-btn')?.addEventListener('click', async () => {
        await VaultDB.setSetting('welcomeSeen', true);
        showScreen('mails');
        renderMails();
      });
    } else {
      showScreen('mails');
      renderMails();
    }

    bindEvents();
  }

  function bindEvents() {
    // Mail screen
    $('#add-mail-btn')?.addEventListener('click', showAddMailForm);
    $('#mail-fab')?.addEventListener('click', showAddMailForm);
    $('#mail-search')?.addEventListener('input', (e) => renderMails(e.target.value));
    $('#settings-btn')?.addEventListener('click', openSettings);

    // App screen
    $('#back-btn')?.addEventListener('click', () => {
      currentMailId = null;
      showScreen('mails');
      renderMails($('#mail-search').value);
    });
    $('#add-app-btn')?.addEventListener('click', showAddAppForm);
    $('#app-fab')?.addEventListener('click', showAddAppForm);
    $('#app-search')?.addEventListener('input', (e) => renderApps(e.target.value));

    $('#edit-mail-btn')?.addEventListener('click', () => {
      const mail = VaultDB.getMail(currentMailId);
      if (mail) showEditMailForm(mail);
    });
    $('#delete-mail-btn')?.addEventListener('click', () => {
      const mail = VaultDB.getMail(currentMailId);
      if (mail) confirmDeleteMail(mail);
    });

    // Settings
    $('#settings-back-btn')?.addEventListener('click', () => {
      showScreen('mails');
      renderMails($('#mail-search').value);
    });
    $('#app-lock-toggle')?.addEventListener('change', handleAppLockToggle);
    $('#export-btn')?.addEventListener('click', handleExport);
    $('#import-btn')?.addEventListener('click', handleImport);
    $('#import-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) processImportFile(file);
      e.target.value = '';
    });
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  start();

})();
