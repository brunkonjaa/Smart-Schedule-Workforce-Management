const config = require('../config/env');
const { resolveSessionPolicy } = require('../config/session');
const { closePool } = require('../config/db');

describe('role-based session lifetime policy', () => {
  afterAll(async () => {
    await closePool();
  });

  test('Admin idle and absolute limits use the shorter Admin policy', () => {
    const policy = resolveSessionPolicy({ role: 'ADMIN' });

    expect(policy.idleTimeoutMs).toBe(
      config.sessionAdminIdleTimeoutMinutes * 60 * 1000
    );
    expect(policy.absoluteLifetimeMs).toBe(
      config.sessionAdminAbsoluteLifetimeHours * 60 * 60 * 1000
    );
    expect(policy.idleTimeoutMs).toBeLessThan(
      resolveSessionPolicy({ role: 'STAFF' }).idleTimeoutMs
    );
  });

  test('remember me never extends an Admin session', () => {
    const normalAdmin = resolveSessionPolicy({ rememberMe: false, role: 'ADMIN' });
    const rememberedAdmin = resolveSessionPolicy({ rememberMe: true, role: 'ADMIN' });

    expect(rememberedAdmin).toEqual(normalAdmin);
    expect(rememberedAdmin.rememberMe).toBe(false);
  });

  test('remember me extends Manager idle and absolute lifetimes', () => {
    const normalManager = resolveSessionPolicy({ role: 'MANAGER' });
    const rememberedManager = resolveSessionPolicy({ rememberMe: true, role: 'MANAGER' });

    expect(rememberedManager.rememberMe).toBe(true);
    expect(rememberedManager.idleTimeoutMs).toBeGreaterThan(normalManager.idleTimeoutMs);
    expect(rememberedManager.absoluteLifetimeMs).toBeGreaterThan(
      normalManager.absoluteLifetimeMs
    );
  });
});
