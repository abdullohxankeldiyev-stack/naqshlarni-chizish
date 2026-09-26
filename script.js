/* =========================================================
   GIRIH — script.js
   Olti xil naqsh oilasi, hammasi canvas'da real vaqtda chiziladi.
   ========================================================= */

(function () {
  "use strict";

  const $  = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const root = document.documentElement;
  const kamHarakat = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TAU = Math.PI * 2;
  let joriyTur = "rozetta";
  let tanlanganRang = null;

  /* ===============================================
     1. UMUMIY GEOMETRIYA YORDAMCHILARI
     =============================================== */

  // {n/k} yulduz ko‘pburchagining ichki radius nisbati
  function ichkiNisbat(n) {
    const k = Math.max(2, Math.round(n / 2.7));
    return Math.cos((k * Math.PI) / n) / Math.cos(((k - 1) * Math.PI) / n);
  }

  // Har bir shakl ikki marta chiziladi: avval fon rangi bilan qalinroq,
  // keyin asosiy rang bilan ingichka — chiziqlar to‘qilgandek ko‘rinadi.
  function ikkiQatlam(ctx, o, lw) {
    ctx.lineWidth = lw + 2.6;
    ctx.strokeStyle = o.bg;
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.strokeStyle = o.line;
    ctx.stroke();
  }

  function kopburchakYuli(ctx, cx, cy, n, R, rot) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i * TAU) / n;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  function yulduzYuli(ctx, cx, cy, n, R, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = rot + (i * Math.PI) / n;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  // Xoch (plyus) shakli — 12 burchak
  function xochYuli(ctx, cx, cy, a, b, rot) {
    const p = [[b,a],[-b,a],[-b,b],[-a,b],[-a,-b],[-b,-b],[-b,-a],[b,-a],[b,-b],[a,-b],[a,b],[b,b]];
    const c = Math.cos(rot), s = Math.sin(rot);
    ctx.beginPath();
    for (let i = 0; i < p.length; i++) {
      const X = cx + p[i][0] * c - p[i][1] * s;
      const Y = cy + p[i][0] * s + p[i][1] * c;
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.closePath();
  }

  // Aniqlangan tasodif — kufiy naqshi uchun
  function xash(a, b, s) {
    let n = (a * 374761393 + b * 668265263 + s * 2246822519) | 0;
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  // Fonni to‘ldirib, panjarani markazlaydi va buradi
  function maydon(ctx, w, h, o, cw, ch) {
    ctx.save();
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const c = Math.abs(Math.cos(o.rot)), s = Math.abs(Math.sin(o.rot));
    const rw = w * c + h * s;
    const rh = w * s + h * c;
    const cols = Math.ceil(rw / cw) + 2;
    const rows = Math.ceil(rh / ch) + 2;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(o.rot);
    ctx.translate(-(cols * cw) / 2, -(rows * ch) / 2);
    return { cols: cols, rows: rows };
  }

  // Kvadrat panjara + romb diagonallari
  function torKvadrat(ctx, o, m, cell) {
    if (!o.showGrid) return;
    ctx.strokeStyle = o.grid;
    ctx.lineWidth = Math.max(0.5, o.lw * 0.5);
    ctx.beginPath();
    for (let i = 0; i <= m.cols; i++) { ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, m.rows * cell); }
    for (let j = 0; j <= m.rows; j++) { ctx.moveTo(0, j * cell); ctx.lineTo(m.cols * cell, j * cell); }
    ctx.stroke();
    ctx.beginPath();
    for (let j = 0; j < m.rows; j++) {
      for (let i = 0; i < m.cols; i++) {
        const x = i * cell, y = j * cell, q = cell / 2;
        ctx.moveTo(x, y + q); ctx.lineTo(x + q, y);
        ctx.lineTo(x + cell, y + q); ctx.lineTo(x + q, y + cell);
        ctx.closePath();
      }
    }
    ctx.stroke();
  }

  // Uchburchakli (olti burchakli) panjara
  function torUchburchak(ctx, o, m, cw, ch) {
    if (!o.showGrid) return;
    ctx.strokeStyle = o.grid;
    ctx.lineWidth = Math.max(0.5, o.lw * 0.5);
    ctx.beginPath();
    for (let j = 0; j <= m.rows; j++) {
      for (let i = 0; i <= m.cols; i++) {
        const cx = i * cw + (j % 2 ? cw / 2 : 0), cy = j * ch;
        ctx.moveTo(cx, cy); ctx.lineTo(cx + cw, cy);
        ctx.moveTo(cx, cy); ctx.lineTo(cx - cw / 2, cy + ch);
        ctx.moveTo(cx, cy); ctx.lineTo(cx + cw / 2, cy + ch);
      }
    }
    ctx.stroke();
  }

  /* ===============================================
     2. NAQSH OILALARI
     =============================================== */

  /* --- 1. ROZETTA: kvadrat panjara ustidagi nurli yulduz --- */
  function rozetta(ctx, cx, cy, o, R, kichik) {
    if (R < 2) return;
    const n = o.fold;
    const r = R * ichkiNisbat(n);
    const rot = -Math.PI / 2;
    const lw = kichik ? o.lw * 0.8 : o.lw;

    if (!kichik) {
      kopburchakYuli(ctx, cx, cy, n, R * 1.04, rot + Math.PI / n);
      ikkiQatlam(ctx, o, lw * 0.8);
    }

    yulduzYuli(ctx, cx, cy, n, R, r, rot);
    ikkiQatlam(ctx, o, lw);

    if (!kichik) {
      kopburchakYuli(ctx, cx, cy, n, r * 0.62, rot + Math.PI / n);
      ikkiQatlam(ctx, o, lw * 0.8);

      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = rot + (i * TAU) / n;
        ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.lineTo(cx + Math.cos(a) * R * 1.28, cy + Math.sin(a) * R * 1.28);
      }
      ikkiQatlam(ctx, o, lw * 0.7);

      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.4, lw * 1.3), 0, TAU);
      ctx.fillStyle = o.line;
      ctx.fill();
    }
  }

  function chizRozetta(ctx, w, h, o) {
    const cell = o.cell;
    const m = maydon(ctx, w, h, o, cell, cell);
    torKvadrat(ctx, o, m, cell);
    const R = cell * 0.44 * o.scale;
    for (let j = 0; j <= m.rows; j++)
      for (let i = 0; i <= m.cols; i++) rozetta(ctx, i * cell, j * cell, o, R * 0.44, true);
    for (let j = 0; j < m.rows; j++)
      for (let i = 0; i < m.cols; i++) rozetta(ctx, i * cell + cell / 2, j * cell + cell / 2, o, R, false);
    ctx.restore();
  }

  /* --- 2. OLTI BURCHAK: asalari uyasi to‘ri --- */
  function chizOlti(ctx, w, h, o) {
    const cw = o.cell, ch = cw * 0.866;
    const m = maydon(ctx, w, h, o, cw, ch);
    torUchburchak(ctx, o, m, cw, ch);

    const s = cw / Math.sqrt(3);
    const R = s * o.scale;
    const n = o.fold;
    const rot = -Math.PI / 2;

    for (let j = 0; j <= m.rows; j++) {
      for (let i = 0; i <= m.cols; i++) {
        const cx = i * cw + (j % 2 ? cw / 2 : 0), cy = j * ch;
        if (R < 2) continue;
        kopburchakYuli(ctx, cx, cy, 6, R, rot);
        ikkiQatlam(ctx, o, o.lw * 0.9);
        yulduzYuli(ctx, cx, cy, n, R * 0.68, R * 0.68 * ichkiNisbat(n), rot);
        ikkiQatlam(ctx, o, o.lw);
        kopburchakYuli(ctx, cx, cy, 6, R * 0.2, rot);
        ikkiQatlam(ctx, o, o.lw * 0.7);
      }
    }
    ctx.restore();
  }

  /* --- 3. XATAM: yulduz va xoch --- */
  function chizXatam(ctx, w, h, o) {
    const cell = o.cell;
    const m = maydon(ctx, w, h, o, cell, cell);
    torKvadrat(ctx, o, m, cell);

    const R = cell * 0.5 * o.scale;
    const n2 = Math.max(3, Math.round(o.fold / 2));
    const rot = -Math.PI / 2;

    for (let j = 0; j < m.rows; j++) {
      for (let i = 0; i < m.cols; i++) {
        const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
        if (R < 2) continue;
        kopburchakYuli(ctx, cx, cy, n2, R, rot);
        ikkiQatlam(ctx, o, o.lw);
        kopburchakYuli(ctx, cx, cy, n2, R, rot + Math.PI / n2);
        ikkiQatlam(ctx, o, o.lw);
        kopburchakYuli(ctx, cx, cy, n2 * 2, R * 0.34, rot);
        ikkiQatlam(ctx, o, o.lw * 0.8);
      }
    }
    for (let j = 0; j <= m.rows; j++) {
      for (let i = 0; i <= m.cols; i++) {
        if (R < 2) continue;
        xochYuli(ctx, i * cell, j * cell, cell * 0.34 * o.scale, cell * 0.12 * o.scale, Math.PI / 4);
        ikkiQatlam(ctx, o, o.lw);
      }
    }
    ctx.restore();
  }

  /* --- 4. GUL: tegib turgan doiralar va gulbarglar --- */
  function chizGul(ctx, w, h, o) {
    const cw = o.cell, ch = cw * 0.866;
    const m = maydon(ctx, w, h, o, cw, ch);
    torUchburchak(ctx, o, m, cw, ch);

    const n = Math.max(5, o.fold);
    const R = cw * 0.5 * o.scale;
    const d = R / (1 + Math.sin(Math.PI / n));
    const p = d * Math.sin(Math.PI / n);

    for (let j = 0; j <= m.rows; j++) {
      for (let i = 0; i <= m.cols; i++) {
        const cx = i * cw + (j % 2 ? cw / 2 : 0), cy = j * ch;
        if (R < 3) continue;

        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, TAU);
        ikkiQatlam(ctx, o, o.lw);

        ctx.beginPath();
        for (let t = 0; t < n; t++) {
          const a = -Math.PI / 2 + (t * TAU) / n;
          const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
          ctx.moveTo(px + p, py);
          ctx.arc(px, py, p, 0, TAU);
        }
        ikkiQatlam(ctx, o, o.lw * 0.85);

        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1.5, p * 0.3), 0, TAU);
        ctx.fillStyle = o.line;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* --- 5. PANJARA: sakkiz burchak va kvadrat --- */
  function chizPanjara(ctx, w, h, o) {
    const cell = o.cell;
    const m = maydon(ctx, w, h, o, cell, cell);
    torKvadrat(ctx, o, m, cell);

    const s = cell / (1 + Math.SQRT2);
    const R = s * 1.30656 * o.scale;
    const n = o.fold;
    const rot = -Math.PI / 2;

    for (let j = 0; j < m.rows; j++) {
      for (let i = 0; i < m.cols; i++) {
        const cx = i * cell + cell / 2, cy = j * cell + cell / 2;
        if (R < 2) continue;
        kopburchakYuli(ctx, cx, cy, 8, R, Math.PI / 8);
        ikkiQatlam(ctx, o, o.lw);
        yulduzYuli(ctx, cx, cy, n, R * 0.74, R * 0.74 * ichkiNisbat(n), rot);
        ikkiQatlam(ctx, o, o.lw * 0.9);
        kopburchakYuli(ctx, cx, cy, 8, R * 0.2, Math.PI / 8);
        ikkiQatlam(ctx, o, o.lw * 0.7);
      }
    }
    for (let j = 0; j <= m.rows; j++) {
      for (let i = 0; i <= m.cols; i++) {
        if (R < 2) continue;
        kopburchakYuli(ctx, i * cell, j * cell, 4, s * 0.7071 * o.scale, 0);
        ikkiQatlam(ctx, o, o.lw);
      }
    }
    ctx.restore();
  }

  /* --- 6. KUFIY: to‘g‘ri burchakli, xat kabi qat’iy naqsh --- */
  function chizKufiy(ctx, w, h, o) {
    const cell = o.cell;
    const m = maydon(ctx, w, h, o, cell, cell);
    const k = Math.max(5, Math.min(10, o.fold));
    const u = cell / k;
    const urug = o.fold * 13 + Math.round(o.cell / 7);

    ctx.fillStyle = o.line;
    for (let j = 0; j < m.rows; j++) {
      for (let i = 0; i < m.cols; i++) {
        const x0 = i * cell, y0 = j * cell;
        for (let b = 1; b < k - 1; b++) {
          for (let a = 1; a < k - 1; a++) {
            const A = Math.min(a, k - 1 - a);
            const B = Math.min(b, k - 1 - b);
            if (A === B || xash(A, B, urug) > 0.52) {
              ctx.fillRect(x0 + a * u, y0 + b * u, u + 0.6, u + 0.6);
            }
          }
        }
      }
    }

    if (o.showGrid) {
      ctx.strokeStyle = o.grid;
      ctx.lineWidth = Math.max(0.6, o.lw * 0.7);
      ctx.beginPath();
      for (let i = 0; i <= m.cols; i++) { ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, m.rows * cell); }
      for (let j = 0; j <= m.rows; j++) { ctx.moveTo(0, j * cell); ctx.lineTo(m.cols * cell, j * cell); }
      ctx.stroke();
    }
    ctx.restore();
  }

  const TURLAR = {
    rozetta: chizRozetta,
    olti:    chizOlti,
    xatam:   chizXatam,
    gul:     chizGul,
    panjara: chizPanjara,
    kufiy:   chizKufiy
  };

  // Namuna oynachalari uchun mos katak o‘lchamlari
  const NAMUNA_KATAK = { rozetta: 96, olti: 100, xatam: 94, gul: 92, panjara: 100, kufiy: 88 };

  function naqshChiz(ctx, w, h, o) {
    (TURLAR[o.tur] || chizRozetta)(ctx, w, h, o);
  }

  /* ===============================================
     3. RANGLAR — mavzudan o‘qiladi
     =============================================== */

  const css = (nom) => getComputedStyle(root).getPropertyValue(nom).trim();

  function yorqinlik(hex) {
    const v = hex.replace("#", "");
    const n = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
    const r = parseInt(n.slice(0, 2), 16) / 255;
    const g = parseInt(n.slice(2, 4), 16) / 255;
    const b = parseInt(n.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function opts(qoshimcha) {
    const bg = css("--naqsh-bg");
    let line = tanlanganRang || css("--naqsh-line");
    if (Math.abs(yorqinlik(line) - yorqinlik(bg)) < 0.14) line = css("--ink");
    return Object.assign(
      {
        bg: bg,
        line: line,
        grid: css("--naqsh-grid"),
        tur: joriyTur,
        fold: 8,
        cell: 150,
        lw: 1.6,
        rot: 0,
        showGrid: true,
        scale: 1
      },
      qoshimcha
    );
  }

  /* ===============================================
     4. CANVAS o‘lchamini ekranga moslash
     =============================================== */

  function moslash(canvas, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  /* ===============================================
     5. HERO — sahifa ochilishidagi yagona animatsiya
     =============================================== */

  const heroCanvas = $("#heroCanvas");
  const hero = $("#hero");
  let heroW = 0, heroH = 0;

  function heroChiz(k) {
    if (!heroCanvas || !heroW) return;
    const ctx = heroCanvas.getContext("2d");
    naqshChiz(ctx, heroW, heroH, opts({
      tur: "rozetta",
      cell: heroW < 640 ? 118 : 168,
      lw: 1.3,
      scale: k,
      rot: 0.12
    }));
  }

  function heroMoslash() {
    if (!heroCanvas || !hero) return;
    heroW = hero.clientWidth;
    heroH = hero.clientHeight;
    moslash(heroCanvas, heroW, heroH);
    heroChiz(1);
  }

  function heroBoshla() {
    heroMoslash();
    if (kamHarakat) return;
    let t0 = null;
    const qadam = (ts) => {
      if (t0 === null) t0 = ts;
      const p = Math.min(1, (ts - t0) / 1500);
      heroChiz(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(qadam);
    };
    requestAnimationFrame(qadam);
  }

  if (heroCanvas && !kamHarakat && window.matchMedia("(pointer: fine)").matches) {
    heroCanvas.style.transform = "scale(1.06)";
    let band = false;
    hero.addEventListener("pointermove", (e) => {
      if (band) return;
      band = true;
      requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * -18;
        const y = (e.clientY / window.innerHeight - 0.5) * -18;
        heroCanvas.style.transform = "translate3d(" + x + "px," + y + "px,0) scale(1.06)";
        band = false;
      });
    });
  }

  /* ===============================================
     6. Kichik namuna canvas
     =============================================== */

  function miniChiz() {
    const c = $("#miniCanvas");
    if (!c) return;
    const size = 460;
    const ctx = moslash(c, size, size);
    naqshChiz(ctx, size, size, opts({ tur: "rozetta", cell: 230, lw: 1.8, fold: 8 }));
  }

  /* ===============================================
     7. NAQSH TURLARI galereyasi
     =============================================== */

  function galereyaChiz() {
    $$("#gallery button").forEach((b) => {
      const c = $("canvas", b);
      if (!c) return;
      const w = 360, h = 260;
      const ctx = moslash(c, w, h);
      const tur = b.dataset.tur;
      naqshChiz(ctx, w, h, opts({ tur: tur, cell: NAMUNA_KATAK[tur] || 92, lw: 1.2, fold: 8, rot: 0 }));
      b.classList.toggle("is-on", tur === joriyTur);
    });
  }

  function turQoy(tur, otish) {
    joriyTur = tur;
    $$("#chips button").forEach((b) => b.classList.toggle("is-on", b.dataset.tur === tur));
    $$("#gallery button").forEach((b) => b.classList.toggle("is-on", b.dataset.tur === tur));
    studioChiz();
    if (otish) {
      const u = $("#ustaxona");
      if (u) u.scrollIntoView({ behavior: kamHarakat ? "auto" : "smooth", block: "start" });
    }
  }

  $$("#gallery button").forEach((b) => {
    b.addEventListener("click", () => turQoy(b.dataset.tur, true));
  });
  $$("#chips button").forEach((b) => {
    b.addEventListener("click", () => turQoy(b.dataset.tur, false));
  });

  /* ===============================================
     8. BOSQICHLAR — 5 qadam
     =============================================== */

  const stepCanvas = $("#stepCanvas");
  let bosqich = 1;

  function bosqichChiz() {
    if (!stepCanvas) return;
    const S = 520;
    const ctx = moslash(stepCanvas, S, S);
    const o = opts({ tur: "rozetta", fold: Number($("#fold") ? $("#fold").value : 8), lw: 2.2 });
    const cx = S / 2, cy = S / 2, R = 190;
    const n = o.fold;
    const k = Math.max(2, Math.round(n / 2.7));
    const rot = -Math.PI / 2;

    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, S, S);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (bosqich === 5) {
      naqshChiz(ctx, S, S, Object.assign({}, o, { cell: 176, lw: 1.6 }));
      return;
    }

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.strokeStyle = bosqich === 1 ? o.line : o.grid;
    ctx.lineWidth = bosqich === 1 ? o.lw : o.lw * 0.6;
    ctx.stroke();

    if (bosqich >= 2) {
      ctx.strokeStyle = bosqich === 2 ? o.line : o.grid;
      ctx.lineWidth = bosqich === 2 ? o.lw * 0.7 : o.lw * 0.5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = rot + (i * TAU) / n;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      }
      ctx.stroke();

      ctx.fillStyle = o.line;
      for (let i = 0; i < n; i++) {
        const a = rot + (i * TAU) / n;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 5, 0, TAU);
        ctx.fill();
      }
    }

    if (bosqich >= 3) {
      kopburchakYuli(ctx, cx, cy, n, R, rot);
      ctx.strokeStyle = bosqich === 3 ? o.line : o.grid;
      ctx.lineWidth = bosqich === 3 ? o.lw : o.lw * 0.6;
      ctx.stroke();
    }

    if (bosqich >= 4) {
      const korilgan = new Array(n).fill(false);
      ctx.strokeStyle = o.line;
      ctx.lineWidth = o.lw;
      for (let s = 0; s < n; s++) {
        if (korilgan[s]) continue;
        ctx.beginPath();
        let i = s;
        do {
          korilgan[i] = true;
          const a = rot + (i * TAU) / n;
          const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
          i === s ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          i = (i + k) % n;
        } while (i !== s);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  function bosqichYangila() {
    $$("#stepList li").forEach((li) => {
      li.classList.toggle("is-on", Number(li.dataset.step) === bosqich);
    });
    bosqichChiz();
  }

  if ($("#nextStep")) {
    $("#nextStep").addEventListener("click", () => {
      bosqich = bosqich >= 5 ? 1 : bosqich + 1;
      bosqichYangila();
    });
  }
  if ($("#prevStep")) {
    $("#prevStep").addEventListener("click", () => {
      bosqich = bosqich <= 1 ? 5 : bosqich - 1;
      bosqichYangila();
    });
  }
  $$("#stepList li").forEach((li) => {
    li.addEventListener("click", () => {
      bosqich = Number(li.dataset.step);
      bosqichYangila();
    });
  });

  /* ===============================================
     9. USTAXONA
     =============================================== */

  const studioCanvas = $("#studioCanvas");

  function studioSozlama() {
    return opts({
      tur: joriyTur,
      fold: Number($("#fold").value),
      cell: Number($("#cell").value),
      lw: Number($("#lw").value),
      rot: (Number($("#rot").value) * Math.PI) / 180,
      showGrid: $("#grid").checked
    });
  }

  function studioChiz() {
    if (!studioCanvas) return;
    const box = studioCanvas.parentElement;
    const w = box.clientWidth;
    const h = Math.max(320, Math.round(w * 0.68));
    const ctx = moslash(studioCanvas, w, h);
    naqshChiz(ctx, w, h, studioSozlama());
  }

  function chiqishlarYangila() {
    $("#outFold").value = $("#fold").value;
    $("#outCell").value = $("#cell").value;
    $("#outLine").value = Number($("#lw").value).toFixed(1);
    $("#outRot").value = $("#rot").value + "\u00B0";
  }

  if ($("#panel")) {
    $$("#panel input").forEach((inp) => {
      inp.addEventListener("input", () => {
        chiqishlarYangila();
        studioChiz();
        if (inp.id === "fold") bosqichChiz();
      });
    });

    $("#randomBtn").addEventListener("click", () => {
      const r = (a, b) => a + Math.random() * (b - a);
      const kalitlar = Object.keys(TURLAR);
      joriyTur = kalitlar[Math.floor(Math.random() * kalitlar.length)];
      $$("#chips button").forEach((b) => b.classList.toggle("is-on", b.dataset.tur === joriyTur));
      $$("#gallery button").forEach((b) => b.classList.toggle("is-on", b.dataset.tur === joriyTur));

      $("#fold").value = Math.round(r(5, 14));
      $("#cell").value = Math.round(r(110, 260));
      $("#lw").value = r(1, 3).toFixed(1);
      $("#rot").value = Math.round(r(0, 90));
      $("#grid").checked = Math.random() > 0.35;

      const tugmalar = $$("#paints button");
      const t = tugmalar[Math.floor(Math.random() * tugmalar.length)];
      if (t) {
        $$("#paints button").forEach((x) => x.classList.remove("is-on"));
        t.classList.add("is-on");
        tanlanganRang = t.dataset.hex;
      }

      chiqishlarYangila();
      hammasiChiz();
    });

    $("#saveBtn").addEventListener("click", () => {
      const W = 2400, H = 1632;
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const octx = off.getContext("2d");
      const o = studioSozlama();
      const nisbat = W / Math.max(1, studioCanvas.clientWidth);
      naqshChiz(octx, W, H, Object.assign({}, o, { cell: o.cell * nisbat, lw: o.lw * nisbat }));

      const a = document.createElement("a");
      a.download = "girih-" + joriyTur + ".png";
      a.href = off.toDataURL("image/png");
      a.click();
      xabar("Naqsh saqlandi");
    });
  }

  /* ===============================================
     10. Bo‘yoqlar
     =============================================== */

  $$("#paints button").forEach((b) => {
    b.addEventListener("click", () => {
      $$("#paints button").forEach((x) => x.classList.remove("is-on"));
      b.classList.add("is-on");
      tanlanganRang = b.dataset.hex;
      hammasiChiz();
    });
  });

  /* ===============================================
     11. Mavzu: kecha / kunduz
     =============================================== */

  const themeBtn = $("#themeBtn");
  const themeLabel = $("#themeLabel");

  function mavzuQoy(nom) {
    root.setAttribute("data-theme", nom);
    if (themeLabel) themeLabel.textContent = nom === "kecha" ? "Kunduz" : "Kecha";
    if (themeBtn) themeBtn.setAttribute("aria-pressed", String(nom === "kunduz"));
    try { localStorage.setItem("girih-mavzu", nom); } catch (e) {}
    requestAnimationFrame(() => {
      heroChiz(1);
      hammasiChiz();
    });
  }

  let boshMavzu = "kecha";
  try {
    const saqlangan = localStorage.getItem("girih-mavzu");
    if (saqlangan === "kecha" || saqlangan === "kunduz") boshMavzu = saqlangan;
  } catch (e) {}

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      mavzuQoy(root.getAttribute("data-theme") === "kecha" ? "kunduz" : "kecha");
    });
  }

  /* ===============================================
     12. Navigatsiya, progress, toast
     =============================================== */

  const burger = $("#burger");
  const menu = $("#menu");

  if (burger && menu) {
    burger.addEventListener("click", () => {
      const ochiq = menu.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", String(ochiq));
      burger.setAttribute("aria-label", ochiq ? "Menyuni yopish" : "Menyuni ochish");
    });
    menu.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        menu.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  const topbar = $("#topbar");
  const bar = $("#progressBar");

  function aylantirish() {
    const balandlik = document.body.scrollHeight - window.innerHeight;
    const p = balandlik > 0 ? (window.scrollY / balandlik) * 100 : 0;
    if (bar) bar.style.width = p + "%";
    if (topbar) topbar.classList.toggle("is-stuck", window.scrollY > 10);
  }
  window.addEventListener("scroll", aylantirish, { passive: true });

  const bolimlar = $$("main section[id]");
  if ("IntersectionObserver" in window && bolimlar.length) {
    const kuzatuvchi = new IntersectionObserver(
      (yozuvlar) => {
        yozuvlar.forEach((y) => {
          if (!y.isIntersecting) return;
          const id = y.target.id;
          $$(".menu a").forEach((a) => {
            a.classList.toggle("is-on", a.getAttribute("href") === "#" + id);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    bolimlar.forEach((s) => kuzatuvchi.observe(s));
  }

  let toastVaqt;
  function xabar(matn) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = matn;
    t.classList.add("is-on");
    clearTimeout(toastVaqt);
    toastVaqt = setTimeout(() => t.classList.remove("is-on"), 2600);
  }

  /* ===============================================
     13. Ishga tushirish va o‘lcham o‘zgarishi
     =============================================== */

  function hammasiChiz() {
    miniChiz();
    galereyaChiz();
    bosqichChiz();
    studioChiz();
  }

  mavzuQoy(boshMavzu);
  chiqishlarYangila();
  bosqichYangila();
  hammasiChiz();
  heroBoshla();
  aylantirish();

  let olchamVaqt;
  window.addEventListener("resize", () => {
    clearTimeout(olchamVaqt);
    olchamVaqt = setTimeout(() => {
      heroMoslash();
      hammasiChiz();
      aylantirish();
    }, 180);
  });
})();