const overlayTokenMatch = window.location.pathname.match(/^\/overlay\/([a-f0-9]{24})/i);
const overlayToken = overlayTokenMatch ? overlayTokenMatch[1] : '';
const socket = io({ auth: { overlayToken } });
const $ = id => document.getElementById(id);
let state = null;
let serverOffset = 0;
let lastAuctionId = null;
const previousCoins = new Map();
let latestWinnerChat = '';
let latestWinnerChatMeta = { nickname: '', avatar: '' };
let winnerChatSwapTimer = null;
let winnerChatAnimTimer = null;
const medal = ['🥇','🥈','🥉'];
function fmt(ms){const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function avatar(src){return src||'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#202938"/><text x="40" y="50" text-anchor="middle" font-size="30" fill="#fff">?</text></svg>`)}
function winnerMatchesChat(winner, chat){
  if(!winner || !chat) return false;
  const norm=v=>String(v??'').trim().replace(/^@+/,'').toLowerCase();
  const wid=norm(winner.userId), cid=norm(chat.userId);
  if(wid && cid && wid===cid) return true;
  const wu=norm(winner.uniqueId), cu=norm(chat.uniqueId);
  if(wu && cu && wu===cu) return true;
  return false;
}
function findLatestWinnerChat(winner, logs){
  if(!winner || !Array.isArray(logs)) return '';
  for(let i=logs.length-1;i>=0;i--){
    const chat=logs[i];
    if(winnerMatchesChat(winner, chat) && String(chat.comment ?? '').trim()) return String(chat.comment).trim();
  }
  return '';
}
function setWinnerChatText(comment, meta={}, animate=true){
  const next=String(comment ?? '').trim();
  const target=$('winnerChat');
  const textEl=$('winnerChatText');
  const userEl=$('winnerChatUser');
  const avatarEl=$('winnerChatAvatar');
  if(!target || !textEl || !userEl || !avatarEl) return;

  const nextMeta={
    nickname:String(meta?.nickname ?? '').trim() || 'Winner',
    avatar:String(meta?.avatar ?? '').trim()
  };
  const displayText=next || 'Waiting for winner chat…';
  const sameMessage=next===latestWinnerChat && nextMeta.nickname===latestWinnerChatMeta.nickname && nextMeta.avatar===latestWinnerChatMeta.avatar;
  latestWinnerChat=next;
  latestWinnerChatMeta=nextMeta;

  clearTimeout(winnerChatSwapTimer);
  clearTimeout(winnerChatAnimTimer);

  const applyContent=()=>{
    textEl.textContent=displayText;
    userEl.textContent=nextMeta.nickname;
    avatarEl.src=avatar(nextMeta.avatar);
    avatarEl.alt=nextMeta.nickname ? `${nextMeta.nickname} profile` : '';
  };

  if(sameMessage) applyContent();
  else if(!animate || !textEl.textContent || textEl.textContent==='Waiting for winner chat…'){
    target.classList.remove('winner-chat-swap-out','winner-chat-swap-in');
    applyContent();
    void target.offsetWidth;
  } else {
    target.classList.remove('winner-chat-swap-in');
    target.classList.add('winner-chat-swap-out');
    winnerChatSwapTimer=setTimeout(()=>{
      applyContent();
      target.classList.remove('winner-chat-swap-out');
      void target.offsetWidth;
      target.classList.add('winner-chat-swap-in');
      winnerChatAnimTimer=setTimeout(()=>target.classList.remove('winner-chat-swap-in'),340);
    },150);
  }

  const copy=$('winnerChatCopy');
  if(copy){
    copy.disabled=!latestWinnerChat;
    copy.setAttribute('aria-label', latestWinnerChat ? 'Copy winner chat text' : 'No winner chat to copy');
  }
}
function syncWinnerChat(winner, logs, serverWinnerChat='', serverWinnerChatMeta={}){
  if(!winner){
    latestWinnerChat='';
    latestWinnerChatMeta={nickname:'',avatar:''};
    setWinnerChatText('', {}, false);
    return;
  }
  const direct=String(serverWinnerChat ?? '').trim();
  let meta={
    nickname:String(serverWinnerChatMeta?.nickname ?? winner.nickname ?? '').trim() || winner.nickname || 'Winner',
    avatar:String(serverWinnerChatMeta?.avatar ?? winner.avatar ?? '').trim()
  };
  let latest=direct;
  if(!latest){
    for(let i=(logs||[]).length-1;i>=0;i--){
      const chat=logs[i];
      if(winnerMatchesChat(winner, chat) && String(chat?.comment ?? '').trim()){
        latest=String(chat.comment).trim();
        meta={nickname:String(chat.nickname ?? winner.nickname ?? 'Winner').trim() || 'Winner',avatar:String(chat.avatar ?? winner.avatar ?? '').trim()};
        break;
      }
    }
  }
  setWinnerChatText(latest, meta, false);
}
function render(s){
  state=s; serverOffset=(s.serverNow||Date.now())-Date.now();
  if(lastAuctionId!==null && s.auctionId!==lastAuctionId){ previousCoins.clear(); }
  lastAuctionId=s.auctionId;
  document.body.className=`overlay-body ${s.phase}`;
  $('minimumChip').textContent=`MINIMUM: ${(s.config?.minimumCoins||0).toLocaleString()} 🪙`;
  $('snipeChip').textContent=`SNIPE TIME ${Math.round(s.config?.snipeSeconds||0)}S`;
  const phaseLabel=s.phase==='regular'?'REGULAR TIME':s.phase==='snipe'?'SNIPE TIME':s.phase==='draw'?'DRAW TIME':s.phase==='finished'?(s.winner?'WINNER':'DRAW'):'WAITING';
  $('phaseLabel').textContent=phaseLabel;
  const users=s.leaderboard||[];
  const seenKeys=new Set();
  $('rows').innerHTML=users.length?users.map((u,i)=>{
    const key=String(u.userId||u.uniqueId||u.nickname);
    seenKeys.add(key);
    const prev=previousCoins.get(key);
    const delta=prev==null?0:u.coins-prev;
    const hit=delta>0?' coin-hit':'';
    const burst=delta>0?`<span class="coin-burst">+${delta.toLocaleString()} 🪙</span>`:'';
    return `<div class="ov-row rank${i+1}${hit}"><div class="ov-rank">${medal[i]}</div><img class="ov-avatar" src="${esc(avatar(u.avatar))}"><div class="ov-info"><div class="ov-name">${esc(u.nickname)}</div><div class="ov-id">@${esc(u.uniqueId)}</div></div><div class="ov-coins-wrap"><div class="ov-coins">${u.coins.toLocaleString()} 🪙</div>${burst}</div></div>`;
  }).join(''):'<div class="ov-row empty-row"><div></div><div></div><div class="ov-info"><div class="ov-name">No bids yet</div><div class="ov-id">Send a gift to enter</div></div><div class="ov-coins">—</div></div>';
  for(const u of users) previousCoins.set(String(u.userId||u.uniqueId||u.nickname), u.coins);
  for(const key of [...previousCoins.keys()]) if(!seenKeys.has(key)) previousCoins.delete(key);

  const winnerPanel=$('winnerPanel');
  if(s.phase==='finished' && s.winner){
    winnerPanel.classList.remove('hidden');
    $('winnerName').textContent=s.winner.nickname || 'Unknown';
    $('winnerCoins').textContent=`${s.winner.coins.toLocaleString()} 🪙`;
    syncWinnerChat(s.winner, s.chatLog || [], s.winnerChat || '', s.winnerChatMeta || {});
    $('prizeBar').textContent=`PRIZE: ${s.prize || 'Prize #1'}`;
  } else if(s.phase==='draw') {
    winnerPanel.classList.add('hidden');
    $('prizeBar').textContent=`PRIZE: ${s.prize || 'Prize #1'}`;
  } else if(s.phase==='finished') {
    winnerPanel.classList.add('hidden');
    $('prizeBar').textContent='DRAW · STILL TIED AFTER DRAW TIME';
  } else {
    winnerPanel.classList.add('hidden');
    setWinnerChatText('', {}, false);
    $('prizeBar').textContent=`PRIZE: ${s.prize || 'Prize #1'}`;
  }
  updateTimer();
}
function handleChat(chat){
  if(!state || !state.winner || !winnerMatchesChat(state.winner, chat)) return;
  const comment=String(chat?.comment ?? '').trim();
  if(!comment) return;
  setWinnerChatText(comment, {nickname:chat.nickname, avatar:chat.avatar || state.winner?.avatar || ''}, true);
}
async function copyWinnerChat(){
  if(!latestWinnerChat) return;
  try{
    await navigator.clipboard.writeText(latestWinnerChat);
  }catch{
    const ta=document.createElement('textarea');
    ta.value=latestWinnerChat;
    ta.style.position='fixed';
    ta.style.opacity='0';
    document.body.appendChild(ta);
    ta.select();
    try{document.execCommand('copy')}catch{}
    ta.remove();
  }
  const button=$('winnerChatCopy');
  if(button){
    const original=button.textContent;
    button.textContent='Copied';
    clearTimeout(button._copyTimer);
    button._copyTimer=setTimeout(()=>{button.textContent=original},1200);
  }
}
function updateTimer(){
  if(!state)return;
  const target=state.phaseEndsAt||0;
  const now=Date.now()+serverOffset;
  $('timer').textContent=fmt(Math.max(0,target-now));
}
socket.on('auction:state',render);
socket.on('auction:tick',t=>{if(state){state.phase=t.phase;state.phaseEndsAt=t.phaseEndsAt;updateTimer();}});
socket.on('chat:message',chat=>{
  if(state){
    state.chatLog=Array.isArray(state.chatLog)?[...state.chatLog,chat].slice(-60):[chat];
  }
  handleChat(chat);
});
socket.on('winner:chat',payload=>{
  const comment=String(payload?.comment ?? '').trim();
  if(!comment) return;
  const meta={nickname:String(payload?.nickname ?? state?.winner?.nickname ?? 'Winner'),avatar:String(payload?.avatar ?? state?.winner?.avatar ?? '')};
  if(state){ state.winnerChat=comment; state.winnerChatMeta=meta; }
  setWinnerChatText(comment, meta, true);
});
$('winnerChatCopy')?.addEventListener('click',copyWinnerChat);
fetch('/api/state').then(r=>r.json()).then(render);
setInterval(updateTimer,100);
