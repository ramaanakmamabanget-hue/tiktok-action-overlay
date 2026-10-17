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
   Uses globals from overlay.js: $, play, counters, collectToken, rowIcon, rowNum, pulseIcon
   ============================================================ */
if(typeof CanvasRenderingContext2D!=='undefined' && !CanvasRenderingContext2D.prototype.roundRect){ CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h){ this.rect(x,y,w,h); }; }
const FX = { cv:null, ctx:null, W:0, H:0, dpr:1, actors:[], raf:0, last:0, sprites:null };
const rainbowUntil = new Map(); // row key -> timestamp until the number stays rainbow

function fxSprites(){
  if (FX.sprites) return FX.sprites;
  const mk=(w,h,fn)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; fn(c.getContext('2d'),w,h); return c; };
  const coin=mk(48,48,(g,w,h)=>{
    const r=w/2-2, gr=g.createRadialGradient(w*.38,h*.32,2,w/2,h/2,r);
    gr.addColorStop(0,'#fff6b0'); gr.addColorStop(.55,'#ffc522'); gr.addColorStop(1,'#d99200');
    g.beginPath(); g.arc(w/2,h/2,r,0,7); g.fillStyle=gr; g.fill();
    g.lineWidth=4; g.strokeStyle='#ffe27a'; g.stroke();
    g.beginPath(); g.arc(w/2,h/2,r*.55,0,7); g.lineWidth=3; g.strokeStyle='rgba(160,95,0,.6)'; g.stroke();
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
    g.fillStyle='#fff0fb'; g.font='bold 13px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('$',w/2,h/2+1);
    g.fillStyle='rgba(255,255,255,.28)'; g.fillRect(2,2,w-4,4);
  });
  const gun=mk(170,110,(g,w,h)=>{
    g.translate(50,44); g.lineJoin='round';
    // pink/purple money roll on top
    for(let i=0;i<3;i++){ g.fillStyle=i%2?'#c04dff':'#ff7ad9'; g.strokeStyle='#4a1480'; g.lineWidth=2; g.beginPath(); g.rect(-30+i*2,-34+i*4,48,10); g.fill(); g.stroke(); }
    // barrel
    const bg=g.createLinearGradient(0,-10,0,8); bg.addColorStop(0,'#f1dcff'); bg.addColorStop(1,'#7a52c8');
    g.fillStyle=bg; g.strokeStyle='#2a1050'; g.lineWidth=3; g.beginPath(); g.roundRect(18,-10,86,16,5); g.fill(); g.stroke();
    g.fillStyle='#ff5ad8'; g.fillRect(98,-7,8,10);
    // body: hot pink -> purple
    const body=g.createLinearGradient(0,-18,0,16); body.addColorStop(0,'#ff9ee8'); body.addColorStop(.5,'#ff3bd4'); body.addColorStop(1,'#8a2be2');
    g.fillStyle=body; g.beginPath(); g.roundRect(-40,-20,66,38,9); g.fill(); g.stroke();
    g.fillStyle='rgba(255,255,255,.35)'; g.beginPath(); g.roundRect(-34,-16,50,7,4); g.fill();
    // grip
    g.fillStyle='#43206e'; g.beginPath(); g.moveTo(-34,16); g.lineTo(-10,16); g.lineTo(-16,56); g.lineTo(-42,56); g.closePath(); g.fill(); g.stroke();
    // trigger guard + trigger
    g.beginPath(); g.arc(4,22,11,0,Math.PI); g.strokeStyle='#2a1050'; g.lineWidth=4; g.stroke();
    g.fillStyle='#2a1050'; g.fillRect(2,18,4,12);
    g.fillStyle='#fff0fb'; g.font='bold 24px Arial'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('$',-8,0);
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
  const sx=Math.abs(Math.cos(rot))*.8+.2; g.scale(sx,1);
  g.drawImage(S.coin,-r,-r,r*2,r*2); g.restore();
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
function fxBurst(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const S=fxSprites(), W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, cnt=fxCounter(key,from,to);
  const ox=W/2, oy=H-40, N=Math.min(130,55+Math.round(delta/6));
  let arrived=0;
  // origin flash
  fxAdd({ life:.55, draw(g,a){ const k=a.t/a.life; if(k>=1){a.done=true;return;}
    g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=1-k; const r=40+k*220;
    const gr=g.createRadialGradient(ox,oy,0,ox,oy,r); gr.addColorStop(0,'rgba(255,245,170,.95)'); gr.addColorStop(.4,'rgba(255,190,40,.5)'); gr.addColorStop(1,'rgba(255,150,0,0)');
    g.fillStyle=gr; g.fillRect(0,0,W,H); g.restore(); } });
  fxRing(ox,oy,{max:260,life:.6,width:12});
  fxRing(ox,oy,{color:'255,255,255',max:180,life:.45,width:8,delay:.05});
  fxFlash('#ffd23f',.22,.35);
  fxRing(ox,oy,{color:'255,160,40',max:340,life:.8,width:8,delay:.18});
  for(let i=0;i<N;i++){
    const ang=Math.random()*Math.PI*2, sp=300+Math.random()*620;
    fxAdd({
      x:ox,y:oy,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp*.9-90,rot:Math.random()*6,vr:(Math.random()-.5)*16,
      r:7+Math.random()*6, home:.55+i*(.95/N)+Math.random()*.08, star:i%4===0,
      step(dt,a){
        if(a.t<0) return;
        if(a.t<a.home){ const d=Math.pow(.035,dt); a.vx*=d; a.vy*=d; a.vy+=70*dt; }
        else{
          const dx=T.x-a.x, dy=T.y-a.y, dist=Math.hypot(dx,dy)||1, sp=Math.min(1500,520+(a.t-a.home)*2800);
          a.vx+=(dx/dist*sp-a.vx)*Math.min(1,dt*9); a.vy+=(dy/dist*sp-a.vy)*Math.min(1,dt*9);
          if(dist<14||a.t>4){
            a.done=true; arrived++; cnt.set(from+Math.round(delta*arrived/N));
            if(arrived%3===0) pulseIcon(key);
            if(dist<14) fxSpark(T.x,T.y,24);
            if(arrived>=N) cnt.end();
            return;
          }
        }
        a.x+=a.vx*dt; a.y+=a.vy*dt; a.rot+=a.vr*dt;
      },
      draw(g,a){
        fxTrail(g,a.x,a.y,a.vx,a.vy,a.r);
        if(a.star){ g.save(); g.globalCompositeOperation='lighter'; const s=a.r*2.4; g.drawImage(S.star,a.x-s/2,a.y-s/2,s,s); g.restore(); }
        else drawCoin(g,S,a.x,a.y,a.r,a.rot);
      }
    },0);
  }
  setTimeout(()=>cnt.end(),5200);
  return true;
}

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

  // falling missile
  fxAdd({ draw(g,a){ const k=a.t/IMPACT; if(k>=1){a.done=true;return;}
    const e=k*k, hx=mx0+(P.x-mx0)*e, hy=-30+(P.y+30)*e;
    const tl=Math.min(170,(hy+30)), tx=mx0+(hx-mx0)*Math.max(0,1-tl/Math.max(1,hy+30)), ty=hy-tl;
    g.save(); g.globalCompositeOperation='lighter'; g.lineCap='round';
    const lg=g.createLinearGradient(hx,hy,tx,ty); lg.addColorStop(0,'rgba(255,240,200,1)'); lg.addColorStop(.3,'rgba(255,150,30,.8)'); lg.addColorStop(1,'rgba(255,60,0,0)');
    g.strokeStyle=lg; g.lineWidth=9; g.beginPath(); g.moveTo(hx,hy); g.lineTo(tx,ty); g.stroke();
    g.drawImage(S.glow,hx-34,hy-34,68,68);
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

    // mushroom cloud
    fxAdd({ life:2.1, draw(g,a){ const k=a.t/a.life; if(k>=1){a.done=true;return;}
      const e=1-Math.pow(1-k,2), al=k<.15?k/.15:Math.max(0,1-(k-.15)/.85);
      const capY=P.y-14-e*120, capW=26+e*105, capH=14+e*40, stemW=24*(1-.35*k);
      g.save(); g.globalAlpha=al;
      const sg=g.createLinearGradient(0,capY,0,P.y); sg.addColorStop(0,'rgba(110,60,30,.95)'); sg.addColorStop(.5,'rgba(255,120,20,.9)'); sg.addColorStop(1,'rgba(255,230,140,.95)');
      g.fillStyle=sg; g.beginPath(); g.moveTo(P.x-stemW*.5,P.y+6); g.lineTo(P.x-stemW*.28,capY); g.lineTo(P.x+stemW*.28,capY); g.lineTo(P.x+stemW*.5,P.y+6); g.closePath(); g.fill();
      const cg=g.createRadialGradient(P.x,capY,2,P.x,capY,capW);
      cg.addColorStop(0,'rgba(255,230,140,1)'); cg.addColorStop(.45,'rgba(255,110,20,.95)'); cg.addColorStop(1,'rgba(70,30,20,.9)');
      g.fillStyle=cg; g.beginPath(); g.ellipse(P.x,capY,capW,capH,0,0,Math.PI*2); g.fill();
      g.beginPath(); g.ellipse(P.x-capW*.55,capY+capH*.55,capW*.42,capH*.6,0,0,Math.PI*2); g.fill();
      g.beginPath(); g.ellipse(P.x+capW*.55,capY+capH*.55,capW*.42,capH*.6,0,0,Math.PI*2); g.fill();
      g.restore(); } });

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
    grav:o.grav||0,drag:o.drag??.1,home:o.home,bill:!!o.bill,star:!!o.star,heart:!!o.heart,tc:o.trail||(o.bill?'255,90,220':o.heart?'255,90,200':'255,210,63'),
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
      if(a.heart){ g.save(); g.translate(a.x,a.y); g.rotate(Math.sin(a.rot)*.35); const hs=a.r*2.6; g.drawImage(S.heart,-hs/2,-hs/2,hs,hs); g.restore(); }
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
function fxConfettiCannons(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, N=Math.min(60,16+Math.round(delta/4)), tr=fxTracker(key,from,to,N,T);
  const cols=['#ffd23f','#ff3b3b','#4dff7a','#22d3ee','#b34dff','#ff3bd4','#ffffff','#ff9f1a'];
  const cannons=[{x:10,y:H-20,dir:-1},{x:W-10,y:H-20,dir:1}];
  for(const c of cannons){
    fxRing(c.x,c.y,{color:'255,255,255',max:110,life:.4,width:8});
    fxRing(c.x,c.y,{color:'255,210,63',max:160,life:.55,width:8,delay:.04});
  }
  fxFlash('#ffffff',.18,.3);
  const P=Math.min(190,80+Math.round(delta*1.2));
  for(let i=0;i<P;i++){
    const c=cannons[i%2];
    const a0=-Math.PI/2-c.dir*(.12+Math.random()*.75), sp=520+Math.random()*620;
    const col=cols[(Math.random()*cols.length)|0], w=6+Math.random()*7, h=3+Math.random()*4;
    fxAdd({ x:c.x,y:c.y,vx:Math.cos(a0)*sp,vy:Math.sin(a0)*sp,rot:Math.random()*6,vr:(Math.random()-.5)*18,life:2.1+Math.random()*1.3,w,h,col,ph:Math.random()*6,
      step(dt,a){ if(a.t<0) return; const d=Math.pow(.12,dt); a.vx*=d; a.vy*=d; a.vy+=170*dt; a.x+=a.vx*dt+Math.sin(a.t*7+a.ph)*.8; a.y+=a.vy*dt; a.rot+=a.vr*dt; if(a.t>a.life||a.y>H+20) a.done=true; },
      draw(g,a){ g.save(); g.globalAlpha=Math.min(1,(a.life-a.t)/.5); g.translate(a.x,a.y); g.rotate(a.rot); g.scale(1,Math.abs(Math.cos(a.t*9+a.ph))*.85+.15); g.fillStyle=a.col; g.fillRect(-a.w/2,-a.h/2,a.w,a.h); g.restore(); } },i*.004);
  }
  for(let i=0;i<N;i++){
    const c=cannons[i%2], a0=-Math.PI/2-c.dir*(.2+Math.random()*.6), sp=500+Math.random()*420;
    fxHomer({T,tr,x:c.x,y:c.y,vx:Math.cos(a0)*sp,vy:Math.sin(a0)*sp,grav:600,drag:.08,home:.8+i*(.7/N)+Math.random()*.1,r:7+Math.random()*4},i*.012);
  }
  setTimeout(()=>tr.cnt.end(),4600);
  return true;
}

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
function fxMoneyGun(key,from,to){
  const T=fxTarget(key); if(!T) return false;
  const S=fxSprites(), W=FX.W||$('stack').offsetWidth, H=FX.H||$('stack').offsetHeight;
  const delta=to-from, N=Math.max(50,Math.min(240,Math.round(40+delta/5)));
  const DUR=Math.min(2.8,1.3+delta/700), IN=.4, FIRE0=IN, FIRE1=IN+DUR, OUT=.4, END=FIRE1+OUT;
  const tr=fxTracker(key,from,to,N,T);
  const side=T.x<W/2?1:-1;                       // gun sits on the opposite side of the target
  const gx=side>0?W*.86:W*.14, gy=Math.min(H-70,Math.max(T.y+90,H*.62));
  const dx0=T.x-gx, dy0=T.y-gy, ang=Math.atan2(dy0,dx0), dirx=Math.cos(ang), diry=Math.sin(ang);
  const SC=.78, LEN=106*SC, off=210;
  fxFlash('#ff4fd8',.22,.45);
  fxRing(gx,gy,{color:'255,120,230',max:150,life:.5,width:8});
  fxRing(gx,gy,{color:'180,100,255',max:210,life:.6,width:8,delay:.08});
  let fired=0, last=-1;
  // green money tint behind everything
  fxAdd({ draw(g,a){ const t=a.t; if(t>END+.6){a.done=true;return;} const e=Math.min(1,t/.3,(END+.6-t)/.6)*.5;
    g.save(); g.globalCompositeOperation='lighter'; const gr=g.createRadialGradient(gx,gy,10,gx,gy,W*.9); gr.addColorStop(0,`rgba(255,80,220,${e*.5})`); gr.addColorStop(.5,`rgba(150,70,255,${e*.22})`); gr.addColorStop(1,'rgba(80,20,160,0)'); g.fillStyle=gr; g.fillRect(0,0,W,H); g.restore(); } });
  // decorative pink bill rain from the top
  for(let i=0;i<Math.min(46,16+Math.round(delta/25));i++){
    const x0=Math.random()*W, vy=180+Math.random()*220, sw=Math.random()*6, sc=.5+Math.random()*.5, d=.3+Math.random()*(DUR+.6);
    fxAdd({ x:x0,y:-20,rot:Math.random()*6,life:3,
      step(dt,a){ if(a.t<0) return; a.y+=vy*dt; a.x+=Math.sin(a.t*3+sw)*40*dt; a.rot+=dt*4; if(a.y>H+30) a.done=true; },
      draw(g,a){ if(a.t<0) return; g.save(); g.globalAlpha=.8; g.translate(a.x,a.y); g.rotate(Math.sin(a.rot)*.6); g.scale(sc,sc*(Math.abs(Math.cos(a.rot*1.4))*.8+.2)); g.drawImage(S.bill,-30,-15); g.restore(); } },d);
  }
  // the gun (also the firing orchestrator)
  fxAdd({
    step(dt,a){
      const t=a.t; if(t<0) return;
      while(fired<N && t>=FIRE0+fired*(DUR/N)){
        const mx=gx+dirx*LEN*1.05, my=gy+diry*LEN*1.05, sp0=760+Math.random()*520, spr=(Math.random()-.5)*.55, aa=ang+spr;
        fxHomer({T,tr,bill:true,x:mx,y:my,vx:Math.cos(aa)*sp0,vy:Math.sin(aa)*sp0-80,grav:380,drag:.2,home:.38+Math.random()*.34,r:10+Math.random()*3});
        fxAdd({ life:.1, draw(g,b){ const k=b.t/b.life; if(k>=1){b.done=true;return;} g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=1-k; const s=46*(1-k*.4); g.drawImage(S.pglow,mx-s,my-s,s*2,s*2); g.drawImage(S.star,mx-s/2,my-s/2,s,s); g.restore(); } });
        for(let q=0;q<2;q++){ const ga=aa+(Math.random()-.5)*.9, gs=200+Math.random()*260, gc=Math.random()<.5?'255,130,230':'190,120,255';
          fxAdd({ x:mx,y:my,vx:Math.cos(ga)*gs,vy:Math.sin(ga)*gs,life:.5+Math.random()*.3,gc,step(dt,b){ b.vy+=300*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; if(b.t>b.life) b.done=true; },draw(g,b){ g.save(); g.globalCompositeOperation='lighter'; g.globalAlpha=Math.max(0,1-b.t/b.life); g.fillStyle=`rgb(${b.gc})`; g.fillRect(b.x,b.y,3,3); g.restore(); } });
        }
        fired++; last=t;
      }
      if(t>END) a.done=true;
    },
    draw(g,a){
      const t=a.t; if(t<0) return;
      const inK=Math.min(1,t/IN), outK=t>FIRE1?Math.min(1,(t-FIRE1)/OUT):0;
      const ox=side*(off*(1-(1-Math.pow(1-inK,3))) + off*outK);
      const firing=t>=FIRE0&&t<=FIRE1, rec=firing?(6+4*Math.sin(t*95))*(1):0, shake=firing?Math.sin(t*120)*1.2:0;
      g.save(); g.translate(gx+ox-dirx*rec,gy-diry*rec+shake);
      if(dirx>=0){ g.rotate(ang); } else { g.scale(-1,1); g.rotate(Math.atan2(diry,-dirx)); }
      g.scale(SC,SC); g.translate(-50,-44);
      g.drawImage(S.gun,0,0); g.restore();
    }
  });
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

/* entry: returns true when a canvas effect handled the row (kind is chosen from the coins just added) */
function fxBig(key,from,to,tier){
  switch(kindOf(to-from)){
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
