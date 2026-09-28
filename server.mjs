import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server as SocketIOServer } from 'socket.io';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8000);
const HOST = '0.0.0.0';
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, 'data');
const SESSION_COOKIE = 'auction_session';
const SESSION_ID_RE = /^[a-f0-9]{24}$/i;

const defaultConfig = {
  tiktokUsername: '',
  eulerApiKey: '',
  regularSeconds: 30,
  snipeSeconds: 10,
  drawSeconds: 30,
  minimumCoins: 0,
  drawMarginCoins: 0,
  prize: 'Prize #1',
  autoSave: false
};

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: true } });
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

function createSession(sessionId, overlayToken, loadedConfig = {}) {
const sessionFile = path.join(DATA_DIR, 'sessions', `${sessionId}.json`);
let config = { ...defaultConfig, ...(loadedConfig || {}) };
config.prize = String(config.prize ?? defaultConfig.prize);
if (!config.eulerApiKey) config.eulerApiKey = '';
let activeConnectConfig = null;
const room = `auction:${sessionId}`;

let connection = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let connectionState = { status: 'disconnected', roomId: null, message: 'Not connected' };
let lastConnectionError = null;
let connectionRequested = false;
let chatLog = [];
let eventLog = [];

const state = {
  phase: 'idle',
  auctionId: 0,
  phaseEndsAt: 0,
  startedAt: 0,
  participants: new Map(),
  winner: null,
  drawStartedAt: 0,
  lastGiftAt: 0,
  winnerChat: ''
};

// Anti-duplicate bookkeeping. These maps are reset for every new auction.
const streakProgress = new Map();
const processedFingerprints = new Map();
const seenMessageIds = new Map();
// Keep the connector's repeatCount baseline across auction rounds so a streak
// that was still open when the previous round ended cannot make the next round
// start at the old total (e.g. 100 -> 101 instead of 1).
const streakBaselines = new Map();

function clampInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function sanitizeConfig(input) {
  return {
    tiktokUsername: String(input.tiktokUsername ?? '').trim().replace(/^@+/, ''),
    // Keep the previously saved key when the dashboard submits an empty key field.
    eulerApiKey: String(input.eulerApiKey ?? config.eulerApiKey ?? '').trim(),
    regularSeconds: clampInt(input.regularSeconds, 1, 86400),
    snipeSeconds: clampInt(input.snipeSeconds, 1, 86400),
    drawSeconds: clampInt(input.drawSeconds, 1, 86400),
    minimumCoins: clampInt(input.minimumCoins, 0, 10_000_000_000),
    drawMarginCoins: clampInt(input.drawMarginCoins, 0, 1_000_000),
    prize: String(input.prize ?? input.prizes?.['1'] ?? '').trim(),
    autoSave: Boolean(input.autoSave)
  };
}

async function saveConfig() {
  await fs.mkdir(path.dirname(sessionFile), { recursive: true });
  const persisted = { ...config, controlId: sessionId, overlayToken };
  await fs.writeFile(sessionFile, JSON.stringify(persisted, null, 2), 'utf8');
}

function normalizeAvatar(user) {
  const candidates = [
    user?.avatarThumb?.urlList?.[0],
    user?.avatarThumb?.url_list?.[0],
    user?.avatarLarger?.urlList?.[0],
    user?.avatarMedium?.urlList?.[0],
    user?.profilePicture?.urlList?.[0],
    user?.profilePicture?.urls?.[0],
    user?.profilePic?.urlList?.[0]
  ].filter(Boolean);
  return candidates[0] || '';
}


function normalizeIdentity(value) {
  return String(value ?? '').trim().replace(/^@+/, '').toLowerCase();
}

function chatPayload(data) {
  const user = data?.user || data?.userInfo || data?.sender || {};
  const userId = String(
    user?.userId ?? user?.user_id ?? data?.userId ?? data?.user_id ?? user?.id ?? ''
  ).trim();
  const uniqueId = String(
    user?.uniqueId ?? user?.unique_id ?? data?.uniqueId ?? data?.unique_id ?? user?.displayId ?? user?.username ?? ''
  ).trim();
  const nickname = String(
    user?.nickname ?? user?.displayName ?? data?.nickname ?? uniqueId ?? userId ?? 'Unknown'
  ).trim();
  const comment = String(
    data?.comment ?? data?.text ?? data?.content ?? data?.message ?? ''
  );
  return {
    time: Date.now(),
    userId,
    uniqueId,
    nickname,
    avatar: normalizeAvatar(user),
    comment
  };
}

function sameChatUser(a, b) {
  if (!a || !b) return false;
  const aUserId = normalizeIdentity(a.userId);
  const bUserId = normalizeIdentity(b.userId);
  if (aUserId && bUserId && aUserId === bUserId) return true;
  const aUnique = normalizeIdentity(a.uniqueId);
  const bUnique = normalizeIdentity(b.uniqueId);
  if (aUnique && bUnique && aUnique === bUnique) return true;
  const aNick = normalizeIdentity(a.nickname);
  const bNick = normalizeIdentity(b.nickname);
  if (aNick && bNick && aNick === bNick) return true;
  return false;
}

function primeWinnerChat() {
  state.winnerChat = '';
  if (!state.winner || !state.startedAt) return;
  for (let i = chatLog.length - 1; i >= 0; i -= 1) {
    const chat = chatLog[i];
    if (Number(chat?.time || 0) < state.startedAt) break;
    if (sameChatUser(state.winner, chat) && String(chat?.comment || '').trim()) {
      state.winnerChat = String(chat.comment).trim();
      break;
    }
  }
}

function participantPayload(p) {
  return {
    userId: p.userId,
    uniqueId: p.uniqueId,
    nickname: p.nickname,
    avatar: p.avatar || '',
    coins: p.coins,
    lastGiftAt: p.lastGiftAt
  };
}

function leaderboard() {
  return [...state.participants.values()]
    .filter((p) => p.coins >= config.minimumCoins)
    .sort((a, b) => b.coins - a.coins || b.lastGiftAt - a.lastGiftAt)
    .slice(0, 3)
    .map(participantPayload);
}

function leaderByRank() {
  return leaderboard();
}

function safeWinner(w) {
  return w ? participantPayload(w) : null;
}

function publicState() {
  const publicConfig = { ...config, eulerApiKey: '' , eulerApiKeyConfigured: Boolean(config.eulerApiKey) };
  return {
    sessionId,
    overlayToken,
    phase: state.phase,
    auctionId: state.auctionId,
    phaseEndsAt: state.phaseEndsAt,
    serverNow: Date.now(),
    remainingMs: Math.max(0, state.phaseEndsAt ? state.phaseEndsAt - Date.now() : 0),
    leaderboard: leaderboard(),
    winner: safeWinner(state.winner),
    winnerChat: state.winnerChat || '',
    prize: config.prize || '',
    config: publicConfig,
    connection: connectionState,
    eventLog: eventLog.slice(-40),
    chatLog: chatLog.slice(-60),
    isRunning: state.phase !== 'idle' && state.phase !== 'finished'
  };
}

function broadcast() {
  io.to(room).emit('auction:state', publicState());
}

function addEventLog(entry) {
  eventLog.push({ ...entry, time: Date.now() });
  if (eventLog.length > 120) eventLog = eventLog.slice(-120);
}

function getGiftCoins(data) {
  const direct = [
    data?.giftDetails?.diamondCount,
    data?.extendedGiftInfo?.diamondCount,
    data?.gift?.diamondCount,
    data?.diamondCount,
    data?.giftDetails?.diamond_count,
    data?.gift?.diamond_count
  ];
  for (const v of direct) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function getGiftType(data) {
  return Number(data?.giftDetails?.giftType ?? data?.giftDetails?.gift_type ?? data?.giftType ?? data?.gift?.type ?? 0);
}

function getGiftName(data) {
  return data?.giftDetails?.giftName || data?.giftDetails?.gift_name || data?.gift?.name || `Gift #${data?.giftId ?? '?'}`;
}

function getEventId(data) {
  return data?.msgId ?? data?.messageId ?? data?.eventId ?? data?.giftExtra?.messageId ?? null;
}

function getEventTimestamp(data) {
  const raw = data?.timestamp ?? data?.giftExtra?.timestamp ?? data?.eventTimestamp ?? null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  // TikTok fields have appeared as microseconds/milliseconds depending on version.
  if (n > 1e14) return Math.floor(n / 1000);
  if (n < 1e12) return n * 1000;
  return n;
}

function participantFromGift(data) {
  const user = data?.user || {};
  const userId = String(user.userId ?? user.id ?? user.uniqueId ?? 'unknown');
  const uniqueId = String(user.uniqueId ?? user.displayId ?? user.nickname ?? userId);
  const nickname = String(user.nickname ?? uniqueId);
  return {
    key: userId,
    userId,
    uniqueId,
    nickname,
    avatar: normalizeAvatar(user)
  };
}

function isAuctionAcceptingGifts() {
  return ['regular', 'snipe', 'draw'].includes(state.phase);
}

function ensureParticipant(data) {
  const base = participantFromGift(data);
  let p = state.participants.get(base.key);
  if (!p) {
    p = { ...base, coins: 0, lastGiftAt: 0 };
    state.participants.set(base.key, p);
  } else {
    p.uniqueId = base.uniqueId || p.uniqueId;
    p.nickname = base.nickname || p.nickname;
    p.avatar = base.avatar || p.avatar;
  }
  return p;
}

function applyCoins(data, coins, extra) {
  if (!coins || coins <= 0 || !isAuctionAcceptingGifts()) return false;
  const p = ensureParticipant(data);
  p.coins += Math.floor(coins);
  p.lastGiftAt = getEventTimestamp(data);
  state.lastGiftAt = p.lastGiftAt;
  addEventLog({
    type: 'gift',
    user: p.nickname,
    uniqueId: p.uniqueId,
    coins: Math.floor(coins),
    giftName: getGiftName(data),
    repeatCount: Number(data?.repeatCount || 1),
    phase: state.phase,
    ...extra
  });
  broadcast();
  return true;
}

function handleGift(data) {
  if (!isAuctionAcceptingGifts()) return;
  const giftCoins = getGiftCoins(data);
  if (!giftCoins) return;

  const user = data?.user;
  const userKey = String(user?.userId ?? user?.uniqueId ?? user?.nickname ?? 'unknown');
  const giftId = String(data?.giftId ?? data?.giftDetails?.giftId ?? getGiftName(data));
  const giftType = getGiftType(data);
  const repeatCount = Math.max(1, Number(data?.repeatCount ?? 1));
  const eventId = getEventId(data);
  const eventTimestamp = getEventTimestamp(data);

  // Do not let a gift packet from the previous round arrive late and seed the
  // freshly-reset leaderboard. A small clock tolerance keeps legitimate packets.
  if (state.startedAt && eventTimestamp < state.startedAt - 5_000) return;

  if (eventId != null) {
    const idKey = String(eventId);
    const seen = seenMessageIds.get(idKey);
    if (seen) return;
    seenMessageIds.set(idKey, Date.now());
  }

  // Streakable gifts: count only the repeatCount delta. The baseline survives
  // an auction restart for a short time, which prevents an open TikTok streak
  // from turning a new round's first gift into the previous round's total.
  if (giftType === 1) {
    const key = `${userKey}:${giftId}`;
    const now = Date.now();
    const previous = streakBaselines.get(key);
    const baseline = previous && now - previous.lastSeen <= 12_000 ? previous.count : 0;
    if (repeatCount <= baseline) return;
    const delta = repeatCount - baseline;
    streakBaselines.set(key, { count: repeatCount, lastSeen: now });
    streakProgress.set(key, now);
    applyCoins(data, giftCoins * delta, { streak: true, repeatEnd: Boolean(data?.repeatEnd) });
    if (data?.repeatEnd) {
      // The final repeat value remains only as a short-lived duplicate guard.
      streakBaselines.set(key, { count: repeatCount, lastSeen: now });
    }
    return;
  }

  // Non-streak gifts: prefer a real message id. When the connector has no id,
  // use the event timestamp in the fingerprint and only suppress the exact same
  // fingerprint for a short window.
  const fingerprint = `${userKey}:${giftId}:${repeatCount}:${eventTimestamp}`;
  const previousAt = processedFingerprints.get(fingerprint);
  if (previousAt && Date.now() - previousAt < 5000) return;
  processedFingerprints.set(fingerprint, Date.now());
  applyCoins(data, giftCoins * repeatCount, { streak: false, repeatEnd: true });
}

function finalizeWinner() {
  const top = leaderByRank();
  const first = top[0];
  const second = top[1];
  if (!first) {
    state.winner = null;
    state.phase = 'finished';
    state.phaseEndsAt = 0;
    addEventLog({ type: 'finished', message: 'No qualifying bidders.' });
    broadcast();
    return;
  }
  const diff = second ? first.coins - second.coins : Infinity;
  if (second && diff <= config.drawMarginCoins) {
    state.phase = 'draw';
    state.drawStartedAt = Date.now();
    state.phaseEndsAt = Date.now() + config.drawSeconds * 1000;
    addEventLog({ type: 'phase', phase: 'draw', message: `Draw started (${diff} coin gap).` });
    broadcast();
    return;
  }
  state.winner = state.participants.get(first.userId) || first;
  primeWinnerChat();
  state.phase = 'finished';
  state.phaseEndsAt = 0;
  addEventLog({ type: 'winner', winner: first.nickname, coins: first.coins });
  broadcast();
}

function finishDraw() {
  const top = leaderByRank();
  const first = top[0];
  const second = top[1];
  if (!first) {
    state.winner = null;
  } else if (!second) {
    state.winner = state.participants.get(first.userId) || first;
  } else {
    const diff = first.coins - second.coins;
    if (diff <= config.drawMarginCoins) {
      state.winner = null;
      addEventLog({ type: 'draw', message: 'Still tied after draw period.' });
    } else {
      state.winner = state.participants.get(first.userId) || first;
      primeWinnerChat();
      addEventLog({ type: 'winner', winner: first.nickname, coins: first.coins, afterDraw: true });
    }
  }
  if (state.winner) primeWinnerChat();
  state.phase = 'finished';
  state.phaseEndsAt = 0;
  broadcast();
}

function startAuction() {
  state.auctionId += 1;
  state.participants.clear();
  state.winner = null;
  state.winnerChat = '';
  state.phase = 'regular';
  state.startedAt = Date.now();
  state.phaseEndsAt = state.startedAt + config.regularSeconds * 1000;
  state.drawStartedAt = 0;
  state.lastGiftAt = 0;
  streakProgress.clear();
  processedFingerprints.clear();
  seenMessageIds.clear();
  eventLog = [];
  addEventLog({ type: 'auction', message: 'Auction started.', auctionId: state.auctionId });
  broadcast();
}

function resetAuction() {
  state.phase = 'idle';
  state.phaseEndsAt = 0;
  state.startedAt = 0;
  state.participants.clear();
  state.winner = null;
  state.winnerChat = '';
  state.drawStartedAt = 0;
  state.lastGiftAt = 0;
  streakProgress.clear();
  processedFingerprints.clear();
  seenMessageIds.clear();
  eventLog = [];
  broadcast();
}

function phaseTicker() {
  if (state.phase === 'regular' && Date.now() >= state.phaseEndsAt) {
    state.phase = 'snipe';
    state.phaseEndsAt = Date.now() + config.snipeSeconds * 1000;
    addEventLog({ type: 'phase', phase: 'snipe', message: 'Snipe phase started.' });
    broadcast();
  } else if (state.phase === 'snipe' && Date.now() >= state.phaseEndsAt) {
    finalizeWinner();
  } else if (state.phase === 'draw' && Date.now() >= state.phaseEndsAt) {
    finishDraw();
  } else if (state.phase === 'idle' || state.phase === 'finished') {
    // no-op
  } else {
    io.to(room).emit('auction:tick', { phase: state.phase, phaseEndsAt: state.phaseEndsAt, serverNow: Date.now() });
  }
}
function tick() {
  phaseTicker();
}

function maintenance() {
  const now = Date.now();
  for (const [k, v] of seenMessageIds) if (now - v > 60_000) seenMessageIds.delete(k);
  for (const [k, v] of processedFingerprints) if (now - v > 60_000) processedFingerprints.delete(k);
  for (const [k, v] of streakBaselines) if (now - v.lastSeen > 15_000) streakBaselines.delete(k);
  if (streakProgress.size > 5000) streakProgress.clear();
  if (streakBaselines.size > 5000) streakBaselines.clear();
}

function normalizeErrorDetail(err, depth = 0) {
  if (!err || depth > 4) return '';
  const parts = [];
  if (err.name) parts.push(String(err.name));
  if (err.message) parts.push(String(err.message));
  const requestErr = err.requestErr || err.cause;
  if (requestErr && requestErr !== err) {
    const nested = normalizeErrorDetail(requestErr, depth + 1);
    if (nested) parts.push(`cause: ${nested}`);
  }
  if (Array.isArray(err.errors)) {
    for (const child of err.errors.slice(0, 6)) {
      const nested = normalizeErrorDetail(child, depth + 1);
      if (nested) parts.push(nested);
    }
  }
  return [...new Set(parts)].join(' | ');
}

function buildConnectionErrorMessage(err, username) {
  const raw = normalizeErrorDetail(err) || String(err);
  if (/Unexpected server response: 200|handshake-status.*417|illegal app_id/i.test(raw)) {
    return `${raw} — WebSocket handshake appears blocked by TikTok/network. Try another network or VPN.`;
  }
  if (/user_not_found|404000|not currently live|offline/i.test(raw)) {
    return `${raw} — TikTok's room lookup currently reports @${username} as unavailable/offline. If the LIVE is visible in TikTok, this is a room-id lookup problem rather than a username typo.`;
  }
  if (/rate_limit_|rate.?limit|too many|429/i.test(raw)) {
    return `${raw} — Euler Stream sign-server rate limit. Automatic reconnect is paused so the limit is not consumed further.`;
  }
  if (/403|Forbidden/i.test(raw)) {
    return `${raw} — Euler/TikTok rejected the request. Check that the Euler API key is valid and active.`;
  }
  return raw;
}

async function connectTikTok({ manual = false } = {}) {
  if (manual) {
    connectionRequested = true;
    activeConnectConfig = {
      tiktokUsername: String(config.tiktokUsername || '').trim().replace(/^@+/, ''),
      eulerApiKey: String(config.eulerApiKey || '').trim()
    };
    reconnectAttempt = 0;
    lastConnectionError = null;
  }
  if (!activeConnectConfig) {
    activeConnectConfig = {
      tiktokUsername: String(config.tiktokUsername || '').trim().replace(/^@+/, ''),
      eulerApiKey: String(config.eulerApiKey || '').trim()
    };
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (connection) {
    try { await connection?.disconnect?.(); } catch {}
    connection = null;
  }
  const username = String(activeConnectConfig.tiktokUsername || '').trim().replace(/^@+/, '');
  if (!username) {
    connectionState = { status: 'disconnected', roomId: null, message: 'Set a TikTok username first.' };
    broadcast();
    return;
  }

  const eulerApiKey = String(activeConnectConfig.eulerApiKey || '').trim();
  if (!eulerApiKey) {
    connectionState = {
      status: 'disconnected',
      roomId: null,
      message: 'Euler Stream API key required. Create a free key and save it above.'
    };
    broadcast();
    return;
  }

  connectionState = { status: 'connecting', roomId: null, message: `Connecting to @${username} using Euler API key…` };
  broadcast();

  try {
    // Keep the connection path as light as possible. Extended gift info performs
    // an extra gift-catalog request during connect and can be rejected by TikTok
    // (403) even when the live WebSocket itself is usable. The gift event already
    // contains diamondCount/giftName in the connector payload, which is enough for
    // the auction.
    const client = new TikTokLiveConnection(username, {
      enableExtendedGiftInfo: false,
      processInitialData: false,
      fetchRoomInfoOnConnect: true,
      signApiKey: eulerApiKey
    });

    connection = client;

    client.on(ControlEvent.CONNECTED, (info) => {
      reconnectAttempt = 0;
      lastConnectionError = null;
      connectionState = { status: 'connected', roomId: info?.roomId ?? null, message: `Connected to @${username}` };
      broadcast();
    });
    client.on(ControlEvent.DISCONNECTED, ({ code, reason } = {}) => {
      connectionState = { status: 'disconnected', roomId: null, message: `Disconnected${code ? ` (${code})` : ''}${reason ? `: ${reason}` : ''}` };
      broadcast();
      if (connection === client && connectionRequested) scheduleReconnect();
    });
    client.on(ControlEvent.ERROR, ({ info, exception } = {}) => {
      const ex = exception instanceof Error ? exception : null;
      const detail = ex?.message || (exception ? String(exception) : '');
      const message = [info ? String(info) : '', detail].filter(Boolean).join(' — ') || 'TikTok connection error';
      connectionState = { status: 'error', roomId: connectionState.roomId, message };
      addEventLog({ type: 'connection-error', message });
      broadcast();
    });
    client.on(WebcastEvent.GIFT, handleGift);
    client.on(WebcastEvent.CHAT, (data) => {
      const chat = chatPayload(data);
      chatLog.push(chat);
      if (chatLog.length > 200) chatLog = chatLog.slice(-200);
      io.to(room).emit('chat:message', chat);

      // Winner Chat is resolved server-side so the overlay does not have to
      // guess which TikTok user fields are present in every connector event.
      if (state.phase === 'finished' && state.winner && chat.comment.trim() && sameChatUser(state.winner, chat)) {
        state.winnerChat = chat.comment.trim();
        io.to(room).emit('winner:chat', {
          userId: chat.userId,
          uniqueId: chat.uniqueId,
          nickname: chat.nickname,
          avatar: chat.avatar || state.winner?.avatar || '',
          comment: state.winnerChat,
          time: chat.time
        });
        broadcast();
      }
    });

    try {
      // Resolve the room explicitly first. This gives us a useful error when the
      // account is offline and avoids hiding room lookup failures inside connect().
      const roomId = await client.fetchRoomId(username);
      if (!roomId) throw new Error(`Cannot resolve LIVE room for @${username}. Make sure the account is LIVE and the username is correct.`);
      await client.connect(roomId);
    } catch (err) {
      reconnectAttempt += 1;
      const message = buildConnectionErrorMessage(err, username);
      lastConnectionError = { time: Date.now(), username, message };
      connectionState = { status: 'error', roomId: null, message };
      addEventLog({ type: 'connection-error', message });
      broadcast();
      if (connectionRequested && !/rate_limit_|rate.?limit|too many|429/i.test(message)) scheduleReconnect();
    }
  } catch (err) {
    reconnectAttempt += 1;
    const message = buildConnectionErrorMessage(err, username);
    lastConnectionError = { time: Date.now(), username, message };
    connectionState = { status: 'error', roomId: null, message };
    addEventLog({ type: 'connection-error', message });
    broadcast();
    if (connectionRequested && !/rate_limit_|rate.?limit|too many|429/i.test(message)) scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer || !activeConnectConfig?.tiktokUsername || !activeConnectConfig?.eulerApiKey) return;
  // Room-id failures can be caused by temporary TikTok/network throttling.
  // Back off aggressively instead of hammering the same endpoints every few seconds.
  const delays = [30_000, 60_000, 120_000, 240_000, 300_000];
  const delay = delays[Math.min(reconnectAttempt - 1, delays.length - 1)] || 300_000;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectTikTok();
  }, delay);
}



function demoGift(body = {}) {
  if (!isAuctionAcceptingGifts()) return { ok: false, error: 'Auction is not accepting gifts.' };
  const name = String(body.name || 'DemoUser');
  const coins = Math.max(1, Math.floor(Number(body.coins) || 1));
  const repeatCount = Math.max(1, Math.floor(Number(body.repeatCount) || 1));
  const fake = {
    user: {
      userId: `demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      uniqueId: name.toLowerCase().replace(/\s+/g, '_'),
      nickname: name,
      profilePicture: { urls: [] }
    },
    giftId: 999,
    giftDetails: { giftName: 'Demo Gift', giftType: 2, diamondCount: coins },
    repeatCount,
    repeatEnd: true,
    giftExtra: { timestamp: Date.now() }
  };
  applyCoins(fake, coins * repeatCount, { demo: true, streak: false, repeatEnd: true });
  return { ok: true };
}

return {
  id: sessionId,
  overlayToken,
  room,
  publicState,
  broadcast,
  connectTikTok,
  startAuction,
  resetAuction,
  demoGift,
  saveConfig,
  tick,
  maintenance,
  get config() { return config; },
  get connection() { return connection; },
  get connectionState() { return connectionState; },
  get phase() { return state.phase; }
};

}


const sessions = new Map();
const overlayIndex = new Map();

function validSessionId(value) {
  return SESSION_ID_RE.test(String(value || ''));
}

function newToken() {
  return crypto.randomBytes(12).toString('hex');
}

function parseCookies(req) {
  const out = {};
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = value;
  }
  return out;
}

function cookieOptions(req) {
  const secure = String(req.headers['x-forwarded-proto'] || req.protocol || '') === 'https' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}

function setSessionCookie(res, req, sessionId) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; ${cookieOptions(req)}`);
}

async function readSessionFile(sessionId) {
  const file = path.join(DATA_DIR, 'sessions', `${sessionId}.json`);
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return parsed;
  } catch {
    return null;
  }
}

async function loadPersistedSession(sessionId) {
  const parsed = await readSessionFile(sessionId);
  if (!parsed) return null;
  const overlayToken = String(parsed.overlayToken || '').trim().toLowerCase();
  const config = {
    ...defaultConfig,
    ...parsed,
    prize: String(parsed?.prize ?? defaultConfig.prize)
  };
  delete config.controlId;
  delete config.overlayToken;
  return {
    overlayToken: SESSION_ID_RE.test(overlayToken) ? overlayToken : newToken(),
    config
  };
}

async function getOrCreateSession(sessionId) {
  if (!validSessionId(sessionId)) return null;
  let session = sessions.get(sessionId);
  if (session) return session;
  const persisted = await loadPersistedSession(sessionId);
  const overlayToken = persisted?.overlayToken || newToken();
  session = createSession(sessionId, overlayToken, persisted?.config || defaultConfig);
  sessions.set(sessionId, session);
  overlayIndex.set(overlayToken, sessionId);
  return session;
}

async function getSessionByOverlayToken(token) {
  const normalized = String(token || '').trim().toLowerCase();
  if (!validSessionId(normalized)) return null;
  const knownId = overlayIndex.get(normalized);
  if (knownId) return getOrCreateSession(knownId);

  const dir = path.join(DATA_DIR, 'sessions');
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const controlId = entry.name.slice(0, -5);
      if (!validSessionId(controlId)) continue;
      const parsed = JSON.parse(await fs.readFile(path.join(dir, entry.name), 'utf8'));
      if (String(parsed?.overlayToken || '').trim().toLowerCase() === normalized) {
        const session = await getOrCreateSession(controlId);
        overlayIndex.set(normalized, controlId);
        return session;
      }
    }
  } catch {}
  return null;
}

