/*!
 * secret-fx.js — efek animasi SECRET (neon rainbow)
 * Tanpa library. Taruh sebelum </body>:  <script src="secret-fx.js"></script>
 *
 * Pemakaian di halaman Open Robux Chest (saat hadiah Secret/1000 menang):
 *   SecretFX.play({ tile: strip.children[WIN], panel, vp });
 * Bersihkan sebelum spin berikutnya:
 *   SecretFX.clear({ tile: strip.children[WIN], panel });
 *
 * Fungsi lain:
 *   SecretFX.neon(el)            border neon pelangi berputar
 *   SecretFX.burst(container,n)  percikan warna pelangi
 *   SecretFX.rings(container)    gelombang cincin pelangi
 *   SecretFX.flash(container)    kilatan layar singkat
 *   SecretFX.shake(el)           getar
 *   SecretFX.text(el)            teks pelangi bergerak
 */
(function (global) {
  'use strict';

  var COLORS = ['#ff0040', '#ff9a00', '#ffe600', '#2bff5a', '#00d4ff', '#6a5cff', '#ff00d4'];
  var reduced = function () {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion:reduce)').matches;
  };

  // ---------- CSS ----------
  function css() {
    if (document.getElementById('secretfx-css')) return;
    var conic = 'conic-gradient(from var(--fxa),' + COLORS.concat(COLORS[0]).join(',') + ')';
    var lin = 'linear-gradient(90deg,' + COLORS.concat(COLORS[0]).join(',') + ')';
    var glow = function (px) {
      return COLORS.map(function (c, i) {
        return Math.round((i / COLORS.length) * 100) + '%{box-shadow:0 0 ' + px + 'px ' + c + ',0 0 6px ' + c + '}';
      }).join('') + '100%{box-shadow:0 0 ' + px + 'px ' + COLORS[0] + ',0 0 6px ' + COLORS[0] + '}';
    };
    var s = document.createElement('style');
    s.id = 'secretfx-css';
    s.textContent =
      '@property --fxa{syntax:"<angle>";initial-value:0deg;inherits:false}' +
      '@keyframes fx-spin{to{--fxa:360deg}}' +
      '@keyframes fx-glow{' + glow(22) + '}' +
      '@keyframes fx-glow-big{' + glow(54) + '}' +
      '@keyframes fx-slide{to{background-position:300% 0}}' +
      '@keyframes fx-ring{from{transform:translate(-50%,-50%) scale(.2);opacity:.9}to{transform:translate(-50%,-50%) scale(3.2);opacity:0}}' +
      '@keyframes fx-flash{0%{opacity:.85}100%{opacity:0}}' +
      '.fx-neon{border:3px solid transparent!important;' +
      'background:linear-gradient(180deg,#1b2140,#10142a) padding-box,' + conic + ' border-box!important;' +
      'animation:fx-spin 3s linear infinite,fx-glow 3s linear infinite!important}' +
      '.fx-neon.fx-big{animation:fx-spin 2s linear infinite,fx-glow-big 2.4s linear infinite!important}' +
      '.fx-text{background:' + lin + ' 0 0/300% 100%;-webkit-background-clip:text;background-clip:text;' +
      'color:transparent!important;animation:fx-slide 2s linear infinite}' +
      '.fx-ring{position:absolute;left:50%;top:50%;width:160px;height:160px;border-radius:50%;pointer-events:none;z-index:4;' +
      'border:4px solid transparent;background:linear-gradient(transparent,transparent) padding-box,' + conic + ' border-box;' +
      'animation:fx-spin 1.2s linear infinite,fx-ring 1.2s ease-out forwards}' +
      '.fx-flash{position:absolute;inset:0;background:#fff;pointer-events:none;z-index:6;animation:fx-flash .6s ease-out forwards}' +
      '.fx-spark{position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:2px;pointer-events:none;z-index:5}' +
      '@media (prefers-reduced-motion:reduce){.fx-neon,.fx-neon.fx-big,.fx-text{animation:none!important}.fx-ring,.fx-flash{display:none}}';
    document.head.appendChild(s);
  }

  // ---------- efek ----------
  function neon(el, big) {
    css();
    if (!el) return;
    el.classList.add('fx-neon');
    if (big) el.classList.add('fx-big');
  }

  function text(el) {
    css();
    if (el) el.classList.add('fx-text');
  }

  function burst(container, n) {
    css();
    if (!container || reduced()) return;
    n = n || 60;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i');
      p.className = 'fx-spark';
      p.style.background = 'hsl(' + Math.random() * 360 + ' 100% 60%)';
      p.style.boxShadow = '0 0 8px currentColor';
      container.appendChild(p);
      var a = Math.random() * Math.PI * 2,
        d = 80 + Math.random() * 190;
      p.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          {
            transform:
              'translate(' + Math.cos(a) * d + 'px,' + (Math.sin(a) * d + 40) + 'px) rotate(' +
              Math.random() * 540 + 'deg) scale(.2)',
            opacity: 0
          }
        ],
        { duration: 900 + Math.random() * 600, easing: 'cubic-bezier(.2,.8,.3,1)' }
      ).onfinish = (function (el) {
        return function () { el.remove(); };
      })(p);
    }
  }

  function rings(container) {
    css();
    if (!container || reduced()) return;
    [0, 220, 440].forEach(function (t) {
      setTimeout(function () {
        var r = document.createElement('div');
        r.className = 'fx-ring';
        container.appendChild(r);
        setTimeout(function () { r.remove(); }, 1300);
      }, t);
    });
  }

  function flash(container) {
    css();
    if (!container || reduced()) return;
    var f = document.createElement('div');
    f.className = 'fx-flash';
    container.appendChild(f);
    setTimeout(function () { f.remove(); }, 650);
  }

  function shake(el) {
    if (!el || reduced()) return;
    el.animate(
      [
        { transform: 'translate(0)' },
        { transform: 'translate(-7px,3px)' },
        { transform: 'translate(7px,-3px)' },
        { transform: 'translate(-5px,-2px)' },
        { transform: 'translate(4px,2px)' },
        { transform: 'translate(0)' }
      ],
      { duration: 450 }
    );
  }

  // ---------- paket lengkap ----------
  // opts: { tile, panel, vp }
  function play(opts) {
    opts = opts || {};
    css();
    neon(opts.tile, true);
    if (opts.vp) {
      flash(opts.vp);
      rings(opts.vp);
      burst(opts.vp, 70);
      setTimeout(function () { burst(opts.vp, 50); }, 300);
      setTimeout(function () { burst(opts.vp, 50); }, 700);
    }
    if (opts.panel) {
      shake(opts.panel);
      opts.panel.style.transition = 'box-shadow .3s';
      opts.panel.style.animation = 'fx-glow-big 2.4s linear infinite';
    }
  }

  function clear(opts) {
    opts = opts || {};
    if (opts.tile) opts.tile.classList.remove('fx-neon', 'fx-big');
    if (opts.panel) opts.panel.style.animation = '';
  }

  global.SecretFX = {
    colors: COLORS,
    neon: neon, text: text, burst: burst, rings: rings,
    flash: flash, shake: shake, play: play, clear: clear
  };
})(window);
