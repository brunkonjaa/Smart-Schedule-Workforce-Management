const { performance } = require('perf_hooks');

const baseUrl = 'http://localhost:3000';
const sampleCount = 15;

const percentile = (values, value) => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1);
  return sorted[index];
};

const summarize = (name, samples, bytes) => ({
  bytes: Math.round(bytes.reduce((total, value) => total + value, 0) / bytes.length),
  maxMs: Number(Math.max(...samples).toFixed(2)),
  medianMs: Number(percentile(samples, 0.5).toFixed(2)),
  name,
  p95Ms: Number(percentile(samples, 0.95).toFixed(2)),
  samples: samples.length
});

const measure = async (path, options = {}) => {
  const durations = [];
  const sizes = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const started = performance.now();
    const response = await fetch(`${baseUrl}${path}`, options);
    const body = await response.arrayBuffer();
    durations.push(performance.now() - started);
    sizes.push(body.byteLength);
    if (!response.ok) {
      throw new Error(`${path} returned ${response.status}`);
    }
  }
  return { durations, sizes };
};

const login = async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    body: JSON.stringify({
      email: 'maeveoconnorfake@gmail.com',
      password: 'EvidenceManager123!'
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });
  if (!response.ok) throw new Error(`login returned ${response.status}`);
  return response.headers.get('set-cookie').split(';')[0];
};

const main = async () => {
  const cookie = await login();
  const cases = [
    ['Frontend HTML', '/', {}],
    ['Main CSS', '/src/styles/main.css', {}],
    ['Health + database check', '/health', {}],
    ['Weekly rota API', '/api/v1/rota?weekStart=2026-07-13&department=ALL', { headers: { cookie } }],
    ['Manager staff API', '/api/v1/staff', { headers: { cookie } }],
    ['NodyChat bootstrap API', '/api/v1/chat/messages', { headers: { cookie } }]
  ];
  const results = [];
  for (const [name, path, options] of cases) {
    const measured = await measure(path, options);
    results.push(summarize(name, measured.durations, measured.sizes));
  }
  console.log(JSON.stringify({
    environment: 'localhost with smart_schedule_local PostgreSQL',
    measuredAt: new Date().toISOString(),
    note: 'HTTP response timing only; this is not a browser render or network-speed test.',
    results
  }, null, 2));
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