async function createNewSession() {
  const id = newToken();
  const overlayToken = newToken();
  const session = createSession(id, overlayToken, { ...defaultConfig });
  sessions.set(id, session);
  overlayIndex.set(overlayToken, id);
  return session;
}

async function controlSession(req, res, explicitId = '') {
  const candidate = explicitId || parseCookies(req)[SESSION_COOKIE] || '';
  let session = await getOrCreateSession(candidate);
  if (!session) session = await createNewSession();
  setSessionCookie(res, req, session.id);
  return session;
}

async function routeControlSession(req) {
  const cookieId = parseCookies(req)[SESSION_COOKIE] || '';
  return getOrCreateSession(cookieId);
}

app.get('/api/health', (req, res) => res.json({
  ok: true,
  service: 'tiktok-auction-overlay',
  port: Number(PORT),
  sessionsInMemory: sessions.size
}));

app.get('/api/session', async (req, res) => {
  const session = await controlSession(req, res);
  res.json({
    sessionId: session.id,
    overlayToken: session.overlayToken,
    controlUrl: `/control/${session.id}`,
    overlayUrl: `/overlay/${session.overlayToken}`
  });
});

app.get('/api/state', async (req, res) => {
  const session = await routeControlSession(req);
  if (!session) return res.status(401).json({ error: 'Session not found. Open your control URL again.' });
  res.json(session.publicState());
});

