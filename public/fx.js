/* ============================================================
   fx.js — heavy gift effects drawn on a canvas inside #stack
     10+   : STARS | 35+ : HEARTS | 150+ : LIGHTNING | 3000+ : METEOR SHOWER
     20+   : FOUNTAIN  — coins shoot up like a fountain, rain down, fly into the row
     50+   : CONFETTI  — two party cannons + coins
     100+  : BURST     — coins explode outward, then get sucked into the row
     200+  : FIREWORKS — rockets explode into coin showers
     299+  : NUKE      — missile hits the row: flash, shockwaves, mushroom cloud
     500+  : MONEY GUN — a money gun slides in and machine-guns bills into the player's frame
     1000+ : GALAXY    — nebula + spiral galaxy that collapses into the row
     2100+ : SHARK     — water floods the frame, shark swims by, jumpscare bite, fast dash adds C
   Uses globals from overlay.js: $, play, counters, collectToken, rowIcon, rowNum, pulseIcon
   ============================================================ */
if(typeof CanvasRenderingContext2D!=='undefined' && !CanvasRenderingContext2D.prototype.roundRect){ CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h){ this.rect(x,y,w,h); }; }
const FX = { cv:null, ctx:null, W:0, H:0, dpr:1, actors:[], raf:0, last:0, sprites:null };
const rainbowUntil = new Map(); // row key -> timestamp until the number stays rainbow

function fxSprites(){
  if (FX.sprites) return FX.sprites;
  const mk=(w,h,fn)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; fn(c.getContext('2d'),w,h); return c; };
  const coin=mk(64,64,(g,w,h)=>{
    const bw=document.documentElement.dataset.skin==='blaxwhit', c=w/2, R=c-2;
    const col=bw?['#ffffff','#e6e6e6','#8f8f8f','#6a6a6a','#c9c9c9']:['#fff3a6','#ffc928','#b87000','#8a5200','#e69a00'];
    // outer rim
    let gr=g.createLinearGradient(0,0,w,h); gr.addColorStop(0,col[0]); gr.addColorStop(.5,col[1]); gr.addColorStop(1,col[2]);
    g.beginPath(); g.arc(c,c,R,0,7); g.fillStyle=gr; g.fill();
    // reeded edge
    g.strokeStyle=bw?'rgba(70,70,70,.55)':'rgba(120,66,0,.55)'; g.lineWidth=1.6;
    for(let i=0;i<44;i++){ const a=i/44*Math.PI*2; g.beginPath(); g.moveTo(c+Math.cos(a)*(R-3.2),c+Math.sin(a)*(R-3.2)); g.lineTo(c+Math.cos(a)*R,c+Math.sin(a)*R); g.stroke(); }
    // face
    gr=g.createRadialGradient(w*.36,h*.3,2,c,c,R-4); gr.addColorStop(0,bw?'#ffffff':'#fff8c8'); gr.addColorStop(.5,bw?'#efefef':'#ffd23a'); gr.addColorStop(1,bw?'#b5b5b5':'#e39b00');
    g.beginPath(); g.arc(c,c,R-5,0,7); g.fillStyle=gr; g.fill(); g.lineWidth=2.2; g.strokeStyle=col[3]; g.stroke();
    g.beginPath(); g.arc(c,c,R-11,0,7); g.lineWidth=1.6; g.strokeStyle=bw?'rgba(255,255,255,.9)':'rgba(255,248,180,.85)'; g.stroke();
    // embossed C
    g.font='900 32px Arial'; g.textAlign='center'; g.textBaseline='middle';
    g.fillStyle=col[3]; g.fillText('C',c+1.6,c+2.4); g.fillStyle=bw?'#fff':'#fff6c0'; g.fillText('C',c-1.2,c-.6); g.fillStyle=col[4]; g.fillText('C',c,c+.8);
    // shine
    g.beginPath(); g.arc(c,c,R-8,Math.PI*1.08,Math.PI*1.62); g.lineWidth=4; g.lineCap='round'; g.strokeStyle='rgba(255,255,255,.65)'; g.stroke();
  });
  const star=mk(48,48,(g,w)=>{
    const c=w/2, gr=g.createRadialGradient(c,c,0,c,c,c);
    gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.25,'rgba(255,240,170,.8)'); gr.addColorStop(1,'rgba(255,200,60,0)');
    g.fillStyle=gr; g.fillRect(0,0,w,w);
    g.fillStyle='#fff'; g.beginPath();
    for(let i=0;i<8;i++){ const a=i*Math.PI/4, r=i%2?5:c-2; g.lineTo(c+Math.cos(a)*r,c+Math.sin(a)*r); }
    g.closePath(); g.fill();
  });
  const glow=mk(64,64,(g,w)=>{
    const c=w/2, gr=g.createRadialGradient(c,c,0,c,c,c);
    gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr; g.fillRect(0,0,w,w);
  });
  const bill=mk(60,30,(g,w,h)=>{
    const rr=(x,y,ww,hh,r)=>{ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+ww,y,x+ww,y+hh,r); g.arcTo(x+ww,y+hh,x,y+hh,r); g.arcTo(x,y+hh,x,y,r); g.arcTo(x,y,x+ww,y,r); g.closePath(); };
    const gr=g.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#ff9ee0'); gr.addColorStop(.55,'#e04dff'); gr.addColorStop(1,'#8a3bff');
    rr(1,1,w-2,h-2,4); g.fillStyle=gr; g.fill(); g.lineWidth=2; g.strokeStyle='#5a1a9a'; g.stroke();
    rr(5,5,w-10,h-10,3); g.lineWidth=1.3; g.strokeStyle='rgba(255,230,250,.85)'; g.stroke();
    g.beginPath(); g.arc(w/2,h/2,8,0,7); g.fillStyle='rgba(80,10,130,.35)'; g.fill(); g.strokeStyle='rgba(255,230,250,.9)'; g.stroke();
    g.fillStyle='#fff0fb'; g.font='bold 13px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('C',w/2,h/2+1);
    g.fillStyle='rgba(255,255,255,.28)'; g.fillRect(2,2,w-4,4);
  });
  const gun=mk(190,120,(g,w,h)=>{
    g.translate(50,44); g.lineJoin='round'; g.lineCap='round';
    const OL='#2a0f55', rr=(x,y,ww,hh,r)=>{ g.beginPath(); g.roundRect(x,y,ww,hh,r); };
    // money roll on top
    for(let i=0;i<4;i++){ g.fillStyle=i%2?'#c04dff':'#ff7ad9'; g.strokeStyle=OL; g.lineWidth=2; g.beginPath(); g.rect(-28+i*3,-38+i*4,52,9); g.fill(); g.stroke(); }
    // drum magazine under the barrel
    const dg=g.createRadialGradient(46,22,2,52,28,24); dg.addColorStop(0,'#d9b3ff'); dg.addColorStop(.6,'#7b3fe0'); dg.addColorStop(1,'#35167a');
    g.fillStyle=dg; g.strokeStyle=OL; g.lineWidth=3; g.beginPath(); g.arc(52,26,20,0,7); g.fill(); g.stroke();
    g.strokeStyle='#ffd23f'; g.lineWidth=2.5; g.beginPath(); g.arc(52,26,14,0,7); g.stroke();
    g.fillStyle='#fff0fb'; g.font='900 18px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('C',52,27);
    // ribbed barrel shroud with vents
    const bg=g.createLinearGradient(0,-12,0,8); bg.addColorStop(0,'#f6e4ff'); bg.addColorStop(.5,'#b58cf0'); bg.addColorStop(1,'#5a36a8');
    g.fillStyle=bg; g.strokeStyle=OL; g.lineWidth=3; rr(16,-13,92,19,6); g.fill(); g.stroke();
    g.fillStyle='rgba(30,5,70,.75)'; for(let i=0;i<5;i++){ rr(30+i*13,-8,7,9,3); g.fill(); }
    // gold muzzle brake + glowing tip
    const mg=g.createLinearGradient(0,-16,0,10); mg.addColorStop(0,'#fff3b0'); mg.addColorStop(1,'#d99200');
    g.fillStyle=mg; g.strokeStyle=OL; rr(104,-16,12,25,3); g.fill(); g.stroke();
    g.fillStyle='#ff5ad8'; g.fillRect(113,-9,4,11);
    // receiver body
    const body=g.createLinearGradient(0,-22,0,20); body.addColorStop(0,'#ffa8ec'); body.addColorStop(.5,'#ff3bd4'); body.addColorStop(1,'#7a22d8');
    g.fillStyle=body; g.strokeStyle=OL; g.lineWidth=3; rr(-42,-22,70,42,10); g.fill(); g.stroke();
    g.strokeStyle='#ffd23f'; g.lineWidth=2; g.beginPath(); g.moveTo(-36,10); g.lineTo(20,10); g.stroke();
    g.fillStyle='rgba(255,255,255,.4)'; rr(-35,-18,52,6,3); g.fill();
    // gold C emblem
    g.fillStyle='#ffd23f'; g.strokeStyle=OL; g.lineWidth=2; g.beginPath(); g.arc(-12,-2,10,0,7); g.fill(); g.stroke();
    g.fillStyle='#7a22d8'; g.font='900 14px Arial'; g.fillText('C',-12,-1);
    // grip
    g.fillStyle='#43206e'; g.strokeStyle=OL; g.lineWidth=3; g.beginPath(); g.moveTo(-34,18); g.lineTo(-10,18); g.lineTo(-16,58); g.lineTo(-42,58); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle='rgba(255,150,240,.55)'; g.lineWidth=1.5; for(let i=0;i<4;i++){ g.beginPath(); g.moveTo(-36+i*0,26+i*8); g.lineTo(-18,26+i*8-2); g.stroke(); }
    // trigger guard + trigger
    g.beginPath(); g.arc(6,24,11,0,Math.PI); g.strokeStyle=OL; g.lineWidth=4; g.stroke();
    g.fillStyle=OL; g.fillRect(4,19,4,12);
  });
  const heart=mk(48,48,(g,w,h)=>{
    const gr=g.createRadialGradient(18,16,2,24,24,26); gr.addColorStop(0,'#ffd0f0'); gr.addColorStop(.5,'#ff4fc3'); gr.addColorStop(1,'#b01fd0');
    g.fillStyle=gr; g.strokeStyle='#ffe0f6'; g.lineWidth=3;
    g.beginPath(); g.moveTo(24,42); g.bezierCurveTo(2,28,4,8,16,8); g.bezierCurveTo(21,8,24,12,24,15); g.bezierCurveTo(24,12,27,8,32,8); g.bezierCurveTo(44,8,46,28,24,42); g.closePath(); g.fill(); g.stroke();
  });
  const pglow=mk(64,64,(g,w)=>{
    const c=w/2, gr=g.createRadialGradient(c,c,0,c,c,c);
    gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.3,'rgba(255,120,230,.8)'); gr.addColorStop(1,'rgba(160,60,255,0)');
    g.fillStyle=gr; g.fillRect(0,0,w,w);
  });
  return (FX.sprites={coin,star,glow,bill,gun,heart,pglow});
}

function fxStart(){
  const cv=$('fxc'), box=$('stack').getBoundingClientRect();
  if(!cv) return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  if(FX.cv!==cv || Math.abs(FX.W-box.width)>1 || Math.abs(FX.H-box.height)>1){
    FX.cv=cv; FX.W=box.width; FX.H=box.height; FX.dpr=dpr;
    cv.width=Math.round(box.width*dpr); cv.height=Math.round(box.height*dpr);
    FX.ctx=cv.getContext('2d');
  }
  if(!FX.raf){ FX.last=performance.now(); FX.raf=requestAnimationFrame(fxLoop); }
}
function fxLoop(now){
  const dt=Math.min(.05,(now-FX.last)/1000); FX.last=now;
  const g=FX.ctx; g.setTransform(FX.dpr,0,0,FX.dpr,0,0); g.clearRect(0,0,FX.W,FX.H);
  const cur=FX.actors; FX.actors=[]; const keep=[];
  for(const a of cur){
    a.t+=dt;
    try{ a.step&&a.step(dt,a); if(a.t>=0 && !a.done) a.draw(g,a); }catch(e){ a.done=true; }
    if(!a.done) keep.push(a);
  }
  FX.actors=keep.concat(FX.actors); // keep actors spawned during this frame
  if(FX.actors.length) FX.raf=requestAnimationFrame(fxLoop);
  else { FX.raf=0; g.clearRect(0,0,FX.W,FX.H); }
}
function fxAdd(a,delay=0){ a.t=-delay; a.done=false; if(FX.actors.length>700) FX.actors.splice(0,100); FX.actors.push(a); fxStart(); return a; }

/* ---------- helpers ---------- */
function offIn(el,stack){ let x=0,y=0; while(el&&el!==stack){ x+=el.offsetLeft; y+=el.offsetTop; el=el.offsetParent; } return {x,y}; }
function fxTarget(key){
  const stack=$('stack');
  const row=document.querySelector(`.ov-row[data-key="${CSS.escape(key)}"]`);
  const ic=rowIcon(key);
  if(!row||!ic||!stack) return null;
  const i=offIn(ic,stack), r=offIn(row,stack);
  return { x:i.x+ic.offsetWidth/2, y:i.y+ic.offsetHeight/2, rx:r.x+row.offsetWidth/2, ry:r.y+row.offsetHeight/2 };
}
function fxCounter(key,from,to){
  const token=++collectToken;
  counters.set(key,{cur:from,token});
  return {
    set(v){ const c=counters.get(key); if(!c||c.token!==token) return false; c.cur=v; const n=rowNum(key); if(n) n.textContent=v.toLocaleString(); return true; },
    end(){ const c=counters.get(key); if(c&&c.token===token){ counters.delete(key); const n=rowNum(key); if(n) n.textContent=to.toLocaleString(); } }
  };
}
function fxSpark(x,y,size=22){
  const S=fxSprites();
  fxAdd({ life:.28, draw(g,a){ const k=a.t/a.life; if(k>=1){a.done=true;return;} g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=1-k; const s=size*(.6+k*1.2); g.drawImage(S.star,x-s/2,y-s/2,s,s); g.restore(); } });
}
function fxRing(x,y,{color='255,210,63',max=240,life=.6,width=10,delay=0}={}){
  fxAdd({ draw(g,a){ const k=a.t/life; if(k>=1){a.done=true;return;} const e=1-Math.pow(1-k,2.2);
    g.save(); g.globalCompositeOperation='lighter'; g.lineWidth=Math.max(1,(1-k)*width); g.strokeStyle=`rgba(${color},${1-k})`;
    g.beginPath(); g.arc(x,y,Math.max(1,e*max),0,Math.PI*2); g.stroke(); g.restore(); } },delay);
}
function fxFlash(color,peak,life){
  fxAdd({ draw(g,a){ const k=a.t/life; if(k>=1){a.done=true;return;} g.save(); g.globalAlpha=peak*Math.pow(1-k,2); g.fillStyle=color; g.fillRect(0,0,FX.W,FX.H); g.restore(); } });
}
function drawCoin(g,S,x,y,r,rot,alpha=1){
  g.save(); g.globalAlpha=alpha; g.translate(x,y);
  const sx=Math.abs(Math.cos(rot))*.86+.14, bw=document.documentElement.dataset.skin==='blaxwhit';
  if(sx<.55){ g.fillStyle=bw?'#9a9a9a':'#b87400'; g.beginPath(); g.ellipse(0,0,Math.max(1,r*(1-sx)*.34+r*sx),r,0,0,7); g.fill(); }
  g.scale(sx,1); g.drawImage(S.coin,-r,-r,r*2,r*2); g.restore();
}
function fxTrail(g,x,y,vx,vy,r,color='255,210,63'){
  const sp=Math.hypot(vx,vy); if(sp<220) return;
  const L=Math.min(54,sp*.05);
  g.save(); g.globalCompositeOperation='lighter'; g.lineCap='round';
  const lg=g.createLinearGradient(x,y,x-vx/sp*L,y-vy/sp*L); lg.addColorStop(0,`rgba(${color},.7)`); lg.addColorStop(1,`rgba(${color},0)`);
  g.strokeStyle=lg; g.lineWidth=Math.max(2,r*.8); g.beginPath(); g.moveTo(x,y); g.lineTo(x-vx/sp*L,y-vy/sp*L); g.stroke(); g.restore();
}
function fxRainbow(key,ms){
  rainbowUntil.set(key,Date.now()+ms);
  const n=rowNum(key); if(n) n.classList.add('rainbow-num');
  setTimeout(()=>{ if((rainbowUntil.get(key)||0)<=Date.now()){ rainbowUntil.delete(key); const e=rowNum(key); if(e) e.classList.remove('rainbow-num'); } },ms+60);
}

