// reload_on_start.mjs — после старта аддона приводит браузер в рабочее состояние:
//   1) если панель уже открыта — один раз перезагружает её;
//   2) если страницы панели нет — открывает START_URL (из настроек аддона)
//      и выставляет ей ровно 480x480, чтобы дисплей получил правильный кадр.
//
// Запускается из run.sh в фоне: node /reload_on_start.mjs
// Переменные: DEBUG_PORT (по умолчанию 9221), START_URL, PANEL_W/H (по умолчанию 480).

const PORT = Number(process.env.DEBUG_PORT || 9221);
const START_URL = (process.env.START_URL || '').trim();
const W = Number(process.env.PANEL_W || 480);
const H = Number(process.env.PANEL_H || 480);
const WAIT_MS = 180000;
const DEADLINE = Date.now() + WAIT_MS;
const MARK = '/local/panel/';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function listPages() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    if (!r.ok) return [];
    return (await r.json()).filter(t => t.type === 'page');
  } catch {
    return [];
  }
}

async function cdp(wsUrl, calls) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
    setTimeout(reject, 5000);
  });
  let id = 0;
  const out = {};
  for (const [method, params] of calls) {
    const myId = ++id;
    ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
    await new Promise(resolve => {
      const h = ev => {
        const m = JSON.parse(ev.data);
        if (m.id === myId) { ws.removeEventListener('message', h); out[method] = m.result || m.error; resolve(); }
      };
      ws.addEventListener('message', h);
      setTimeout(resolve, 5000);
    });
  }
  try { ws.close(); } catch {}
  return out;
}

async function ensureViewport(page) {
  await cdp(page.webSocketDebuggerUrl, [
    ['Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }],
  ]);
}

async function openPage(url) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

(async () => {
  console.log(`[reload-on-start] start, START_URL ${START_URL ? 'set' : 'empty'}`);
  while (Date.now() < DEADLINE) {
    const pages = await listPages();
    const panel = pages.find(p => p.url.includes(MARK));
    if (panel) {
      await ensureViewport(panel);
      await cdp(panel.webSocketDebuggerUrl, [['Page.navigate', { url: panel.url }]]);
      console.log(`[reload-on-start] reloaded ${panel.url.split('#')[0]}`);
      return;
    }
    if (START_URL) {
      const created = await openPage(START_URL);
      if (created && created.webSocketDebuggerUrl) {
        await ensureViewport(created);
        await sleep(1500);
        console.log(`[reload-on-start] opened ${START_URL.split('#')[0]}`);
        return;
      }
    }
    await sleep(3000);
  }
  console.log('[reload-on-start] gave up');
})();