app.get('/api/tiktok/diagnostic', async (req, res) => {
  const session = await routeControlSession(req);
  if (!session) return res.status(401).json({ error: 'Session not found.' });
  res.json({
    username: session.config.tiktokUsername || null,
    status: session.connectionState,
    sessionId: session.id
  });
});

app.post('/api/config', async (req, res) => {
  const session = await routeControlSession(req);
  if (!session) return res.status(401).json({ error: 'Session not found.' });
  // saveConfig is deliberately isolated from Connect: saving never starts or
  // restarts the user's TikTok connection.
  const current = session.config;
  const input = req.body || {};
  const clamp = (value, min, max) => {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  };
  const nextConfig = {
    tiktokUsername: String(input.tiktokUsername ?? '').trim().replace(/^@+/, ''),
    eulerApiKey: String(input.eulerApiKey ?? current.eulerApiKey ?? '').trim(),
    regularSeconds: clamp(input.regularSeconds, 1, 86400),
    snipeSeconds: clamp(input.snipeSeconds, 1, 86400),
    drawSeconds: clamp(input.drawSeconds, 1, 86400),
    minimumCoins: clamp(input.minimumCoins, 0, 10_000_000_000),
    drawMarginCoins: clamp(input.drawMarginCoins, 0, 1_000_000),
    prize: String(input.prize ?? current.prize ?? defaultConfig.prize).trim() || defaultConfig.prize,
    autoSave: Boolean(input.autoSave)
  };

  // The factory exposes a mutable config through its getter, so update it
  // without touching the active TikTok connection.
  Object.assign(current, nextConfig);
  await session.saveConfig();
  session.broadcast();
  res.json(session.publicState());
});