/* ============================================================
   100+ : BURST
   ============================================================ */

/* ============================================================
   500+ : GALAXY
   ============================================================ */
function fxGalaxy(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const S=fxSprites(), W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, cnt=fxCounter(key,from,to);
  const C={x:W/2,y:H*.5}, LIFE=3.4+Math.min(1.2,delta/6000), N=Math.min(320,170+Math.round(delta/20));
  let arrived=0;
  const stars=Array.from({length:130},()=>({x:Math.random()*W,y:Math.random()*H,s:1+Math.random()*2.2,p:Math.random()*6.28}));
  const env=t=>Math.max(0,Math.min(1,t/.5,(LIFE-t)/.8));
  fxFlash('#b48cff',.35,.5);
  if(delta>=3000){ fxRing(C.x,C.y,{color:'180,140,255',max:380,life:.9,width:14,delay:.3}); fxRing(C.x,C.y,{color:'255,80,210',max:300,life:.9,width:10,delay:.5}); }
  // nebula + starfield + core (one actor, drawn first = underneath)
  fxAdd({ draw(g,a){
    const t=a.t; if(t>=LIFE){a.done=true;return;} const e=env(t);
    g.save();
    g.globalAlpha=.62*e; g.fillStyle='#05001c'; g.fillRect(0,0,W,H);
    g.globalCompositeOperation='lighter';
    const cols=['123,44,255','255,47,208','47,140,255'];
    for(let j=0;j<3;j++){
      const ang=t*1.1+j*2.094, bx=C.x+Math.cos(ang)*80, by=C.y+Math.sin(ang)*60, r=190;
      const gr=g.createRadialGradient(bx,by,0,bx,by,r);
      gr.addColorStop(0,`rgba(${cols[j]},${.6*e})`); gr.addColorStop(1,`rgba(${cols[j]},0)`);
      g.fillStyle=gr; g.fillRect(0,0,W,H);
    }
    for(const s of stars){ g.globalAlpha=e*(.35+.65*Math.abs(Math.sin(t*3.2+s.p))); g.fillStyle='#fff'; g.fillRect(s.x,s.y,s.s,s.s); }
    g.globalAlpha=e; const cr=46+10*Math.sin(t*9);
    const cg=g.createRadialGradient(C.x,C.y,0,C.x,C.y,cr*2.2);
    cg.addColorStop(0,'rgba(255,255,255,1)'); cg.addColorStop(.3,'rgba(255,230,150,.85)'); cg.addColorStop(1,'rgba(255,170,60,0)');
    g.fillStyle=cg; g.fillRect(0,0,W,H);
    g.restore();
  } });
  // shooting stars across the nebula
  for(let q=0;q<7;q++){
    const y0=Math.random()*H*.7, x0=-30-Math.random()*60, d=.45+Math.random()*.35, dl=.3+q*.38;
    fxAdd({ draw(g,a){ const k=a.t/d; if(k>=1){a.done=true;return;} const x=x0+(W+120)*k, y=y0+H*.35*k;
      g.save(); g.globalCompositeOperation='lighter'; const lg=g.createLinearGradient(x,y,x-130,y-46); lg.addColorStop(0,'rgba(255,255,255,1)'); lg.addColorStop(1,'rgba(160,120,255,0)');
      g.strokeStyle=lg; g.lineWidth=3; g.lineCap='round'; g.beginPath(); g.moveTo(x,y); g.lineTo(x-130,y-46); g.stroke(); g.drawImage(fxSprites().glow,x-12,y-12,24,24); g.restore(); } },dl);
  }
  // spiral particles
  for(let i=0;i<N;i++){
    const arm=i%3, u=.1+Math.random()*.9, coin=i%5===0;
    fxAdd({
      arm,u,coin,r:coin?8:4+Math.random()*5,rot:Math.random()*6,
      pull:1.2+i*(.85/N)+Math.random()*.05, pd:.6, x:C.x,y:C.y,p0:null,
      step(dt,a){
        if(a.t<0) return;
        const t=a.t;
        if(t<a.pull){
          const k=Math.min(1,t/1.05), ex=1-Math.pow(1-k,3);
          const ang=a.arm*2.094+a.u*3.8+t*(1.6+(1-a.u)*2.6), R=a.u*180*ex;
          a.x=C.x+Math.cos(ang)*R; a.y=C.y+Math.sin(ang)*R*.78;
        } else {
          if(!a.p0) a.p0={x:a.x,y:a.y};
          const k=Math.min(1,(t-a.pull)/a.pd), e=k*k*k;
          const sw=Math.sin(k*Math.PI)*38*(a.arm-1);
          a.x=a.p0.x+(T.x-a.p0.x)*e+sw*(1-e); a.y=a.p0.y+(T.y-a.p0.y)*e;
          if(k>=1){ a.done=true; arrived++; cnt.set(from+Math.round(delta*arrived/N)); if(arrived%4===0) pulseIcon(key); fxSpark(T.x,T.y,22); if(arrived>=N) cnt.end(); }
        }
        a.rot+=dt*9;
      },
      draw(g,a){
        if(a.coin) drawCoin(g,S,a.x,a.y,a.r,a.rot);
        else{ g.save(); g.globalCompositeOperation='lighter'; const s=a.r*2.6; g.drawImage(S.star,a.x-s/2,a.y-s/2,s,s); g.restore(); }
      }
    });
  }
  setTimeout(()=>cnt.end(),LIFE*1000+1500);
  return true;
}

/* ============================================================
   1000+ : NUKE
   ============================================================ */
