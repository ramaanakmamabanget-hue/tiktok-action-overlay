const sessionIdMatch = window.location.pathname.match(/^\/control\/([a-f0-9]{24})/i);
const sessionId = sessionIdMatch ? sessionIdMatch[1] : '';
const socket = io({ auth: { sessionId } });
const $ = (id) => document.getElementById(id);

if (sessionId) {
  const openOverlay = $('openOverlay');
  const overlayFrame = $('overlayFrame');
  if (openOverlay) openOverlay.href = '/overlay';
  if (overlayFrame) overlayFrame.src = '/overlay';
}
let latest = null;
let autoSaveTimer = null;
let autoSaveEnabled = false;
let renderingState = false;

function fmtTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}
function esc(s='') { return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function avatar(src){ return src || 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#202938"/><text x="40" y="49" text-anchor="middle" font-size="34" fill="#fff">?</text></svg>`); }

function fillSettings(c) {
  $('tiktokUsername').value = c.tiktokUsername || '';
  // Never overwrite the API-key textbox from server state. The server intentionally
  // does not return the secret, and doing so used to make the key disappear after Save.
  const key = $('eulerApiKey');
  key.placeholder = c.eulerApiKeyConfigured ? 'API key saved — leave blank to keep it' : 'Paste your free key here';
  $('regularSeconds').value = c.regularSeconds;
  $('snipeSeconds').value = c.snipeSeconds;
  $('drawSeconds').value = c.drawSeconds;
  $('minimumCoins').value = c.minimumCoins;
  $('drawMarginCoins').value = c.drawMarginCoins;
  $('prize').value = c.prize || c.prizes?.['1'] || '';
  const snd = $('soundEnabled'); if (snd) snd.checked = c.soundEnabled !== false;
  autoSaveEnabled = Boolean(c.autoSave);
  const toggle = $('autoSave');
  if (toggle) toggle.checked = autoSaveEnabled;
}
function renderList(items) {
  $('leaderboard').innerHTML = items?.length ? items.map((u,i)=>`<div class="dash-row"><div class="rank">${['🥇','🥈','🥉'][i]}</div><img class="dash-avatar" src="${esc(avatar(u.avatar))}"><div class="dash-name"><strong>${esc(u.nickname)}</strong><span>@${esc(u.uniqueId)}</span></div><div class="dash-coins">${u.coins.toLocaleString()} 🪙</div></div>`).join('') : '<div class="muted" style="padding:12px 0">No qualifying users yet.</div>';
}
function renderLogs(events, chats) {
  $('eventLog').innerHTML = [...(events||[])].reverse().map(e=>`<div class="log-item"><span class="time">${new Date(e.time).toLocaleTimeString()}</span>${e.type==='gift'?`<b>${esc(e.user)}</b> <span class="coin">+${e.coins} 🪙</span> <span>${esc(e.giftName)}</span>`:esc(e.message||e.type||'event')}</div>`).join('');
  $('chatLog').innerHTML = [...(chats||[])].reverse().map(e=>`<div class="log-item"><span class="time">${new Date(e.time).toLocaleTimeString()}</span><b>${esc(e.nickname)}</b>: ${esc(e.comment)}</div>`).join('');
}
function render(s) {
  latest = s;
  if (s.overlayToken) {
    const overlayUrl = `/overlay/${s.overlayToken}`;
    const openOverlay = $('openOverlay');
    const overlayFrame = $('overlayFrame');
    if (openOverlay) openOverlay.href = overlayUrl;
    if (overlayFrame && overlayFrame.dataset.sessionOverlay !== overlayUrl) {
      overlayFrame.src = overlayUrl;
      overlayFrame.dataset.sessionOverlay = overlayUrl;
    }
  }
  if (s.config) fillSettings(s.config);
  const status = s.connection?.status || 'disconnected';
  $('connBadge').textContent = status.toUpperCase();
  $('connBadge').className = `status-badge ${status}`;
  $('connectionText').textContent = s.connection?.message || '—';
  const connectBtn = $('connectBtn');
  if (connectBtn) {
    const connected = status === 'connected';
    const connecting = status === 'connecting';
    connectBtn.textContent = connected ? 'Connected' : connecting ? 'Connecting…' : 'Connect';
    connectBtn.disabled = connecting;
  }
  $('phaseValue').textContent = s.phase.toUpperCase();
  $('phaseText').textContent = s.phase === 'regular' ? 'Regular bidding is open.' : s.phase === 'snipe' ? 'Snipe phase is live.' : s.phase === 'draw' ? 'Draw phase is live.' : s.phase === 'finished' ? 'Round finished.' : 'Idle.';
  $('auctionId').textContent = `#${s.auctionId}`;
  $('countdown').textContent = fmtTime(s.remainingMs || 0);
  $('startBtn').textContent = s.phase === 'idle' || s.phase === 'finished' ? 'Start Auction' : 'Auction Running';
  $('startBtn').disabled = !(s.phase === 'idle' || s.phase === 'finished');
  renderList(s.leaderboard);
  renderLogs(s.eventLog, s.chatLog);
  const w = s.winner;
  $('winnerBox').classList.toggle('hidden', !w && s.phase !== 'finished');
  $('winnerBox').innerHTML = w ? `<b>🏆 Winner: ${esc(w.nickname)}</b><br><span class="muted">${w.coins.toLocaleString()} coins · ${esc(s.prize || 'Prize #1')}</span>` : (s.phase === 'finished' ? '<b>DRAW</b><br><span class="muted">Still tied after draw phase.</span>' : '');
}

$('settingsForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const body = {
    tiktokUsername: $('tiktokUsername').value,
    eulerApiKey: $('eulerApiKey').value,
    regularSeconds: $('regularSeconds').value,
    snipeSeconds: $('snipeSeconds').value,
    drawSeconds: $('drawSeconds').value,
    minimumCoins: $('minimumCoins').value,
    drawMarginCoins: $('drawMarginCoins').value,
    prize: $('prize').value,
    soundEnabled: $('soundEnabled')?.checked ?? true,
    autoSave: $('autoSave')?.checked ?? autoSaveEnabled
  };
  const r = await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const next = await r.json();
  render(next);
  $('saveBtn').textContent = 'Saved ✓';
  clearTimeout(autoSaveTimer);
  setTimeout(() => { $('saveBtn').textContent = 'Save'; }, 1000);
});

