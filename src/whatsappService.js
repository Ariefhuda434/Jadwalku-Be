const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

let sock = null;
let qrDataURL = null;
let connectionStatus = 'disconnected';
let onStatusChange = null;
let lastQrString = null;

const authDir = path.resolve(__dirname, '..', 'wa_auth');

async function initWhatsApp(io) {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

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
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        connectionStatus = 'disconnected';
        qrDataURL = null;
        lastQrString = null;
        if (io) io.emit('whatsapp:status', 'disconnected');
        console.log('[WA] Terputus' + (shouldReconnect ? ', reconnect dalam 5s...' : ''));
        if (shouldReconnect) {
          setTimeout(() => initWhatsApp(io), 5000);
        }
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
  return { status: connectionStatus, qr: qrDataURL };
}

module.exports = { initWhatsApp, sendMessage, getStatus };
