const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

let sock = null;
let qrDataURL = null;
let connectionStatus = 'disconnected';
let lastQrString = null;
let reconnectTimer = null;
let isDestroyed = false;

const authDir = path.resolve(__dirname, '..', 'wa_auth');

function clearAuth() {
  try {
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log('[WA] Auth folder cleared');
    }
  } catch (e) {
    console.log('[WA] Gagal clear auth folder:', e.message);
  }
}

async function initWhatsApp(io) {
  isDestroyed = false;
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  if (isDestroyed) return;

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['JadwalKu', 'Chrome', '1.0.0'],
    markOnlineOnConnect: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && qr !== lastQrString) {
      lastQrString = qr;
      try {
        qrDataURL = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
      } catch {
        qrDataURL = null;
      }
      connectionStatus = 'waiting_scan';
      if (io) io.emit('whatsapp:qr', qrDataURL);
      console.log('[WA] QR code baru generated - scan dengan WhatsApp kamu');
    }

    if (connection) {
      if (connection === 'open') {
        connectionStatus = 'connected';
        qrDataURL = null;
        lastQrString = null;
        if (io) io.emit('whatsapp:status', 'connected');
        console.log('[WA] Tersambung!');
      } else if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced;

        connectionStatus = 'disconnected';
        qrDataURL = null;
        lastQrString = null;
        if (io) io.emit('whatsapp:status', 'disconnected');

        if (isReplaced) {
          console.log('[WA] Session digantikan device lain, reset auth...');
          clearAuth();
          console.log('[WA] Auth direset. Mulai ulang untuk QR baru...');
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (!isDestroyed) initWhatsApp(io);
          }, 2000);
        } else if (!isLoggedOut) {
          console.log('[WA] Terputus, reconnect dalam 5s...');
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (!isDestroyed) initWhatsApp(io);
          }, 5000);
        } else {
          console.log('[WA] Terputus (logged out). Mulai ulang untuk QR baru...');
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (!isDestroyed) initWhatsApp(io);
          }, 2000);
        }
      }
    }
  });

  return sock;
}

async function disconnect() {
  isDestroyed = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    try { await sock.logout(); } catch {}
    try { sock.end(undefined); } catch {}
    sock = null;
  }
  clearAuth();
  connectionStatus = 'disconnected';
  qrDataURL = null;
  lastQrString = null;
}

async function sendMessage(to, text) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp tidak terhubung.');
  }

  const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

function getStatus() {
  return { status: connectionStatus, qr: qrDataURL };
}

module.exports = { initWhatsApp, sendMessage, getStatus, disconnect };
