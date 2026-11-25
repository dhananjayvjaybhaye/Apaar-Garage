import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { makeAdmin, startStore } from '../../server/test/store-fixture.js';
import { eventually } from './form-browser.mjs';

export async function openAdminPreview(t, environment = {}) {
  const listener = createServer().listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise((done) => listener.close(done));
  const site = 'http://127.0.0.1:' + port;
  const api = await startStore(t, { CORS_ORIGINS: site, ...environment });
  await makeAdmin(api);
  const child = spawn(process.execPath, ['scripts/preview.mjs'], {
    env: { ...process.env, PREVIEW_API: api, PREVIEW_PORT: String(port) },
    stdio: 'inherit',
    windowsHide: true,
  });
  t.after(() => child.kill());
  await eventually('production preview', () =>
    fetch(site)
      .then((response) => response.ok)
      .catch(() => false),
  );
  return { site, api };
}
