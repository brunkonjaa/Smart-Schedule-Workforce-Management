jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => ({
      end: jest.fn(),
      query: jest.fn()
    }))
  };
});

const {
  buildPoolConfig,
  isLocalDatabaseUrl,
  stripConnectionStringSslSettings
} = require('../config/db');

describe('database config', () => {
  test('treats localhost connections as local', () => {
    expect(
      isLocalDatabaseUrl(
        'postgresql://postgres:password@localhost:5432/smart_schedule'
      )
    ).toBe(true);
    expect(
      isLocalDatabaseUrl(
        'postgresql://postgres:password@127.0.0.1:5432/smart_schedule'
      )
    ).toBe(true);
  });

  test('removes SSL query settings before pg applies explicit TLS options', () => {
    const sanitizedConnectionString = stripConnectionStringSslSettings(
      'postgresql://user:pass@example.neon.tech/db?sslmode=require&channel_binding=require&sslrootcert=test'
    );

    expect(sanitizedConnectionString).toContain('channel_binding=require');
    expect(sanitizedConnectionString).not.toContain('sslmode=');
    expect(sanitizedConnectionString).not.toContain('sslrootcert=');
  });

  test('builds strict TLS config for remote databases', () => {
    const poolConfig = buildPoolConfig(
      'postgresql://user:pass@example.neon.tech/db?sslmode=require'
    );

    expect(poolConfig.connectionString).not.toContain('sslmode=');
    expect(poolConfig.enableChannelBinding).toBe(true);
    expect(poolConfig.ssl).toEqual({
      rejectUnauthorized: true
    });
  });
});
