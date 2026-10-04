const qs=new URLSearchParams(location.search);
const inIframe=window.self!==window.top;
(function applyTheme(){
  const t=(qs.get('theme')||'').toLowerCase();
  if(['gold','pink','green','blue'].includes(t)) document.documentElement.dataset.theme=t;
})();
/* ---------- Sound (WebAudio synth, no files) ---------- */
let audioCtx=null;
function soundOn(){ return !inIframe && qs.get('mute')!=='1' && state?.config?.soundEnabled!==false; }
function ac(){
  try{
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    return audioCtx;
  }catch{ return null; }
}
function tone(freq,start,dur,{type='sine',vol=.15,to=null}={}){
  const c=ac(); if(!c) return;
  const t=c.currentTime+start, o=c.createOscillator(), g=c.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,t);
  if(to) o.frequency.exponentialRampToValueAtTime(to,t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol,t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t+dur+0.03);
}
function noise(start,dur,vol){
  const c=ac(); if(!c) return;
  const len=Math.floor(c.sampleRate*dur), buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
  const src=c.createBufferSource(); src.buffer=buf;
  const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=700;
  const g=c.createGain(); g.gain.value=vol;
  src.connect(f); f.connect(g); g.connect(c.destination); src.start(c.currentTime+start);
}
const sfx={
  coin(){ tone(988,0,.09,{type:'triangle',vol:.15}); tone(1319,.08,.24,{type:'triangle',vol:.15}); },
  tick(last){ tone(last?1500:1000,0,.06,{type:'square',vol:.05}); },
  over(){ tone(520,0,.3,{type:'sawtooth',vol:.06,to:200}); },
  coin2(){ [988,1319,1568].forEach((f,i)=>tone(f,i*.07,.22,{type:'triangle',vol:.15})); },
  big(){ [784,988,1319,1568].forEach((f,i)=>tone(f,i*.07,.3,{type:'triangle',vol:.15})); tone(2093,.3,.45,{type:'sine',vol:.1}); },
  mega(){ [523,659,784,1047,1319,1568,2093].forEach((f,i)=>tone(f,i*.065,.35,{type:'triangle',vol:.15})); tone(2637,.5,.7,{type:'sine',vol:.09}); tone(1047,.45,.8,{type:'sawtooth',vol:.04}); },
  pip(k){ tone(700+k*900,0,.045,{type:'triangle',vol:.035}); },
  galaxy(){ tone(260,0,1.5,{type:'sine',vol:.08,to:2000}); tone(390,0,1.5,{type:'triangle',vol:.05,to:3000}); [880,1175,1568,2093,2637].forEach((f,i)=>tone(f,1.1+i*.08,.4,{type:'triangle',vol:.13})); },
  nuke(){
    tone(2000,0,.6,{type:'sawtooth',vol:.045,to:240}); tone(1500,0,.6,{type:'sine',vol:.08,to:180});
    tone(95,.6,1.2,{type:'sine',vol:.42,to:24}); tone(160,.6,.5,{type:'sawtooth',vol:.12,to:40});
    noise(.6,1.0,.3);
    [1047,1319,1568,2093].forEach((f,i)=>tone(f,1.5+i*.09,.4,{type:'triangle',vol:.1}));
  },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,i*.11,.35,{type:'triangle',vol:.15})); tone(1047,.5,.8,{type:'sine',vol:.12}); tone(1319,.5,.8,{type:'sine',vol:.09}); }
};
function play(name,arg){ if(soundOn()){ try{ sfx[name](arg); }catch{} } }
if(!inIframe) document.addEventListener('pointerdown',()=>ac(),{once:true});

