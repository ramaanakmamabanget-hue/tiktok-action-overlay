(() => {
  const $ = (s) => document.querySelector(s);
  const q = new URLSearchParams(location.search);
  const bg = (q.get('bg') || '00ff00').replace('#', '');
  document.documentElement.style.background = document.body.style.background = bg === 'transparent' ? 'transparent' : '#' + bg;
  const spinToken = location.pathname.split('/').filter(Boolean)[1] || '';
  const socket = io({ auth: { spinToken } });

  const stage = $('#stage'), who = $('#who'), cd = $('#cd'), panel = $('#panel'), vp = $('#vp'), strip = $('#strip');
  const chipsBox = $('#chips'), secEl = $('#secret'), secSp = $('#sp');
  const RM = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
  const R = { 10: { c: '#66728f', n: 'Common' }, 25: { c: '#4b9bff', n: 'Rare' }, 50: { c: '#a56bff', n: 'Epic' }, 100: { c: '#ff4f9a', n: 'Legendary' }, 500: { c: '#ffc233', n: 'Mythic' }, 1000: { c: '#ff4fd8', n: 'Secret' } };
  const V = [10, 25, 50, 100, 500];
  const TW = 180, STEP = 210, N = 70, WIN = 58;
  const ICO = '<svg class="ico" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M12 1.2l9.4 5.4v10.8L12 22.8l-9.4-5.4V6.6z"/><path fill="currentColor" fill-rule="evenodd" d="M12 4.6l6.5 3.7v7.4L12 19.4l-6.5-3.7V8.3zM9.2 9.2h5.6v5.6H9.2z"/></svg>';
  const avatarFallback = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#202938"/><text x="150" y="190" text-anchor="middle" font-size="150" fill="#fff">?</text></svg>');

  // ---- fit stage to window (OBS browser source of any size)
  function fit() {
    const h = 960; // fixed design height so the layout never jumps
    const k = Math.min(innerWidth / 1200, innerHeight / h);
    stage.style.transform = `translateX(-50%) scale(${k})`;
  }
  addEventListener('resize', fit);

  // ---- sound
  let AC, snd = true;
  const tone = (f, d, t = 'triangle', v = .05) => { if (!snd) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(); o.type = t; o.frequency.value = f; g.gain.setValueAtTime(v, AC.currentTime); g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + d); o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + d); } catch (e) {} };

  // ---- run control (abort when round is reset)
  let runId = 0, playedSeq = null, running = false;
  const sleep = (ms, id) => new Promise((res, rej) => setTimeout(() => (id === runId ? res() : rej(new Error('abort'))), ms));

  function burst(c, p = vp, n = 30) {
    if (RM()) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i'); s.className = 'spark';
      s.style.background = c === 'rb' ? `hsl(${Math.random() * 360} 100% 60%)` : c; p.appendChild(s);
      const a = Math.random() * 6.28, d = 60 + Math.random() * 150;
      s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) rotate(${Math.random() * 360}deg) scale(.3)`, opacity: 0 }], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => s.remove();
    }
  }

  function clearAll() {
    runId++; running = false;
    stage.classList.add('hidden');
    cd.classList.add('hidden'); panel.classList.add('hidden'); who.classList.remove('hidden');
    panel.classList.remove('glow', 'rbw'); panel.style.animation = ''; panel.style.opacity = ''; stage.style.opacity = ''; stage.style.transition = '';
    chipsBox.innerHTML = ''; strip.innerHTML = ''; secEl.style.opacity = 0; vp.classList.remove('off');
    window.SecretFX && SecretFX.clear({ panel });
  }

  async function play(winner, spin, opts) {
    if (running) clearAll();
    const id = ++runId; running = true; snd = opts.sound !== false;
    try {
      const W = spin.weights.slice(); let secretP = 0;
      const pick = () => { if (secretP && Math.random() * 100 < secretP) return 1000; let s = 0; for (let i = 0; i < 5; i++) s += W[i]; let r = Math.random() * s; for (let i = 0; i < 5; i++) { r -= W[i]; if (r < 0) return V[i]; } return 10; };
      const win = spin.win;

      // 1. winner header, prize still "?"
      $('#wAv').src = winner.avatar || avatarFallback;
      $('#wAv').onerror = () => { $('#wAv').src = avatarFallback; };
      $('#wName').textContent = winner.nickname || 'Winner';
      const wp = $('#wPrize'); wp.textContent = 'PRIZE: ???'; wp.classList.remove('got');
      stage.style.opacity = 1; stage.classList.remove('hidden'); cd.classList.add('hidden'); panel.classList.add('hidden');
      fit(); who.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 600, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      [520, 660, 780, 1040].forEach((f, i) => setTimeout(() => tone(f, .25, 'triangle', .07), i * 110));
      await sleep(1800, id);

      // 2. countdown 5..1
      cd.classList.remove('hidden');
      for (let n = 5; n >= 1; n--) {
        cd.textContent = n; cd.classList.remove('tick'); void cd.offsetWidth; cd.classList.add('tick');
        tone(n === 1 ? 880 : 520, .18, 'square', .05); fit();
        await sleep(1000, id);
      }
      cd.classList.add('hidden');

      // 3. build chips (percentages)
      chipsBox.innerHTML = V.map((v, i) => `<span class="${v == 500 ? 'g' : ''} q" style="--c:${R[v].c}">${v} RBX (<em style="font-style:normal" class="pc">?</em>%)</span>`).join('');
      const secChip = document.createElement('span'); secChip.className = 'dk rbc'; secChip.style.cssText = '--c:#ff4fd8;display:none';
      secChip.innerHTML = 'SECRET (<em style="font-style:normal" class="pc rb" id="secPc">0</em>%)'; chipsBox.appendChild(secChip);
      const chipEls = [...chipsBox.children].slice(0, 5), pcs = [...chipsBox.querySelectorAll('.pc')].slice(0, 5), secPc = secChip.querySelector('#secPc');
      strip.innerHTML = ''; vp.classList.add('off'); secEl.style.opacity = 0;
      panel.classList.remove('hidden'); fit();
      await sleep(500, id);

      for (let i = 0; i < 5; i++) {
        chipEls[i].classList.remove('q'); chipEls[i].classList.add('on');
        const t0 = performance.now(); let dl = 40;
        while (performance.now() - t0 < 1000) { pcs[i].textContent = Math.floor(Math.random() * 60) + 1; tone(300 + Math.random() * 200, .03, 'square', .02); await sleep(dl, id); dl = Math.min(110, dl + 4); }
        pcs[i].textContent = spin.weights[i]; W[i] = spin.weights[i]; tone(700 + i * 120, .18, 'triangle', .07);
        pcs[i].classList.toggle('rb', spin.weights[i] > 30); chipEls[i].classList.toggle('dk', spin.weights[i] > 30); chipEls[i].classList.add('lock'); burst(R[V[i]].c, chipEls[i], 14);
        await sleep(450, id); chipEls[i].classList.remove('on', 'lock'); chipEls[i].classList.add('done');
      }
      if (!spin.secretPct) {
        await sleep(600, id);
      } else {
        await sleep(500, id);
        const pr = panel.getBoundingClientRect(), cx = pr.left + pr.width / 2, cy = pr.top + pr.height / 2;
        tone(200, .5, 'sawtooth', .06);
        if (!RM()) await Promise.all(chipEls.map((c) => { const r = c.getBoundingClientRect(); return c.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${cx - (r.left + r.width / 2)}px,${cy - (r.top + r.height / 2)}px) scale(.25)`, opacity: 0 }], { duration: 800, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' }).finished; }));
        chipEls.forEach((c) => { c.style.display = 'none'; c.getAnimations().forEach((a) => a.cancel()); });
        secSp.textContent = '0%'; secEl.style.opacity = 1;
        secEl.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1 }, { transform: 'scale(1)', opacity: 1 }], { duration: 600, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'forwards' });
        const t1 = performance.now(); let dl = 40;
        while (performance.now() - t1 < 2000) { secSp.textContent = (5 + Math.floor(Math.random() * 60)) + '%'; tone(300 + Math.random() * 300, .03, 'square', .02); await sleep(dl, id); dl = Math.min(120, dl + 3); }
        secSp.textContent = spin.secretPct + '%'; tone(900, .3, 'triangle', .08); setTimeout(() => tone(1200, .4, 'triangle', .08), 150);
        burst('rb', panel, 60); burst('rb', panel, 60);
        await sleep(1500, id);
        await secEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).finished;
        secEl.getAnimations().forEach((a) => a.cancel()); secEl.style.opacity = 0;
        secPc.textContent = spin.secretPct; secChip.style.display = ''; secretP = spin.secretPct;
        secChip.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.25)', opacity: 1 }, { transform: 'scale(1)', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.3,1.6,.5,1)' });
        await sleep(600, id);
      }

      // 4. spin the strip
      const first = pick();
      const items = Array.from({ length: N }, pick); items[4] = first; items[WIN] = win;
      strip.innerHTML = items.map((v) => `<div class="tile${v == 1000 ? ' sec' : ''}" style="--c:${R[v].c}">${ICO}<b>${v}</b><span>${R[v].n}</span></div>`).join('');
      const half = () => vp.clientWidth / 2, x0 = half() - (4 * STEP + TW / 2);
      strip.style.transform = `translateX(${x0}px)`;
      panel.style.setProperty('--lc', '#ffc233');
      vp.classList.remove('off'); await sleep(1000, id);
      const off = (Math.random() * .8 - .4) * TW, b = half() - (WIN * STEP + TW / 2 + off), dur = 15000, t0 = performance.now();
      let li = 4, nb = 0;
      await new Promise((done, fail) => {
        const f = (now) => {
          if (id !== runId) return fail(new Error('abort'));
          const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 4), x = x0 + (b - x0) * e;
          strip.style.transform = `translateX(${x}px)`;
          if (t > .5 && now > nb) { nb = now + 950 - 520 * Math.min(1, (t - .5) / .5); tone(110, .2, 'sine', .3); setTimeout(() => tone(90, .22, 'sine', .25), 150); if (!RM()) { $('#line').animate([{ transform: 'scaleX(4)' }, { transform: 'scaleX(1)' }], { duration: 320 }); panel.animate([{ transform: 'scale(1.012)' }, { transform: 'scale(1)' }], { duration: 320 }); } }
          const i = Math.floor((half() - x) / STEP);
          if (i != li) { li = i; const el = strip.children[i]; if (el && !RM()) el.animate([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 180 }); tone(420 + Math.random() * 60, .04, 'square', .025); }
          t < 1 ? requestAnimationFrame(f) : done();
        };
        requestAnimationFrame(f);
      });
      await sleep(400, id);

      // 5. result
      const c = R[win].c, ts = strip.children;
      [...ts].forEach((el, i) => el.classList.add(i == WIN ? 'win' : 'dim'));
      panel.style.setProperty('--lc', c); panel.classList.add('glow'); if (win == 1000) panel.classList.add('rbw');
      wp.textContent = win == 1000 ? '+1000 RBX SECRET' : `+${win} RBX`; wp.classList.add('got'); wp.style.borderColor = c;
      const k = win == 1000 ? 4 : V.indexOf(win);
      [520, 660, 780, 1040, 1320].slice(0, k + 2).forEach((f, i) => setTimeout(() => tone(f, .25, 'triangle', .07), i * 110));
      if (win == 1000) { window.SecretFX && SecretFX.play({ tile: ts[WIN], panel, vp }); burst('rb'); setTimeout(() => burst('rb'), 250); setTimeout(() => burst('rb'), 600); }
      else if (win >= 50) burst(c);
      if (win >= 100 && win < 1000) setTimeout(() => burst('#ffc233'), 250);
      if (win >= 500 && win < 1000) { setTimeout(() => burst('#fff', vp, 50), 500); if (!RM()) panel.animate([{ transform: 'translate(0)' }, { transform: 'translate(-6px,3px)' }, { transform: 'translate(6px,-3px)' }, { transform: 'translate(-4px,-2px)' }, { transform: 'translate(0)' }], { duration: 400 }); }

      // 6. hold, then vanish -> green only
      await sleep((opts.holdSeconds || 8) * 1000, id);
      stage.style.transition = 'opacity .8s'; stage.style.opacity = 0;
      await sleep(900, id);
      clearAll();
    } catch (e) {
      if (e && e.message !== 'abort') { console.error(e); clearAll(); }
    }
  }

  socket.on('auction:state', (s) => {
    snd = s.config?.soundEnabled !== false;
    const hasSpin = s.phase === 'finished' && s.winner && s.spin;
    if (hasSpin) {
      if (playedSeq !== s.spin.seq) {
        playedSeq = s.spin.seq;
        play(s.winner, s.spin, { sound: snd, holdSeconds: s.config?.spinHoldSeconds });
      }
    } else {
      // no winner / new round / reset: only the green background
      if (running || !stage.classList.contains('hidden')) { if (!window.__testing) clearAll(); }
      playedSeq = null;
    }
  });
  socket.on('spin:test', (t) => { window.__testing = true; playedSeq = null; clearAll(); play(t.winner, t.spin, { sound: t.soundEnabled, holdSeconds: t.holdSeconds }).finally(() => { window.__testing = false; }); });
})();
