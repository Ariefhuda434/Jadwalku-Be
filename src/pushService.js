const webpush = require('web-push');
const db = require('./database');

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@jadwalku.com';

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function sendPushToUser(userId, title, message) {
  const subs = db.prepare(
    'SELECT * FROM push_subscriptions WHERE user_id = ?'
  ).all(userId);

  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, message, timestamp: Date.now() });

  for (const sub of subs) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };

    webpush.sendNotification(pushSub, payload).catch((err) => {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      }
    });
  }
}

module.exports = { sendPushToUser };
