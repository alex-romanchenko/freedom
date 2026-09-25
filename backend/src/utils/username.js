// Preserve the user's chosen casing for display, but compare usernames
// case-insensitively in PostgreSQL.
const USERNAME_REGEX = /^[A-Za-z0-9]{3,15}$/;

function isValidUsername(value) {
  return typeof value === 'string' && USERNAME_REGEX.test(value);
}

module.exports = { USERNAME_REGEX, isValidUsername };