/* ---------- Confetti ---------- */
let confettiRaf=null;
function fireConfetti(count=150){
  const cv=$('confetti'), box=$('stack').getBoundingClientRect();
  if(!cv||!box.width) return;
  cancelAnimationFrame(confettiRaf);
  const dpr=window.devicePixelRatio||1, W=box.width, H=box.height;
  cv.width=W*dpr; cv.height=H*dpr;
  const ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  const colors=['#ffd23f','#ff3b3b','#4dff7a','#22d3ee','#b34dff','#ff3bd4','#ffffff','#ff9f1a'];
  const parts=Array.from({length:count},()=>({
    x:Math.random()*W, y:-10-Math.random()*H*.7,
    vx:(Math.random()-.5)*2.4, vy:2.2+Math.random()*3.2,
    w:5+Math.random()*7, h:3+Math.random()*5,
    r:Math.random()*Math.PI*2, vr:(Math.random()-.5)*.35,
    c:colors[(Math.random()*colors.length)|0], sw:Math.random()*Math.PI*2
  }));
  const t0=performance.now(), DUR=4200;
  (function frame(now){
    const t=now-t0;
    ctx.clearRect(0,0,W,H);
    if(t>DUR){ return; }
    ctx.globalAlpha=t>DUR-900?Math.max(0,(DUR-t)/900):1;
    for(const p of parts){
      p.sw+=.08; p.x+=p.vx+Math.sin(p.sw)*.7; p.y+=p.vy; p.r+=p.vr;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r);
      ctx.fillStyle=p.c; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore();
    }
    confettiRaf=requestAnimationFrame(frame);
  })(t0);
}

