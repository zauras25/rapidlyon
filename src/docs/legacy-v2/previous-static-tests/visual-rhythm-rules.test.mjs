import test from 'node:test';
import assert from 'node:assert/strict';
import { assessVisualMetrics } from './visual-rhythm-rules.mjs';

const sample = (route, viewport, heading, section = { paddingTop: '68px' }) => ({
  route, viewport, status: 200, h1: { fontSize: `${heading}px` },
  section, viewportOverflow: false,
});

test('original oversized desktop headings fail visual guardrails', () => {
  assert.match(assessVisualMetrics(sample('/', 1440, 109.44)).issues.join(' '), /exceeds 100px/);
  assert.match(assessVisualMetrics(sample('/about', 1440, 90.72)).issues.join(' '), /exceeds 80px/);
});

test('calibrated desktop headings and original mobile sizes pass', () => {
  for (const [route, width, size] of [
    ['/', 1440, 96], ['/about', 1440, 76], ['/', 768, 58.368],
    ['/about', 768, 48.384], ['/', 390, 48.8], ['/about', 390, 44],
    ['/discovery', 1440, 60], ['/client/login', 1440, 30],
  ]) assert.deepEqual(assessVisualMetrics(sample(route, width, size)).issues, []);
});

test('missing section sample is flagged without inventing zero padding', () => {
  const status = assessVisualMetrics(sample('/about', 1440, 76, null));
  assert.equal(status.issues.length, 0);
  assert.match(status.notes.join(' '), /not sampled/);
});

test('HTTP, overflow, and missing headings fail the QA gate', () => {
  const result = assessVisualMetrics({ ...sample('/about', 390, 44), status: 500, h1: null, viewportOverflow: true });
  assert.equal(result.issues.length, 3);
});
