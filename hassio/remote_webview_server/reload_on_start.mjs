// reload_on_start.mjs - один раз после старта аддона перезагружает страницу,
// которую клиент (панель) уже открыл. Лечит случай, когда после обрыва связи
// и рестарта сервера панель остаётся с мёртвой страницей.
//
// Запускается из run.sh в фоне: node /reload_on_start.mjs
// Ждёт появления страницы до 3 минут, делает Page.navigate на её же URL,
// затем выходит.

const PORT = Number(process.env.DEBUG_PORT || 9221);
const WAIT_MS = 180000;
const DEADLINE = Date.now() + WAIT_MS;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function listPages() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    if (!r.ok) return [];
    return (await r.json()).filter(t => t.type === "page" && /^https?:/.test(t.url));
  } catch {
    return [];
  }
}

async function reload(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
    setTimeout(reject, 5000);
  });
  ws.send(JSON.stringify({ id: 1, method: "Page.navigate", params: { url: page.url } }));
  await sleep(1500);
  try { ws.close(); } catch {}
}

(async () => {
  console.log(`[reload-on-start] waiting for a page (port ${PORT})`);
  while (Date.now() < DEADLINE) {
    const pages = await listPages();
    const panel = pages.find(p => p.url.includes("/local/panel/")) || pages[0];
    if (panel) {
      try {
        await reload(panel);
        console.log(`[reload-on-start] reloaded ${panel.url}`);
      } catch (e) {
        console.log(`[reload-on-start] reload failed: ${e && e.message}`);
      }
      return;
    }
    await sleep(3000);
  }
  console.log("[reload-on-start] no page appeared, giving up");
})();
