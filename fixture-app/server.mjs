import http from 'node:http';
import { pathToFileURL } from 'node:url';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'P@ssword123';
const SESSION_COOKIE = 'fixture_session=demo';
const MAX_FORM_BYTES = 8 * 1024;

const defaultHeaders = {
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff'
};

const send = (response, statusCode, body, headers = {}) => {
  response.writeHead(statusCode, {
    ...defaultHeaders,
    'content-length': Buffer.byteLength(body),
    'content-type': 'text/html; charset=utf-8',
    ...headers
  });
  response.end(body);
};

const redirect = (response, location, headers = {}) => {
  response.writeHead(303, { ...defaultHeaders, location, ...headers });
  response.end();
};

const page = (title, content) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} · Playwright Adventures</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <header><a href="/">Playwright Adventures</a></header>
    <main>${content}</main>
  </body>
</html>`;

const homePage = page(
  'Home',
  `<h1>Welcome to Playwright Adventures</h1>
  <p>A deterministic application for exercising the repository's browser journeys.</p>
  <a class="button" href="/login">Sign in</a>`
);

const loginPage = (invalidCredentials = false) => page(
  'Sign in',
  `<h1>Sign in</h1>
  ${invalidCredentials ? '<p role="alert">Invalid email or password.</p>' : ''}
  <form method="post" action="/login">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="username" required>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Sign in</button>
  </form>`
);

const dashboardPage = page(
  'Dashboard',
  `<h1>Dashboard</h1>
  <section data-testid="account-summary" aria-labelledby="account-summary-heading">
    <h2 id="account-summary-heading">Account summary</h2>
    <p>Combined balance: $2,500.00</p>
  </section>
  <ul>
    <li><a data-testid="account-list-item" href="/accounts/checking">Everyday Checking</a></li>
  </ul>`
);

const accountDetailsPage = page(
  'Account Details',
  `<h1>Account Details</h1>
  <p>Everyday Checking · $2,500.00</p>
  <table data-testid="transaction-table">
    <caption>Recent transactions</caption>
    <thead><tr><th scope="col">Description</th><th scope="col">Amount</th></tr></thead>
    <tbody>
      <tr><td>Opening balance</td><td>$3,000.00</td></tr>
      <tr><td>Adventure supplies</td><td>-$500.00</td></tr>
    </tbody>
  </table>`
);

const styles = `
:root { color-scheme: light; font-family: system-ui, sans-serif; }
body { margin: 0 auto; max-width: 48rem; padding: 1.5rem; }
header { border-bottom: 1px solid #ccd2da; padding-bottom: 1rem; }
main { padding-block: 2rem; }
form { display: grid; gap: 0.75rem; max-width: 24rem; }
input, button { font: inherit; padding: 0.6rem; }
.button, button { background: #174ea6; border: 0; border-radius: 0.25rem; color: white; display: inline-block; padding: 0.65rem 1rem; }
table { border-collapse: collapse; width: 100%; }
th, td { border-bottom: 1px solid #ccd2da; padding: 0.6rem; text-align: left; }
[role="alert"] { color: #a40000; }
`;

const isAuthenticated = (request) => request.headers.cookie
  ?.split(';')
  .some((cookie) => cookie.trim() === SESSION_COOKIE) ?? false;

const readForm = async (request) => {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_FORM_BYTES) {
      throw new Error('Form body is too large');
    }
  }
  return new URLSearchParams(body);
};

const handleRequest = async (request, response) => {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', 'http://fixture.local');

  if (method === 'GET' && url.pathname === '/healthz') {
    send(response, 200, 'playwright-adventures-fixture', { 'content-type': 'text/plain; charset=utf-8' });
    return;
  }
  if (method === 'GET' && url.pathname === '/styles.css') {
    send(response, 200, styles, { 'content-type': 'text/css; charset=utf-8' });
    return;
  }
  if (method === 'GET' && url.pathname === '/') {
    send(response, 200, homePage);
    return;
  }
  if (method === 'GET' && url.pathname === '/login') {
    send(response, 200, loginPage());
    return;
  }
  if (method === 'POST' && url.pathname === '/login') {
    let form;
    try {
      form = await readForm(request);
    } catch {
      send(response, 413, page('Request rejected', '<h1>Request rejected</h1>'));
      return;
    }

    if (form.get('email') !== DEMO_EMAIL || form.get('password') !== DEMO_PASSWORD) {
      send(response, 401, loginPage(true));
      return;
    }

    redirect(response, '/dashboard', {
      'set-cookie': `${SESSION_COOKIE}; HttpOnly; Path=/; SameSite=Lax`
    });
    return;
  }
  if (method === 'GET' && url.pathname === '/dashboard') {
    if (!isAuthenticated(request)) {
      redirect(response, '/login');
      return;
    }
    send(response, 200, dashboardPage);
    return;
  }
  if (method === 'GET' && url.pathname === '/accounts/checking') {
    if (!isAuthenticated(request)) {
      redirect(response, '/login');
      return;
    }
    send(response, 200, accountDetailsPage);
    return;
  }

  send(response, 404, page('Not Found', '<h1>Not Found</h1>'));
};

export const createFixtureServer = () => http.createServer((request, response) => {
  void handleRequest(request, response).catch(() => {
    if (!response.headersSent) {
      send(response, 500, page('Server Error', '<h1>Server Error</h1>'));
    } else {
      response.destroy();
    }
  });
});

const parsePort = (value) => {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('FIXTURE_APP_PORT must be an integer from 1 to 65535');
  }
  return port;
};

export const startFixtureServer = ({
  host = process.env.FIXTURE_APP_HOST || 'localhost',
  port = parsePort(process.env.FIXTURE_APP_PORT || '3000')
} = {}) => {
  const server = createFixtureServer();
  server.listen(port, host, () => {
    console.error(`Managed fixture app listening at http://${host}:${port}`);
  });
  return server;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = startFixtureServer();
  const shutdown = () => server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
