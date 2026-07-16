const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} = require('@simplewebauthn/server');
const { query } = require('../config/db');
const config = require('../config/env');

const getWebAuthnConfig = () => {
  const configuredOrigin = config.appBaseUrl.replace(/\/$/, '');
  const origin = new URL(configuredOrigin);

  return {
    origin: configuredOrigin,
    rpID: origin.hostname,
    rpName: 'Smart Schedule'
  };
};

const encodeBase64Url = (value) => {
  return Buffer.from(value).toString('base64url');
};

const decodeBase64Url = (value) => {
  return Buffer.from(value, 'base64url');
};

const credentialIdToBuffer = (value) => {
  return typeof value === 'string' ? decodeBase64Url(value) : Buffer.from(value);
};

const userIdToBytes = (userId) => {
  return Buffer.from(String(userId).replace(/-/g, ''), 'hex');
};

const countActivePasskeys = async (userId) => {
  const result = await query(
    `SELECT COUNT(*)::INTEGER AS count FROM user_passkeys WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );

  return result.rows[0].count;
};

const listActivePasskeys = async (userId) => {
  const result = await query(
    `
      SELECT id, credential_id, public_key, counter, device_name, transports
      FROM user_passkeys
      WHERE user_id = $1 AND revoked_at IS NULL
      ORDER BY created_at ASC
    `,
    [userId]
  );

  return result.rows;
};

const buildRegistrationOptions = async ({ user }) => {
  const existingPasskeys = await listActivePasskeys(user.id);
  const { rpID, rpName } = getWebAuthnConfig();

  return generateRegistrationOptions({
    attestationType: 'none',
    excludeCredentials: existingPasskeys.map((passkey) => ({
      id: encodeBase64Url(passkey.credential_id),
      transports: passkey.transports || []
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required'
    },
    rpID,
    rpName,
    userDisplayName: user.email,
    userID: userIdToBytes(user.id),
    userName: user.email
  });
};

const buildAuthenticationOptions = async ({ userId }) => {
  const passkeys = await listActivePasskeys(userId);
  const { rpID } = getWebAuthnConfig();

  return generateAuthenticationOptions({
    allowCredentials: passkeys.map((passkey) => ({
      id: encodeBase64Url(passkey.credential_id),
      transports: passkey.transports || []
    })),
    rpID,
    userVerification: 'required'
  });
};

const saveRegistration = async ({ userId, response, expectedChallenge }) => {
  const { origin, rpID } = getWebAuthnConfig();
  const verification = await verifyRegistrationResponse({
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    response
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { credential } = verification.registrationInfo;
  await query(
    `
      INSERT INTO user_passkeys
        (user_id, credential_id, public_key, counter, device_name, transports)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      userId,
      credentialIdToBuffer(credential.id),
      Buffer.from(credential.publicKey),
      credential.counter,
      'Passkey',
      response.response?.transports || []
    ]
  );

  return { verified: true };
};

const verifyAuthentication = async ({ userId, response, expectedChallenge }) => {
  const passkeys = await listActivePasskeys(userId);
  const credentialId = decodeBase64Url(response.rawId || response.id);
  const passkey = passkeys.find((candidate) => {
    return Buffer.from(candidate.credential_id).equals(credentialId);
  });

  if (!passkey) {
    return { verified: false };
  }

  const { origin, rpID } = getWebAuthnConfig();
  const verification = await verifyAuthenticationResponse({
    credential: {
      id: Buffer.from(passkey.credential_id),
      publicKey: Buffer.from(passkey.public_key),
      counter: Number(passkey.counter)
    },
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    response
  });

  if (!verification.verified) {
    return { verified: false };
  }

  await query(
    `UPDATE user_passkeys SET counter = $1, last_used_at = NOW() WHERE id = $2`,
    [verification.authenticationInfo.newCounter, passkey.id]
  );

  return { verified: true };
};

module.exports = {
  buildAuthenticationOptions,
  buildRegistrationOptions,
  countActivePasskeys,
  saveRegistration,
  verifyAuthentication
};
