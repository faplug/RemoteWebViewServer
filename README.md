# Remote WebView Server

> **This fork (faplug).** Trimmed variant used to drive a wall panel (ESP32-4848S040):
>
> - **~926 MB image instead of 2.57 GB** — only the Chromium headless shell is installed, Firefox/WebKit and the full Chromium are left out (see [SLIM.md](SLIM.md));
> - **serves the panel page itself** — the addon runs a tiny static server (`static.mjs`, port 8099) for `/data/panel`, because Home Assistant protects `/local/...` and the browser started by the addon has no session there;
> - **opens the page on start** — `reload_on_start.mjs` opens `start_url` (or reloads the open panel page) and pins the viewport to 480x480, so a restarted addon never leaves the display blank;
> - the upstream "Stand With Ukraine" banner is removed from this README.
>
> Everything else, including the tile protocol, is upstream `strange-v/RemoteWebViewServer`.

Headless browser that renders target web pages (e.g., Home Assistant dashboards) and streams them as image tiles over WebSocket to lightweight [clients](https://github.com/strange-v/RemoteWebViewClient) (ESP32 displays). The server supports multiple simultaneous clients, each with its own screen resolution, orientation, and per-device settings.

![Remote WebView](/images/tiled_preview.png)

## Features

- Renders pages in a headless Chromium environment and streams diffs as tiles over WebSocket.
- Tile merging with change detection to reduce packet count and CPU load
- Full-frame fallback on cadence/threshold or on demand
- Configurable tile size, JPEG quality, WS message size, and min frame interval
- Per-client settings: each connection can supply its own width, height, tileSize, jpegQuality, maxBytesPerMessage, etc.
- Hot reconfigure: reconnecting with new params reconfigures the device session and triggers a full-frame refresh.
- Smarter frame gating: throttling + content-hash dedup (skip identical frames)
- No viewers = no work: frames are ACKРІР‚в„ўd to keep Chromium streaming, but tiles arenРІР‚в„ўt encoded/queued when there are no listeners.
- Touch event bridging (down/move/up) РІР‚вЂќ scrolling supported (no gestures yet)
- Client-driven navigation: the client can control which page to open.
- Built-in self-test (open the `self-test` URL from the client): measures what the whole pipeline delivers, names the bottleneck (device, server CPU or network) and suggests `min_frame_interval`, `jpeg_quality` and `max_bytes_per_msg`
- Health endpoint for container orchestration
- Optional DevTools access via TCP proxy

## On-screen keyboard

The server does not include a built-in on-screen keyboard, but you can inject any external JavaScript file into every page it renders РІР‚вЂќ including a virtual keyboard of your choice.

- `INJECT_JS_URL` (empty by default): direct HTTPS URL to a JavaScript file. If set, the script is fetched once on startup and injected into every new page via `Page.addScriptToEvaluateOnNewDocument`.
- `INJECT_JS_ALLOW_HTTP` (`false` by default): allow plain HTTP URLs (HTTPS is strongly recommended).

> [!CAUTION]
>
> The injected script runs with full access to every page the server renders, including any active sessions, credentials, and cookies. Only use scripts from sources you fully trust. Never point this at a URL controlled by a third party.

## Accessing the serverРІР‚в„ўs tab with Chrome DevTools

1. Make sure your server exposes the DevTools (CDP) port (e.g., 9222).
   - If you use a pure Docker container, make sure you have configured and started `debug-proxy`
   - If HA OS addon is used, enable `expose_debug_proxy`
1. In Chrome, go to chrome://inspect/#devices РІвЂ вЂ™ ConfigureРІР‚В¦ РІвЂ вЂ™ add your host: hostname_or_ip:9222.
1. You should see the page the server opened (the one you want to log into, e.g., Home Assistant). Click inspect to open a full DevTools window for that tab.

## Image Tags & Versioning

- latest РІР‚вЂќ newest stable release
- beta РІР‚вЂќ newest pre-release (rolling)
- Semantic versions: X.Y.Z, plus convenience tags X.Y, X on stable releases

You can pin a stable release (`1.4.0`) or track channels (`latest`, `beta`) depending on your deployment strategy.

## Docker Compose Example

```yaml
services:
  rwvserver:
    image: strangev/remote-webview-server:latest  # use :beta for pre-release
    container_name: remote-webview-server
    restart: unless-stopped
    environment:
      TILE_SIZE: 32
      FULL_FRAME_TILE_COUNT: 4
      FULL_FRAME_AREA_THRESHOLD: 0.5
      FULL_FRAME_EVERY: 50
      EVERY_NTH_FRAME: 1
      MIN_FRAME_INTERVAL_MS: 80
      JPEG_QUALITY: 85
      MAX_BYTES_PER_MESSAGE: 14336
      WS_PORT: 8081
      DEBUG_PORT: 9221 # internal debug port
      HEALTH_PORT: 18080
      PREFERS_REDUCED_MOTION: false
      INJECT_JS_URL: "https://example.com/keyboard.js"
      INJECT_JS_ALLOW_HTTP: false
      USER_DATA_DIR: /pw-data
      BROWSER_LOCALE: "en-US"
    ports:
      - "8081:8081"                   # WebSocket stream
      - "9222:9222"                   # external DevTools via socat
    expose:
      - "18080"                       # health endpoint (internal)
      - "9221"                        # internal DevTools port
    volumes:
      - /opt/volumes/esp32-rdp/pw-data:/pw-data
    shm_size: 1gb
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:18080 || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 10s

  debug-proxy:
    image: alpine/socat
    container_name: remote-webview-server-debug
    restart: unless-stopped
    network_mode: "service:rwvserver"
    depends_on:
      rwvserver:
        condition: service_healthy
    command:
      - "-d"
      - "-d"
      - "TCP-LISTEN:9222,fork,reuseaddr,keepalive" # external DevTools port
      - "TCP:127.0.0.1:9221"
```
