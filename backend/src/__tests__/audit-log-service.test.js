jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const { query } = require('../config/db');
const { listAuditLogs } = require('../services/audit-log-service');

describe('audit log pagination boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockPage = (recordCount, total) => {
    query
      .mockResolvedValueOnce({
        rows: Array.from({ length: recordCount }, (_, index) => ({
          action: 'SHIFT_CREATED',
          after_state: null,
          before_state: null,
          created_at: new Date('2026-07-21T12:00:00Z'),
          entity_id: `entity-${index}`,
          entity_type: 'SHIFT',
          id: `record-${index}`,
          summary: `Record ${index}`
        }))
      })
      .mockResolvedValueOnce({ rows: [{ total }] });
  };

  test('an empty audit log still has a valid first page', async () => {
    mockPage(0, 0);
    await expect(listAuditLogs()).resolves.toEqual({
      logs: [],
      pagination: {
        hasNext: false,
        hasPrevious: false,
        page: 1,
        pageSize: 25,
        total: 0,
        totalPages: 1
      }
    });
  });

  test('exactly 25 records fit on one page', async () => {
    mockPage(25, 25);
    const result = await listAuditLogs();
    expect(result.logs).toHaveLength(25);
    expect(result.pagination).toEqual(expect.objectContaining({
      hasNext: false,
      page: 1,
      total: 25,
      totalPages: 1
    }));
  });

  test('record 26 creates a reachable second and final page', async () => {
    mockPage(25, 26);
    const first = await listAuditLogs();
    expect(first.pagination).toEqual(expect.objectContaining({
      hasNext: true,
      hasPrevious: false,
      totalPages: 2
    }));

    jest.clearAllMocks();
    mockPage(1, 26);
    const final = await listAuditLogs({ page: 2 });
    expect(final.logs).toHaveLength(1);
    expect(final.pagination).toEqual(expect.objectContaining({
      hasNext: false,
      hasPrevious: true,
      page: 2,
      totalPages: 2
    }));
  });

  test('the query uses the UUID as the stable tie-breaker for equal timestamps', async () => {
    mockPage(0, 0);
    await listAuditLogs();
    expect(query.mock.calls[0][0]).toContain(
      'ORDER BY audit_logs.created_at DESC, audit_logs.id DESC'
    );
  });
});
