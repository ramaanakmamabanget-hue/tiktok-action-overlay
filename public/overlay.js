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
const isBW=()=>document.documentElement.dataset.skin==='blaxwhit';
// BlaxWhit sound bus: dry signal + a soft filtered echo tail ("room").
let bwBus=null;
// Classic (HEX) sound bus: soft compressor + short glassy slapback echo.
let hxBus=null;
function out(){
  const c=ac();
  if(!isBW()){
    if(!hxBus){
      const inp=c.createGain(), comp=c.createDynamicsCompressor(), dl=c.createDelay(.5), fb=c.createGain(), lp=c.createBiquadFilter(), wet=c.createGain();
      dl.delayTime.value=.11; fb.gain.value=.28; lp.type='lowpass'; lp.frequency.value=3800; wet.gain.value=.22;
      comp.threshold.value=-14; comp.ratio.value=4; comp.attack.value=.004; comp.release.value=.2;
      inp.connect(comp); inp.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(comp); comp.connect(c.destination);
      hxBus=inp;
    }
    return hxBus;
  }
  if(!bwBus){
    const inp=c.createGain(), dl=c.createDelay(1), fb=c.createGain(), lp=c.createBiquadFilter(), wet=c.createGain();
    dl.delayTime.value=.17; fb.gain.value=.38; lp.type='lowpass'; lp.frequency.value=2400; wet.gain.value=.34;
    inp.connect(c.destination); inp.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(c.destination);
    bwBus=inp;
  }
  return bwBus;
}
function tone(freq,start,dur,{type='sine',vol=.15,to=null}={}){
  const c=ac(); if(!c) return;
  const t=c.currentTime+start, o=c.createOscillator(), g=c.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,t);
  if(to) o.frequency.exponentialRampToValueAtTime(to,t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol,t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); g.connect(out());
  o.start(t); o.stop(t+dur+0.03);
}
function noise(start,dur,vol){
  const c=ac(); if(!c) return;
  const len=Math.floor(c.sampleRate*dur), buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
  const src=c.createBufferSource(); src.buffer=buf;
  const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=700;
  const g=c.createGain(); g.gain.value=vol;
  src.connect(f); f.connect(g); g.connect(out()); src.start(c.currentTime+start);
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
  confetti(){ noise(0,.12,.35); noise(.05,.1,.25); [784,988,1319,1760].forEach((f,i)=>tone(f,.05+i*.06,.25,{type:'triangle',vol:.13})); },
  fireworks(){ for(let i=0;i<4;i++){ tone(500+i*160,i*.38,.3,{type:'sine',vol:.05,to:1800}); noise(i*.38+.3,.35,.28); [1319,1760,2349].forEach((f,j)=>tone(f,i*.38+.3+j*.03,.3,{type:'triangle',vol:.07})); } },
  moneygun(c){ const dur=Math.min(2.8,1.3+(Number(c)||500)/700), n=Math.round(dur/.075), t0=.42;
    tone(180,0,.4,{type:'sawtooth',vol:.05,to:900}); noise(0,.3,.18);
    for(let i=0;i<n;i++){ const t=t0+i*.075; noise(t,.045,.2); tone(2600-(i%4)*300,t,.04,{type:'square',vol:.035,to:400}); tone(130,t,.05,{type:'sine',vol:.16,to:60}); if(i%4===0) tone(3400+(i%8)*120,t+.02,.05,{type:'triangle',vol:.03}); }
    const te=t0+n*.075+.1; noise(te,.25,.25); [2093,2637,3136,4186].forEach((f,i)=>tone(f,te+.04+i*.07,.55,{type:'triangle',vol:.1}));
    for(let i=0;i<22;i++) tone(2400+Math.random()*2400,te+.2+Math.random()*1.1,.07,{type:'sine',vol:.04}); },
  blackhole(){ tone(38,0,3.6,{type:'sine',vol:.36,to:150}); tone(70,0,3.6,{type:'sawtooth',vol:.05,to:320}); noise(.2,3.0,.2);
    for(let i=0;i<10;i++) tone(300+i*70,.3+i*.3,.8,{type:'sine',vol:.025,to:1500+i*150});
    tone(60,3.42,1.2,{type:'sine',vol:.55,to:20}); noise(3.4,1.0,.5); [523,784,1047,1568,2093,3136].forEach((f,i)=>tone(f,3.5+i*.08,.8,{type:'triangle',vol:.11}));
    for(let i=0;i<26;i++) tone(2200+Math.random()*2600,3.9+Math.random()*1.3,.07,{type:'sine',vol:.04}); },
  shark(){ noise(0,1.0,.22); tone(90,0,1.2,{type:'sine',vol:.2,to:240});
    for(let i=0;i<14;i++) tone(500+Math.random()*900,.05+i*.07,.09,{type:'sine',vol:.04,to:1600});
    [1.5,1.95,2.35,2.7,2.98,3.2,3.38].forEach((t,i)=>{ const f=i%2?87.3:82.4; tone(f,t,.32,{type:'sawtooth',vol:.1}); tone(f/2,t,.4,{type:'sine',vol:.25}); });
    tone(300,3.5,.9,{type:'sawtooth',vol:.06,to:1800}); tone(450,3.5,.9,{type:'square',vol:.03,to:2600});
    noise(4.4,.5,.6); tone(55,4.4,.9,{type:'sine',vol:.6,to:22}); tone(2200,4.38,.25,{type:'sawtooth',vol:.18,to:300}); noise(4.46,.2,.5); noise(4.52,.2,.5);
    [5.0,5.55].forEach(t=>{ noise(t,.4,.35); tone(900,t,.38,{type:'sawtooth',vol:.07,to:200}); tone(70,t+.2,.4,{type:'sine',vol:.35,to:28});
      [1047,1319,1568,2093].forEach((f,i)=>tone(f,t+.2+i*.05,.5,{type:'triangle',vol:.1})); });
    for(let i=0;i<24;i++) tone(2200+Math.random()*2600,5.3+Math.random()*1.5,.07,{type:'sine',vol:.04}); },
  stars(){ [1568,2093,2637,3136].forEach((f,i)=>tone(f,i*.05,.25,{type:'sine',vol:.1})); },
  hearts(){ [659,784,988,1319].forEach((f,i)=>tone(f,i*.09,.4,{type:'sine',vol:.12})); tone(1976,.4,.6,{type:'sine',vol:.08}); },
  lightning(){ for(let i=0;i<3;i++){ noise(i*.26,.18,.4); tone(1400,i*.26,.12,{type:'sawtooth',vol:.08,to:120}); tone(70,i*.26+.05,.35,{type:'sine',vol:.3,to:30}); } },
  meteor(){ tone(120,0,1.2,{type:'sine',vol:.22,to:40}); for(let i=0;i<8;i++){ tone(1800,.1+i*.2,.35,{type:'sawtooth',vol:.04,to:200}); noise(.5+i*.2,.25,.3); tone(80,.5+i*.2,.3,{type:'sine',vol:.25,to:28}); } [1047,1319,1568,2093].forEach((f,i)=>tone(f,1.8+i*.08,.4,{type:'triangle',vol:.1})); },
  win(){ [523,659,784,1047].forEach((f,i)=>tone(f,i*.11,.35,{type:'triangle',vol:.15})); tone(1047,.5,.8,{type:'sine',vol:.12}); tone(1319,.5,.8,{type:'sine',vol:.09}); }
};
/* BlaxWhit sound pack: glassy bells, sub-bass hits, airy sweeps (replaces the chiptune beeps) */
function bell(f,t,d=.9,v=.12){ tone(f,t,d,{type:'sine',vol:v}); tone(f*2.76,t,d*.35,{type:'sine',vol:v*.28}); tone(f*5.4,t,d*.12,{type:'sine',vol:v*.1}); }
function sub(f,t,d=.5,v=.3,to=null){ tone(f,t,d,{type:'sine',vol:v,to:to||f*.5}); }
function air(t,d=.6,v=.14,from=300,to=3000){ const c=ac(); if(!c) return; const len=Math.floor(c.sampleRate*d), buf=c.createBuffer(1,len,c.sampleRate), data=buf.getChannelData(0);
  for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/len);
  const s=c.createBufferSource(); s.buffer=buf; const f=c.createBiquadFilter(); f.type='bandpass'; f.Q.value=1.2;
  const st=c.currentTime+t; f.frequency.setValueAtTime(from,st); f.frequency.exponentialRampToValueAtTime(to,st+d);
  const g=c.createGain(); g.gain.value=v; s.connect(f); f.connect(g); g.connect(out()); s.start(st); }
