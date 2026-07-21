const crypto = require('crypto');
const { performance } = require('perf_hooks');

const pepperVersion = String(process.env.PASSWORD_PEPPER_CURRENT_VERSION || '1');
process.env.PASSWORD_PEPPER_CURRENT_VERSION = pepperVersion;
const pepperVariable = `PASSWORD_PEPPER_V${pepperVersion}`;
if (!process.env[pepperVariable]) {
  process.env[pepperVariable] = crypto.randomBytes(32).toString('base64url');
}

const {
  argon2Options,
  createPasswordHash,
  verifyPassword
} = require('../services/password-security-service');

const measureBatch = async (operation) => {
  const memoryBefore = process.memoryUsage().rss;
  let peakMemory = memoryBefore;
  const sampler = setInterval(() => {
    peakMemory = Math.max(peakMemory, process.memoryUsage().rss);
  }, 2);
  const started = performance.now();
  try {
    const value = await operation();
    peakMemory = Math.max(peakMemory, process.memoryUsage().rss);
    return {
      duration: performance.now() - started,
      peakMemoryIncrease: Math.max(0, peakMemory - memoryBefore),
      value
    };
  } finally {
    clearInterval(sampler);
  }
};

const run = async () => {
  const concurrency = 4;
  const password = crypto.randomBytes(48).toString('base64url');
  await createPasswordHash(password);

  const hashBatch = await measureBatch(() => Promise.all(
    Array.from({ length: concurrency }, () => createPasswordHash(password))
  ));
  const records = hashBatch.value;

  const verifyBatch = await measureBatch(() => Promise.all(records.map((record) => verifyPassword({
    password,
    passwordHash: record.passwordHash,
    passwordPepperVersion: record.passwordPepperVersion,
    passwordScheme: record.passwordScheme
  }))));
  const verified = verifyBatch.value;

  if (verified.some((value) => value !== true)) {
    throw new Error('Password verification failed during the benchmark.');
  }

  console.log('Argon2id password benchmark');
  console.log(`Parameters: memory=${argon2Options.memoryCost} KiB, time=${argon2Options.timeCost}, parallelism=${argon2Options.parallelism}`);
  console.log(`Concurrent operations: ${concurrency}`);
  console.log(`Hash batch: ${hashBatch.duration.toFixed(1)} ms (${(hashBatch.duration / concurrency).toFixed(1)} ms average)`);
  console.log(`Verify batch: ${verifyBatch.duration.toFixed(1)} ms (${(verifyBatch.duration / concurrency).toFixed(1)} ms average)`);
  console.log(`Observed peak RSS increase: ${Math.ceil(Math.max(hashBatch.peakMemoryIncrease, verifyBatch.peakMemoryIncrease) / 1024 / 1024)} MiB`);
};

run().catch((error) => {
  console.error(`Password benchmark failed: ${error.message}`);
  process.exitCode = 1;
});