function fxNuke(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const S=fxSprites(), W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, cnt=fxCounter(key,from,to);
  const P={x:W/2,y:T.ry}, IMPACT=.62, COUNT0=IMPACT+.1, COUNT1=COUNT0+1.7;
  const mx0=P.x+(Math.random()-.5)*90;

  // red alarm vignette until impact
  fxAdd({ draw(g,a){ const t=a.t; if(t>IMPACT+.15){a.done=true;return;}
    const pulse=.55+.45*Math.sin(t*28), al=Math.min(1,t/.1)*.6*pulse*(t>IMPACT?Math.max(0,1-(t-IMPACT)/.15):1);
    g.save(); const gr=g.createRadialGradient(W/2,H/2,H*.18,W/2,H/2,H*.75);
    gr.addColorStop(0,'rgba(255,0,0,0)'); gr.addColorStop(1,`rgba(255,20,20,${al})`); g.fillStyle=gr; g.fillRect(0,0,W,H); g.restore(); } });

  // falling missile (real missile sprite with flame)
  fxAdd({ draw(g,a){ const k=a.t/IMPACT; if(k>=1){a.done=true;return;}
    const e=k*k, hx=mx0+(P.x-mx0)*e, hy=-60+(P.y+60)*e, ang=Math.atan2(P.y+60,P.x-mx0);
    g.save(); g.globalCompositeOperation='lighter'; g.lineCap='round';
    const L=Math.min(260,hy+60), tx=hx-Math.cos(ang)*L, ty=hy-Math.sin(ang)*L;
    const lg=g.createLinearGradient(hx,hy,tx,ty); lg.addColorStop(0,'rgba(255,240,200,.95)'); lg.addColorStop(.25,'rgba(255,150,30,.75)'); lg.addColorStop(1,'rgba(255,60,0,0)');
    g.strokeStyle=lg; g.lineWidth=16; g.beginPath(); g.moveTo(hx,hy); g.lineTo(tx,ty); g.stroke();
    g.drawImage(S.glow,hx-50,hy-50,100,100); g.restore();
    g.save(); g.translate(hx,hy); g.rotate(ang); g.scale(1.25+k*.6,1.25+k*.6); g.lineJoin='round';
    // fins
    g.fillStyle='#b01818'; g.strokeStyle='#2a0505'; g.lineWidth=2;
    g.beginPath(); g.moveTo(-34,-6); g.lineTo(-52,-24); g.lineTo(-22,-6); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-34,6); g.lineTo(-52,24); g.lineTo(-22,6); g.closePath(); g.fill(); g.stroke();
    // body
    const bg=g.createLinearGradient(0,-9,0,9); bg.addColorStop(0,'#f2f2f2'); bg.addColorStop(.5,'#b9bec6'); bg.addColorStop(1,'#6c727c');
    g.fillStyle=bg; g.beginPath(); g.moveTo(-40,-8); g.lineTo(18,-8); g.lineTo(18,8); g.lineTo(-40,8); g.closePath(); g.fill(); g.stroke();
    g.fillStyle='#ffd23f'; g.fillRect(-14,-8,6,16); g.fillStyle='#111'; g.fillRect(-26,-8,4,16);
    // nose cone
    g.fillStyle='#d41f1f'; g.beginPath(); g.moveTo(18,-8); g.quadraticCurveTo(40,-5,50,0); g.quadraticCurveTo(40,5,18,8); g.closePath(); g.fill(); g.stroke();
    // nuclear mark
    g.fillStyle='#111'; g.beginPath(); g.arc(-2,0,4.4,0,7); g.fill(); g.fillStyle='#ffd23f'; g.beginPath(); g.arc(-2,0,1.8,0,7); g.fill();
    g.restore(); } });

  // orchestrator: impact + number counting
  fxAdd({ hit:false,
    step(dt,a){
      if(!a.hit && a.t>=IMPACT){ a.hit=true; impact(); }
      if(a.t>=COUNT0){
        const k=Math.min(1,(a.t-COUNT0)/(COUNT1-COUNT0));
        cnt.set(from+Math.round(delta*k));
        if(Math.random()<.5) pulseIcon(key);
        if(k>=1){ cnt.end(); a.done=true; }
      }
      if(a.t>5) a.done=true;
    },
    draw(){} });

  function impact(){
    const root=$('overlayRoot');
    root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake');
    setTimeout(()=>root.classList.remove('shake'),1000);
    fxRainbow(key,(COUNT1-IMPACT)*1000+4500);

    fxFlash('#ffffff',1,.75);
    fxFlash('#ffb040',.5,1.1);
    fxRing(P.x,P.y,{color:'255,255,255',max:420,life:.55,width:18});
    fxRing(P.x,P.y,{color:'255,170,40',max:340,life:.75,width:14,delay:.07});
    fxRing(P.x,P.y,{color:'255,60,20',max:260,life:.9,width:10,delay:.15});

    // fireball
    fxAdd({ life:1.2, draw(g,a){ const k=a.t/a.life; if(k>=1){a.done=true;return;}
      const r=Math.max(2,(1-Math.pow(1-Math.min(1,k*1.8),3))*170), al=Math.pow(1-k,1.4);
      g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=al;
      const gr=g.createRadialGradient(P.x,P.y,0,P.x,P.y,r);
      gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.25,'rgba(255,240,120,.95)'); gr.addColorStop(.55,'rgba(255,130,20,.8)'); gr.addColorStop(.85,'rgba(200,30,0,.45)'); gr.addColorStop(1,'rgba(120,0,0,0)');
      g.fillStyle=gr; g.beginPath(); g.arc(P.x,P.y,r,0,Math.PI*2); g.fill(); g.restore(); } });

    // mushroom cloud — billowing puffs (fire inside, smoke outside)
    const seed=Array.from({length:40},()=>Math.random());
    fxAdd({ life:2.8, draw(g,a){ const k=a.t/a.life; if(k>=1){a.done=true;return;}
      const e=1-Math.pow(1-Math.min(1,k*1.25),2.2), al=k<.1?k/.1:Math.max(0,1-(k-.35)/.65);
      const capY=P.y-20-e*150, capR=22+e*80, g2=g;
      g.save(); g.globalAlpha=al;
      const puff=(x,y,r,heat)=>{ const gr=g2.createRadialGradient(x-r*.25,y-r*.25,r*.1,x,y,r);
        const f=Math.max(0,heat); gr.addColorStop(0,`rgba(255,${200+f*50|0},${110+f*100|0},${.95})`); gr.addColorStop(.5,`rgba(${230-(1-f)*120|0},${100-(1-f)*30|0},${30+(1-f)*20|0},.92)`); gr.addColorStop(1,`rgba(${50+f*30|0},35,30,.85)`);
        g2.fillStyle=gr; g2.beginPath(); g2.arc(x,y,r,0,7); g2.fill(); };
      const heat=1-k*.9;
      // stem
      for(let i=0;i<9;i++){ const f=i/8, y=P.y-4-f*(P.y-4-capY), r=(15+seed[i]*5)*(1-.3*f)*(1+k*.5), x=P.x+Math.sin(f*4+k*3+seed[i]*6)*5*(1+f); puff(x,y,r,heat*(1-f*.35)); }
      // cap: ring of puffs + core
      const n=15;
      for(let i=0;i<n;i++){ const th=Math.PI+i/(n-1)*Math.PI, bx=P.x+Math.cos(th)*capR*1.25, by=capY+Math.sin(th)*capR*.55+capR*.1, r=capR*(.36+seed[10+i]*.14); puff(bx,by,r,heat*(.5+seed[10+i]*.4)); }
      puff(P.x,capY,capR*.62,heat);
      // underside skirt
      for(let i=0;i<6;i++){ const bx=P.x+(i/5-.5)*capR*1.9, by=capY+capR*.38, r=capR*.3; puff(bx,by,r,heat*.4); }
      g.restore(); } });
    // low ground shock (flat ellipse) + dust
    fxAdd({ life:.9, draw(g,a){ const k=a.t/a.life; if(k>=1){a.done=true;return;} const e=1-Math.pow(1-k,2.4); g.save(); g.globalCompositeOperation='lighter'; g.strokeStyle=`rgba(255,220,150,${(1-k)*.9})`; g.lineWidth=Math.max(1,(1-k)*10); g.beginPath(); g.ellipse(P.x,P.y+8,20+e*W*.55,6+e*34,0,0,7); g.stroke(); g.restore(); } });
    // coin rain after the blast
    for(let i=0;i<Math.min(80,30+Math.round(delta/12));i++){ const x0=Math.random()*W, life=1.6+Math.random()*.8, r=6+Math.random()*5, d=.5+Math.random()*1.2;
      fxAdd({ x:x0,y:-20,rot:Math.random()*6,vr:(Math.random()-.5)*12,r,life,vy:300+Math.random()*200,
        step(dt,a){ a.y+=a.vy*dt; a.rot+=a.vr*dt; if(a.t>a.life||a.y>H+20) a.done=true; },
        draw(g,a){ drawCoin(g,S,a.x,a.y,a.r,a.rot,.95); } },d); }
    // rising smoke puffs
    for(let i=0;i<22;i++){
      const ox=(Math.random()-.5)*50, life=1.6+Math.random()*1.1, r0=10+Math.random()*10;
      fxAdd({ life,ox,r0, draw(g,a){ const k=a.t/a.life; if(k>=1){a.done=true;return;}
        g.save(); g.globalAlpha=.55*(1-k); const x=P.x+a.ox*(1+k), y=P.y-10-k*(90+a.r0*3), r=a.r0*(1+k*2.2);
        const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(90,70,60,.9)'); gr.addColorStop(1,'rgba(30,25,25,0)'); g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); g.restore(); } },.1+i*.04);
    }
    // debris coins
    for(let i=0;i<Math.min(220,95+Math.round(delta/6));i++){
      const ang=Math.random()*Math.PI*2, sp=320+Math.random()*700, life=1.3+Math.random()*.9;
      fxAdd({ x:P.x,y:P.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-180,rot:Math.random()*6,vr:(Math.random()-.5)*20,r:6+Math.random()*7,life,
        step(dt,a){ a.vy+=1100*dt; a.vx*=Math.pow(.5,dt); a.x+=a.vx*dt; a.y+=a.vy*dt; a.rot+=a.vr*dt; if(a.t>a.life||a.y>H+30) a.done=true; },
        draw(g,a){ drawCoin(g,S,a.x,a.y,a.r,a.rot,Math.min(1,(a.life-a.t)/.4)); } });
    }
    // embers
    for(let i=0;i<80;i++){
      const ang=Math.random()*Math.PI*2, sp=180+Math.random()*620, life=.7+Math.random()*.8;
      fxAdd({ x:P.x,y:P.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-120,life,s:2+Math.random()*3,
        step(dt,a){ a.vy+=380*dt; a.x+=a.vx*dt; a.y+=a.vy*dt; if(a.t>a.life) a.done=true; },
        draw(g,a){ g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=Math.max(0,1-a.t/a.life); g.fillStyle=Math.random()<.5?'#ffb030':'#ff5a1a'; g.fillRect(a.x,a.y,a.s,a.s); g.restore(); } });
    }
  }
  setTimeout(()=>cnt.end(),COUNT1*1000+1500);
  return true;
}

/* ============================================================
   shared: homing coin + arrival tracker
   ============================================================ */
function fxTracker(key,from,to,N,T){
  const cnt=fxCounter(key,from,to); let arrived=0;
  return {
    cnt,
    arrive(sp=22){
      arrived++; cnt.set(from+Math.round((to-from)*Math.min(1,arrived/N)));
      if(arrived%3===0) pulseIcon(key); fxSpark(T.x,T.y,sp);
      if(arrived>=N) cnt.end();
    }
  };
}
/* a coin (or bill) that flies freely for `home` seconds, then is pulled into the target */
function fxHomer(o,delay=0){
  const {T,tr}=o; const S=fxSprites();
  fxAdd({
    x:o.x,y:o.y,vx:o.vx||0,vy:o.vy||0,rot:Math.random()*6,vr:(Math.random()-.5)*16,r:o.r||9,
    grav:o.grav||0,drag:o.drag??.1,home:o.home,bill:!!o.bill,star:!!o.star,heart:!!o.heart,poly:o.poly||0,col:o.col||'255,210,63',tc:o.trail||(o.poly?(o.col||'255,210,63'):o.bill?'255,90,220':o.heart?'255,90,200':'255,210,63'),
    step(dt,a){
      if(a.t<0) return;
      if(a.t<a.home){ const d=Math.pow(a.drag,dt); a.vx*=d; a.vy*=d; a.vy+=a.grav*dt; }
      else{
        const dx=T.x-a.x, dy=T.y-a.y, dist=Math.hypot(dx,dy)||1, sp=Math.min(1700,560+(a.t-a.home)*3200);
        a.vx+=(dx/dist*sp-a.vx)*Math.min(1,dt*9); a.vy+=(dy/dist*sp-a.vy)*Math.min(1,dt*9);
        if(dist<14||a.t>a.home+3){ a.done=true; if(dist<14) tr.arrive(a.bill?26:22); else tr.arrive(0.01); return; }
      }
      a.x+=a.vx*dt; a.y+=a.vy*dt; a.rot+=a.vr*dt;
    },
    draw(g,a){
      if(a.t>=0) fxTrail(g,a.x,a.y,a.vx,a.vy,a.r,a.tc);
      if(a.poly){ hxGem(g,a.x,a.y,a.r*1.15,a.poly,a.rot,a.col); }
      else if(a.heart){ g.save(); g.translate(a.x,a.y); g.rotate(Math.sin(a.rot)*.35); const hs=a.r*2.6; g.drawImage(S.heart,-hs/2,-hs/2,hs,hs); g.restore(); }
      else if(a.bill){
        g.save(); g.translate(a.x,a.y); g.rotate(Math.atan2(a.vy,a.vx)*.35+a.rot*.25); g.scale(1,Math.abs(Math.cos(a.rot*1.3))*.75+.25);
        g.drawImage(S.bill,-a.r*1.4,-a.r*.7,a.r*2.8,a.r*1.4); g.restore();
      }
      else if(a.star){ g.save(); g.globalCompositeOperation='lighter'; const s=a.r*2.4; g.drawImage(S.star,a.x-s/2,a.y-s/2,s,s); g.restore(); }
      else drawCoin(g,S,a.x,a.y,a.r,a.rot);
    }
  },delay);
}

/* ============================================================
   20+ : FOUNTAIN
   ============================================================ */
function fxFountain(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, N=Math.min(60,16+Math.round(delta/3)), tr=fxTracker(key,from,to,N,T);
  const ox=W/2, oy=H-34;
  fxRing(ox,oy,{color:'255,226,122',max:120,life:.5,width:8});
  fxFlash('#ffd23f',.1,.3);
  fxGlitter(ox,oy-20,70,{spread:640,life:1.7,grav:900,cone:[-Math.PI/2-.7,-Math.PI/2+.7]});
  fxAdd({ draw(g,a){ const k=a.t/1.1; if(k>=1){a.done=true;return;} g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=(1-k)*.7;
    const lg=g.createLinearGradient(0,oy,0,oy-H*.8); lg.addColorStop(0,'rgba(255,230,140,.8)'); lg.addColorStop(1,'rgba(255,200,60,0)'); g.fillStyle=lg; g.fillRect(ox-22*(1-k*.4),oy-H*.8,44*(1-k*.4),H*.8+10); g.restore(); } });
  for(let i=0;i<N;i++){
    const spread=(Math.random()-.5)*.7, sp=620+Math.random()*320;
    fxHomer({T,tr,x:ox+(Math.random()-.5)*20,y:oy,vx:Math.sin(spread)*sp*.55,vy:-Math.cos(spread)*sp,
      grav:1500,drag:.7,home:.85+i*(.7/N)+Math.random()*.1,r:7+Math.random()*4,star:i%5===0},i*.014);
  }
  setTimeout(()=>tr.cnt.end(),4600);
  return true;
}

/* ============================================================
   50+ : CONFETTI CANNONS
   ============================================================ */

/* ============================================================
   200+ : FIREWORKS
   ============================================================ */
function fxFireworks(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, R=Math.min(7,3+Math.floor(delta/110)), per=Math.min(14,Math.ceil((22+delta/8)/R)), N=R*per;
  const tr=fxTracker(key,from,to,N,T);
  const pal=[['255,90,90','255,210,90'],['90,255,150','255,255,160'],['90,200,255','200,160,255'],['255,90,220','255,200,120'],['255,220,60','255,140,40']];
  for(let r=0;r<R;r++){
    const sx=W*(.15+.7*((r+Math.random()*.6)/R)), ex=sx+(Math.random()-.5)*60, ey=H*(.12+Math.random()*.32), rise=.5+Math.random()*.15, col=pal[r%pal.length];
    // rocket
    fxAdd({ draw(g,a){ const k=a.t/rise; if(k>=1){a.done=true; explode(ex,ey,col); return;}
      const e=1-Math.pow(1-k,2), x=sx+(ex-sx)*e, y=H-20+(ey-(H-20))*e, S=fxSprites();
      g.save(); g.globalCompositeOperation='lighter'; const lg=g.createLinearGradient(x,y,x-(ex-sx)*.12,y+60); lg.addColorStop(0,'rgba(255,240,200,1)'); lg.addColorStop(1,'rgba(255,120,0,0)');
      g.strokeStyle=lg; g.lineWidth=4; g.lineCap='round'; g.beginPath(); g.moveTo(x,y); g.lineTo(x-(ex-sx)*.12*(1-k),y+60); g.stroke();
      g.drawImage(S.glow,x-14,y-14,28,28); g.restore(); } }, r*.36);
    function explode(x,y,c){
      fxFlash('#ffffff',.12,.2);
      fxRing(x,y,{color:c[0],max:110,life:.6,width:8});
      fxGlitter(x,y,24,{spread:230,life:1.9,grav:150,col:c[1]});
      const M=44;
      for(let i=0;i<M;i++){
        const ang=i/M*Math.PI*2+Math.random()*.1, sp=140+Math.random()*170, life=.9+Math.random()*.5, cc=c[i%2];
        fxAdd({ x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life,cc,
          step(dt,a){ const d=Math.pow(.22,dt); a.vx*=d; a.vy*=d; a.vy+=130*dt; a.px=a.x; a.py=a.y; a.x+=a.vx*dt; a.y+=a.vy*dt; if(a.t>a.life) a.done=true; },
          draw(g,a){ if(a.px==null) return; g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=Math.max(0,1-a.t/a.life); g.strokeStyle=`rgb(${a.cc})`; g.lineWidth=2.6; g.lineCap='round'; g.beginPath(); g.moveTo(a.px,a.py); g.lineTo(a.x,a.y); g.stroke(); g.restore(); } });
      }
      for(let i=0;i<per;i++){
        const ang=Math.random()*Math.PI*2, sp=140+Math.random()*260;
        fxHomer({T,tr,x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-40,grav:500,drag:.25,home:.45+i*(.5/per)+Math.random()*.1,r:7+Math.random()*4,star:i%4===0});
      }
    }
  }
  setTimeout(()=>tr.cnt.end(),R*360+5200);
  return true;
}

/* ============================================================
   500+ : MONEY GUN
   ============================================================ */
/* ---------- shared canvas helpers (v5) ---------- */
function mgDur(delta){ return Math.min(2.8,1.3+delta/700); }
function fxCashText(x,y,text,{size=34,life=1.7,c1='#fff6c4',c2='#ffc933',glow='255,80,220',rise=34,delay=0}={}){
  fxAdd({ draw(g,a){ const k=a.t/life; if(k>=1){a.done=true;return;}
    const pop=k<.18?(k/.18):1, sc=k<.18?(1.5-.5*pop+Math.sin(pop*Math.PI)*.25):1, al=k>.7?(1-k)/.3:1;
    g.save(); g.translate(x,y-rise*Math.min(1,k*1.4)); g.scale(sc,sc); g.globalAlpha=al;
    g.font=`900 ${size}px Montserrat,Arial,sans-serif`; g.textAlign='center'; g.textBaseline='middle';
    g.lineJoin='round'; g.lineWidth=7; g.strokeStyle='rgba(20,0,40,.9)'; g.strokeText(text,0,0);
    g.shadowColor=`rgba(${glow},.95)`; g.shadowBlur=18;
    const gr=g.createLinearGradient(0,-size/2,0,size/2); gr.addColorStop(0,c1); gr.addColorStop(1,c2); g.fillStyle=gr; g.fillText(text,0,0);
    g.restore(); } },delay);
}
function fxSmoke(x,y,{color='255,150,235',life=.8,size=26,vx=0,vy=-40}={}){
  fxAdd({ x,y,draw(g,a){ const k=a.t/life; if(k>=1){a.done=true;return;} a.x+=vx*.016; a.y+=vy*.016; const s=size*(.5+k*1.6);
    g.save(); g.globalAlpha=.32*(1-k); const gr=g.createRadialGradient(a.x,a.y,0,a.x,a.y,s); gr.addColorStop(0,`rgba(${color},.9)`); gr.addColorStop(1,`rgba(${color},0)`); g.fillStyle=gr; g.fillRect(a.x-s,a.y-s,s*2,s*2); g.restore(); } });
}

/* ============================================================
   500+ : MONEY GUN v2  — target lock, laser sight, muzzle cone,
   spent casings, smoke, impact rings, cash-out volley + "+N C"
   ============================================================ */
function fxMoneyGun(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const S=fxSprites(), W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, N=Math.max(60,Math.min(240,Math.round(50+delta/5))), FIN=32;
  const DUR=mgDur(delta), IN=.45, FIRE0=IN, FIRE1=IN+DUR, OUT=.45, END=FIRE1+OUT;
  const base=fxTracker(key,from,to,N+FIN,T);
  let hits=0;
  const tr={cnt:base.cnt, arrive(sp){ base.arrive(sp); hits++; if(hits%5===0) fxRing(T.x,T.y,{color:hits%2?'255,120,230':'255,225,130',max:50,life:.38,width:4}); }};
  const rowEl=document.querySelector(`.ov-row[data-key="${CSS.escape(key)}"]`);
  const rw=rowEl?rowEl.offsetWidth:W-40, rh=rowEl?rowEl.offsetHeight:70;
  const side=T.x<W/2?1:-1;
  const gx=side>0?W*.86:W*.14, gy=Math.min(H-70,Math.max(T.y+96,H*.62));
  const ang=Math.atan2(T.y-gy,T.x-gx), dirx=Math.cos(ang), diry=Math.sin(ang);
  const SC=.82, LEN=112*SC, off=230;
  fxFlash('#ff4fd8',.28,.5);
  fxRing(gx,gy,{color:'255,120,230',max:160,life:.5,width:8});
  fxRing(gx,gy,{color:'180,100,255',max:230,life:.62,width:8,delay:.08});
  fxRainbow(key,(END+2.2)*1000);
  try{ hxShake(); }catch(e){}
  let fired=0, volley=false;
  // pink-violet atmosphere + edge glow
  fxAdd({ draw(g,a){ const t=a.t; if(t>END+.7){a.done=true;return;} const e=Math.min(1,t/.3,(END+.7-t)/.7);
    g.save(); g.globalCompositeOperation='lighter';
    let gr=g.createRadialGradient(gx,gy,10,gx,gy,W*.95); gr.addColorStop(0,`rgba(255,80,220,${e*.30})`); gr.addColorStop(.5,`rgba(150,70,255,${e*.12})`); gr.addColorStop(1,'rgba(80,20,160,0)'); g.fillStyle=gr; g.fillRect(0,0,W,H);
    const pulse=.5+.5*Math.sin(t*16); g.lineWidth=6; g.strokeStyle=`rgba(255,90,230,${e*(.18+.14*pulse)})`; g.strokeRect(3,3,W-6,H-6); g.restore(); } });
  // laser sight + target lock
  fxAdd({ draw(g,a){ const t=a.t; if(t<IN*.5) return; if(t>END+.25){a.done=true;return;}
    const e=Math.min(1,(t-IN*.5)/.25,(END+.25-t)/.25), mx=gx+side*off*Math.max(0,1-t/IN)*0+dirx*LEN, my=gy+diry*LEN;
    g.save(); g.globalCompositeOperation='lighter';
    const lg=g.createLinearGradient(mx,my,T.x,T.y); lg.addColorStop(0,`rgba(255,120,235,${.55*e})`); lg.addColorStop(1,`rgba(255,230,255,${.15*e})`);
    g.strokeStyle=lg; g.lineWidth=1.6; g.setLineDash([10,7]); g.lineDashOffset=-t*160; g.beginPath(); g.moveTo(mx,my); g.lineTo(T.x,T.y); g.stroke(); g.setLineDash([]);
    // reticle brackets around the player's frame
    const rx=T.rx-rw/2-4, ry=T.ry-rh/2-4, w2=rw+8, h2=rh+8, L=16+3*Math.sin(t*14), c=`rgba(255,150,240,${.85*e})`;
    g.strokeStyle=c; g.lineWidth=3; g.lineCap='round';
    [[rx,ry,1,1],[rx+w2,ry,-1,1],[rx,ry+h2,1,-1],[rx+w2,ry+h2,-1,-1]].forEach(([x,y,sx,sy])=>{ g.beginPath(); g.moveTo(x,y+sy*L); g.lineTo(x,y); g.lineTo(x+sx*L,y); g.stroke(); });
    // rotating lock rings on the C icon
    g.lineWidth=2; g.setLineDash([6,6]); g.lineDashOffset=t*40; g.strokeStyle=`rgba(255,235,255,${.8*e})`; g.beginPath(); g.arc(T.x,T.y,20+2*Math.sin(t*12),0,Math.PI*2); g.stroke();
    g.setLineDash([]); g.restore();
    // row border flash while firing
    if(t>=FIRE0&&t<=FIRE1+.1){ g.save(); g.globalCompositeOperation='lighter'; g.lineWidth=3; g.strokeStyle=`rgba(255,120,235,${.35+.35*Math.abs(Math.sin(t*22))})`; g.shadowColor='rgba(255,60,220,.9)'; g.shadowBlur=14; g.beginPath(); g.roundRect(rx+2,ry+2,w2-4,h2-4,16); g.stroke(); g.restore(); }
  } });
  // falling pink "C" bills from the top
  for(let i=0;i<Math.min(54,18+Math.round(delta/22));i++){
    const x0=Math.random()*W, vy=180+Math.random()*240, sw=Math.random()*6, sc=.5+Math.random()*.5, d=.3+Math.random()*(DUR+.7);
    fxAdd({ x:x0,y:-20,rot:Math.random()*6,
      step(dt,a){ if(a.t<0) return; a.y+=vy*dt; a.x+=Math.sin(a.t*3+sw)*40*dt; a.rot+=dt*4; if(a.y>H+30) a.done=true; },
      draw(g,a){ if(a.t<0) return; g.save(); g.globalAlpha=.8; g.translate(a.x,a.y); g.rotate(Math.sin(a.rot)*.6); g.scale(sc,sc*(Math.abs(Math.cos(a.rot*1.4))*.8+.2)); g.drawImage(S.bill,-30,-15); g.restore(); } },d);
  }
  // the gun (also the firing orchestrator)
  fxAdd({
    step(dt,a){
      const t=a.t; if(t<0) return;
      while(fired<N && t>=FIRE0+fired*(DUR/N)){
        const mx=gx+dirx*LEN*1.04, my=gy+diry*LEN*1.04, sp0=820+Math.random()*560, aa=ang+(Math.random()-.5)*.5;
        fxHomer({T,tr,bill:true,x:mx,y:my,vx:Math.cos(aa)*sp0,vy:Math.sin(aa)*sp0-70,grav:380,drag:.2,home:.36+Math.random()*.34,r:10+Math.random()*3});
        if(fired%5===0) fxHomer({T,tr,x:mx,y:my,vx:Math.cos(aa+.25)*sp0*.8,vy:Math.sin(aa+.25)*sp0*.8-120,grav:520,drag:.2,home:.4+Math.random()*.3,r:8});
        // muzzle cone flash
        fxAdd({ life:.09, draw(g,b){ const k=b.t/b.life; if(k>=1){b.done=true;return;} g.save(); g.globalCompositeOperation='lighter'; g.translate(mx,my); g.rotate(aa); g.globalAlpha=1-k;
          const L2=78*(1-k*.3), W2=24*(1-k*.4), gr=g.createLinearGradient(0,0,L2,0); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.35,'rgba(255,130,235,.85)'); gr.addColorStop(1,'rgba(180,90,255,0)');
          g.fillStyle=gr; g.beginPath(); g.moveTo(0,-W2*.35); g.lineTo(L2,0); g.lineTo(0,W2*.35); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(0,-W2); g.lineTo(L2*.5,0); g.lineTo(0,W2); g.closePath(); g.globalAlpha=(1-k)*.35; g.fill();
          g.restore(); const s=40*(1-k*.4); g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=1-k; g.drawImage(S.pglow,mx-s,my-s,s*2,s*2); g.restore(); } });
        // spark spray
        for(let q=0;q<2;q++){ const ga=aa+(Math.random()-.5)*1.0, gs=200+Math.random()*280, gc=Math.random()<.5?'255,130,230':'255,225,140';
          fxAdd({ x:mx,y:my,vx:Math.cos(ga)*gs,vy:Math.sin(ga)*gs,life:.5+Math.random()*.3,gc,step(dt,b){ b.vy+=320*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; if(b.t>b.life) b.done=true; },draw(g,b){ g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=Math.max(0,1-b.t/b.life); g.fillStyle=`rgb(${b.gc})`; g.fillRect(b.x,b.y,3,3); g.restore(); } });
        }
        // ejected golden casing
        if(fired%2===0){ const ex=gx+side*20, ey=gy-18, cvx=side*(50+Math.random()*110), cvy=-(150+Math.random()*170);
          fxAdd({ x:ex,y:ey,vx:cvx,vy:cvy,rot:0,life:.8,step(dt,b){ b.vy+=980*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.rot+=dt*18; if(b.t>b.life) b.done=true; },
            draw(g,b){ g.save(); g.globalAlpha=Math.max(0,1-b.t/b.life); drawCoin(g,S,b.x,b.y,5,b.rot); g.restore(); } }); }
        if(fired%3===0) fxSmoke(mx,my,{vx:-dirx*30,vy:-50,size:20+Math.random()*10});
        fired++;
      }
      if(t>=FIRE1+.05 && !volley){ volley=true;
        // cash-out: final volley erupts from the player's frame, then gets pulled back in
        fxFlash('#ffd0f6',.3,.5);
        fxRing(T.x,T.y,{color:'255,210,120',max:130,life:.7,width:10});
        fxRing(T.x,T.y,{color:'255,120,235',max:190,life:.8,width:8,delay:.1});
        for(let i=0;i<FIN;i++){ const ang2=-Math.PI/2+(Math.random()-.5)*2.1, sp=380+Math.random()*520;
          fxHomer({T,tr,bill:i%3!==0,x:T.rx+(Math.random()-.5)*rw*.5,y:T.ry,vx:Math.cos(ang2)*sp,vy:Math.sin(ang2)*sp,grav:1000,drag:.1,home:.5+Math.random()*.3,r:i%3===0?9:11}); }
        fxCashText(T.rx,T.ry-4,'+'+delta.toLocaleString()+' C',{size:36,life:2.0,rise:46});
        try{ hxShake(); }catch(e){}
      }
      if(t>END) a.done=true;
    },
    draw(g,a){
      const t=a.t; if(t<0) return;
      const inK=Math.min(1,t/IN), outK=t>FIRE1?Math.min(1,(t-FIRE1)/OUT):0;
      const ox=side*(off*Math.pow(1-inK,3)+off*outK);
      const firing=t>=FIRE0&&t<=FIRE1, ph=(t*(N/DUR))%1, rec=firing?(9*Math.pow(1-ph,2)):0, shake=firing?Math.sin(t*120)*1.1:0;
      g.save(); g.translate(gx+ox-dirx*rec,gy-diry*rec+shake);
      if(dirx>=0){ g.rotate(ang); } else { g.scale(-1,1); g.rotate(Math.atan2(diry,-dirx)); }
      g.scale(SC,SC); g.translate(-50,-44);
      if(firing){ g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=.55; g.shadowColor='rgba(255,70,220,1)'; g.shadowBlur=26; g.drawImage(S.gun,0,0); g.restore(); }
      g.drawImage(S.gun,0,0); g.restore();
      if(t>FIRE1&&t<FIRE1+.5&&Math.random()<.5) fxSmoke(gx+ox+dirx*LEN,gy+diry*LEN,{color:'230,200,255',vy:-70,size:14});
    }
  });
  setTimeout(()=>tr.cnt.end(),END*1000+3800);
  return true;
}