const E5=659.25,G5=783.99,B5=987.77,D6=1174.66,E6=1318.5,G6=1568,B6=1975.5,E7=2637;
const sfxBW={
  coin(){ bell(E6,0,.8,.12); bell(B6,.07,.9,.09); },
  coin2(){ [E6,G6,B6].forEach((f,i)=>bell(f,i*.06,.9,.1)); },
  big(){ [E5,B5,E6,G6,B6].forEach((f,i)=>bell(f,i*.06,1.1,.1)); sub(70,0,.5,.22); },
  mega(){ [E5,G5,B5,D6,E6,G6,B6,E7].forEach((f,i)=>bell(f,i*.055,1.4,.1)); sub(55,0,.9,.3); air(0,.7,.12,400,5000); },
  tick(arg){
    if(arg===true){ bell(B5,0,.5,.12); sub(80,0,.18,.18); return; }       // start-of-auction beats
    const n=Number(arg)||0;
    if(n===3){ bell(E5,0,.55,.13); sub(70,0,.2,.25); }
    else if(n===2){ bell(G5,0,.7,.14); sub(66,0,.28,.3); }
    else if(n===1){ bell(B5,0,1.0,.16); bell(E6,.02,1.1,.1); sub(52,0,.7,.4); air(0,.5,.1,500,4500); }
    else { tone(1200,0,.03,{type:'sine',vol:.05}); }
  },
  over(){ air(0,.45,.2,2600,260); sub(120,0,.4,.22,40); },
  snipe(){ sub(48,0,1.1,.5,26); air(0,.9,.2,200,3800); [E6,G6,B6].forEach((f,i)=>bell(f,.6+i*.07,1.2,.08)); },
  bonus(){ bell(G6,0,.7,.13); bell(B6,.09,.7,.13); bell(E7,.18,1.0,.1); sub(110,0,.25,.2); },
  win(){ sub(65,0,1.8,.36,40); air(0,1.1,.16,250,4200); [E5,B5,E6,G6,B6,E7].forEach((f,i)=>bell(f,.25+i*.1,1.9,.11)); bell(E6,1.1,2.2,.12); bell(B6,1.1,2.2,.09); },
  pip(k){ bell(1800+k*900,0,.12,.05); }
};
/* ---------- Classic "HEX" sound pack (all new): FM glass plucks, filtered saw sweeps, digital zaps, sub thumps ---------- */
function ftone(freq,start,dur,{type='sawtooth',vol=.1,cut=2400,cutTo=null,q=1,to=null,att=.006}={}){
  const c=ac(); if(!c) return;
  const t=c.currentTime+start, o=c.createOscillator(), f=c.createBiquadFilter(), g=c.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,t); if(to) o.frequency.exponentialRampToValueAtTime(to,t+dur);
  f.type='lowpass'; f.Q.value=q; f.frequency.setValueAtTime(cut,t); if(cutTo) f.frequency.exponentialRampToValueAtTime(cutTo,t+dur);
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+att); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(f); f.connect(g); g.connect(out()); o.start(t); o.stop(t+dur+.03);
}
function fmtone(freq,ratio,idx,start,dur,vol=.1){
  const c=ac(); if(!c) return;
  const t=c.currentTime+start, car=c.createOscillator(), mod=c.createOscillator(), mg=c.createGain(), g=c.createGain();
  car.frequency.value=freq; mod.frequency.value=freq*ratio;
  mg.gain.setValueAtTime(freq*idx,t); mg.gain.exponentialRampToValueAtTime(freq*.01+1,t+dur*.8);
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.004); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(out());
  car.start(t); mod.start(t); car.stop(t+dur+.03); mod.stop(t+dur+.03);
}
function hxzap(f0,f1,start,dur,vol=.08){ ftone(f0,start,dur,{type:'square',vol,cut:6000,cutTo:300,to:f1}); }
function hxthump(f,start,dur=.5,vol=.4){ tone(f*2.2,start,.05,{type:'sine',vol:vol*.5,to:f}); tone(f,start,dur,{type:'sine',vol,to:f*.4}); }
const HXN=[587.33,659.25,739.99,880,987.77,1174.66,1318.5,1479.98,1760,1975.53,2349.32,2637]; // D major pentatonic ladder
const sfxHex={
  coin(){ fmtone(HXN[7],2,3,0,.28,.11); fmtone(HXN[9],3,2,.06,.34,.08); },
  coin2(){ [5,7,9].forEach((n,i)=>fmtone(HXN[n],2,2.5,i*.055,.3,.09)); hxzap(900,2400,0,.09,.03); },
  stars(){ [8,9,10,11].forEach((n,i)=>fmtone(HXN[n],3.01,1.5,i*.045,.35,.07)); },
  hearts(){ [2,4,6,8].forEach((n,i)=>fmtone(HXN[n],1,1.2,i*.08,.5,.09)); ftone(HXN[0],0,.7,{type:'triangle',vol:.06,cut:1200}); },
  big(){ hxthump(80,0,.45,.3); [4,6,8,9,10].forEach((n,i)=>fmtone(HXN[n],2,3,.05+i*.055,.45,.09)); air(0,.35,.1,500,5000); },
  confetti(){ noise(0,.1,.3); noise(.04,.08,.2); [3,5,7,9,10].forEach((n,i)=>ftone(HXN[n],.05+i*.05,.22,{type:'square',vol:.04,cut:5000,cutTo:900})); hxzap(300,3000,0,.18,.035); },
  lightning(){ for(let i=0;i<3;i++){ noise(i*.24,.14,.35); hxzap(5200,160,i*.24,.2,.07); hxthump(62,i*.24+.04,.4,.3); fmtone(HXN[8+i%2],5.01,4,i*.24+.02,.2,.05); } },
  fireworks(){ for(let i=0;i<4;i++){ const t=i*.36; ftone(300+i*90,t,.28,{type:'sawtooth',vol:.04,cut:1500,cutTo:5000,to:1400}); noise(t+.28,.3,.26); [6,8,10].forEach((n,j)=>fmtone(HXN[n],2.5,2,t+.28+j*.03,.35,.06)); } },
  nuke(){
    ftone(70,0,.7,{type:'sawtooth',vol:.12,cut:300,cutTo:2600,to:420}); air(0,.7,.14,200,6000);
    hxthump(46,.72,1.3,.55); noise(.72,1.0,.35); hxzap(2400,60,.72,.7,.08);
    [4,6,8,10,11].forEach((n,i)=>fmtone(HXN[n],2,3,1.5+i*.08,.6,.07));
  },
  moneygun(){ for(let i=0;i<10;i++){ hxzap(4200,700,.08+i*.085,.07,.05); noise(.08+i*.085,.04,.16); } hxthump(70,0,.3,.3); [6,8,9,10,11].forEach((n,i)=>fmtone(HXN[n],2,3,1.1+i*.07,.5,.08)); },
  galaxy(){
    ftone(110,0,1.4,{type:'sawtooth',vol:.08,cut:200,cutTo:5000,to:880}); ftone(165,0,1.4,{type:'sawtooth',vol:.05,cut:200,cutTo:6000,to:1320});
    air(0,1.4,.14,150,7000); hxthump(52,1.35,1.0,.4); [3,5,7,9,10,11].forEach((n,i)=>fmtone(HXN[n],3,2,1.4+i*.07,.8,.07));
  },
  meteor(){
    ftone(900,0,.9,{type:'sawtooth',vol:.05,cut:6000,cutTo:200,to:90});
    for(let i=0;i<6;i++){ const t=.35+i*.2; noise(t,.22,.32); hxthump(56+i*3,t,.4,.32); fmtone(HXN[5+i%3],4,3,t,.3,.04); }
    [6,8,10,11].forEach((n,i)=>fmtone(HXN[n],2,3,1.7+i*.08,.6,.07));
  },
  tick(arg){
    if(arg===true){ fmtone(HXN[5],2,2,0,.2,.08); return; }
    const n=Number(arg)||0;
    if(n===3){ fmtone(HXN[3],1,2,0,.3,.1); hxthump(70,0,.18,.2); }
    else if(n===2){ fmtone(HXN[5],1,2,0,.35,.11); hxthump(62,0,.22,.26); }
    else if(n===1){ fmtone(HXN[7],1,2.5,0,.5,.13); fmtone(HXN[10],2,2,.02,.5,.07); hxthump(52,0,.5,.34); air(0,.4,.1,400,5000); }
    else ftone(1800,0,.03,{type:'square',vol:.025,cut:4000});
  },
  over(){ hxzap(1800,120,0,.35,.07); air(0,.35,.14,3000,200); hxthump(90,.05,.3,.2); },
  pip(k){ fmtone(1500+k*1100,2,1,0,.07,.03); },
  snipe(){ hxthump(44,0,1.0,.5); air(0,.8,.16,200,5000); [3,5,7].forEach((n,i)=>fmtone(HXN[n],2,2,.5+i*.07,.8,.06)); ftone(HXN[0]/2,0,.9,{type:'sawtooth',vol:.06,cut:400,cutTo:1800}); },
  bonus(){ [5,7,9,11].forEach((n,i)=>fmtone(HXN[n],2,2.5,i*.06,.4,.08)); hxthump(100,0,.2,.2); },
  win(){ hxthump(56,0,1.3,.4); air(0,.9,.15,250,6000); [2,4,5,7,9,10,11].forEach((n,i)=>fmtone(HXN[n],2,2.2,.2+i*.085,.9,.075)); [4,7,10].forEach(n=>fmtone(HXN[n],1,1.5,1.0,1.5,.07)); }
};
function play(name,arg){ if(soundOn()){ try{ const pk=isBW()?sfxBW:sfx; (pk[name]||sfx[name])(arg); }catch{} } }
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
  const colors=isBW()?['#ffffff','#f1f1f1','#cfcfcf','#9a9a9a','#ffffff','#6a6a6a']:['#ffd23f','#ff3b3b','#4dff7a','#22d3ee','#b34dff','#ff3bd4','#ffffff','#ff9f1a'];
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
  const color=v==='transparent'?'transparent':v==='black'?'#000':v==='blue'?'#001a66':v==='green'?'#00ff00':/^[0-9a-f]{3,8}$/.test(v)?'#'+v:'';
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
/* tier = visual level (CSS), kind = which effect plays
   1-19 coin | 20+ fountain | 50+ confetti | 100+ burst | 200+ fireworks | 299+ NUKE | 500+ MONEY GUN | 1000+ GALAXY */
