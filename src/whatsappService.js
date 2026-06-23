const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');

let sock = null;
let qrCode = null;
let connectionStatus = 'disconnected';
let onQRChange = null;

const authDir = path.resolve(__dirname, '..', 'wa_auth');

async function initWhatsApp() {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['JadwalKu', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCode = qr;
      connectionStatus = 'waiting_scan';
      if (onQRChange) onQRChange(qr);
    }

    if (connection) {
      if (connection === 'open') {
        connectionStatus = 'connected';
        qrCode = null;
        if (onQRChange) onQRChange(null);
      } else if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        connectionStatus = 'disconnected';
        if (shouldReconnect) {
          setTimeout(initWhatsApp, 5000);
        }
        if (onQRChange) onQRChange(null);
      }
    }
  });

  return sock;
}

async function sendMessage(to, text) {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp tidak terhubung.');
  }

  const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

function getStatus() {
  return { status: connectionStatus, qr: qrCode };
}

function setQRListener(fn) {
  onQRChange = fn;
}

module.exports = { initWhatsApp, sendMessage, getStatus, setQRListener };