/* ============================================================
   5000+ : BLACK HOLE — vignette, lensing rings, accretion disk,
   everything spirals in, collapse flash, then the C pour out
   into the player's row.
   ============================================================ */
function fxBlackhole(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const S=fxSprites(), W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, N=Math.max(100,Math.min(260,Math.round(80+delta/45)));
  const cx=W/2, cy=H*.44, OPEN=.9, FEED=3.5, COL=3.85, END=4.3;
  const tr=fxTracker(key,from,to,N,T);
  const stack=$('stack'); if(stack){ stack.classList.add('bh'); setTimeout(()=>stack.classList.remove('bh'),3900); }
  fxRainbow(key,(END+2.4)*1000);
  const radius=t=>{ if(t<OPEN){ const k=t/OPEN; return 6+50*(1-Math.pow(1-k,3)); } if(t<FEED) return 56+5*Math.sin(t*9); if(t<COL){ const k=(t-FEED)/(COL-FEED); return 58*(1-k*k)+2; } return 0; };
  let burst=false;
  // main body: vignette + lensing + disk + horizon
  fxAdd({
    step(dt,a){
      const t=a.t; if(t<0) return;
      if(t>=COL && !burst){ burst=true;
        fxFlash('#ffffff',.9,.7); fxFlash('#8a5cff',.35,1.2);
        fxRing(cx,cy,{color:'255,230,180',max:W*.8,life:.9,width:16});
        fxRing(cx,cy,{color:'170,120,255',max:W*.6,life:.8,width:12,delay:.08});
        fxRing(cx,cy,{color:'255,160,60',max:W*.45,life:.7,width:10,delay:.16});
        try{ hxShake(); }catch(e){}
        for(let i=0;i<N;i++){ const an=Math.random()*Math.PI*2, sp=320+Math.random()*560, r0=i%4===0?12:i%9===0?0:9;
          fxHomer({T,tr,bill:i%5===0,star:i%9===0,x:cx,y:cy,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp,grav:200,drag:.1,home:.34+Math.random()*.4,r:r0||8}); }
        // energy jet from the core to the row
        fxAdd({ life:.7, draw(g,b){ const k=b.t/b.life; if(k>=1){b.done=true;return;} g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=1-k;
          const lg=g.createLinearGradient(cx,cy,T.x,T.y); lg.addColorStop(0,'rgba(255,255,255,1)'); lg.addColorStop(1,'rgba(255,190,80,.4)');
          g.strokeStyle=lg; g.lineCap='round'; g.lineWidth=26*(1-k)+3; g.shadowColor='rgba(255,170,60,1)'; g.shadowBlur=26; g.beginPath(); g.moveTo(cx,cy); g.lineTo(T.x,T.y); g.stroke(); g.restore(); } });
        fxCashText(T.rx,T.ry-2,'+'+delta.toLocaleString()+' C',{size:38,life:2.2,rise:50,c1:'#ffffff',c2:'#ffb347',glow:'255,150,50',delay:.5});
      }
      if(t>END) a.done=true;
    },
    draw(g,a){
      const t=a.t; if(t<0) return;
      const env=Math.min(1,t/.5,(END+.2-t)/.5); if(env<=0) return;
      const R=radius(t);
      // darken the scene
      g.save(); g.globalAlpha=env*.85; const vg=g.createRadialGradient(cx,cy,30,cx,cy,Math.max(W,H)*.75); vg.addColorStop(0,'rgba(10,0,30,.15)'); vg.addColorStop(1,'rgba(2,0,10,.92)'); g.fillStyle=vg; g.fillRect(0,0,W,H); g.restore();
      // gravitational lensing rings contracting
      g.save(); g.globalCompositeOperation='lighter'; g.lineWidth=2;
      for(let i=0;i<4;i++){ const k=((t*.7+i/4)%1), rad=Math.max(R*1.1,W*.62*(1-k)); g.strokeStyle=`rgba(170,140,255,${.28*k*env})`; g.beginPath(); g.ellipse(cx,cy,rad,rad*.82,0,0,Math.PI*2); g.stroke(); }
      g.restore();
      if(R<=1) return;
      // glow
      g.save(); g.globalCompositeOperation='lighter';
      const gl=g.createRadialGradient(cx,cy,R*.8,cx,cy,R*4.2); gl.addColorStop(0,`rgba(255,150,50,${.55*env})`); gl.addColorStop(.4,`rgba(190,80,255,${.22*env})`); gl.addColorStop(1,'rgba(60,0,120,0)'); g.fillStyle=gl; g.fillRect(cx-R*4.4,cy-R*4.4,R*8.8,R*8.8);
      // accretion disk (back half)
      const disk=(front)=>{ for(let j=0;j<6;j++){ const rx=R*(1.45+j*.38), ry=rx*.26, al=(.85-j*.12)*env;
          g.save(); g.translate(cx,cy); g.rotate(-.32); g.lineWidth=4.2-j*.5; g.strokeStyle=`rgba(255,${210-j*22},${120-j*14},${al})`; g.setLineDash([46+j*10,14+j*4]); g.lineDashOffset=-t*(160-j*18);
          g.beginPath(); g.ellipse(0,0,rx,ry,0,front?0:Math.PI,front?Math.PI:Math.PI*2); g.stroke(); g.restore(); } };
      disk(false); g.restore();
      // event horizon
      g.save(); g.shadowColor='rgba(255,200,120,.95)'; g.shadowBlur=22; g.fillStyle='#000'; g.beginPath(); g.arc(cx,cy,R,0,Math.PI*2); g.fill();
      g.shadowBlur=0; g.lineWidth=3; g.strokeStyle=`rgba(255,235,200,${.95*env})`; g.beginPath(); g.arc(cx,cy,R,0,Math.PI*2); g.stroke(); g.restore();
      // front half of the disk passes over the horizon
      g.save(); g.globalCompositeOperation='lighter'; disk(true); g.restore();
    }
  });
  // everything spiralling in
  const feedN=Math.min(130,70+Math.round(delta/60));
  for(let i=0;i<feedN;i++){
    const d=.35+Math.random()*(FEED-.9), life=1.1+Math.random()*1.0, th0=Math.random()*Math.PI*2, r0=Math.max(W,H)*(.42+Math.random()*.28), spin=2.2+Math.random()*2.2, kind=i%7, sc=.55+Math.random()*.6;
    fxAdd({ life, draw(g,a){ const k=a.t/life; if(k>=1){a.done=true;return;} const e=Math.pow(k,1.7), r=r0*(1-e)+4, th=th0+spin*e*3.2, x=cx+Math.cos(th)*r, y=cy+Math.sin(th)*r*.78, s=Math.max(.12,Math.min(1,r/110))*sc;
      g.save(); g.translate(x,y); g.globalAlpha=Math.min(1,(1-k)*2.2)*.95; g.rotate(th*1.4);
      if(kind===0){ g.scale(s,s); g.drawImage(S.bill,-30,-15); }
      else if(kind<=3){ const rr=11*s; g.scale(Math.abs(Math.cos(th*2))*.7+.3,1); g.drawImage(S.coin,-rr,-rr,rr*2,rr*2); }
      else { g.globalCompositeOperation='lighter'; const ss=20*s+4; g.drawImage(S.star,-ss/2,-ss/2,ss,ss); }
      g.restore(); } },d);
  }
  setTimeout(()=>tr.cnt.end(),END*1000+3600);
  return true;
}

/* ============================================================
   10+ : STARS  (star pulse: sparks fly out of the row and get pulled back in)
   ============================================================ */
function fxStars(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const S=fxSprites(), W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, N=Math.min(26,8+delta), tr=fxTracker(key,from,to,N,T);
  fxRing(T.x,T.y,{color:'255,244,176',max:110,life:.5,width:7});
  fxGlitter(T.x,T.y,34,{spread:380,life:1.2,grav:120}); fxFlash('#fff2b0',.12,.25);
  for(let q=0;q<14;q++){
    const x0=Math.random()*W, d=Math.random()*.5, life=.7+Math.random()*.4;
    fxAdd({ draw(g,a){ const k=a.t/life; if(k>=1){a.done=true;return;} const x=x0-40*k, y=-10+(T.y+20)*k; g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=1-k*.6; const s2=18+8*Math.sin(k*20); g.drawImage(S.star,x-s2/2,y-s2/2,s2,s2); g.restore(); } },d);
  }
  for(let i=0;i<N;i++){
    const ang=Math.random()*Math.PI*2, sp=180+Math.random()*260;
    fxHomer({T,tr,x:T.x,y:T.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,drag:.04,home:.28+i*(.3/N),r:7+Math.random()*3,star:i%2===0});
  }
  setTimeout(()=>tr.cnt.end(),3600);
  return true;
}

