const serviceAccount = require('../../firebase-service-account.json');

const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

module.exports = admin;