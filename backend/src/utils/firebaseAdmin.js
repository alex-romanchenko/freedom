const serviceAccount = require('../../firebase-service-account.json');

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert(serviceAccount),
    });

const messaging = getMessaging(app);

module.exports = {
  messaging,
};