/* ============================================================
   35+ : HEARTS
   ============================================================ */
function fxHearts(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const S=fxSprites(), W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, N=Math.min(50,14+Math.round(delta/2)), tr=fxTracker(key,from,to,N,T);
  fxFlash('#ff5ac8',.14,.4);
  fxRing(W/2,H-34,{color:'255,110,210',max:160,life:.55,width:8});
  fxGlitter(W/2,H-40,34,{spread:480,life:1.5,grav:160,col:'255,140,220',cone:[-Math.PI/2-1,-Math.PI/2+1]});
  // floating decorative hearts
  for(let i=0;i<Math.min(36,12+Math.round(delta/3));i++){
    const x0=Math.random()*W, vy=90+Math.random()*170, sw=Math.random()*6, sz=14+Math.random()*22, life=2+Math.random()*1.4;
    fxAdd({ life,
      draw(g,a){ const k=a.t/a.life; if(k>=1){a.done=true;return;} const x=x0+Math.sin(a.t*2.4+sw)*26, y=H+10-vy*a.t;
        g.save(); g.globalAlpha=Math.min(1,k*8)*(1-k*k)*.9; g.translate(x,y); g.rotate(Math.sin(a.t*3+sw)*.35); g.drawImage(S.heart,-sz/2,-sz/2,sz,sz); g.restore(); } },Math.random()*.9);
  }
  for(let i=0;i<N;i++){
    const ang=-Math.PI/2+(Math.random()-.5)*1.6, sp=420+Math.random()*420;
    fxHomer({T,tr,x:W/2+(Math.random()-.5)*40,y:H-30,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,grav:500,drag:.12,home:.7+i*(.75/N)+Math.random()*.1,r:8+Math.random()*3,heart:i%2===0},i*.02);
  }
  setTimeout(()=>tr.cnt.end(),4800);
  return true;
}

/* ============================================================
   150+ : LIGHTNING
   ============================================================ */
function fxLightning(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const S=fxSprites(), W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, K=Math.min(6,3+Math.floor(delta/200)), N=Math.min(70,22+Math.round(delta/5)), per=Math.ceil(N/K), tr=fxTracker(key,from,to,K*per,T);
  // storm darkening
  fxAdd({ draw(g,a){ const t=a.t, D=K*.26+.9; if(t>D){a.done=true;return;} const e=Math.min(1,t/.2,(D-t)/.4)*.4; g.save(); g.fillStyle=`rgba(10,5,40,${e})`; g.fillRect(0,0,W,H); g.restore(); } });
  for(let k=0;k<K;k++){
    const tx=T.x+(Math.random()-.5)*160, delay=.12+k*.26;
    const pts=[]; let x=tx+(Math.random()-.5)*60, y=-10; const steps=9;
    for(let j=0;j<=steps;j++){ const f=j/steps; pts.push([x+(tx-x)*0,y]); x+=((tx-x)*.35+(Math.random()-.5)*70); y=-10+(T.y+10)*(j+1)/steps; if(j===steps-1){ x=tx; } }
    const branches=[]; for(let j=2;j<pts.length-1;j+=3){ const [bx,by]=pts[j]; const dir=Math.random()<.5?-1:1; branches.push([[bx,by],[bx+dir*(25+Math.random()*30),by+30],[bx+dir*(45+Math.random()*30),by+55]]); }
    fxAdd({ life:.34,fired:false,
      draw(g,a){
        const t=a.t, k2=t/a.life; if(k2>=1){a.done=true;return;}
        if(!a.fired){ a.fired=true; impact(tx,T.y); }
        if(Math.random()<.25) return; // flicker
        const al=1-k2*.7;
        g.save(); g.globalCompositeOperation='lighter'; g.lineJoin='round'; g.lineCap='round';
        const stroke=(w,c)=>{ g.lineWidth=w; g.strokeStyle=c; g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke(); branches.forEach(b=>{ g.lineWidth=w*.5; g.beginPath(); b.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke(); }); };
        stroke(14,`rgba(150,90,255,${.28*al})`); stroke(7,`rgba(110,200,255,${.55*al})`); stroke(2.6,`rgba(255,255,255,${al})`);
        g.restore();
      } },delay);
  }
  function impact(x,y){
    fxFlash('#d8e6ff',.5,.22);
    fxRing(x,y,{color:'190,170,255',max:200,life:.45,width:12});
    fxGlitter(x,y,22,{spread:420,life:.9,grav:300,col:'170,190,255'});
    fxRing(x,y,{color:'255,255,255',max:120,life:.3,width:8});
    const root=$('overlayRoot'); if(root){ root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); setTimeout(()=>root.classList.remove('shake'),500); }
    for(let i=0;i<per;i++){
      const ang=Math.random()*Math.PI*2, sp=260+Math.random()*420;
      fxHomer({T,tr,x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-120,grav:600,drag:.1,home:.35+i*(.4/per)+Math.random()*.1,r:7+Math.random()*4,star:i%4===0,trail:'170,150,255'});
    }
  }
  setTimeout(()=>tr.cnt.end(),K*260+4800);
  return true;
}

/* ============================================================
   3000+ : METEOR SHOWER
   ============================================================ */
function fxMeteor(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const S=fxSprites(), W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, R=Math.min(14,6+Math.floor(delta/600)), N=Math.min(160,56+Math.round(delta/40)), per=Math.ceil(N/R), tr=fxTracker(key,from,to,R*per,T);
  // fiery sky
  fxAdd({ draw(g,a){ const D=R*.2+1.4,t=a.t; if(t>D){a.done=true;return;} const e=Math.min(1,t/.3,(D-t)/.6); g.save(); const gr=g.createLinearGradient(0,0,0,H); gr.addColorStop(0,`rgba(255,70,20,${.4*e})`); gr.addColorStop(1,'rgba(60,0,20,0)'); g.fillStyle=gr; g.fillRect(0,0,W,H); g.restore(); } });
  fxFlash('#ff7a30',.25,.4);
  for(let i=0;i<R;i++){
    const sx=Math.min(W+60,T.x+120+Math.random()*(W*.5)), sy=-50-Math.random()*60;
    const ex=T.x+(Math.random()-.5)*90, ey=T.y+(Math.random()-.5)*14, fall=.5+Math.random()*.15;
    fxAdd({ draw(g,a){ const k=a.t/fall; if(k>=1){a.done=true; impact(ex,ey); return;}
      const e=k*k*.6+k*.4, x=sx+(ex-sx)*e, y=sy+(ey-sy)*e, dx=sx-ex, dy=sy-ey, dl=Math.hypot(dx,dy), L=180;
      g.save(); g.globalCompositeOperation='lighter'; g.lineCap='round';
      const lg=g.createLinearGradient(x,y,x+dx/dl*L,y+dy/dl*L); lg.addColorStop(0,'rgba(255,245,210,1)'); lg.addColorStop(.25,'rgba(255,160,40,.85)'); lg.addColorStop(1,'rgba(255,60,0,0)');
      g.strokeStyle=lg; g.lineWidth=13; g.beginPath(); g.moveTo(x,y); g.lineTo(x+dx/dl*L,y+dy/dl*L); g.stroke();
      g.drawImage(S.glow,x-30,y-30,60,60); g.restore(); } },.15+i*.2);
  }
  function impact(x,y){
    fxRing(x,y,{color:'255,200,90',max:170,life:.5,width:10});
    fxRing(x,y,{color:'255,90,30',max:120,life:.4,width:8});
    fxFlash('#ffb060',.18,.25);
    for(let q=0;q<14;q++){ const ang=Math.random()*Math.PI*2, sp=200+Math.random()*340;
      fxAdd({ x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-100,life:.5+Math.random()*.4,
        step(dt,a){ a.vy+=500*dt; a.x+=a.vx*dt; a.y+=a.vy*dt; if(a.t>a.life) a.done=true; },
        draw(g,a){ g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=Math.max(0,1-a.t/a.life); g.fillStyle=Math.random()<.5?'#ffb030':'#ff5a1a'; g.fillRect(a.x,a.y,3,3); g.restore(); } }); }
    const root=$('overlayRoot'); if(root){ root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); setTimeout(()=>root.classList.remove('shake'),450); }
    for(let i=0;i<per;i++){
      const ang=Math.random()*Math.PI*2, sp=300+Math.random()*500;
      fxHomer({T,tr,x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-160,grav:700,drag:.1,home:.4+i*(.45/per)+Math.random()*.15,r:7+Math.random()*4,star:i%5===0,trail:'255,140,40'});
    }
  }
  setTimeout(()=>tr.cnt.end(),R*200+5400);
  return true;
}


/* ============================================================
   HEX PACK — all-new effects for the CLASSIC (hex) skin.
   Same tiers as before, but every effect is built from hexagons / pentagons / honeycomb:
     10+ PRISM | 20+ JET | 35+ PENTA BLOOM | 50+ HEX PARTY | 100+ SHOCKWAVE
     150+ ARC SURGE | 200+ HEX NOVA | 299+ CORE OVERLOAD | 500+ RAILGUN | 1000+ HYPERGRID | 3000+ HEX METEOR
   ============================================================ */
const HX_TAU=Math.PI*2;
function hxAcc(){ const v=getComputedStyle(document.documentElement).getPropertyValue('--n').trim(); return /^\d+\s*,\s*\d+\s*,\s*\d+$/.test(v)?v.replace(/\s/g,''):'31,184,232'; }
function hxPoly(g,x,y,r,n,rot){ g.beginPath(); for(let i=0;i<n;i++){ const a=rot+i/n*HX_TAU, px=x+Math.cos(a)*r, py=y+Math.sin(a)*r; if(i) g.lineTo(px,py); else g.moveTo(px,py); } g.closePath(); }
function hxGem(g,x,y,r,n,rot,col,alpha=1){
  g.save(); g.globalAlpha=alpha; g.lineJoin='round';
  hxPoly(g,x,y,r,n,rot); g.fillStyle=`rgba(${col},.30)`; g.fill(); g.lineWidth=Math.max(1.5,r*.28); g.strokeStyle=`rgba(${col},1)`; g.stroke();
  hxPoly(g,x,y,r*.5,n,rot+Math.PI/n); g.fillStyle='rgba(255,255,255,.92)'; g.fill();
  g.restore();
}
function hxRing(x,y,{n=6,color='31,184,232',max=220,life=.6,width=8,delay=0,rot=0,spin=0}={}){
  fxAdd({ draw(g,a){ const k=a.t/life; if(k>=1){a.done=true;return;} const e=1-Math.pow(1-k,2.4);
    g.save(); g.globalCompositeOperation='lighter'; g.lineJoin='round'; g.lineWidth=Math.max(1,(1-k)*width); g.strokeStyle=`rgba(${color},${1-k})`;
    hxPoly(g,x,y,Math.max(2,e*max),n,rot+spin*k); g.stroke(); g.restore(); } },delay);
}
/* honeycomb wave: hex cells light up outward from (ox,oy) */
function hxHoneycomb(ox,oy,{color='31,184,232',life=1,size=26,speed=520,delay=0,alpha=.5}={}){
  const W=FX.W,H=FX.H,w=size*Math.sqrt(3),h=size*1.5,cells=[];
  for(let r=-1;r*h<H+size;r++) for(let c=-1;c*w<W+w;c++){ const x=c*w+((r&1)?w/2:0), y=r*h; cells.push({x,y,d:Math.hypot(x-ox,y-oy),j:Math.random()}); }
  const total=life+Math.hypot(W,H)/speed;
  fxAdd({ draw(g,a){ const t=a.t; if(t>total){a.done=true;return;}
    g.save(); g.globalCompositeOperation='lighter'; g.lineWidth=1.4;
    for(const c of cells){ const lt=t-c.d/speed; if(lt<0||lt>life) continue; const k=lt/life, al=(1-k)*(1-k)*alpha*(.6+c.j*.4);
      g.strokeStyle=`rgba(${color},${Math.min(1,al*1.7)})`; g.fillStyle=`rgba(${color},${al*.5})`; hxPoly(g,c.x,c.y,size*.92,6,Math.PI/6); g.fill(); g.stroke(); }
    g.restore(); } },delay);
}
/* jagged electric bolt */
function hxBolt(x0,y0,x1,y1,{color='120,200,255',life=.3,delay=0,width=3,jag=26,onFire=null}={}){
  const pts=[[x0,y0]], seg=9, dx=x1-x0, dy=y1-y0, len=Math.hypot(dx,dy)||1, nx=-dy/len, ny=dx/len;
  for(let i=1;i<seg;i++){ const f=i/seg, o=(Math.random()-.5)*jag; pts.push([x0+dx*f+nx*o,y0+dy*f+ny*o]); }
  pts.push([x1,y1]);
  fxAdd({ fired:false, draw(g,a){ const k=a.t/life; if(k>=1){a.done=true;return;} if(!a.fired){ a.fired=true; if(onFire) onFire(); } if(Math.random()<.22) return;
    const al=1-k*.7; g.save(); g.globalCompositeOperation='lighter'; g.lineJoin='round'; g.lineCap='round';
    const st=(w,c)=>{ g.lineWidth=w; g.strokeStyle=c; g.beginPath(); pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])); g.stroke(); };
    st(width*4,`rgba(${color},${.25*al})`); st(width*2,`rgba(${color},${.6*al})`); st(width,`rgba(255,255,255,${al})`); g.restore(); } },delay);
}
function hxShake(){ const root=$('overlayRoot'); if(root){ root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); setTimeout(()=>root.classList.remove('shake'),500); } }
const hxSz=()=>({W:FX.W||$('stack').offsetWidth, H:FX.H||$('stack').offsetHeight});
const HXCOL=['255,59,59','255,200,40','77,255,122','34,211,238','179,77,255','255,59,212'];