function collectConfig() {
  return {
    tiktokUsername: $('tiktokUsername').value,
    eulerApiKey: $('eulerApiKey').value,
    regularSeconds: $('regularSeconds').value,
    snipeSeconds: $('snipeSeconds').value,
    drawSeconds: $('drawSeconds').value,
    minimumCoins: $('minimumCoins').value,
    drawMarginCoins: $('drawMarginCoins').value,
    prize: $('prize').value,
    soundEnabled: $('soundEnabled')?.checked ?? true,
    autoSave: $('autoSave')?.checked ?? autoSaveEnabled
  };
}

function queueAutoSave() {
  if (renderingState || !autoSaveEnabled) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    try {
      const r = await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(collectConfig())});
      const next = await r.json();
      render(next);
      $('saveBtn').textContent = 'Auto-saved ✓';
      setTimeout(() => { if ($('saveBtn')) $('saveBtn').textContent = 'Save'; }, 1000);
    } catch (err) {
      $('saveBtn').textContent = 'Save failed';
      setTimeout(() => { if ($('saveBtn')) $('saveBtn').textContent = 'Save'; }, 1200);
    }
  }, 650);
}

document.querySelectorAll('#settingsForm input').forEach((el) => {
  el.addEventListener('input', queueAutoSave);
  el.addEventListener('change', queueAutoSave);
});
$('autoSave').addEventListener('change', () => {
  autoSaveEnabled = $('autoSave').checked;
  if (autoSaveEnabled) queueAutoSave();
});
$('connectBtn').addEventListener('click',async()=>{
  const btn = $('connectBtn');
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  try {
    const r = await fetch('/api/tiktok/connect',{method:'POST'});
    render(await r.json());
  } finally {
    btn.disabled = false;
  }
});
$('startBtn').addEventListener('click',async()=>{ const r=await fetch('/api/auction/start',{method:'POST'}); render(await r.json()); });
$('resetBtn').addEventListener('click',async()=>{ const r=await fetch('/api/auction/reset',{method:'POST'}); render(await r.json()); });
$('reloadSnipeBtn').addEventListener('click',async()=>{ const r=await fetch('/api/auction/reload-snipe',{method:'POST'}); render(await r.json()); });
$('demoGift').addEventListener('click',async()=>{ const r=await fetch('/api/demo/gift',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('demoName').value,coins:$('demoCoins').value})}); render(await r.json()); });
document.querySelectorAll('.demo-presets button').forEach(btn=>btn.addEventListener('click',()=>{$('demoCoins').value=btn.dataset.coins; $('demoGift').click();}));
socket.on('auction:state', render);
socket.on('auction:tick', t=>{ $('countdown').textContent = fmtTime((t.phaseEndsAt || 0) - (Date.now())); });
socket.on('chat:message', m=>{ if(latest){ latest.chatLog=[...(latest.chatLog||[]),m].slice(-60); renderLogs(latest.eventLog, latest.chatLog); }});
fetch('/api/state').then(r=>r.json()).then(render);
