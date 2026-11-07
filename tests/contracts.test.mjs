import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('database schema covers the complete matchmaking lifecycle', async () => {
  const schema = await read('scripts/schema.sql');
  for (const table of ['users', 'sessions', 'rooms', 'participants', 'messages', 'signals', 'choices', 'matches', 'bans', 'reports']) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(schema, /CHECK\(capacity IN \(4,6\)\)/);
  assert.match(schema, /CHECK\(stage BETWEEN 0 AND 4\)/);
  assert.match(schema, /CHECK\(user_id<>target_id\)/);
  assert.match(schema, /audio_enabled boolean NOT NULL DEFAULT false/);
  assert.match(schema, /video_enabled boolean NOT NULL DEFAULT false/);
});

test('Cloudflare production uses D1 with the complete schema and no database secret', async () => {
  const schema = await read('migrations/0001_init.sql');
  const config = await read('cloudflare.config.ts');
  const adapter = await read('lib/db.d1.ts');
  for (const table of ['users', 'sessions', 'rooms', 'participants', 'messages', 'signals', 'choices', 'matches', 'bans', 'reports', 'rate_limits']) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(config, /DB: bindings\.d1/);
  assert.doesNotMatch(config, /DATABASE_URL/);
  assert.match(config, /love\.ifeng-wang\.com/);
  assert.match(adapter, /from 'cloudflare:workers'/);
  assert.match(adapter, /env\.DB\.prepare/);
});

test('WebRTC client includes queued ICE, restart and bitrate control', async () => {
  const rtc = await read('lib/rtc.ts');
  assert.match(rtc, /pending:RTCIceCandidateInit\[\]/);
  assert.match(rtc, /createOffer\(\{iceRestart:restart\}\)/);
  assert.match(rtc, /maxBitrate=800000/);
  assert.match(rtc, /addTransceiver/);
});

test('room API transfers or clears host ownership on departure', async () => {
  const api = await read('lib/api.ts');
  assert.match(api, /ORDER BY joined_at LIMIT 1/);
  assert.match(api, /SET host_id=NULL,stage=0/);
  assert.match(api, /role=CASE WHEN user_id=\$2 THEN 'host'/);
});

test('room rules expose only 4 or 6 seat gender-special sessions', async () => {
  const api = await read('lib/api.ts');
  assert.match(api, /z\.enum\(\['男生专场','女生专场'\]\)/);
  assert.match(api, /z\.union\(\[z\.literal\(4\),z\.literal\(6\)\]\)/);
  assert.match(api, /featuredGender=room\.mode==='男生专场'\?'male':'female'/);
  assert.match(api, /p\.role='guest'/);
  assert.match(api, /只能操作自己的心动灯或异性的心动灯/);
  assert.match(api, /主嘉宾没有心动灯/);
  assert.match(api, /action==='media-all'/);
  assert.match(api, /只有主持人可以控制全场音视频/);
  assert.match(api, /role='guest'/);
  assert.match(api, /只有本人或主持人可以控制音视频/);
});

test('container is unprivileged and exposes only the web application', async () => {
  const dockerfile = await read('Dockerfile');
  const compose = await read('compose.yaml');
  assert.match(dockerfile, /USER nextjs/);
  assert.match(compose, /0\.0\.0\.0:\$\{APP_PORT:-3210\}:3000/);
  assert.doesNotMatch(compose, /5432:5432/);
  assert.match(compose, /condition: service_healthy/);
});

test('mobile navigation and secure media permissions are explicit', async () => {
  const css = await read('app/globals.css');
  const config = await read('next.config.ts');
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(config, /camera=\(self\), microphone=\(self\)/);
});

test('television header and participant controls follow the room permission model', async () => {
  const room = await read('components/room.tsx');
  const css = await read('app/globals.css');
  const title = room.indexOf('className="room-summary"');
  const host = room.indexOf('className="moderator-menu-wrap"');
  const stages = room.indexOf('className="header-stage-progress"');
  const actions = room.indexOf('className="theater-actions"');
  assert.ok(title < host && host < stages && stages < actions);
  for (const key of ["t('muteAll')", "t('unmuteAll')", "t('cameraAllOff')", "t('cameraAllOn')"]) assert.match(room, new RegExp(key.replace(/[()']/g,'\\$&')));
  for (const icon of ['MaleSilhouetteIcon', 'FemaleSilhouetteIcon', 'KickGuestIcon', 'Mic', 'Video']) assert.match(room, new RegExp(`<${icon}`));
  assert.doesNotMatch(room, /<Info/);
  assert.match(room, /className="tile-person-button" onClick=\{onProfile\}/);
  assert.match(room, /import\('qrcode'\)/);
  assert.match(room, /<LanguageMenu className="room-language"\/>/);
  assert.match(room, /className=\{'tile-lamp /);
  assert.match(room, /<LogOut size=\{20\}/);
  assert.match(css, /flex-wrap:nowrap/);
  assert.match(css, /\.tile-lamp\{position:absolute/);
  assert.match(css, /\.tile-lamp\{left:-2px;top:-2px\}/);
  assert.match(css, /\.tile-lamp\{left:4px;top:4px\}/);
});

test('international language menu supports Chinese, English, Japanese and Korean', async () => {
  const i18n = await read('components/i18n.tsx');
  const shell = await read('components/shell.tsx');
  const room = await read('components/room.tsx');
  assert.match(i18n, /'zh-CN','en','ja','ko'/);
  assert.match(i18n, /xinyu\.locale\.v1/);
  assert.match(i18n, /🇨🇳/);assert.match(i18n, /🇺🇸/);assert.match(i18n, /🇯🇵/);assert.match(i18n, /🇰🇷/);
  assert.match(shell, /<LanguageMenu\/>/);
  assert.match(room, /<LanguageMenu className="room-language"\/>/);
});

test('sidebar is collapsible and rooms default to a full-width mobile workspace', async () => {
  const shell = await read('components/shell.tsx');
  const room = await read('components/room.tsx');
  const css = await read('app/globals.css');
  assert.match(shell, /useState\(\(\)=>!path\.startsWith\('\/rooms\/'\)\)/);
  assert.match(shell, /className="menu-toggle"/);
  assert.match(shell, /xinyu:toggle-sidebar/);
  assert.match(room, /xinyu:set-sidebar/);
  assert.match(room, /className="room-menu-toggle"/);
  assert.match(css, /\.app-shell\.sidebar-closed \.main-shell\{margin-left:0\}/);
  assert.match(css, /\.live-layout\.chat-open \.chat-panel\{width:100%;max-width:100%\}/);
});

test('mobile chat splits the viewport and video tiles support double-click expansion', async () => {
  const room = await read('components/room.tsx');
  const css = await read('app/globals.css');
  assert.match(room, /const \[expandedSlot,setExpandedSlot\]=useState<string\|null>\(null\)/);
  assert.match(room, /onDoubleClick=/);
  assert.match(room, /tile-viewport-expanded/);
  assert.match(room, /event\.key==='Escape'/);
  assert.match(css, /height:50%;min-height:0;max-height:50%;flex:0 0 50%/);
  assert.match(css, /position:fixed!important;inset:0!important;z-index:100!important/);
});
