/**
 * ============================================================
 * vault-crypto.js — Encryption utilities for SpellVault
 * ============================================================
 * Uses the Web Crypto API (browser built-in, no network).
 * PBKDF2 key derivation + AES-GCM 256-bit encryption.
 * Password generator + strength checker included.
 * ============================================================
 */

const VaultCrypto = (() => {
  const PBKDF2_ITERATIONS = 600_000;
  const SALT_BYTES = 16;
  const IV_BYTES   = 12;

  // ── Base64 helpers ──────────────────────────────────────────
  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  // ── Random generators ───────────────────────────────────────
  function generateSalt() { return crypto.getRandomValues(new Uint8Array(SALT_BYTES)); }
  function generateIV()   { return crypto.getRandomValues(new Uint8Array(IV_BYTES)); }

  // ── PBKDF2 key derivation ───────────────────────────────────
  async function deriveKey(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt', 'decrypt']
    );
  }

  // ── AES-GCM encrypt / decrypt ───────────────────────────────
  async function encrypt(plaintext, key, iv) {
    return crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)
    );
  }

  async function decrypt(ciphertext, key, iv) {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  }

  // ── Per-app PIN encryption ──────────────────────────────────
  async function encryptWithPin(password, pin) {
    const salt = generateSalt();
    const iv   = generateIV();
    const key  = await deriveKey(pin, salt);
    const enc  = await encrypt(password, key, iv);
    return {
      encrypted: bufferToBase64(enc),
      salt:      bufferToBase64(salt),
      iv:        bufferToBase64(iv),
    };
  }

  async function decryptWithPin(encryptedB64, pin, saltB64, ivB64) {
    try {
      const salt = new Uint8Array(base64ToBuffer(saltB64));
      const iv   = new Uint8Array(base64ToBuffer(ivB64));
      const key  = await deriveKey(pin, salt);
      return await decrypt(base64ToBuffer(encryptedB64), key, iv);
    } catch { return null; }
  }

  // ── Vault-wide data encryption ──────────────────────────────
  async function encryptData(data, passphrase) {
    const json = JSON.stringify(data);
    const salt = generateSalt();
    const iv   = generateIV();
    const key  = await deriveKey(passphrase, salt);
    const enc  = await encrypt(json, key, iv);
    return {
      encrypted: bufferToBase64(enc),
      salt:      bufferToBase64(salt),
      iv:        bufferToBase64(iv),
    };
  }

  async function decryptData(encryptedB64, passphrase, saltB64, ivB64) {
    try {
      const salt = new Uint8Array(base64ToBuffer(saltB64));
      const iv   = new Uint8Array(base64ToBuffer(ivB64));
      const key  = await deriveKey(passphrase, salt);
      const json = await decrypt(base64ToBuffer(encryptedB64), key, iv);
      return JSON.parse(json);
    } catch { return null; }
  }

  // ── Password generator ──────────────────────────────────────
  function generatePassword(length = 18, options = {}) {
    const { uppercase = true, lowercase = true, numbers = true, symbols = true } = options;
    const pools = [];
    if (lowercase) pools.push('abcdefghijkmnopqrstuvwxyz');
    if (uppercase) pools.push('ABCDEFGHJKLMNPQRSTUVWXYZ');
    if (numbers)   pools.push('23456789');
    if (symbols)   pools.push('!@#$%^&*_+-=?');
    if (!pools.length) pools.push('abcdefghijkmnopqrstuvwxyz');

    const all    = pools.join('');
    const result = [];
    for (const pool of pools) {
      result.push(pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length]);
    }
    while (result.length < length) {
      result.push(all[crypto.getRandomValues(new Uint32Array(1))[0] % all.length]);
    }
    for (let i = result.length - 1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result.join('');
  }

  // ── Password strength ───────────────────────────────────────
  function checkStrength(password) {
    if (!password) return { score: 0, label: '', color: 'transparent', percent: 0 };
    let score = 0;
    if (password.length >= 8)  score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    if (/[a-z]/.test(password))        score++;
    if (/[A-Z]/.test(password))        score++;
    if (/[0-9]/.test(password))        score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    const levels = [
      { max: 2, label: 'Very Weak',    color: '#ef4444' },
      { max: 3, label: 'Weak',         color: '#f97316' },
      { max: 4, label: 'Fair',         color: '#eab308' },
      { max: 5, label: 'Strong',       color: '#22c55e' },
      { max: 9, label: 'Very Strong',  color: '#6366f1' },
    ];
    const level   = levels.find(l => score <= l.max) || levels[4];
    const mapped  = Math.min(5, Math.max(1, score - 1));
    return { score: mapped, label: level.label, color: level.color, percent: (mapped / 5) * 100 };
  }

  return {
    bufferToBase64, base64ToBuffer, generateSalt, generateIV,
    deriveKey, encrypt, decrypt,
    encryptWithPin, decryptWithPin,
    encryptData, decryptData,
    generatePassword, checkStrength,
  };
})();