const tierOf=n=>n>=299?5:n>=100?4:n>=50?3:n>=10?2:1;
const kindOf=n=>n>=5000?'blackhole':n>=3000?'meteor':n>=2100?'shark':n>=1000?'galaxy':n>=500?'moneygun':n>=299?'nuke':n>=200?'fireworks':n>=150?'lightning':n>=100?'burst':n>=50?'confetti':n>=35?'hearts':n>=20?'fountain':n>=10?'stars':'coin';
const KIND_TAG_HEX={coin:'HEX DROP',stars:'PRISM DROP',fountain:'JET DROP',hearts:'PENTA DROP',confetti:'PARTY DROP',burst:'SHOCK DROP',lightning:'ARC DROP',fireworks:'NOVA DROP',nuke:'CORE DROP',moneygun:'RAIL DROP',galaxy:'GRID DROP',meteor:'METEOR DROP',shark:'SHARK DROP'};
const KIND_TAG={coin:'DROP',stars:'STAR DROP',fountain:'NICE DROP',hearts:'♥ LOVE DROP',confetti:'SUPER DROP',burst:'BIG DROP',lightning:'⚡ THUNDER DROP!',fireworks:'MEGA DROP',nuke:'☢ NUKE DROP!!!',moneygun:'💸 MONEY GUN DROP!!',galaxy:'✦ GALAXY DROP!!!',meteor:'☄ METEOR DROP!!!!',shark:'🦈 SHARK DROP!!!!',blackhole:'🕳 BLACK HOLE DROP!!!!!'};
function burstFx(x,y,tier){
  const fx=$('fx'); if(!fx) return;
  tier=Math.max(1,Math.min(4,tier));
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
  const t=Math.max(tier,tierOf(combo.total)), kind=kindOf(Math.max(g.coins,combo.total));
  $('giftAvatar').src=avatar(g.avatar);
  $('giftName').textContent=g.nickname||'';
  $('giftAmt').textContent='+'+combo.total.toLocaleString();
  $('giftTag').textContent=KIND_TAG[kind];
  const cb=$('giftCombo');
  cb.classList.remove('on'); cb.textContent='x'+combo.count;
  if(combo.count>1){ void cb.offsetWidth; cb.classList.add('on'); }
  el.className='gift-alert t'+Math.min(5,t)+' k-'+kind;
  void el.offsetWidth; el.classList.add('show');
}
function onGift(g){
  const tier=tierOf(g.coins);
  try{ dropNote(g); }catch(e){}
  play(kindOf(g.coins)==='moneygun'?'moneygun':kindOf(g.coins)==='blackhole'?'blackhole':({shark:'shark',meteor:'meteor',galaxy:'galaxy',moneygun:'moneygun',nuke:'nuke',fireworks:'fireworks',lightning:'lightning',burst:'big',confetti:'confetti',hearts:'hearts',fountain:'coin2',stars:'stars',coin:'coin'}[kindOf(g.coins)]), g.coins);
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
// Overlay skin (Theme 1 = classic, Theme 2 = blaxwhit). ?skin=blaxwhit in the URL overrides the saved one.
function applySkin(t){
  const q=(new URLSearchParams(location.search).get('skin')||'').toLowerCase();
  const v=['classic','blaxwhit'].includes(q)?q:(t==='blaxwhit'?'blaxwhit':'classic');
  if(document.documentElement.dataset.skin!==v){ document.documentElement.dataset.skin=v; if(typeof FX!=='undefined') FX.sprites=null; }
}
let lastBonusId;
function showBonus(sec){
  const el=$('timeBonus'); if(!el) return;
  el.textContent=`+${sec}s`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  play('bonus');
}
/* LAST DROP / BIGGEST DROP chips (reset every auction) */
let dropBig={n:0,name:''}, dropLast=null;
function dropReset(){ dropBig={n:0,name:''}; dropLast=null; const a=$('dsLast'),b=$('dsBig'); if(a) a.textContent='—'; if(b) b.textContent='—'; }
function dropNote(g){
  const a=$('dsLast'),b=$('dsBig'); if(!a||!b) return;
  const n=Number(g.coins)||0, nm=String(g.nickname||'');
  a.textContent=`${nm} +${n.toLocaleString()} C`; a.classList.remove('flash'); void a.offsetWidth; a.classList.add('flash');
  if(n>dropBig.n){ dropBig={n,name:nm}; b.textContent=`${nm} ${n.toLocaleString()} C`; b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
}
// header "assembles" on load and again whenever an auction starts (BlaxWhit)
function playHeaderIntro(){
  const r=$('overlayRoot'); if(!r) return;
  r.classList.remove('bw-intro'); void r.offsetWidth; r.classList.add('bw-intro');
  clearTimeout(playHeaderIntro.t); playHeaderIntro.t=setTimeout(()=>r.classList.remove('bw-intro'),2600);
}
let introEnd=0;
function runIntro(){
  const big=$('bigCount'); introEnd=Date.now()+1800; playHeaderIntro();
  [3,2,1].forEach((n,i)=>setTimeout(()=>{
    big.textContent=n; big.classList.add('green'); big.style.setProperty('--cd','.58s');
    big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop');
    try{play('tick',true)}catch{}
  },i*600));
}
function render(s){
  state=s; serverOffset=(s.serverNow||Date.now())-Date.now();
  if(lastAuctionId!==null && s.auctionId!==lastAuctionId){ previousCoins.clear(); prevTopKey=null; try{ dropReset(); }catch(e){} }
  lastAuctionId=s.auctionId;
  const prevPhase=lastPhase; lastPhase=s.phase;
  document.body.className=`overlay-body ${s.phase}`;
  applySkin(s.config?.overlayTheme);
  if(prevPhase!==null && (prevPhase==='idle'||prevPhase==='finished') && s.phase==='regular') runIntro();
  if(prevPhase!==null && prevPhase!=='snipe' && s.phase==='snipe'){ const st=$('stack'); st.classList.remove('snipe-in'); void st.offsetWidth; st.classList.add('snipe-in'); setTimeout(()=>st.classList.remove('snipe-in'),1300); play('snipe'); }
  if(lastBonusId===undefined) lastBonusId=s.lastBonus?.id??0;
  else if(s.lastBonus && s.lastBonus.id>lastBonusId){ lastBonusId=s.lastBonus.id; showBonus(s.lastBonus.seconds); }

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
  rowsEl.innerHTML=s.phase==='idle'&&!users.length?'<div class="ov-row empty-row"><div class="ov-info"><div class="ov-name">Auction hasn\'t started yet</div></div></div>':users.map((u,i)=>{
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
    const burst=delta>0?`<span class="coin-burst t${Math.min(4,tier)}">+${delta.toLocaleString()} C</span>`:'';
    const star=i===0?'<span class="star">★</span>':'';
    let gap='';
    if(activePhase && i>0) gap=`<div class="gap-right">-${(users[0].coins-u.coins).toLocaleString()}<i class="coin red"></i></div>`;
    return `<div class="ov-row rank${i+1}${hit}${previousCoins.has(key)?'':' bw-enter'}" data-key="${esc(key)}" data-tier="${tier}" data-from="${cnt?cnt.cur:(prev??u.coins)}" data-to="${u.coins}" style="--sd:${sheenDelay(i+4)}"><div class="ov-rank"><div class="medal m${i+1}">${i+1}</div></div><span class="avw"><img class="ov-avatar" src="${esc(avatar(u.avatar))}" alt=""></span><div class="ov-info"><div class="ov-name"><span class="nm">${esc(u.nickname)}</span>${star}</div><div class="ov-coins-wrap"><span class="ov-coins${(rainbowUntil.get(key)||0)>Date.now()?' rainbow-num':''}">${shown.toLocaleString()}</span><i class="coin"></i>${burst}</div></div>${gap}<i class="bw-meter" style="--p:${(u.coins/Math.max(1,users[0].coins)).toFixed(3)}"></i></div>`;
  }).join('')+[1,2,3].filter(n=>n>users.length).map(n=>{const rv=Date.now()<introEnd+900; const dl=((introEnd+(n-1)*220-Date.now())/1000).toFixed(2); return `<div class="ov-row rank${n} placeholder${rv?' reveal':''}" data-tier="0" style="--sd:${sheenDelay(n+3)}${rv?`;animation-delay:${dl}s`:''}"><div class="ov-rank"><div class="medal m${n}">${n}</div></div><span class="avw"><div class="ov-avatar q">?</div></span><div class="ov-info"><div class="ov-name"><span class="nm">???</span></div><div class="ov-coins-wrap"><span class="ov-coins">???</span><i class="coin"></i></div></div><i class="bw-meter" style="--p:0"></i></div>`}).join('');
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
    if(tier>=2 && fxBig(key,from,to,tier)) { /* canvas effect handles counting */ }
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
  if(overtaken){ showOvertaken(users[0].nickname); setTimeout(()=>play('over'),140); const r1=rowsEl.querySelector('.rank1'); if(r1){ r1.classList.add('bw-crown'); setTimeout(()=>r1.classList.remove('bw-crown'),1000); } }

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
// Final countdown is stretched: "3" = 1.0s, "2" = 1.5s, "1" = 2.0s (server waits the same tail).
const COUNT_SEGMENTS=[[2000,1],[3500,2],[4500,3]]; // [upper bound of effective ms, number shown]
function countNumber(e){ for(const [lim,n] of COUNT_SEGMENTS) if(e<=lim) return n; return null; }
function handleCountdown(e){
  const ph=state.phase, stack=$('stack');
  const sec=countNumber(e);
  if(!(ph==='snipe'||ph==='draw') || e<=0 || sec===null){ lastCountSec=null; stack.classList.remove('counting'); return; }
  if(sec===lastCountSec) return;
  lastCountSec=sec;
  play('tick', sec);
  const big=$('bigCount');
  big.classList.remove('green');
  big.textContent=sec;
  big.style.setProperty('--cd', sec===3?'.95s':sec===2?'1.45s':'1.95s');
  big.classList.remove('pop'); void big.offsetWidth; big.classList.add('pop');
  stack.classList.add('counting');
}
// BlaxWhit time bar: shrinks with the phase; jumps back up when a gift adds bonus time.
let barTotal=1, barKey='', lastWhole=null;
function updateBar(raw){
  const fill=$('bwFill'); if(!fill||!state) return;
  const ph=state.phase, c=state.config||{};
  const cfg=ph==='regular'?c.regularSeconds:ph==='snipe'?c.snipeSeconds:ph==='draw'?c.drawSeconds:0;
  const key=`${state.auctionId}:${ph}`;
  if(key!==barKey){ barKey=key; barTotal=Math.max(1,(cfg||0)*1000); }
  if(raw>barTotal) barTotal=raw;
  fill.style.transform=`scaleX(${(ph==='regular'||ph==='snipe'||ph==='draw')?Math.min(1,raw/barTotal):0})`;
}
function updateTimer(){
  if(!state)return;
  const tail=Number(state.countdownTailMs??1500);
  const target=state.phaseEndsAt||0;
  const now=Date.now()+serverOffset;
  const raw=Math.max(0,target-now);
  const inTimed=state.phase==='snipe'||state.phase==='draw';
  const e=inTimed&&target?Math.max(0,target+tail-now):raw;   // effective time incl. tail
  let shown=raw;
  if(inTimed&&target){ const n=countNumber(e); shown=n!==null?n*1000:Math.max(0,e-tail); if(e<=0) shown=0; }
  $('timer').textContent=fmt(shown);
  updateBar(raw);
  const whole=Math.ceil(shown/1000);
  if(whole!==lastWhole){ lastWhole=whole; if(inTimed||state.phase==='regular'){ if(whole>0&&whole<=10){ const tm=$('timer'); tm.classList.remove('tp'); void tm.offsetWidth; tm.classList.add('tp'); } } }
  handleCountdown(inTimed&&target?e:raw);
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
playHeaderIntro();
initSparkles();
initSheens();
setInterval(updateTimer,100);
