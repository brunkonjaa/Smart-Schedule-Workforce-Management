const argon2 = require('argon2');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const config = require('../config/env');

const ARGON2ID_PEPPERED = 'ARGON2ID_PEPPERED';
const BCRYPT = 'BCRYPT';
const argon2Options = Object.freeze({
  hashLength: 32,
  memoryCost: 19 * 1024,
  parallelism: 1,
  timeCost: 2,
  type: argon2.argon2id
});
const passwordMinimumLength = 15;
const passwordMaximumLength = 128;
const pwnedPasswordsRangeUrl = 'https://api.pwnedpasswords.com/range/';

const normalizePassword = (password) => {
  return typeof password === 'string' ? password.normalize('NFKC') : '';
};

const validatePassword = (password, fieldName = 'password') => {
  const normalizedPassword = normalizePassword(password);
  const details = [];

  if (typeof password !== 'string' || password.length === 0) {
    details.push(`${fieldName} is required`);
    return details;
  }

  const characterLength = Array.from(normalizedPassword).length;

  if (characterLength < passwordMinimumLength) {
    details.push(`${fieldName} must be at least ${passwordMinimumLength} characters long`);
  } else if (characterLength > passwordMaximumLength) {
    details.push(`${fieldName} must be ${passwordMaximumLength} characters or fewer`);
  }

  return details;
};

const getPepper = (version) => {
  const pepper = config.getPasswordPepper(version);

  if (!pepper) {
    const error = new Error('The configured password pepper is unavailable.');
    error.code = 'PASSWORD_PEPPER_UNAVAILABLE';
    throw error;
  }

  return pepper;
};

const derivePepperedPassword = (password, pepperVersion) => {
  return crypto
    .createHmac('sha256', getPepper(pepperVersion))
    .update(normalizePassword(password), 'utf8')
    .digest();
};

const createPasswordHash = async (password, pepperVersion = config.passwordPepperCurrentVersion) => {
  const passwordHash = await argon2.hash(
    derivePepperedPassword(password, pepperVersion),
    argon2Options
  );

  return {
    passwordHash,
    passwordPepperVersion: pepperVersion,
    passwordScheme: ARGON2ID_PEPPERED
  };
};

const verifyPassword = async ({
  password,
  passwordHash,
  passwordPepperVersion = null,
  passwordScheme = BCRYPT
}) => {
  if (passwordScheme === BCRYPT) {
    return bcrypt.compare(password, passwordHash);
  }

  if (passwordScheme !== ARGON2ID_PEPPERED || !passwordPepperVersion) {
    return false;
  }

  try {
    return await argon2.verify(
      passwordHash,
      derivePepperedPassword(password, passwordPepperVersion),
      { type: argon2.argon2id }
    );
  } catch (error) {
    if (error.code === 'PASSWORD_PEPPER_UNAVAILABLE') {
      throw error;
    }

    return false;
  }
};

const getBreachedPasswordCount = async (password) => {
  const sha1 = crypto
    .createHash('sha1')
    .update(normalizePassword(password), 'utf8')
    .digest('hex')
    .toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  let response;

  try {
    response = await fetch(`${pwnedPasswordsRangeUrl}${prefix}`, {
      headers: {
        'Add-Padding': 'true',
        'User-Agent': 'Smart-Schedule-Password-Safety-Check'
      },
      signal: AbortSignal.timeout(5000)
    });
  } catch (error) {
    const unavailableError = new Error(
      'Password safety checking is temporarily unavailable. Try again shortly.'
    );
    unavailableError.code = 'BREACHED_PASSWORD_CHECK_UNAVAILABLE';
    throw unavailableError;
  }

  if (!response.ok) {
    const unavailableError = new Error(
      'Password safety checking is temporarily unavailable. Try again shortly.'
    );
    unavailableError.code = 'BREACHED_PASSWORD_CHECK_UNAVAILABLE';
    throw unavailableError;
  }

  const body = await response.text();
  const matchingLine = body.split(/\r?\n/).find((line) => {
    return line.slice(0, 35).toUpperCase() === suffix;
  });

  if (!matchingLine) {
    return 0;
  }

  const count = Number(matchingLine.split(':')[1]);
  return Number.isFinite(count) ? count : 0;
};

const assertPasswordIsSafe = async (password) => {
  const breachedCount = await getBreachedPasswordCount(password);

  if (breachedCount > 0) {
    const error = new Error(
      'Choose a different password because this one appears in known breached-password data.'
    );
    error.code = 'BREACHED_PASSWORD';
    throw error;
  }
};

module.exports = {
  ARGON2ID_PEPPERED,
  BCRYPT,
  argon2Options,
  assertPasswordIsSafe,
  createPasswordHash,
  getBreachedPasswordCount,
  normalizePassword,
  passwordMaximumLength,
  passwordMinimumLength,
  validatePassword,
  verifyPassword
};
