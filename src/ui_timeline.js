// Nonlinear timeline 8000 BCE -> 2026-11-11 (segmented: deep past compressed, 1900-2026 at day resolution).
import { icon } from './icons.js';
import {
  ctx,
  st,
  $,
  emit,
  on,
  esc,
  caseVisibleF,
  catColor,
  dayLabel,
  dayToISO,
  dateToDay,
  NDAYS,
  DAYMIN,
  dayOf,
  civil,
} from './app_core.js';
import { posToDay, dayToPos, addMonths, addYears, TL_SEGMENTS } from './geo.js';
import { ERAS, eraById, makeScale, zoomWindow, centerWindow, ticks } from './ui/timescale.js';

const SPEEDS = [
  ['1d', 1, '1 day per second'],
  ['1w', 7, '1 week per second'],
  ['1mo', 30.44, '1 month per second'],
  ['1y', 365.25, '1 year per second'],
  ['10y', 3652.5, '10 years per second'],
  ['100y', 36525, '100 years per second'],
  ['Auto', 'adaptive', 'Adaptive: 2% of the bar per second'],
];
const STEPS = [
  ['-Y', '−1y', 'Back 1 year (Alt+←)'],
  ['-M', '−1m', 'Back 1 month (Shift+←)'],
  ['-D', '−1d', 'Back 1 day (←)'],
  ['+D', '+1d', 'Forward 1 day (→)'],
  ['+M', '+1m', 'Forward 1 month (Shift+→)'],
  ['+Y', '+1y', 'Forward 1 year (Alt+→)'],
];
const LS_ERA = 'gm.tl.focus';
let cv,
  c2,
  W = 0,
  H = 0,
  PADL = 12,
  PADR = 12,
  drag = null,
  hoverDay = null,
  view = null, // detail window: null = All time (segmented) or [d0, d1] (linear)
  era = 'all';
const OV_H = 12; // overview strip height (CSS px) at the top of the canvas
const seg = (id, label, items, cur) =>
  `<div class="tl-group" role="group" aria-labelledby="${id}-l"><span class="tl-cap" id="${id}-l">${label}</span><div class="seg" id="${id}">${items
    .map(
      ([v, t, tip]) =>
        `<button type="button" class="seg-b" data-v="${v}" title="${tip}" aria-label="${tip}" aria-pressed="${String(v) === String(cur)}">${t}</button>`,
    )
    .join('')}</div></div>`;