/* 10+ PRISM — crystal shards rain down, pentagon/hexagon gems burst out of the row and get pulled in */
function hxPrism(key,from,to){
  const T=fxTarget(key); if(!T) return false; const A=hxAcc(), {W}=hxSz();
  const delta=to-from, N=Math.min(24,8+delta), tr=fxTracker(key,from,to,N,T);
  hxRing(T.x,T.y,{n:6,color:A,max:110,life:.5,width:6});
  hxRing(T.x,T.y,{n:6,color:'255,255,255',max:70,life:.4,width:4,rot:Math.PI/6,delay:.05});
  for(let q=0;q<10;q++){ const x0=Math.random()*W, life=.6+Math.random()*.4, s0=9+Math.random()*9;
    fxAdd({ draw(g,a){ const k=a.t/life; if(k>=1){a.done=true;return;} const x=x0-50*k, y=-10+(T.y+20)*k;
      g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=1-k*.6; hxPoly(g,x,y,s0*(1-k*.4),4,k*6); g.fillStyle=`rgba(${A},.75)`; g.fill(); g.restore(); } },Math.random()*.4);
  }
  for(let i=0;i<N;i++){ const ang=Math.random()*HX_TAU, sp=170+Math.random()*250;
    fxHomer({T,tr,x:T.x,y:T.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,drag:.04,home:.28+i*(.3/N),r:7+Math.random()*3,poly:i%2?6:5,col:i%3===0?'255,255,255':A}); }
  setTimeout(()=>tr.cnt.end(),3600); return true;
}
/* 20+ JET — a column of rising hex rings + gems fountain */
function hxJet(key,from,to){
  const T=fxTarget(key); if(!T) return false; const A=hxAcc(), {W,H}=hxSz();
  const delta=to-from, N=Math.min(60,16+Math.round(delta/3)), tr=fxTracker(key,from,to,N,T), ox=W/2, oy=H-34;
  hxRing(ox,oy,{n:6,color:'255,226,122',max:120,life:.5,width:8}); fxFlash(`rgb(${A})`,.08,.3);
  for(let j=0;j<9;j++) fxAdd({ draw(g,a){ const k=a.t/.9; if(k>=1){a.done=true;return;}
    const y=oy-k*H*.85, r=16+k*30; g.save(); g.globalCompositeOperation='lighter'; g.lineWidth=3*(1-k)+1; g.strokeStyle=`rgba(255,226,122,${(1-k)*.9})`; hxPoly(g,ox,y,r,6,k*2); g.stroke(); g.restore(); } },j*.07);
  for(let i=0;i<N;i++){ const spread=(Math.random()-.5)*.7, sp=620+Math.random()*320;
    fxHomer({T,tr,x:ox+(Math.random()-.5)*20,y:oy,vx:Math.sin(spread)*sp*.55,vy:-Math.cos(spread)*sp,grav:1500,drag:.7,home:.85+i*(.7/N)+Math.random()*.1,r:7+Math.random()*4,poly:6,col:i%4===0?'255,255,255':i%2?'255,210,63':A},i*.014); }
  setTimeout(()=>tr.cnt.end(),4600); return true;
}
/* 35+ PENTA BLOOM — pentagon petals open like a flower, then spiral into the row */
function hxBloom(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const delta=to-from, N=Math.min(40,15+Math.round(delta/2)), tr=fxTracker(key,from,to,N,T);
  hxRing(T.x,T.y,{n:5,color:'255,90,200',max:150,life:.75,width:9,spin:1.2});
  hxRing(T.x,T.y,{n:5,color:'255,190,240',max:100,life:.6,width:6,delay:.08,spin:-1.4});
  fxFlash('#ff4fc3',.07,.35);
  for(let i=0;i<N;i++){ const ang=i/N*HX_TAU*2.2, sp=210+(i%5)*55;
    fxHomer({T,tr,x:T.x,y:T.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,drag:.05,home:.45+i*(.45/N),r:8+Math.random()*3,poly:5,col:i%3?'255,90,200':'255,190,240'},i*.012); }
  setTimeout(()=>tr.cnt.end(),4200); return true;
}
/* 50+ HEX PARTY — two cannons fire multicolour polygons */
function hxParty(key,from,to){
  const T=fxTarget(key); if(!T) return false; const {W,H}=hxSz();
  const delta=to-from, N=Math.min(70,26+Math.round(delta/2)), tr=fxTracker(key,from,to,N,T);
  for(const side of [-1,1]){ const ox=side<0?16:W-16, oy=H-16;
    hxRing(ox,oy,{n:6,color:'255,255,255',max:60,life:.35,width:6}); hxRing(ox,oy,{n:6,color:'255,200,40',max:90,life:.5,width:5,delay:.04});
    for(let i=0;i<N/2;i++){ const ang=-Math.PI/2-side*(.22+Math.random()*.6), sp=720+Math.random()*420, col=HXCOL[(i+(side>0?2:0))%HXCOL.length];
      fxHomer({T,tr,x:ox,y:oy,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,grav:1300,drag:.65,home:.9+i*(.7/N)+Math.random()*.1,r:6+Math.random()*4,poly:3+(i%4),col},i*.012); } }
  fireConfetti(60);
  setTimeout(()=>tr.cnt.end(),4800); return true;
}
/* 100+ SHOCKWAVE — concentric hexagon shockwaves + honeycomb ripple, gems implode */
function hxShock(key,from,to){
  const T=fxTarget(key); if(!T) return false; const A=hxAcc();
  const delta=to-from, N=Math.min(70,30+Math.round(delta/4)), tr=fxTracker(key,from,to,N,T);
  fxFlash('#ffffff',.18,.25);
  for(let j=0;j<5;j++) hxRing(T.x,T.y,{n:6,color:j%2?'255,200,60':A,max:260+j*40,life:.65+j*.07,width:12-j,delay:j*.07,rot:j*.2});
  hxHoneycomb(T.x,T.y,{color:A,life:.9,speed:600});
  hxShake();
  for(let i=0;i<N;i++){ const ang=Math.random()*HX_TAU, sp=300+Math.random()*520;
    fxHomer({T,tr,x:T.x,y:T.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-120,grav:700,drag:.1,home:.4+i*(.45/N)+Math.random()*.15,r:7+Math.random()*4,poly:6,col:i%3===0?'255,255,255':i%2?'255,200,60':A}); }
  setTimeout(()=>tr.cnt.end(),4800); return true;
}
/* 150+ ARC SURGE — electric arcs strike through hex nodes onto the row */
function hxArc(key,from,to){
  const T=fxTarget(key); if(!T) return false; const A=hxAcc(), {W,H}=hxSz();
  const delta=to-from, K=Math.min(6,3+Math.floor(delta/200)), N=Math.min(70,24+Math.round(delta/5)), per=Math.ceil(N/K), tr=fxTracker(key,from,to,K*per,T);
  fxAdd({ draw(g,a){ const D=K*.24+.9; if(a.t>D){a.done=true;return;} const e=Math.min(1,a.t/.2,(D-a.t)/.4)*.42; g.save(); g.fillStyle=`rgba(4,8,30,${e})`; g.fillRect(0,0,W,H); g.restore(); } });
  for(let k=0;k<K;k++){ const tx=T.x+(Math.random()-.5)*170, sx=tx+(Math.random()-.5)*120, delay=.12+k*.24;
    hxBolt(sx,-10,tx,T.y,{color:'120,200,255',delay,width:3,jag:46,onFire(){
      fxFlash('#cfe0ff',.35,.2); hxRing(tx,T.y,{n:6,color:'170,200,255',max:130,life:.45,width:10}); hxRing(tx,T.y,{n:6,color:'255,255,255',max:80,life:.3,width:7,rot:Math.PI/6});
      hxHoneycomb(tx,T.y,{color:'140,190,255',life:.5,size:22,speed:700,alpha:.4}); hxShake();
      for(let i=0;i<per;i++){ const ang=Math.random()*HX_TAU, sp=280+Math.random()*340;
        fxHomer({T,tr,x:tx,y:T.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-100,grav:600,drag:.1,home:.35+i*(.4/per),r:7+Math.random()*3,poly:6,col:i%2?'170,200,255':A}); } }});
  }
  setTimeout(()=>tr.cnt.end(),5000); return true;
}
/* 200+ HEX NOVA — rockets rise, explode in six-armed hexagonal bursts */
function hxNova(key,from,to){
  const T=fxTarget(key); if(!T) return false; const A=hxAcc(), {W,H}=hxSz();
  const delta=to-from, K=Math.min(6,3+Math.floor(delta/120)), per=30, tr=fxTracker(key,from,to,K*per,T);
  for(let k=0;k<K;k++){ const ex=W*(.18+Math.random()*.64), ey=H*(.12+Math.random()*.38), sx=W/2+(Math.random()-.5)*80, delay=k*.34, col=HXCOL[(k*2)%HXCOL.length];
    fxAdd({ draw(g,a){ const kk=a.t/.42; if(kk>=1){ a.done=true; boom(); return; } const x=sx+(ex-sx)*kk, y=H+(ey-H)*(1-Math.pow(1-kk,2));
      g.save(); g.globalCompositeOperation='lighter'; g.strokeStyle='rgba(255,255,255,.9)'; g.lineWidth=3; g.lineCap='round'; g.beginPath(); g.moveTo(x,y); g.lineTo(x-(ex-sx)*.12,y+30); g.stroke(); g.restore(); } },delay);
    function boom(){
      hxRing(ex,ey,{n:6,color:col,max:150,life:.6,width:9}); hxRing(ex,ey,{n:6,color:'255,255,255',max:90,life:.4,width:6,rot:Math.PI/6}); fxFlash(`rgb(${col})`,.08,.25);
      for(let s=0;s<6;s++){ const ang=s/6*HX_TAU+Math.PI/6; for(let j=0;j<5;j++){ const sp=150+j*80;
        fxHomer({T,tr,x:ex,y:ey,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,grav:260,drag:.12,home:.5+j*.06+Math.random()*.1,r:6+Math.random()*3,poly:j%2?6:4,col:j%2?col:'255,255,255'}); } } }
  }
  setTimeout(()=>tr.cnt.end(),5600); return true;
}
/* 299+ CORE OVERLOAD — converging hex charge, white-out, honeycomb meltdown wave */
function hxCore(key,from,to){
  const T=fxTarget(key); if(!T) return false; const A=hxAcc();
  const delta=to-from, N=Math.min(90,44+Math.round(delta/6)), tr=fxTracker(key,from,to,N,T);
  fxRainbow(key,4800);
  for(let j=0;j<4;j++) fxAdd({ draw(g,a){ const k=a.t/.7; if(k>=1){a.done=true;return;} const r=(1-k)*(300-j*45)+8;
    g.save(); g.globalCompositeOperation='lighter'; g.lineWidth=2+k*7; g.strokeStyle=`rgba(255,${120+j*30},60,${.25+k*.7})`; hxPoly(g,T.x,T.y,r,6,k*(j%2?4:-4)); g.stroke(); g.restore(); } },j*.07);
  setTimeout(()=>{
    fxFlash('#ffffff',.85,.5); fxFlash('#ff7a1a',.3,.9); hxShake();
    hxHoneycomb(T.x,T.y,{color:'255,130,40',life:1.1,size:28,speed:480,alpha:.65});
    for(let j=0;j<6;j++) hxRing(T.x,T.y,{n:6,color:j%2?'255,200,80':'255,90,40',max:320+j*50,life:.8+j*.08,width:14-j*1.5,delay:j*.08,rot:j*.17});
    for(let i=0;i<N;i++){ const ang=Math.random()*HX_TAU, sp=380+Math.random()*620;
      fxHomer({T,tr,x:T.x,y:T.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-180,grav:800,drag:.1,home:.5+i*(.7/N)+Math.random()*.2,r:7+Math.random()*5,poly:6,col:i%3===0?'255,255,255':i%2?'255,170,60':'255,90,40'}); }
  },700);
  setTimeout(()=>tr.cnt.end(),6200); return true;
}
/* 500+ RAILGUN — hex-segmented laser rails slam down from above */
function hxRail(key,from,to){
  const T=fxTarget(key); if(!T) return false; const {W}=hxSz();
  const delta=to-from, K=5, per=Math.min(18,8+Math.round(delta/80)), tr=fxTracker(key,from,to,K*per,T);
  for(let k=0;k<K;k++){ const x=T.x+(k-2)*(W*.17), delay=k*.16, col=k%2?'255,59,212':'179,77,255';
    fxAdd({ fired:false, draw(g,a){ const kk=a.t/.55; if(kk>=1){a.done=true;return;}
      if(!a.fired&&kk>.18){ a.fired=true; hxRing(x,T.y,{n:6,color:col,max:120,life:.45,width:9}); hxHoneycomb(x,T.y,{color:col,life:.5,size:22,speed:700,alpha:.4});
        for(let i=0;i<per;i++){ const ang=-Math.PI/2+(Math.random()-.5)*2.4, sp=260+Math.random()*420;
          fxHomer({T,tr,x,y:T.y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,grav:900,drag:.1,home:.4+i*(.4/per),r:7+Math.random()*3,poly:i%2?6:5,col:i%3===0?'255,255,255':col}); } }
      const w=Math.max(2,16*(1-kk)), al=Math.min(1,kk*8)*(1-kk*.4); g.save(); g.globalCompositeOperation='lighter';
      g.fillStyle=`rgba(${col},${al*.35})`; g.fillRect(x-w*1.6,0,w*3.2,T.y); g.fillStyle=`rgba(255,255,255,${al})`; g.fillRect(x-w/2,0,w,T.y);
      g.strokeStyle=`rgba(${col},${al})`; g.lineWidth=2; for(let y=((a.t*900)%48)-48;y<T.y;y+=48){ hxPoly(g,x,y,w*1.5+6,6,0); g.stroke(); } g.restore(); } },delay);
  }
  fxFlash('#ff9ee8',.1,.5);
  setTimeout(()=>tr.cnt.end(),5000); return true;
}
/* 1000+ HYPERGRID — a spinning hexagon vortex swallows gems into the row */
function hxGrid(key,from,to){
  const T=fxTarget(key); if(!T) return false; const {W,H}=hxSz();
  const delta=to-from, N=Math.min(100,50+Math.round(delta/20)), tr=fxTracker(key,from,to,N,T), D=3.2;
  fxAdd({ draw(g,a){ if(a.t>D){a.done=true;return;} const k=a.t/D, e=Math.min(1,a.t/.4,(D-a.t)/.7);
    g.save(); g.fillStyle=`rgba(18,6,40,${e*.55})`; g.fillRect(0,0,W,H); g.globalCompositeOperation='lighter';
    for(let j=0;j<10;j++){ const r=((1-((k*1.6+j/10)%1))*330)+6, al=e*Math.min(1,r/80)*.75; g.lineWidth=2.5; g.strokeStyle=`rgba(${j%2?'179,77,255':'255,59,212'},${al})`; hxPoly(g,T.x,T.y,r,6,(j%2?1:-1)*a.t*1.4+j*.15); g.stroke(); }
    g.restore(); } });
  hxHoneycomb(T.x,T.y,{color:'179,77,255',life:1.2,size:30,speed:420,alpha:.5});
  for(let i=0;i<N;i++){ const ang=i/N*HX_TAU*3, R=150+(i%7)*26, sp=330;
    fxHomer({T,tr,x:T.x+Math.cos(ang)*R,y:T.y+Math.sin(ang)*R*.8,vx:-Math.sin(ang)*sp,vy:Math.cos(ang)*sp,drag:.55,home:.9+i*(1.3/N),r:7+Math.random()*3,poly:i%2?6:5,col:i%3===0?'255,255,255':i%2?'255,59,212':'179,77,255'},i*.01); }
  hxRing(T.x,T.y,{n:6,color:'224,200,255',max:300,life:.9,width:12,delay:2.3,spin:2});
  setTimeout(()=>tr.cnt.end(),6800); return true;
}
/* 3000+ HEX METEOR — hexagonal meteors crash into the row one after another */
function hxMeteor(key,from,to){
  const T=fxTarget(key); if(!T) return false; const {W}=hxSz();
  const delta=to-from, M=7, per=14, tr=fxTracker(key,from,to,M*per,T);
  for(let m=0;m<M;m++){ const x0=(Math.random()*W*1.1)-W*.05, tx=T.x+(Math.random()-.5)*190, ty=T.y+(Math.random()-.5)*26, delay=.1+m*.3, dur=.55;
    fxAdd({ draw(g,a){ const k=a.t/dur; if(k>=1){ a.done=true; hit(); return; } const x=x0+(tx-x0)*k, y=-40+(ty+40)*k;
      const lg=g.createLinearGradient(x,y,x-(tx-x0)*.5,y-(ty+40)*.5); lg.addColorStop(0,'rgba(255,170,60,.9)'); lg.addColorStop(1,'rgba(255,90,20,0)');
      g.save(); g.globalCompositeOperation='lighter'; g.strokeStyle=lg; g.lineWidth=14; g.lineCap='round'; g.beginPath(); g.moveTo(x,y); g.lineTo(x-(tx-x0)*.5,y-(ty+40)*.5); g.stroke(); g.restore();
      hxGem(g,x,y,15,6,a.t*6,'255,160,50'); } },delay);
    function hit(){ fxFlash('#ffb060',.22,.25); hxRing(tx,ty,{n:6,color:'255,160,50',max:150,life:.5,width:11}); hxRing(tx,ty,{n:6,color:'255,255,255',max:90,life:.35,width:7,rot:Math.PI/6});
      hxHoneycomb(tx,ty,{color:'255,140,40',life:.55,size:24,speed:650,alpha:.45}); hxShake();
      for(let i=0;i<per;i++){ const ang=Math.random()*HX_TAU, sp=300+Math.random()*420;
        fxHomer({T,tr,x:tx,y:ty,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp-140,grav:800,drag:.1,home:.4+i*(.45/per),r:7+Math.random()*3,poly:i%2?6:4,col:i%3===0?'255,255,255':'255,160,50'}); } }
  }
  setTimeout(()=>tr.cnt.end(),6200); return true;
}
/* efek asli (Money Gun / Galaxy / Meteor) tetap dipakai di Classic */
const ORIG_FX=new Set(['stars','fountain','hearts','confetti','burst','lightning','fireworks','nuke','moneygun','galaxy','meteor','blackhole','shark']);
const HX={stars:hxPrism,fountain:hxJet,hearts:hxBloom,confetti:hxParty,burst:hxShock,lightning:hxArc,fireworks:hxNova,nuke:hxCore,moneygun:hxRail,galaxy:hxGrid,meteor:hxMeteor};

