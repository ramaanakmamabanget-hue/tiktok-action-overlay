/* ============================================================
   fx.js — heavy gift effects drawn on a canvas inside #stack
     100+  : BURST  — coins explode outward, then get sucked into the row
     500+  : GALAXY — nebula + spiral galaxy that collapses into the row
     1000+ : NUKE   — missile hits the row: flash, shockwaves, mushroom cloud
   Uses globals from overlay.js: $, play, counters, collectToken, rowIcon, rowNum, pulseIcon
   ============================================================ */
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
  return (FX.sprites={coin,star,glow});
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
  const C={x:W/2,y:H*.5}, LIFE=3.4, N=170;
  let arrived=0;
  const stars=Array.from({length:130},()=>({x:Math.random()*W,y:Math.random()*H,s:1+Math.random()*2.2,p:Math.random()*6.28}));
  const env=t=>Math.max(0,Math.min(1,t/.5,(LIFE-t)/.8));
  fxFlash('#b48cff',.35,.5);
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

    // debris coins
    for(let i=0;i<95;i++){
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

/* entry: returns true when a canvas effect handled the row */
function fxBig(key,from,to,tier){
  if(tier>=5) return fxNuke(key,from,to);
  if(tier===4) return fxGalaxy(key,from,to);
  return fxBurst(key,from,to);
}