export function initTimeline() {
  const el = $('#timeline');
  el.innerHTML = `
  <div class="tl-controls">
    <button id="tl-play" class="btn primary tl-play" title="Play / pause (Space)" aria-label="Play" aria-pressed="false">${icon('play', 18)}<span class="tl-play-t">Play</span></button>
    <div class="tl-group" role="group" aria-labelledby="tl-step-l"><span class="tl-cap" id="tl-step-l">Step</span><div class="seg tl-steps">${STEPS.map(
      ([k, t, tip]) =>
        `<button type="button" class="seg-b" data-step="${k}" title="${tip}" aria-label="${tip}">${t}</button>`,
    ).join('')}</div></div>
    ${seg(
      'tl-speed',
      'Speed',
      SPEEDS.map(([t, , tip], i) => [i, t, tip]),
      3,
    )}
    ${seg(
      'tl-mode',
      'Show',
      [
        [0, 'Cumulative', 'Cumulative: cases stay on and fade in as they appear'],
        [1, 'Recent', 'Recent only: cases flash, then fade out'],
      ],
      0,
    )}
    <span class="tl-spacer"></span>
    <label class="tl-date"><span class="tl-cap">Date</span><input id="tl-date" spellcheck="false" title="ISO date; negative years = BCE (e.g. -2560-01-01)"></label>
    <span id="tl-label" class="mono"></span>
    <label class="tl-hour" title="UTC hour for the sun terminator"><span class="tl-cap">UTC</span><input id="tl-hour" type="range" min="0" max="23" value="12" aria-label="UTC hour"><span id="tl-hour-v" class="mono">12:00</span></label>
    <button class="btn sm ghost" id="tl-now" title="Jump to the latest dated case (2026-11-11)">Latest</button>
  </div>
  <canvas id="tl-canvas" aria-label="Timeline. Top strip: the whole span; click it to move the focus. Main track: drag to scrub, Shift+drag to select a date range, wheel to zoom the focus"></canvas>
  <div class="tl-foot">
    ${seg('tl-era', 'Focus', [...ERAS.map((e) => [e.id, e.label, e.title])], era)}
    <span id="tl-brush" class="chip hidden"></span>
    <span id="tl-win" class="mono tl-win"></span>
    <div id="tl-readout" class="tl-readout mono" aria-label="Globe position and timeline date"></div>
  </div>`;
  cv = $('#tl-canvas');
  c2 = cv.getContext('2d');
  $('#tl-play').onclick = togglePlay;
  el.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => step(b.dataset.step)));
  const segPick = (id, fn) =>
    $('#' + id).addEventListener('click', (e) => {
      const b = e.target.closest('.seg-b');
      if (!b) return;
      for (const x of $('#' + id).children) x.setAttribute('aria-pressed', String(x === b));
      fn(b.dataset.v);
    });
  segPick('tl-speed', (v) => (st.speedIdx = +v));
  st.speedIdx = 3;
  segPick('tl-mode', (v) => (st.mode = +v));
  segPick('tl-era', (v) => setFocus(v));
  // the HUD position and date readouts live in the timeline foot (status row), not on top of the globe
  for (const id of ['hud-coord', 'hud-date']) {
    const n = document.getElementById(id);
    if (n) $('#tl-readout').appendChild(n);
  }
  $('#tl-date').onchange = (e) => {
    const d = dateToDay(e.target.value);
    if (isFinite(d)) setDay(d);
    else e.target.value = dayToISO(st.cur);
  };
  $('#tl-hour').oninput = (e) => {
    st.hour = +e.target.value;
    $('#tl-hour-v').textContent = String(st.hour).padStart(2, '0') + ':00';
    emit('time', st.cur);
  };
  $('#tl-now').onclick = () => setDay(NDAYS);
  const inOverview = (e) => e.offsetY < OV_H + 2;
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    if (inOverview(e)) {
      drag = { ov: true };
      overviewAt(e.offsetX);
      return;
    }
    const d = xToDay(e.offsetX);
    if (e.shiftKey) drag = { brush: true, a: d };
    else {
      drag = { scrub: true };
      setDay(d);
    }
  });
  cv.addEventListener('pointermove', (e) => {
    hoverDay = inOverview(e) ? ovXToDay(e.offsetX) : xToDay(e.offsetX);
    if (drag?.ov) overviewAt(e.offsetX);
    else if (drag?.scrub) setDay(hoverDay);
    else if (drag?.brush) {
      st.f.range = [Math.min(drag.a, hoverDay), Math.max(drag.a, hoverDay)];
      emit('filters');
    }
    draw();
  });
  cv.addEventListener('pointerup', () => {
    drag = null;
  });
  cv.addEventListener('pointerleave', () => {
    hoverDay = null;
    draw();
  });
  cv.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const at = xToDay(e.offsetX);
      setView(zoomWindow(view, at, e.deltaY > 0 ? 1.25 : 0.8), 'custom');
    },
    { passive: false },
  );
  cv.addEventListener('dblclick', () => {
    if (st.f.range) {
      st.f.range = null;
      emit('filters');
    }
  });
  on('time', () => {
    readout();
    draw();
  });
  on('filters', () => {
    const b = $('#tl-brush');
    if (st.f.range) {
      b.classList.remove('hidden');
      b.innerHTML = `range ${esc(dayLabel(st.f.range[0]))} → ${esc(dayLabel(st.f.range[1]))} <button class="x" title="Clear the date range" aria-label="Clear the date range">${icon('x', 14)}</button>`;
      b.querySelector('button').onclick = () => {
        st.f.range = null;
        emit('filters');
      };
    } else b.classList.add('hidden');
    draw();
  });
  on('resize', size);
  on('layers-changed', draw);
  on('select', draw);
  let saved = 'all';
  try {
    saved = localStorage.getItem(LS_ERA) || 'all';
  } catch {}
  size();
  setFocus(saved);
  readout();
}
/** Focus the detail track on an era preset ('all', 'ancient', 'ww', 'cold', 'modern', 'recent'). */
export function setFocus(id) {
  const e = eraById(id);
  setView(e.w ? e.w.slice() : null, e.id);
}
function setView(w, id) {
  view = w;
  era = w ? id : 'all';
  for (const b of $('#tl-era').children) b.setAttribute('aria-pressed', String(b.dataset.v === era));
  try {
    localStorage.setItem(LS_ERA, era === 'custom' ? 'all' : era);
  } catch {}
  $('#tl-win').textContent = w ? `${dayLabel(w[0])} → ${dayLabel(w[1])}` : '';
  draw();
}
function overviewAt(x) {
  const d = ovXToDay(x);
  if (view) setView(centerWindow(view, d), era === 'all' ? 'custom' : era);
  setDay(d);
}
export function setDay(d) {
  st.cur = Math.max(DAYMIN, Math.min(NDAYS, Math.round(d)));
  emit('time', st.cur);
}
function step(s) {
  const k = s[0] === '-' ? -1 : 1;
  const u = s[1];
  setDay(u === 'D' ? st.cur + k : u === 'M' ? addMonths(st.cur, k) : addYears(st.cur, k));
}
export const stepTime = step;
export function togglePlay() {
  st.playing = !st.playing;
  if (st.playing && st.cur >= NDAYS) st.cur = st.f.range ? st.f.range[0] : view ? view[0] : dayOf(1900);
  else if (st.playing && view && (st.cur < view[0] || st.cur >= view[1])) st.cur = view[0];
  $('#tl-play').innerHTML =
    `${icon(st.playing ? 'pause' : 'play', 18)}<span class="tl-play-t">${st.playing ? 'Pause' : 'Play'}</span>`;
  $('#tl-play').setAttribute('aria-pressed', String(!!st.playing));
  $('#tl-play').setAttribute('aria-label', st.playing ? 'Pause' : 'Play');
  emit('play', st.playing);
}
let acc = 0;
export function tickPlayback(dt) {
  if (!st.playing) return;
  const sp = SPEEDS[st.speedIdx ?? 3][1];
  const prev = st.cur;
  let next;
  if (sp === 'adaptive') {
    const sc = makeScale(view);
    next = sc.day(Math.min(1, sc.pos(st.cur) + dt * 0.02));
  } else {
    acc += sp * dt;
    const whole = Math.floor(acc);
    acc -= whole;
    next = st.cur + whole;
  }
  const end = st.f.range ? st.f.range[1] : view ? view[1] : NDAYS;
  if (next >= end) {
    next = end;
    togglePlay();
  }
  if (next !== prev) {
    st.cur = Math.round(next);
    emit('time', st.cur);
    pulses(prev, st.cur);
  }
}
function pulses(a, b) {
  let n = 0;
  for (const c of ctx.cases) {
    if (c._day > a && c._day <= b && caseVisibleF(c)) {
      ctx.globe.pulse(c.lat, c.lon, catColor(c.category, c.subtype));
      if (++n > 12) break;
    }
  }
}
function readout() {
  const inp = $('#tl-date');
  if (document.activeElement !== inp) inp.value = dayToISO(st.cur);
  const c = civil(st.cur);
  $('#tl-label').textContent = c.y <= 0 ? `${1 - c.y} BCE (ISO ${c.y})` : `${c.y}`;
}
function size() {
  const r = Math.min(2, devicePixelRatio || 1);
  W = cv.clientWidth;
  H = cv.clientHeight;
  cv.width = W * r;
  cv.height = H * r;
  c2.setTransform(r, 0, 0, r, 0, 0);
  draw();
}
// detail track (focus window) and overview strip (whole span, segmented)
let SC = makeScale(null);
const dayToX = (d) => PADL + SC.pos(d) * (W - PADL - PADR);
const xToDay = (x) => SC.day(Math.max(0, Math.min(1, (x - PADL) / (W - PADL - PADR))));
const ovDayToX = (d) => PADL + dayToPos(d) * (W - PADL - PADR);
const ovXToDay = (x) => posToDay(Math.max(0, Math.min(1, (x - PADL) / (W - PADL - PADR))));
export const drawTimeline = () => draw();
function draw() {
  if (!c2 || !W) return;
  SC = makeScale(view);
  c2.clearRect(0, 0, W, H);
  const iw = W - PADL - PADR;
  const top = OV_H + 5, // two range-bar lanes (date_low..date_high)
    histTop = OV_H + 16,
    histH = Math.max(12, H - histTop - 15);
  // ---- overview strip: the whole span on the segmented scale, the focus window, the playhead
  const ovBins = Math.max(60, Math.floor(iw / 3));
  const ob = new Array(ovBins).fill(0);
  // ---- detail histogram bins
  const bins = Math.max(60, Math.floor(iw / 3));
  const caseBins = new Array(bins).fill(0),
    refBins = new Array(bins).fill(0),
    catBins = new Array(bins).fill(null);
  for (const c of ctx.cases)
    if (isFinite(c._day) && caseVisibleF(c)) {
      ob[Math.min(ovBins - 1, Math.max(0, Math.floor(dayToPos(c._day) * ovBins)))]++;
      const p = SC.pos(c._day);
      if (p < 0 || p > 1) continue;
      const b = Math.min(bins - 1, Math.floor(p * bins));
      caseBins[b]++;
      const m = (catBins[b] ||= {});
      m[c.category] = (m[c.category] || 0) + 1;
    }
  for (const l of ctx.layers)
    if (l.on && l.items && l.timeAware !== false && l.kind !== 'ged')
      for (const it of l.items)
        if (isFinite(it._day)) {
          const p = SC.pos(it._day);
          if (p >= 0 && p <= 1) refBins[Math.min(bins - 1, Math.floor(p * bins))]++;
        }
  c2.fillStyle = 'rgba(120,190,230,0.08)';
  c2.fillRect(PADL, 0, iw, OV_H);
  const om = Math.max(1, ...ob);
  const obw = iw / ovBins;
  c2.fillStyle = 'rgba(56,232,255,0.55)';
  for (let i = 0; i < ovBins; i++)
    if (ob[i]) {
      const h = Math.max(1.5, Math.sqrt(ob[i] / om) * (OV_H - 2));
      c2.fillRect(PADL + i * obw, OV_H - h, Math.max(1, obw - 0.5), h);
    }
  if (view) {
    const xa = ovDayToX(view[0]),
      xb = ovDayToX(view[1]);
    c2.fillStyle = 'rgba(3,6,12,0.55)';
    c2.fillRect(PADL, 0, xa - PADL, OV_H);
    c2.fillRect(xb, 0, W - PADR - xb, OV_H);
    c2.strokeStyle = '#38E8FF';
    c2.lineWidth = 1.5;
    c2.strokeRect(xa, 0.75, Math.max(3, xb - xa), OV_H - 1.5);
    // connectors from the focus window down to the detail track
    c2.strokeStyle = 'rgba(56,232,255,0.35)';
    c2.lineWidth = 1;
    c2.beginPath();
    c2.moveTo(xa, OV_H);
    c2.lineTo(PADL, OV_H + 5);
    c2.moveTo(xb, OV_H);
    c2.lineTo(W - PADR, OV_H + 5);
    c2.stroke();
  }
  c2.fillStyle = '#38E8FF';
  c2.fillRect(ovDayToX(st.cur) - 1, 0, 2, OV_H);
  // ---- detail axis: segment boundaries + decades (All time) or nice ticks (a focus window)
  c2.font = '500 12px Inter, sans-serif';
  if (!view) {
    const segNames = ['8000 BCE', '1 CE', '1500', '1900', '2026'];
    TL_SEGMENTS.forEach(([p], i) => {
      const x = PADL + p * iw;
      c2.fillStyle = 'rgba(120,190,230,0.25)';
      c2.fillRect(x, histTop - 4, 1, histH + 8);
      c2.fillStyle = '#9DB1C2';
      c2.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center';
      c2.fillText(segNames[i], x, H - 3);
    });
    c2.fillStyle = 'rgba(56,232,255,0.05)';
    const x1900 = dayToX(dayOf(1900));
    c2.fillRect(x1900, histTop - 4, W - PADR - x1900, histH + 8);
    c2.fillStyle = '#A9BCCB';
    c2.font = '400 12px Inter, sans-serif';
    c2.textAlign = 'center';
    for (let y = 1910; y <= 2020; y += 10) {
      const x = dayToX(dayOf(y));
      c2.fillRect(x, histTop + histH - 4, 1, 4);
      if (W > 700 || y % 20 === 0) c2.fillText(String(y), x, H - 3);
    }
  } else {
    const tk = ticks(view, Math.max(4, Math.floor(iw / 110)));
    c2.textAlign = 'center';
    for (const t of tk) {
      const x = dayToX(t.d);
      c2.fillStyle = t.major ? 'rgba(120,190,230,0.3)' : 'rgba(120,190,230,0.14)';
      c2.fillRect(x, histTop - 2, 1, histH + 4);
      c2.fillStyle = t.major ? '#C9D8E3' : '#A9BCCB';
      c2.fillText(t.label, Math.max(PADL + 14, Math.min(W - PADR - 14, x)), H - 3);
    }
  }
  // ---- histogram: cases coloured by the bin's dominant category, dated reference layers in grey behind
  const mx = Math.max(1, ...caseBins),
    mr = Math.max(1, ...refBins);
  const bw = iw / bins;
  for (let i = 0; i < bins; i++) {
    if (refBins[i]) {
      const h = Math.sqrt(refBins[i] / mr) * histH * 0.5;
      c2.fillStyle = 'rgba(157,177,194,0.35)';
      c2.fillRect(PADL + i * bw, histTop + histH - h, Math.max(1, bw - 0.5), h);
    }
    if (caseBins[i]) {
      const h = Math.max(3, Math.sqrt(caseBins[i] / mx) * histH);
      let best = null,
        bn = -1;
      for (const [k, n] of Object.entries(catBins[i])) if (n > bn) [best, bn] = [k, n];
      c2.fillStyle = catColor(best);
      c2.globalAlpha = 0.9;
      c2.fillRect(PADL + i * bw, histTop + histH - h, Math.max(1.5, bw - 0.5), h);
      c2.globalAlpha = 1;
    }
  }
  // range bars for disputed / imprecise dates (date_low..date_high), clipped to the focus window
  let lane = 0;
  const xl = PADL,
    xr = W - PADR;
  for (const c of ctx.cases)
    if (caseVisibleF(c) && (c._hi - c._lo > 1 || c.date_disputed)) {
      const xa = Math.max(xl, dayToX(c._lo)),
        xb = Math.min(xr, dayToX(c._hi));
      if (xb < xl || xa > xr) continue;
      c2.fillStyle = catColor(c.category);
      c2.globalAlpha = c === st.selected ? 1 : 0.55;
      c2.fillRect(xa, top + (lane % 2) * 5, Math.max(2, xb - xa), 3);
      c2.globalAlpha = 1;
      lane++;
    }
  const sel = st.selected;
  if (sel && isFinite(sel._lo ?? sel._day)) {
    const xa = dayToX(sel._lo ?? sel._day),
      xb = dayToX(sel._hi ?? sel._day);
    if (xb >= xl && xa <= xr) {
      c2.strokeStyle = '#fff';
      c2.lineWidth = 1.5;
      c2.strokeRect(xa - 1, top - 2, Math.max(3, xb - xa + 2), 12);
    }
  }
  // brush
  if (st.f.range) {
    const xa = Math.max(xl, dayToX(st.f.range[0])),
      xb = Math.min(xr, dayToX(st.f.range[1]));
    if (xb > xa) {
      c2.fillStyle = 'rgba(56,232,255,0.14)';
      c2.fillRect(xa, histTop - 6, xb - xa, histH + 10);
      c2.strokeStyle = 'rgba(56,232,255,0.8)';
      c2.strokeRect(xa, histTop - 6, xb - xa, histH + 10);
    }
  }
  // B playhead (compare)
  if (ctx.globe && ctx.globe.compare.mode !== 'off') {
    const xb = dayToX(st.curB);
    if (xb >= xl && xb <= xr) {
      c2.fillStyle = '#FFC857';
      c2.fillRect(xb - 1, histTop - 8, 2, histH + 12);
      c2.fillText('B', xb, histTop - 10);
    }
  }
  // playhead (an edge chevron when it is outside the focus window)
  const x = dayToX(st.cur);
  c2.fillStyle = '#38E8FF';
  if (x >= xl - 1 && x <= xr + 1) {
    c2.fillRect(x - 1, top - 2, 2, H - top - 14);
    c2.beginPath();
    c2.arc(x, histTop + histH / 2, 5, 0, Math.PI * 2);
    c2.fill();
  } else {
    const ex = x < xl ? xl + 2 : xr - 2,
      dir = x < xl ? -1 : 1,
      y = histTop + histH / 2;
    c2.beginPath();
    c2.moveTo(ex + dir * 6, y);
    c2.lineTo(ex - dir * 2, y - 7);
    c2.lineTo(ex - dir * 2, y + 7);
    c2.fill();
  }
  if (hoverDay != null) {
    const hx = Math.max(xl, Math.min(xr, dayToX(hoverDay)));
    c2.fillStyle = 'rgba(230,241,247,0.5)';
    c2.fillRect(hx, histTop, 1, histH);
    c2.fillStyle = '#E6F1F7';
    c2.font = '500 12px "JetBrains Mono", monospace';
    c2.textAlign = hx > W - 120 ? 'right' : 'left';
    c2.fillText(dayLabel(hoverDay), hx + (hx > W - 120 ? -6 : 6), histTop + 10);
  }
}