/* entry: returns true when a canvas effect handled the row (kind is chosen from the coins just added) */
function fxBig(key,from,to,tier){
  if(!isBW()){ const k=kindOf(to-from); if(!ORIG_FX.has(k)){ const hf=HX[k]; if(hf) return hf(key,from,to); } }
  switch(kindOf(to-from)){
    case 'blackhole':return fxBlackhole(key,from,to);
    case 'shark':    return fxShark(key,from,to);
    case 'meteor':   return fxMeteor(key,from,to);
    case 'galaxy':   return fxGalaxy(key,from,to);
    case 'moneygun': return fxMoneyGun(key,from,to);
    case 'nuke':     return fxNuke(key,from,to);
    case 'fireworks':return fxFireworks(key,from,to);
    case 'lightning':return fxLightning(key,from,to);
    case 'burst':    return fxBurst(key,from,to);
    case 'confetti': return fxConfettiCannons(key,from,to);
    case 'hearts':   return fxHearts(key,from,to);
    case 'fountain': return fxFountain(key,from,to);
    case 'stars':    return fxStars(key,from,to);
    default:         return false;
  }
}


/* ============================================================
   2100–2999 : SHARK ATTACK
     air naik dari bawah memenuhi frame + gelembung  →  hiu lewat (kiri↔kanan)
     →  hiu hilang  →  JUMPSCARE: hiu zoom ke layar + gigitan  →  hilang
     →  hiu menyambar super cepat melewati baris pemain, C nambah
   ============================================================ */
function sharkSide(g,x,y,L,dir,ph,alpha=1){
  g.save(); g.translate(x,y); g.scale(dir,1); g.rotate(Math.sin(ph)*.035); g.globalAlpha=alpha; g.lineJoin='round';
  const w=Math.sin(ph)*L*.06, OL='rgba(10,24,38,.9)';
  // dorsal fin
  g.fillStyle='#2c465e'; g.strokeStyle=OL; g.lineWidth=Math.max(1.5,L*.006);
  g.beginPath(); g.moveTo(L*.12,-L*.12); g.quadraticCurveTo(L*.02,-L*.2,-L*.04,-L*.31); g.quadraticCurveTo(-L*.1,-L*.2,-L*.17,-L*.11); g.closePath(); g.fill(); g.stroke();
  // pectoral fin
  g.fillStyle='#4f6f8a';
  g.beginPath(); g.moveTo(L*.15,L*.09); g.quadraticCurveTo(L*.06,L*.2,-L*.04,L*.29); g.quadraticCurveTo(-L*.04,L*.17,-L*.07,L*.09); g.closePath(); g.fill(); g.stroke();
  // body + tail
  const bg=g.createLinearGradient(0,-L*.15,0,L*.14);
  bg.addColorStop(0,'#27425c'); bg.addColorStop(.42,'#5f84a2'); bg.addColorStop(.56,'#a9c4d8'); bg.addColorStop(.64,'#eef5fa'); bg.addColorStop(1,'#dfeaf2');
  g.fillStyle=bg;
  g.beginPath(); g.moveTo(L*.5,L*.012);
  g.bezierCurveTo(L*.38,-L*.09,L*.2,-L*.145,-L*.02,-L*.135);
  g.bezierCurveTo(-L*.2,-L*.115,-L*.32,-L*.05+w*.3,-L*.4,-L*.015+w*.6);
  g.lineTo(-L*.52,-L*.19+w);
  g.bezierCurveTo(-L*.47,-L*.09+w,-L*.46,-L*.04+w,-L*.45,w*.9);
  g.lineTo(-L*.49,L*.14+w);
  g.bezierCurveTo(-L*.42,L*.07+w*.8,-L*.4,L*.03+w*.6,-L*.4,L*.02+w*.6);
  g.bezierCurveTo(-L*.3,L*.05,-L*.18,L*.09,-L*.02,L*.12);
  g.bezierCurveTo(L*.2,L*.135,L*.4,L*.08,L*.5,L*.012);
  g.closePath(); g.fill(); g.stroke();
  // gills
  g.strokeStyle='rgba(15,35,55,.55)'; g.lineWidth=Math.max(1.2,L*.006);
  for(let i=0;i<4;i++){ const gx=L*(.25-i*.02); g.beginPath(); g.moveTo(gx,-L*.06); g.quadraticCurveTo(gx-L*.012,-L*.005,gx,L*.05); g.stroke(); }
  // mouth + teeth
  g.strokeStyle='#101c28'; g.lineWidth=Math.max(1.5,L*.007);
  g.beginPath(); g.moveTo(L*.495,L*.02); g.quadraticCurveTo(L*.43,L*.075,L*.33,L*.06); g.stroke();
  g.fillStyle='#fff';
  for(let i=0;i<6;i++){ const t=i/5, px=L*(.485-t*.15), py=L*(.025+Math.sin(t*Math.PI)*.03+t*.02); g.beginPath(); g.moveTo(px,py); g.lineTo(px-L*.012,py); g.lineTo(px-L*.006,py+L*.014); g.closePath(); g.fill(); }
  // eye
  g.fillStyle='#050a10'; g.beginPath(); g.arc(L*.375,-L*.03,L*.0145,0,7); g.fill();
  g.fillStyle='#fff'; g.beginPath(); g.arc(L*.379,-L*.034,L*.0045,0,7); g.fill();
  g.restore();
}
function sharkFront(g,cx,cy,S,open){
  g.save(); g.translate(cx,cy); g.lineJoin='round';
  // head
  const hg=g.createLinearGradient(0,-S,0,S);
  hg.addColorStop(0,'#1b2f43'); hg.addColorStop(.4,'#4f7088'); hg.addColorStop(.62,'#a3bccd'); hg.addColorStop(1,'#eaf2f7');
  g.fillStyle=hg; g.strokeStyle='rgba(8,18,30,.85)'; g.lineWidth=S*.012;
  g.beginPath(); g.moveTo(0,-S);
  g.bezierCurveTo(S*.55,-S*.95,S*1.12,-S*.55,S*1.1,S*.1);
  g.bezierCurveTo(S*1.08,S*.7,S*.6,S*1.05,0,S*1.05);
  g.bezierCurveTo(-S*.6,S*1.05,-S*1.08,S*.7,-S*1.1,S*.1);
  g.bezierCurveTo(-S*1.12,-S*.55,-S*.55,-S*.95,0,-S);
  g.closePath(); g.fill(); g.stroke();
  // gill slits
  g.strokeStyle='rgba(8,20,32,.5)'; g.lineWidth=S*.014;
  for(const sd of [-1,1]) for(let i=0;i<4;i++){ g.beginPath(); g.moveTo(sd*(S*.98-i*S*.04),-S*.08+i*S*.015); g.lineTo(sd*(S*.93-i*S*.04),S*.24+i*S*.015); g.stroke(); }
  // nostrils
  g.fillStyle='rgba(5,12,20,.8)'; for(const sd of [-1,1]){ g.beginPath(); g.ellipse(sd*S*.2,-S*.5,S*.045,S*.016,sd*.5,0,7); g.fill(); }
  // mouth
  const my=S*.3, mw=S*.92, f=u=>Math.pow(Math.max(0,1-u*u),.75), sm=u=>S*.2*u*u;
  const yU=u=>my-(S*.1+S*(.05+open*.34))*f(u)+sm(u), yL=u=>my+(S*.04+S*(.05+open*.34)+S*.12*open)*f(u)+sm(u);
  const cg=g.createRadialGradient(0,my,S*.05,0,my,mw); cg.addColorStop(0,'#6a0914'); cg.addColorStop(.55,'#2a0309'); cg.addColorStop(1,'#050003');
  g.fillStyle=cg; g.beginPath();
  for(let i=0;i<=40;i++){ const u=-1+i/20*1; const uu=-1+i*.05; i?g.lineTo(uu*mw,yU(uu)):g.moveTo(uu*mw,yU(uu)); }
  for(let i=40;i>=0;i--){ const uu=-1+i*.05; g.lineTo(uu*mw,yL(uu)); }
  g.closePath(); g.fill();
  g.strokeStyle='rgba(0,0,0,.55)'; g.lineWidth=S*.035; g.beginPath(); for(let i=0;i<=40;i++){ const uu=-1+i*.05; i?g.lineTo(uu*mw,yU(uu)-S*.012):g.moveTo(uu*mw,yU(uu)-S*.012); } g.stroke();
  // teeth
  const tg=g.createLinearGradient(0,-S*.1,0,S*.1); tg.addColorStop(0,'#fffef2'); tg.addColorStop(1,'#d8d0b0');
  g.fillStyle=tg; g.strokeStyle='rgba(70,60,40,.8)'; g.lineWidth=S*.006;
  const NT=17;
  for(let i=0;i<NT;i++){ const u=-.94+i*(1.88/(NT-1)), x=u*mw, au=Math.abs(u), tl=S*(.1+.14*(1-au*au))*(.75+open*.25), bw=S*(.085-.02*au);
    const y=yU(u), lean=-u*S*.03;
    g.beginPath(); g.moveTo(x-bw/2,y-S*.012); g.lineTo(x+bw/2,y-S*.012); g.lineTo(x+lean,y+tl); g.closePath(); g.fill(); g.stroke(); }
  for(let i=0;i<NT-1;i++){ const u=-.9+i*(1.8/(NT-2)), x=u*mw, au=Math.abs(u), tl=S*(.09+.12*(1-au*au))*(.75+open*.25), bw=S*(.08-.02*au);
    const y=yL(u), lean=-u*S*.03;
    g.beginPath(); g.moveTo(x-bw/2,y+S*.012); g.lineTo(x+bw/2,y+S*.012); g.lineTo(x+lean,y-tl); g.closePath(); g.fill(); g.stroke(); }
  // eyes
  for(const sd of [-1,1]){ const ex=sd*S*.72, ey=-S*.14;
    const sg=g.createRadialGradient(ex,ey,0,ex,ey,S*.17); sg.addColorStop(0,'rgba(0,0,0,.55)'); sg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=sg; g.fillRect(ex-S*.2,ey-S*.2,S*.4,S*.4);
    g.fillStyle='#03060a'; g.beginPath(); g.arc(ex,ey,S*.078,0,7); g.fill();
    g.fillStyle='rgba(255,255,255,.9)'; g.beginPath(); g.arc(ex-S*.022,ey-S*.026,S*.02,0,7); g.fill(); }
  g.restore();
}

