import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';

import { createFixtureServer } from './server.mjs';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'P@ssword123';

test('fixture app serves the browser journey contract', async () => {
  const server = createFixtureServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseURL = `http://127.0.0.1:${address.port}`;

  try {
    const home = await fetch(`${baseURL}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Welcome to Playwright Adventures/);

    const protectedDashboard = await fetch(`${baseURL}/dashboard`, { redirect: 'manual' });
    assert.equal(protectedDashboard.status, 303);
    assert.equal(protectedDashboard.headers.get('location'), '/login');

    const invalidLogin = await fetch(`${baseURL}/login`, {
      method: 'POST',
      body: new URLSearchParams({ email: 'wrong@example.com', password: 'wrong' }),
      redirect: 'manual'
    });
    assert.equal(invalidLogin.status, 401);

    const login = await fetch(`${baseURL}/login`, {
      method: 'POST',
      body: new URLSearchParams({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
      redirect: 'manual'
    });
    assert.equal(login.status, 303);
    assert.equal(login.headers.get('location'), '/dashboard');
    const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
    assert.ok(cookie);

    const dashboard = await fetch(`${baseURL}/dashboard`, { headers: { cookie } });
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /data-testid="account-summary"/);

    const account = await fetch(`${baseURL}/accounts/checking`, { headers: { cookie } });
    assert.equal(account.status, 200);
    assert.match(await account.text(), /data-testid="transaction-table"/);
  } finally {
    const closed = once(server, 'close');
    server.close();
    await closed;
  }
});
