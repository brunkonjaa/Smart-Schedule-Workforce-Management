jest.mock('@simplewebauthn/server', () => ({
  generateAuthenticationOptions: jest.fn(),
  generateRegistrationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
  verifyRegistrationResponse: jest.fn()
}));

jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} = require('@simplewebauthn/server');
const { query } = require('../config/db');
const config = require('../config/env');
const {
  buildAuthenticationOptions,
  buildRegistrationOptions,
  saveRegistration,
  verifyAuthentication
} = require('../services/passkey-service');

describe('passkey verification boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registration options bind the challenge to the configured origin RP ID', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    generateRegistrationOptions.mockResolvedValueOnce({ challenge: 'registration-challenge' });

    await expect(buildRegistrationOptions({
      user: { email: 'admin@example.test', id: '4669b9a8-e89b-4c32-b79f-f3bd8cf85ad1' }
    })).resolves.toEqual({ challenge: 'registration-challenge' });

    expect(generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticatorSelection: expect.objectContaining({
          userVerification: 'required'
        }),
        rpID: new URL(config.appBaseUrl).hostname,
        rpName: 'Smart Schedule'
      })
    );
  });

  test.each([
    ['incorrect origin', 'Unexpected authentication response origin'],
    ['incorrect RP ID', 'Unexpected RP ID hash']
  ])('%s is rejected by registration verification', async (label, message) => {
    verifyRegistrationResponse.mockRejectedValueOnce(new Error(message));

    await expect(saveRegistration({
      expectedChallenge: 'expected-challenge',
      response: { id: label },
      userId: '4669b9a8-e89b-4c32-b79f-f3bd8cf85ad1'
    })).rejects.toThrow(message);

    expect(verifyRegistrationResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: 'expected-challenge',
        expectedOrigin: config.appBaseUrl.replace(/\/$/, ''),
        expectedRPID: new URL(config.appBaseUrl).hostname,
        requireUserVerification: true
      })
    );
  });

  test('invalid registration signatures do not create a credential', async () => {
    verifyRegistrationResponse.mockResolvedValueOnce({ verified: false });

    await expect(saveRegistration({
      expectedChallenge: 'expected-challenge',
      response: { id: 'invalid-signature' },
      userId: '4669b9a8-e89b-4c32-b79f-f3bd8cf85ad1'
    })).resolves.toEqual({ verified: false });
    expect(query).not.toHaveBeenCalled();
  });

  test('revoked or unknown credentials are rejected before signature verification', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(verifyAuthentication({
      expectedChallenge: 'expected-challenge',
      response: { rawId: Buffer.from('revoked-credential').toString('base64url') },
      userId: '4669b9a8-e89b-4c32-b79f-f3bd8cf85ad1'
    })).resolves.toEqual({ verified: false });
    expect(verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  test('invalid authentication signatures do not update the passkey counter', async () => {
    const credentialId = Buffer.from('active-credential');
    query.mockResolvedValueOnce({
      rows: [{
        counter: 4,
        credential_id: credentialId,
        id: 'passkey-id',
        public_key: Buffer.from('public-key'),
        transports: []
      }]
    });
    verifyAuthenticationResponse.mockResolvedValueOnce({ verified: false });

    await expect(verifyAuthentication({
      expectedChallenge: 'expected-challenge',
      response: { rawId: credentialId.toString('base64url') },
      userId: '4669b9a8-e89b-4c32-b79f-f3bd8cf85ad1'
    })).resolves.toEqual({ verified: false });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('successful authentication stores the verifier counter', async () => {
    const credentialId = Buffer.from('active-credential');
    query
      .mockResolvedValueOnce({
        rows: [{
          counter: 4,
          credential_id: credentialId,
          id: 'passkey-id',
          public_key: Buffer.from('public-key'),
          transports: []
        }]
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    verifyAuthenticationResponse.mockResolvedValueOnce({
      authenticationInfo: { newCounter: 5 },
      verified: true
    });

    await expect(verifyAuthentication({
      expectedChallenge: 'expected-challenge',
      response: { rawId: credentialId.toString('base64url') },
      userId: '4669b9a8-e89b-4c32-b79f-f3bd8cf85ad1'
    })).resolves.toEqual({ verified: true });
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE user_passkeys'),
      [5, 'passkey-id']
    );
  });

  test('authentication options include only active credentials returned by storage', async () => {
    const credentialId = Buffer.from('allowed-credential');
    query.mockResolvedValueOnce({
      rows: [{ credential_id: credentialId, transports: ['internal'] }]
    });
    generateAuthenticationOptions.mockResolvedValueOnce({ challenge: 'login-challenge' });

    await buildAuthenticationOptions({
      userId: '4669b9a8-e89b-4c32-b79f-f3bd8cf85ad1'
    });

    expect(generateAuthenticationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        allowCredentials: [{
          id: credentialId.toString('base64url'),
          transports: ['internal']
        }],
        rpID: new URL(config.appBaseUrl).hostname,
        userVerification: 'required'
      })
    );
  });
});
