import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export async function eventually(label, check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await delay(200);
  }
  throw new Error('Timed out: ' + label);
}

export async function openFormBrowser(t) {
  const chrome =
    process.env.CHROME_BIN ??
    (process.platform === 'win32'
      ? join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe')
      : 'google-chrome');
  const profile = await mkdtemp(join(tmpdir(), 'apaar-form-chrome-'));
  let ws;
  const processHandle = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-crash-reporter',
      '--no-first-run',
      '--remote-debugging-port=0',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true },
  );
  let startupError;
  processHandle.on('error', (error) => {
    startupError = error;
  });
  t.after(async () => {
    ws?.close();
    if (processHandle.pid && processHandle.exitCode === null) {
      const closed = once(processHandle, 'exit');
      processHandle.kill();
      await closed;
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  let port;
  await eventually('Chrome debug port', async () => {
    if (startupError) throw startupError;
    const file = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '');
    port = file.split(/\r?\n/)[0];
    return port;
  });
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  ws = new WebSocket(targets.find(({ type }) => type === 'page').webSocketDebuggerUrl);
  await once(ws, 'open');
  let sequence = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const reply = JSON.parse(data);
    pending.get(reply.id)?.(reply);
    pending.delete(reply.id);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, ({ result, error }) =>
        error ? reject(new Error(error.message)) : resolve(result),
      );
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) throw new Error(result.description ?? exceptionDetails.text);
    return result.value;
  };
  return {
    evaluate,
    navigate: (url) => send('Page.navigate', { url }),
    async pressKey(key) {
      const keyCode = { Tab: 9, Enter: 13 }[key];
      if (!keyCode) throw new Error('Unsupported browser test key: ' + key);
      const input = { key, code: key, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
      await send('Input.dispatchKeyEvent', { type: 'keyDown', ...input });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...input });
    },
    resize: (width, height) =>
      send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      }),
  };
}