function fxShark(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, half=Math.min(60,24+Math.round(delta/90)), tr=fxTracker(key,from,to,half*2,T);
  const dirPass=Math.random()<.5?1:-1;
  const RISE=1.1, PASS0=1.5, PASSD=1.7, SCARE0=3.5, APPR=.9, CLOSE=.14, HOLD=.34, DASH0=5.0, DRAIN0=6.2, END=7.05;
  const CHOMP=SCARE0+APPR, SCARE_END=CHOMP+CLOSE+HOLD;
  const L=Math.max(W*1.05,260), SF=Math.max(W*.62,H*.4);

  /* --- water + bubbles --- */
  const bub=[];
  const spawn=(x,y,r,vy)=>{ if(bub.length<170) bub.push({x,y,r,vy,ph:Math.random()*6,wob:6+Math.random()*14}); };
  const level=t=>t<RISE?1-Math.pow(1-t/RISE,3):t<DRAIN0?1:Math.max(0,1-Math.pow((t-DRAIN0)/(END-DRAIN0),2));
  const surf=(x,t,base)=>base+Math.sin(x*.022+t*4)*8+Math.sin(x*.05-t*3)*4;
  fxAdd({ draw(g,a){ const t=a.t; if(t>END){ a.done=true; return; }
    const lv=level(t), base=H*(1-lv)-(lv>=1?30:0);
    // water body
    g.save();
    g.beginPath(); g.moveTo(0,H+4); for(let x=0;x<=W+10;x+=10) g.lineTo(x,surf(x,t,base)); g.lineTo(W,H+4); g.closePath();
    const wg=g.createLinearGradient(0,Math.min(base,H),0,H); wg.addColorStop(0,'rgba(60,170,235,.5)'); wg.addColorStop(.5,'rgba(15,95,175,.6)'); wg.addColorStop(1,'rgba(2,30,90,.78)');
    g.fillStyle=wg; g.fill();
    // foam line
    if(lv<1){ g.strokeStyle='rgba(230,248,255,.75)'; g.lineWidth=3; g.beginPath(); for(let x=0;x<=W+10;x+=10){ const y=surf(x,t,base); x?g.lineTo(x,y):g.moveTo(x,y); } g.stroke(); }
    // light rays
    g.globalCompositeOperation='lighter'; g.clip();
    for(let i=0;i<5;i++){ const rx=((i*.23+t*.03)%1.2-.1)*W, rw=W*.07;
      const rg=g.createLinearGradient(rx,0,rx+H*.3,H); rg.addColorStop(0,'rgba(170,230,255,.16)'); rg.addColorStop(1,'rgba(170,230,255,0)');
      g.fillStyle=rg; g.beginPath(); g.moveTo(rx,0); g.lineTo(rx+rw,0); g.lineTo(rx+rw+H*.3,H); g.lineTo(rx+H*.3-rw*.4,H); g.closePath(); g.fill(); }
    g.restore();
    // darkening before the jumpscare
    const dk=t<SCARE0-.4?0:Math.min(.5,(t-(SCARE0-.4))/1.1*.5), rel=t>CHOMP+.3?Math.max(0,1-(t-CHOMP-.3)/.7):1;
    if(dk>0){ g.save(); g.fillStyle=`rgba(0,8,26,${dk*rel})`; g.fillRect(0,0,W,H); g.restore(); }
  } });
  fxAdd({ acc:0,
    step(dt,a){ if(a.t<0||a.t>6.4) return; a.acc+=dt*(a.t<RISE?90:50);
      while(a.acc>=1){ a.acc--; const front=H*(1-level(a.t)); spawn(Math.random()*W,Math.min(H+10,Math.max(front,H*.1)+Math.random()*(H-front)),2+Math.random()*7,90+Math.random()*190); }
      for(const b of bub){ b.y-=b.vy*dt; b.ph+=dt*3; b.x+=Math.sin(b.ph)*b.wob*dt; }
      for(let i=bub.length-1;i>=0;i--){ const b=bub[i], sy=H*(1-level(a.t)); if(b.y<-12||(b.y<sy&&level(a.t)<1)) bub.splice(i,1); } },
    draw(g,a){ if(a.t>END){ a.done=true; return; }
      g.save(); for(const b of bub){ g.globalAlpha=.75; g.beginPath(); g.arc(b.x,b.y,b.r,0,7); g.fillStyle='rgba(200,240,255,.13)'; g.fill(); g.lineWidth=1.3; g.strokeStyle='rgba(255,255,255,.6)'; g.stroke();
        g.beginPath(); g.arc(b.x-b.r*.3,b.y-b.r*.3,Math.max(.8,b.r*.25),0,7); g.fillStyle='rgba(255,255,255,.85)'; g.fill(); } g.restore(); } });

  /* --- 1) shark swims past --- */
  fxAdd({ draw(g,a){ const k=a.t/PASSD; if(k>=1){ a.done=true; return; }
    const x=dirPass>0?-L*.6+(W+L*1.2)*k:W+L*.6-(W+L*1.2)*k, y=H*.42+Math.sin(k*5)*H*.02;
    sharkSide(g,x,y,L,dirPass,a.t*8,.95);
    if(Math.random()<.7) spawn(x-dirPass*L*.45,y+(Math.random()-.5)*L*.12,2+Math.random()*5,70+Math.random()*80); } },PASS0);

  /* --- 2) JUMPSCARE: shark zooms into the screen and bites --- */
  let bit=false;
  fxAdd({ draw(g,a){ const t=a.t; if(t>CHOMP-SCARE0+CLOSE+HOLD){ a.done=true; return; }
    const ap=t<APPR, k=Math.min(1,t/APPR);
    g.save();
    if(ap){ g.fillStyle=`rgba(0,6,20,${.55*Math.min(1,k*2)})`; g.fillRect(0,0,W,H);
      const S=SF*(.07+1.45*Math.pow(k,3.4)), j=k*k*5; g.globalAlpha=Math.min(1,t/.18);
      sharkFront(g,W/2+(Math.random()-.5)*j,H*.5+(1-k)*H*.04+(Math.random()-.5)*j,S,1); }
    else{
      if(!bit){ bit=true; fxFlash('#ffffff',.6,.2); fxFlash('#d0001a',.5,.9); hxShake(); setTimeout(hxShake,180);
        for(let i=0;i<46;i++) spawn(Math.random()*W,H*(.2+Math.random()*.7),3+Math.random()*9,120+Math.random()*260); }
      const c=t-APPR, kc=Math.min(1,c/CLOSE), open=1-kc*kc, hold=Math.max(0,c-CLOSE);
      const S=SF*(1.45+.12*kc+hold*.15), j=hold>0?7:0;
      sharkFront(g,W/2+(Math.random()-.5)*j,H*.5+(Math.random()-.5)*j,S,open);
      if(c>CLOSE+HOLD-.1){ g.fillStyle='rgba(0,0,0,.92)'; g.fillRect(0,0,W,H); } }
    g.restore(); } },SCARE0);
  // red tint left behind after the bite
  fxAdd({ draw(g,a){ const k=a.t/1.3; if(k>=1){ a.done=true; return; }
    g.save(); const rg=g.createRadialGradient(W/2,H/2,Math.min(W,H)*.25,W/2,H/2,Math.max(W,H)*.75); rg.addColorStop(0,'rgba(160,0,20,0)'); rg.addColorStop(1,`rgba(160,0,20,${.55*(1-k)})`);
    g.fillStyle=rg; g.fillRect(0,0,W,H); g.restore(); } },SCARE_END);

  /* --- 3) fast dash through the player's row, C goes up --- */
  function dash(delay,dir){
    const dur=.4, ys=T.y, streaks=[0,1,2,3,4,5,6].map(()=>({dy:(Math.random()-.5)*L*.2,len:.5+Math.random()*.5})); let hit=false;
    fxAdd({ draw(g,a){ const k=a.t/dur; if(k>=1){ a.done=true; return; }
      const e=k*k*(3-2*k)*.35+k*.65, x=dir>0?-L*.6+(W+L*1.2)*e:W+L*.6-(W+L*1.2)*e;
      g.save(); g.globalCompositeOperation='lighter'; g.lineCap='round';
      for(const s of streaks){ const lg=g.createLinearGradient(x,0,x-dir*L*s.len,0); lg.addColorStop(0,'rgba(200,240,255,.55)'); lg.addColorStop(1,'rgba(200,240,255,0)');
        g.strokeStyle=lg; g.lineWidth=3; g.beginPath(); g.moveTo(x,ys+s.dy); g.lineTo(x-dir*L*s.len,ys+s.dy); g.stroke(); }
      g.restore();
      sharkSide(g,x,ys,L,dir,a.t*34,1);
      spawn(x-dir*L*.4,ys+(Math.random()-.5)*L*.1,3+Math.random()*7,100+Math.random()*120);
      if(!hit && (dir>0?x>=T.x:x<=T.x)){ hit=true; boom(dir); } } },delay);
  }
  function boom(dir){
    fxFlash('#a8ecff',.32,.28); hxShake(); fxRainbow(key,3600);
    fxRing(T.x,T.y,{color:'160,230,255',max:230,life:.55,width:12}); fxRing(T.x,T.y,{color:'255,255,255',max:140,life:.4,width:8});
    for(let i=0;i<22;i++) spawn(T.x+(Math.random()-.5)*60,T.y+(Math.random()-.5)*30,3+Math.random()*8,120+Math.random()*200);
    for(let i=0;i<half;i++){ const ang=Math.random()*Math.PI*2, sp=300+Math.random()*460;
      fxHomer({T,tr,x:T.x,y:T.y,vx:Math.cos(ang)*sp-dir*120,vy:Math.sin(ang)*sp-150,grav:700,drag:.1,home:.35+i*(.4/half)+Math.random()*.1,r:7+Math.random()*4,star:i%6===0,trail:'120,220,255'}); }
  }
  dash(DASH0,-dirPass); dash(DASH0+.55,dirPass);
  setTimeout(()=>tr.cnt.end(),7600);
  return true;
}


/* ============================================================
   v6.5 helpers: twinkling glitter + real confetti pieces
   ============================================================ */
function fxGlitter(x,y,n,{spread=300,life=1.2,grav=300,col='255,230,140',size=16,delay=0,cone=null}={}){
  const S=fxSprites();
  for(let i=0;i<n;i++){
    const ang=cone?cone[0]+Math.random()*(cone[1]-cone[0]):Math.random()*Math.PI*2, sp=spread*(.25+Math.random()*.75), lf=life*(.6+Math.random()*.6), sz=size*(.5+Math.random()*.8), ph=Math.random()*6;
    fxAdd({ x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,lf,sz,ph,
      step(dt,a){ if(a.t<0) return; const d=Math.pow(.25,dt); a.vx*=d; a.vy*=d; a.vy+=grav*dt; a.x+=a.vx*dt; a.y+=a.vy*dt; if(a.t>a.lf) a.done=true; },
      draw(g,a){ if(a.t<0) return; const k=a.t/a.lf, tw=.4+.6*Math.abs(Math.sin(a.t*18+a.ph)), s=a.sz*tw*(1-k*.5);
        g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=Math.max(0,(1-k))*tw;
        g.drawImage(S.glow,a.x-s*1.4,a.y-s*1.4,s*2.8,s*2.8); g.drawImage(S.star,a.x-s/2,a.y-s/2,s,s); g.restore(); } },delay);
  }
}
const CF_COLS=[['#ff3b3b','#a80f1f'],['#ffd23f','#c98a00'],['#35e07a','#12894a'],['#2fd6ff','#0f7fb0'],['#b34dff','#6a1fb0'],['#ff4fcf','#a31a86'],['#ffffff','#b9c6d6'],['#ff9f1a','#b35f00']];
function fxConfettiPiece(x,y,vx,vy,{life=3,delay=0,grav=240,drag=.14,shape}={}){
  const c=CF_COLS[(Math.random()*CF_COLS.length)|0], kind=shape??((Math.random()*5)|0), w=6+Math.random()*8, h=3+Math.random()*5;
  fxAdd({ x,y,vx,vy,rot:Math.random()*6,vr:(Math.random()-.5)*14,life,w,h,c,kind,ph:Math.random()*6,len:26+Math.random()*34,
    step(dt,a){ if(a.t<0) return; const d=Math.pow(drag,dt); a.vx*=d; a.vy*=d; a.vy+=grav*dt; if(a.vy>230) a.vy=230+(a.vy-230)*.85; a.x+=a.vx*dt+Math.sin(a.t*4+a.ph)*26*dt; a.y+=a.vy*dt; a.rot+=a.vr*dt; if(a.t>a.life||a.y>(FX.H||800)+30) a.done=true; },
    draw(g,a){ if(a.t<0) return; const flip=Math.cos(a.t*8+a.ph), side=flip>0?a.c[0]:a.c[1];
      g.save(); g.globalAlpha=Math.min(1,(a.life-a.t)/.6); g.translate(a.x,a.y); g.rotate(a.rot); g.fillStyle=side; g.strokeStyle=side;
      if(a.kind===1){ // streamer ribbon
        g.lineWidth=3.4; g.lineCap='round'; g.beginPath(); for(let i=0;i<=8;i++){ const f=i/8, px=(f-.5)*a.len, py=Math.sin(f*7+a.t*9+a.ph)*4.5*Math.abs(flip+.3); i?g.lineTo(px,py):g.moveTo(px,py); } g.stroke(); }
      else if(a.kind===2){ g.scale(1,Math.abs(flip)*.8+.2); g.beginPath(); g.arc(0,0,a.h*.9,0,7); g.fill(); }
      else if(a.kind===3){ g.scale(1,Math.abs(flip)*.8+.2); g.beginPath(); for(let i=0;i<10;i++){ const r=i%2?a.h*.8:a.h*2, an=i/10*Math.PI*2; g.lineTo(Math.cos(an)*r,Math.sin(an)*r); } g.closePath(); g.fill(); }
      else{ g.scale(1,Math.abs(flip)*.85+.15); g.fillRect(-a.w/2,-a.h/2,a.w,a.h); g.fillStyle='rgba(255,255,255,.35)'; g.fillRect(-a.w/2,-a.h/2,a.w,a.h*.28); }
      g.restore(); } },delay);
}

/* ============================================================
   50+ : CONFETTI CANNONS — pops, ribbons, streamers, stars, rain from the top
   ============================================================ */
function fxConfettiCannons(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, N=Math.min(56,18+Math.round(delta/4)), tr=fxTracker(key,from,to,N,T);
  const cannons=[{x:8,y:H-14,dir:-1},{x:W-8,y:H-14,dir:1}];
  const S=fxSprites();
  const volleys=[0,.16,.34];
  for(const c of cannons) for(const v of volleys){
    // muzzle pop
    fxAdd({ draw(g,a){ const k=a.t/.3; if(k>=1){a.done=true;return;} g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=1-k; const r=30+k*80;
      const gr=g.createRadialGradient(c.x,c.y,0,c.x,c.y,r); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.4,'rgba(255,210,90,.7)'); gr.addColorStop(1,'rgba(255,120,40,0)'); g.fillStyle=gr; g.beginPath(); g.arc(c.x,c.y,r,0,7); g.fill(); g.restore(); } },v);
    fxRing(c.x,c.y,{color:'255,255,255',max:120,life:.4,width:8,delay:v});
    fxGlitter(c.x,c.y,10,{spread:500,life:1,grav:420,cone:[-Math.PI/2-c.dir*1.0,-Math.PI/2+c.dir*.1],delay:v});
    const P=Math.min(70,26+Math.round(delta*.5));
    for(let i=0;i<P;i++){
      const a0=-Math.PI/2-c.dir*(.1+Math.random()*.8), sp=560+Math.random()*640;
      fxConfettiPiece(c.x,c.y,Math.cos(a0)*sp,Math.sin(a0)*sp,{life:2.4+Math.random()*1.4,delay:v+i*.003});
    }
  }
  fxFlash('#ffffff',.16,.3);
  // confetti rain from the top
  const R=Math.min(90,40+Math.round(delta*.6));
  for(let i=0;i<R;i++) fxConfettiPiece(Math.random()*W,-20-Math.random()*60,(Math.random()-.5)*60,60+Math.random()*80,{life:3+Math.random()*1.2,grav:120,delay:.35+Math.random()*1.3});
  // coins
  for(let i=0;i<N;i++){
    const c=cannons[i%2], a0=-Math.PI/2-c.dir*(.2+Math.random()*.6), sp=500+Math.random()*420;
    fxHomer({T,tr,x:c.x,y:c.y,vx:Math.cos(a0)*sp,vy:Math.sin(a0)*sp,grav:600,drag:.08,home:.85+i*(.7/N)+Math.random()*.1,r:8+Math.random()*4,star:i%7===0},i*.012);
  }
  setTimeout(()=>tr.cnt.end(),5200);
  return true;
}

/* ============================================================
   100+ : BIG BURST — light rays, shockwaves, sparks, coin explosion sucked into the row
   ============================================================ */
function fxBurst(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const S=fxSprites(), W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, N=Math.min(110,46+Math.round(delta/5)), tr=fxTracker(key,from,to,N,T);
  const ox=W/2, oy=H*.6;
  // soft backdrop glow
  fxAdd({ draw(g,a){ const k=a.t/1.4; if(k>=1){a.done=true;return;} const e=Math.min(1,k*6)*(1-k); g.save(); g.globalCompositeOperation='lighter';
    const gr=g.createRadialGradient(ox,oy,0,ox,oy,H*.7); gr.addColorStop(0,`rgba(255,220,110,${.55*e})`); gr.addColorStop(.5,`rgba(255,150,40,${.2*e})`); gr.addColorStop(1,'rgba(255,120,0,0)'); g.fillStyle=gr; g.fillRect(0,0,W,H); g.restore(); } });
  // rotating rays
  fxAdd({ draw(g,a){ const k=a.t/1.2; if(k>=1){a.done=true;return;} const e=Math.min(1,k*7)*Math.pow(1-k,1.3), R=Math.max(W,H)*.9; g.save(); g.translate(ox,oy); g.rotate(a.t*.9); g.globalCompositeOperation='lighter';
    for(let i=0;i<18;i++){ g.rotate(Math.PI*2/18); const lg=g.createLinearGradient(0,0,R,0); lg.addColorStop(0,`rgba(255,235,150,${.75*e})`); lg.addColorStop(1,'rgba(255,200,60,0)'); g.fillStyle=lg; g.beginPath(); g.moveTo(0,0); g.lineTo(R,-14-i%2*10); g.lineTo(R,14+i%2*10); g.closePath(); g.fill(); }
    g.restore(); } });
  fxFlash('#fff4b0',.45,.3);
  fxRing(ox,oy,{color:'255,255,255',max:200,life:.4,width:14});
  fxRing(ox,oy,{color:'255,210,63',max:360,life:.7,width:12,delay:.06});
  fxRing(ox,oy,{color:'255,140,40',max:480,life:.95,width:9,delay:.14});
  // radial spark streaks
  for(let i=0;i<46;i++){ const ang=Math.random()*Math.PI*2, sp=420+Math.random()*700, life=.35+Math.random()*.35;
    fxAdd({ life,ang,sp, draw(g,a){ const k=a.t/a.life; if(k>=1){a.done=true;return;} const d=a.sp*(1-Math.pow(1-k,2))*.9, L=22+a.sp*.05*(1-k); const x=ox+Math.cos(a.ang)*d, y=oy+Math.sin(a.ang)*d;
      g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=1-k; g.lineCap='round'; g.lineWidth=3; g.strokeStyle='rgba(255,236,150,1)'; g.beginPath(); g.moveTo(x,y); g.lineTo(x-Math.cos(a.ang)*L,y-Math.sin(a.ang)*L); g.stroke(); g.restore(); } });
  }
  fxGlitter(ox,oy,50,{spread:620,life:1.5,grav:260});
  { const root=$('overlayRoot'); if(root){ root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); setTimeout(()=>root.classList.remove('shake'),450); } }
  // coins explode outward in an arc, then get pulled into the row
  for(let i=0;i<N;i++){
    const ang=Math.random()*Math.PI*2, sp=380+Math.random()*760;
    fxHomer({T,tr,x:ox,y:oy,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp*.85-120,grav:520,drag:.06,home:.6+i*(.9/N)+Math.random()*.1,r:8+Math.random()*6,star:i%6===0});
  }
  setTimeout(()=>tr.cnt.end(),5200);
  return true;
}
