// A route-specific visual budget. Public pages share a restrained editorial scale,
// while the home hero is allowed more emphasis and auth/discovery stay compact.
// These are guardrails, not a replacement for checking the actual screenshots.
const h1Limits = {
  390: { home: 56, public: 54, discovery: 44, login: 40 },
  768: { home: 68, public: 64, discovery: 56, login: 40 },
  1440: { home: 100, public: 80, discovery: 64, login: 40 },
};
const roleForRoute = (path) => path === '/' ? 'home' : path === '/discovery' ? 'discovery' : path === '/client/login' ? 'login' : 'public';

// Kept separate from the browser runner to permit deterministic unit tests.
export function assessVisualMetrics(record) {
  const issues = [];
  const notes = [];
  if (!record.status || record.status >= 400) issues.push(`HTTP ${record.status ?? 'no response'}`);
  if (record.viewportOverflow) issues.push('horizontal overflow');
  if (record.evaluationError) issues.push('browser style evaluation failed');
  const fontPx = Number.parseFloat(record.h1?.fontSize ?? '');
  if (!Number.isFinite(fontPx)) {
    issues.push('missing/unmeasurable primary heading');
  } else {
    const budget = h1Limits[record.viewport]?.[roleForRoute(record.route)];
    if (budget != null && fontPx > budget + 0.25) issues.push(`H1 ${fontPx.toFixed(2)}px exceeds ${budget}px ${roleForRoute(record.route)} budget`);
  }
  // The source uses <div> for many content sections. Missing semantic section
  // sampling means we haven't measured their internal spacing, not that it is 0.
  if (!record.section) notes.push('section rhythm not sampled: inspect screenshot');
  return { issues, notes };
}

