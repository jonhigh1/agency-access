import { getCached, deleteCache } from '../../apps/api/src/lib/cache.ts';

async function main() {
  const key = 'benchmark:20-concurrent-cold-reads';
  await deleteCache(key);
  let sourceCalls = 0;
  const fetch = async () => {
    sourceCalls++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { data: 'value', error: null };
  };
  const started = performance.now();
  const results = await Promise.all(Array.from({ length: 20 }, () => getCached({ key, fetch })));
  console.log(JSON.stringify({ concurrentReads: 20, sourceCalls, elapsedMs: Math.round(performance.now() - started), misses: results.filter((result) => !result.cached).length }));
}

void main();
