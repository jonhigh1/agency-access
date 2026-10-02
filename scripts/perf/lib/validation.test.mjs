import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPerfResponse, positiveNumber, redactPerfToken, safeReportUrl } from './validation.mjs';

const response = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});
const agency = { id: 'agency-1', name: 'Agency' };
const dashboard = {
  agency,
  stats: { totalRequests: 0, pendingRequests: 0, activeConnections: 0, totalPlatforms: 0 },
  requests: [],
  connections: [],
};

test('valid agencies and dashboard responses pass', async () => {
  assert.ok(await assertPerfResponse(response(200, { data: [agency], error: null }), 'agencies') > 0);
  assert.ok(await assertPerfResponse(response(200, { data: dashboard, error: null }), 'dashboard') > 0);
  const playwrightResponse = { ok: () => true, status: () => 200, text: async () => JSON.stringify({ data: dashboard, error: null }) };
  assert.ok(await assertPerfResponse(playwrightResponse, 'dashboard') > 0);
});

test('HTTP and application errors never count as fast success', async () => {
  await assert.rejects(assertPerfResponse(response(401, { data: null, error: { message: 'secret' } }), 'agencies'), /agencies HTTP 401/);
  const playwrightError = { ok: () => false, status: () => 403, text: async () => 'secret' };
  await assert.rejects(assertPerfResponse(playwrightError, 'dashboard'), /dashboard HTTP 403/);
  await assert.rejects(assertPerfResponse(response(200, { data: null, error: { message: 'secret' } }), 'dashboard'), /dashboard invalid response/);
  await assert.rejects(assertPerfResponse(new Response('not json'), 'dashboard'), /dashboard invalid response/);
  await assert.rejects(assertPerfResponse(response(200, { data: [], error: null }), 'agencies'), /agencies invalid response/);
  await assert.rejects(assertPerfResponse(response(200, { data: { ...dashboard, agency: null }, error: null }), 'dashboard'), /dashboard invalid response/);
});

test('runs and budgets reject empty, invalid, and nonpositive values', () => {
  assert.equal(positiveNumber('2', '--runs', { integer: true, min: 2 }), 2);
  assert.equal(positiveNumber('0.25', '--budget'), 0.25);
  for (const value of ['0', '-1', 'NaN', 'Infinity', 'bad', '']) {
    assert.throws(() => positiveNumber(value, '--budget'), /--budget/);
  }
  assert.throws(() => positiveNumber('1', '--runs', { integer: true, min: 2 }), /--runs/);
  assert.throws(() => positiveNumber('2.5', '--runs', { integer: true, min: 2 }), /--runs/);
});

test('report URLs drop token and all other query data', () => {
  assert.equal(safeReportUrl('http://localhost:3000/perf/dashboard-bootstrap?token=secret&userId=user#frag'),
    'http://localhost:3000/perf/dashboard-bootstrap');
});

test('trace, console, and error text remove raw and URL-encoded tokens', () => {
  const token = 'a+b/c?d';
  const text = JSON.stringify({
    trace: `Authorization: Bearer ${token}`,
    console: `token=${encodeURIComponent(token)}`,
    error: `page.goto: /perf/dashboard-bootstrap?token=${encodeURIComponent(token)}`,
  });
  const redacted = redactPerfToken(text, token);
  assert.ok(!redacted.includes(token));
  assert.ok(!redacted.includes(encodeURIComponent(token)));
  assert.equal((redacted.match(/\[REDACTED\]/g) || []).length, 3);
});
