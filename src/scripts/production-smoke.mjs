// Non-mutating unauthenticated status probe for a real deployed domain.
const domain = process.argv[2];
if (!domain || !/^https:\/\/[^/?#]+\/?$/.test(domain)) {
  console.error('Usage: node scripts/production-smoke.mjs https://your-production-domain.com');
  process.exit(2);
}
const origin = new URL(domain).origin;
let failures = 0;
const paths = ['/', '/services', '/pricing', '/contact', '/client/login', '/discovery'];
for (const path of paths) {
  try {
    const res = await fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(12000) });
    const okay = res.status === 200 || (path === '/discovery' && [302, 303, 307, 308].includes(res.status));
    console.log(`${okay ? 'OK' : 'CHECK'} ${res.status} ${path}`);
    if (!okay) failures++;
  } catch (error) { failures++; console.log(`FAILED ${path}: ${error.message}`); }
}
try {
  const res = await fetch(origin + '/admin/billing', { redirect: 'manual', signal: AbortSignal.timeout(12000) });
  const location = res.headers.get('location') || '';
  const okay = [302,303,307,308].includes(res.status) && location.includes('/admin/discovery/login');
  console.log(`${okay ? 'OK' : 'CHECK'} ${res.status} /admin/billing (unauthenticated redirect${location ? ': '+location : ''})`);
  if (!okay) failures++;
} catch (error) { failures++; console.log(`FAILED /admin/billing: ${error.message}`); }
console.log(`${failures} smoke checks need investigation. Reminder: this does NOT test submissions or emails.`);
process.exitCode = failures > 0 ? 1 : 0;