app.post('/api/tiktok/connect', async (req, res) => {
  const session = await routeControlSession(req);
  if (!session) return res.status(401).json({ error: 'Session not found.' });
  await session.connectTikTok({ manual: true });
  res.json(session.publicState());
});

app.post('/api/auction/start', async (req, res) => {
  const session = await routeControlSession(req);
  if (!session) return res.status(401).json({ error: 'Session not found.' });
  session.startAuction();
  res.json(session.publicState());
});

app.post('/api/auction/reset', async (req, res) => {
  const session = await routeControlSession(req);
  if (!session) return res.status(401).json({ error: 'Session not found.' });
  session.resetAuction();
  res.json(session.publicState());
});

app.post('/api/demo/gift', async (req, res) => {
  const session = await routeControlSession(req);
  if (!session) return res.status(401).json({ error: 'Session not found.' });
  const body = req.body || {};
  const result = session.demoGift(body);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(session.publicState());
});

function pageSessionIdFromPath(req, kind) {
  const parts = String(req.path || '').split('/').filter(Boolean);
  return parts[0] === kind && validSessionId(parts[1]) ? parts[1] : '';
}

app.get('/', async (req, res) => {
  const session = await controlSession(req, res);
  res.redirect(`/control/${session.id}`);
});

app.get('/control', async (req, res) => {
  const session = await controlSession(req, res);
  res.redirect(`/control/${session.id}`);
});