const overlayTokenMatch = window.location.pathname.match(/^\/overlay\/([a-f0-9]{24})/i);
const overlayToken = overlayTokenMatch ? overlayTokenMatch[1] : '';
const socket = io({ auth: { overlayToken } });
const $ = id => document.getElementById(id);
let state = null;
let prevTopKey = null;
let lastGiftId;
let combo = { key:null, total:0, count:0, ts:0 };
let lastPhase = null;
let lastCountSec = null;
let serverOffset = 0;
let lastAuctionId = null;
const previousCoins = new Map();
let latestWinnerChat = '';
let latestWinnerChatMeta = { nickname: '', avatar: '' };
let winnerChatSwapTimer = null;
let winnerChatAnimTimer = null;
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
const SHEEN_MS=4500;
function sheenDelay(i=0){return `${(-(Date.now()%SHEEN_MS)/1000 + i*0.22).toFixed(2)}s`}
function applyBackground(){
  const bg=new URLSearchParams(location.search).get('bg');
  if(!bg) return;
  const v=bg.toLowerCase();
  const color=v==='transparent'?'transparent':v==='black'?'#000':v==='blue'?'#001a66':/^[0-9a-f]{3,8}$/.test(v)?'#'+v:'';
  if(color) document.documentElement.style.setProperty('--chroma',color);
}
function fitPrize(){
  const el=$('prizeText'); if(!el) return;
  const len=el.textContent.length;
  el.style.fontSize=len>34?'14px':len>26?'16px':len>20?'18px':'';
}
function initSparkles(){
  const box=$('sparkles'); if(!box) return;
  const chars=['✦','✧','★','✦'];
  box.innerHTML=Array.from({length:18},(_,i)=>{
    const x=Math.random()*96, y=Math.random()*94, sz=9+Math.random()*13, d=(Math.random()*3).toFixed(2), du=(1.6+Math.random()*2).toFixed(2);
    const col=['#ffd23f','#fff','#ffe9a6','#22d3ee','#ff7bd5'][i%5];
    return `<span style="left:${x}%;top:${y}%;font-size:${sz}px;color:${col};animation-delay:${d}s;animation-duration:${du}s">${chars[i%4]}</span>`;
  }).join('');
}
function initSheens(){
  document.querySelectorAll('.shiny,.shiny-soft').forEach((el,i)=>el.style.setProperty('--sd',sheenDelay(i)));
}
const tierOf=n=>n>=1000?5:n>=500?4:n>=100?3:n>=20?2:1;
function burstFx(x,y,tier){
  const fx=$('fx'); if(!fx) return;
  while(fx.childElementCount>140) fx.firstElementChild.remove();
  const size=[0,70,110,160,230][tier];
  const rp=document.createElement('div'); rp.className='ripple';
  rp.style.cssText=`left:${x}px;top:${y}px;width:${size}px;height:${size}px`;
  fx.appendChild(rp); setTimeout(()=>rp.remove(),800);
  const n=[0,5,9,15,24][tier];
  for(let i=0;i<n;i++){
    const el=document.createElement('i');
    const star=tier>=2 && i%3===2;
    el.className=star?'fxstar':'fxcoin';
    if(star) el.textContent='✦';
    fx.appendChild(el);
    const ang=-Math.PI/2+(Math.random()-.5)*Math.PI*1.4;
    const sp=45+Math.random()*(70+tier*28);
    const dx=Math.cos(ang)*sp, dy=Math.sin(ang)*sp, rot=(Math.random()-.5)*720;
    const dur=850+Math.random()*600, sc=.7+Math.random()*.6;
    if(!el.animate){ el.remove(); continue; }
    const a=el.animate([
      {transform:`translate(${x}px,${y}px) scale(.4) rotate(0deg)`,opacity:1},
      {transform:`translate(${x+dx}px,${y+dy}px) scale(${sc}) rotate(${rot/2}deg)`,opacity:1,offset:.45},
      {transform:`translate(${x+dx*1.45}px,${y+dy+95}px) scale(${sc*.8}) rotate(${rot}deg)`,opacity:0}
    ],{duration:dur,easing:'cubic-bezier(.2,.7,.4,1)',fill:'forwards'});
    a.onfinish=()=>el.remove();
  }
}
const counters=new Map(); // key -> {cur, token}
let collectToken=0;
function rowIcon(key){ return document.querySelector(`.ov-row[data-key="${CSS.escape(key)}"] .ov-coins-wrap .coin`); }
function rowNum(key){ return document.querySelector(`.ov-row[data-key="${CSS.escape(key)}"] .ov-coins`); }
function pulseIcon(key){
  const ic=rowIcon(key); if(!ic) return;
  ic.classList.remove('pulse'); void ic.offsetWidth; ic.classList.add('pulse');
}
/* Coins scatter from the gift banner, then fly one by one into the row; the number climbs with every arrival. */
function collectFx(key,from,to,tier){
  const fx=$('fx'), stack=$('stack');
  const delta=to-from;
  if(!fx||!fx.animate||delta<=0){ const n=rowNum(key); if(n) n.textContent=to.toLocaleString(); return; }
  const sr=stack.getBoundingClientRect();
  const T=fxTarget(key); if(!T) return;
  const tx=T.x-7, ty=T.y-7;
  const dur=Math.min(2200,Math.max(500,350+delta*2.5));
  const N=Math.min(48,Math.max(8,Math.round(delta/10)+6));
  const FLY=850, step=dur/N;
  const ox=sr.width/2-7, oy=sr.height-34;
  const token=++collectToken, t0=performance.now();
  counters.set(key,{cur:from,token});
  while(fx.childElementCount>150) fx.firstElementChild.remove();
  for(let i=0;i<N;i++){
    const el=document.createElement('i'); el.className='fxcoin'; fx.appendChild(el);
    const ang=Math.random()*Math.PI*2, d=45+Math.random()*120;
    const sx=Math.max(8,Math.min(sr.width-24,ox+Math.cos(ang)*d*1.5));
    const sy=Math.max(8,Math.min(sr.height-24,oy+Math.sin(ang)*d-40));
    const a=el.animate([
      {transform:`translate(${ox}px,${oy}px) scale(.3)`,opacity:0},
      {transform:`translate(${sx}px,${sy}px) scale(1.15)`,opacity:1,offset:.36,easing:'ease-in'},
      {transform:`translate(${tx}px,${ty}px) scale(.8)`,opacity:1,offset:.93},
      {transform:`translate(${tx}px,${ty}px) scale(.3)`,opacity:0}
    ],{duration:FLY,delay:i*step,easing:'cubic-bezier(.2,.8,.3,1)',fill:'both'});
    a.onfinish=()=>{ el.remove(); if(counters.get(key)?.token===token) pulseIcon(key); };
  }
  const first=FLY, last=FLY+(N-1)*step; let lastPip=-1;
  (function tick(now){
    const c=counters.get(key);
    if(!c||c.token!==token) return;
    const k=Math.min(1,Math.max(0,(now-t0-first)/Math.max(1,last-first)));
    const v=Math.round(from+delta*k); c.cur=v;
    const n=rowNum(key); if(n) n.textContent=v.toLocaleString();
    const pip=Math.floor(k*N/3); if(k>0&&pip!==lastPip){ lastPip=pip; play('pip',k); }
    if(k<1) requestAnimationFrame(tick);
    else{
      counters.delete(key);
      const ic2=rowIcon(key);
      if(ic2){ const b=ic2.getBoundingClientRect(), r2=stack.getBoundingClientRect(); burstFx(b.left-r2.left+b.width/2,b.top-r2.top+b.height/2,tier); }
    }
  })(t0);
}
function countUp(el,from,to,ms=650){
  const t0=performance.now();
  (function step(now){
    const k=Math.min(1,(now-t0)/ms), e=1-Math.pow(1-k,3);
    el.textContent=Math.round(from+(to-from)*e).toLocaleString();
    if(k<1) requestAnimationFrame(step);
  })(t0);
}
function showGiftAlert(g,tier){
  const el=$('giftAlert'); if(!el) return;
  const now=Date.now(), key=g.userId||g.nickname;
  if(combo.key===key && now-combo.ts<2200){ combo.total+=g.coins; combo.count++; }
  else combo={key,total:g.coins,count:1,ts:now};
  combo.ts=now;
  const t=Math.max(tier,tierOf(combo.total));
  $('giftAvatar').src=avatar(g.avatar);
  $('giftName').textContent=g.nickname||'';
  $('giftAmt').textContent='+'+combo.total.toLocaleString();
  $('giftTag').textContent=t>=5?'☢ NUKE GIFT!!!':t===4?'✦ GALAXY GIFT!!':t===3?'BIG GIFT!':'GIFT';
  const cb=$('giftCombo');
  cb.classList.remove('on'); cb.textContent='x'+combo.count;
  if(combo.count>1){ void cb.offsetWidth; cb.classList.add('on'); }
  el.className='gift-alert t'+Math.min(5,t);
  void el.offsetWidth; el.classList.add('show');
}
function onGift(g){
  const tier=tierOf(g.coins);
  play(tier>=5?'nuke':tier===4?'galaxy':tier===3?'big':tier===2?'coin2':'coin');
  showGiftAlert(g,tier);
  const st=$('stack');
  if(tier>=3){
    st.classList.remove('gift3','gift4'); void st.offsetWidth;
    st.classList.add(tier>=4?'gift4':'gift3');
    setTimeout(()=>st.classList.remove('gift3','gift4'),1200);
  }
}
const keyOf=u=>String(u.userId||u.uniqueId||u.nickname);
function showOvertaken(name){
  const el=$('overtaken'); if(!el) return;
  $('overtakenName').textContent=`${name} takes #1`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function render(s){
  state=s; serverOffset=(s.serverNow||Date.now())-Date.now();
  if(lastAuctionId!==null && s.auctionId!==lastAuctionId){ previousCoins.clear(); prevTopKey=null; }
  lastAuctionId=s.auctionId;
  const prevPhase=lastPhase; lastPhase=s.phase;
  document.body.className=`overlay-body ${s.phase}`;

  const min=Number(s.config?.minimumCoins||0);
  const minText=$('minimumText'), minIcon=$('minimumIcon');
  if(min>0){ minText.textContent=`MINIMUM: ${min.toLocaleString()}`; minIcon.className='check coin-mode'; minIcon.innerHTML='<i class="coin"></i>'; }
  else { minText.textContent='NO MINIMUM'; minIcon.className='check'; minIcon.textContent='✔'; }

  $('prizeText').textContent=String(s.prize||'').trim()||'Prize #1';
  fitPrize();

  const phaseLabel=s.phase==='regular'?'REGULAR TIME':s.phase==='snipe'?'SNIPE TIME':s.phase==='draw'?'DRAW TIME':s.phase==='finished'?(s.winner?'WINNER':'DRAW'):'WAITING';
  $('phaseLabel').textContent=phaseLabel;
  const total=Number(s.totalParticipants ?? (s.leaderboard||[]).length);
  $('participantsText').textContent=`Total participants: ${total}`;

  const users=s.leaderboard||[];
  const activePhase=s.phase==='regular'||s.phase==='snipe'||s.phase==='draw';
  const rowsEl=$('rows');

  // remember row positions for the slide (FLIP) animation
  const oldTops=new Map();
  rowsEl.querySelectorAll('.ov-row[data-key]').forEach(r=>oldTops.set(r.dataset.key,r.getBoundingClientRect().top));

  // detect new bids + a change of leader
  let anyIncrease=false;
  for(const u of users){ const p=previousCoins.get(keyOf(u)); if(p!=null && u.coins>p) anyIncrease=true; }
  const topKey=users[0]?keyOf(users[0]):null;
  const overtaken=activePhase && prevTopKey && topKey && topKey!==prevTopKey;
  prevTopKey=topKey;

  const seenKeys=new Set();
  rowsEl.innerHTML=users.length?users.map((u,i)=>{
    const key=keyOf(u);
    seenKeys.add(key);
    let prev=previousCoins.get(key);
    // First gift of a brand-new participant: no previous row exists, so treat it as 0 -> 'prev' for FX.
    if(prev==null && lastGiftId!==undefined && s.lastGift && s.lastGift.id>lastGiftId && String(s.lastGift.userId)===key) prev=0;
    const delta=prev==null?0:u.coins-prev;
    const tier=delta>0?tierOf(delta):0;
    const cnt=counters.get(key);
    const shown=cnt?cnt.cur:(delta>=20?prev:u.coins);
    const hit=delta>0?` coin-hit hit${Math.min(4,tier)}${delta>=20?' collect':''}`:'';
    const burst=delta>0?`<span class="coin-burst t${Math.min(4,tier)}">+${delta.toLocaleString()}</span>`:'';
    const star=i===0?'<span class="star">★</span>':'';
    let gap='';
    if(activePhase && i>0) gap=`<div class="gap-right">-${(users[0].coins-u.coins).toLocaleString()}<i class="coin red"></i></div>`;
    return `<div class="ov-row rank${i+1}${hit}" data-key="${esc(key)}" data-tier="${tier}" data-from="${cnt?cnt.cur:(prev??u.coins)}" data-to="${u.coins}" style="--sd:${sheenDelay(i+4)}"><div class="ov-rank"><div class="medal m${i+1}">${i+1}</div></div><img class="ov-avatar" src="${esc(avatar(u.avatar))}" alt=""><div class="ov-info"><div class="ov-name"><span class="nm">${esc(u.nickname)}</span>${star}</div><div class="ov-coins-wrap"><span class="ov-coins${(rainbowUntil.get(key)||0)>Date.now()?' rainbow-num':''}">${shown.toLocaleString()}</span><i class="coin"></i>${burst}</div></div>${gap}</div>`;
  }).join(''):'<div class="ov-row empty-row"><div class="ov-info"><div class="ov-name">No bids yet</div><div class="sub">Send a gift to enter</div></div></div>';
  for(const u of users) previousCoins.set(keyOf(u), u.coins);
  for(const key of [...previousCoins.keys()]) if(!seenKeys.has(key)) previousCoins.delete(key);

  // slide rows that changed rank
  rowsEl.querySelectorAll('.ov-row[data-key]').forEach(r=>{
    const o=oldTops.get(r.dataset.key); if(o==null) return;
    const dy=o-r.getBoundingClientRect().top;
    if(Math.abs(dy)>2 && r.animate) r.animate([{transform:`translateY(${dy}px)`},{transform:'translateY(0)'}],{duration:520,easing:'cubic-bezier(.2,.9,.2,1)'});
  });

  // coin-increase effects on the rows that received coins
  const sr=$('stack').getBoundingClientRect();
  rowsEl.querySelectorAll('.ov-row.coin-hit').forEach(r=>{
    const tier=Number(r.dataset.tier)||1, key=r.dataset.key;
    const from=Number(r.dataset.from), to=Number(r.dataset.to);
    if(tier>=3 && fxBig(key,from,to,tier)) { /* canvas effect handles counting */ }
    else if(r.classList.contains('collect')) collectFx(key,from,to,tier);
    else{
      const num=r.querySelector('.ov-coins');
      if(num) countUp(num,from,to,500+tier*100);
      const ic=r.querySelector('.ov-coins-wrap .coin');
      if(ic){ const b=ic.getBoundingClientRect(); burstFx(b.left-sr.left+b.width/2,b.top-sr.top+b.height/2,tier); }
    }
  });
  if(lastGiftId===undefined){ lastGiftId=s.lastGift?.id??0; }
  else if(s.lastGift && s.lastGift.id>lastGiftId){ lastGiftId=s.lastGift.id; if(activePhase) onGift(s.lastGift); }
  else if(s.lastGift===undefined && activePhase && anyIncrease) play('coin');
  if(overtaken){ showOvertaken(users[0].nickname); setTimeout(()=>play('over'),140); }

  const winnerPanel=$('winnerPanel');
  if(s.phase==='finished' && s.winner){
    const wasHidden=winnerPanel.classList.contains('hidden');
    winnerPanel.classList.remove('hidden');
    $('stack').classList.add('has-winner');
    if(wasHidden){
      winnerPanel.style.setProperty('--sd',sheenDelay(0));
      if(prevPhase!==null && prevPhase!=='finished'){ play('win'); fireConfetti(); }
    }
    $('winnerName').textContent=s.winner.nickname || 'Unknown';
    $('winnerCoins').textContent=s.winner.coins.toLocaleString();
    $('winnerAvatar').src=avatar(s.winner.avatar);
    $('winnerPrize').textContent=String(s.prize||'').trim()||'Prize #1';
    syncWinnerChat(s.winner, s.chatLog || [], s.winnerChat || '', s.winnerChatMeta || {});
  } else {
    winnerPanel.classList.add('hidden');
    $('stack').classList.remove('has-winner');
    if(s.phase!=='finished') setWinnerChatText('', {}, false);
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
function handleCountdown(ms){
  const ph=state.phase, sec=Math.ceil(ms/1000), stack=$('stack');
  if(!(ph==='snipe'||ph==='draw') || sec<=0 || sec>5){ lastCountSec=null; stack.classList.remove('counting'); return; }
  if(sec===lastCountSec) return;
  lastCountSec=sec;
  play('tick', sec<=3);
  if(sec<=3){
    const big=$('bigCount');
    big.textContent=sec;
    big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop');
    stack.classList.add('counting');
  } else stack.classList.remove('counting');
}
function updateTimer(){
  if(!state)return;
  const target=state.phaseEndsAt||0;
  const now=Date.now()+serverOffset;
  const ms=Math.max(0,target-now);
  $('timer').textContent=fmt(ms);
  handleCountdown(ms);
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
applyBackground();
initSparkles();
initSheens();
setInterval(updateTimer,100);
