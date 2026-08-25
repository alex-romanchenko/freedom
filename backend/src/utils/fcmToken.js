const { deleteFcmToken } = require('../models/user.model');

const invalidTokenCodes = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

const invalidTokenMessages = new Set([
  'notregistered',
  'requested entity was not found.',
]);

function isInvalidFcmTokenError(error) {
  const code = String(error?.code || error?.errorInfo?.code || '').toLowerCase();
  if (invalidTokenCodes.has(code)) return true;

  const message = String(error?.message || '').trim().toLowerCase();
  if (invalidTokenMessages.has(message)) return true;

  return message.includes('registration token is not a valid fcm');
}

async function deleteInvalidFcmToken(error, token) {
  if (!token || !isInvalidFcmTokenError(error)) return false;

  await deleteFcmToken(token);
  return true;
}

module.exports = {
  isInvalidFcmTokenError,
  deleteInvalidFcmToken,
};