app.get('/control/:sessionId', async (req, res) => {
  const session = await getOrCreateSession(req.params.sessionId);
  if (!session) return res.status(404).send('Invalid session URL.');
  setSessionCookie(res, req, session.id);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/overlay', async (req, res) => {
  const cookieId = parseCookies(req)[SESSION_COOKIE] || '';
  const session = validSessionId(cookieId) ? await getOrCreateSession(cookieId) : await createNewSession();
  // Public overlay uses a different token than the private control URL.
  res.redirect(`/overlay/${session.overlayToken}`);
});

app.get('/overlay/:overlayToken', async (req, res) => {
  const session = await getSessionByOverlayToken(req.params.overlayToken);
  if (!session) return res.status(404).send('Invalid overlay URL.');
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

io.use(async (socket, next) => {
  try {
    const controlId = String(socket.handshake.auth?.sessionId || socket.handshake.query?.sessionId || '');
    const overlayToken = String(socket.handshake.auth?.overlayToken || socket.handshake.query?.overlayToken || '');
    let session = null;
    if (validSessionId(controlId)) {
      session = await getOrCreateSession(controlId);
    } else if (validSessionId(overlayToken)) {
      session = await getSessionByOverlayToken(overlayToken);
    }
    if (!session) return next(new Error('Invalid or missing session token.'));
    socket.data.auctionSession = session;
    next();
  } catch (err) {
    next(err);
  }
});

io.on('connection', (socket) => {
  const session = socket.data.auctionSession;
  socket.join(session.room);
  socket.emit('auction:state', session.publicState());
});

setInterval(() => {
  for (const session of sessions.values()) {
    session.tick();
  }
}, 100);

setInterval(() => {
  for (const session of sessions.values()) {
    session.maintenance();
  }
}, 5_000);

const serverInstance = server;

serverInstance.listen(PORT, HOST, () => {
  console.log(`Auction Overlay running on ${HOST}:${PORT}`);
  console.log(`Persistent data directory: ${DATA_DIR}`);
});
