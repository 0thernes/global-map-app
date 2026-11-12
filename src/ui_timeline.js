// Nonlinear timeline 8000 BCE -> 2026-11-11 (segmented: deep past compressed, 1900-2026 at day resolution).
import { ctx, st, $, emit, on, esc, caseVisibleF, catColor, dayLabel, dayToISO, dateToDay, NDAYS, DAYMIN, dayOf, civil } from './app_core.js';
import { posToDay, dayToPos, addMonths, addYears, TL_SEGMENTS } from './geo.js';

const SPEEDS = [['1 day/s', 1], ['1 week/s', 7], ['1 month/s', 30.44], ['1 year/s', 365.25], ['10 years/s', 3652.5], ['100 years/s', 36525], ['adaptive (2% of bar/s)', 'adaptive']];
let cv, c2, W = 0, H = 0, PADL = 12, PADR = 12, drag = null, hoverDay = null;
export function initTimeline() {
  const el = $('#timeline');
  el.innerHTML = `
  <div class="tl-controls">
    <button id="tl-play" class="btn primary" title="Play / pause (Space)" aria-label="Play">▶</button>
    <div class="tl-steps">
      <button class="btn sm" data-step="-Y" title="−1 year (Alt+←)">−Y</button><button class="btn sm" data-step="-M" title="−1 month (Shift+←)">−M</button><button class="btn sm" data-step="-D" title="−1 day (←)">−D</button>
      <button class="btn sm" data-step="+D" title="+1 day (→)">+D</button><button class="btn sm" data-step="+M" title="+1 month (Shift+→)">+M</button><button class="btn sm" data-step="+Y" title="+1 year (Alt+→)">+Y</button>
    </div>
    <select id="tl-speed" title="Playback speed">${SPEEDS.map(([l, v], i) => `<option value="${i}" ${i === 3 ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select id="tl-mode" title="Playback style"><option value="0">cumulative (fade in)</option><option value="1">flash (recent only)</option></select>
    <label class="tl-date">Date <input id="tl-date" spellcheck="false" title="ISO date; negative years = BCE (e.g. -2560-01-01)"></label>
    <span id="tl-label" class="mono"></span>
    <label class="tl-hour" title="UTC hour for the sun terminator">UTC <input id="tl-hour" type="range" min="0" max="23" value="12"><span id="tl-hour-v" class="mono">12:00</span></label>
    <button class="btn sm ghost" id="tl-now" title="Jump to 2026-11-11">Latest</button>
    <span id="tl-brush" class="chip hidden"></span>
  </div>
  <canvas id="tl-canvas" aria-label="Timeline: drag to scrub, Shift+drag to select a date range"></canvas>`;
  cv = $('#tl-canvas'); c2 = cv.getContext('2d');
  $('#tl-play').onclick = togglePlay;
  el.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => step(b.dataset.step)));
  $('#tl-speed').onchange = (e) => { st.speedIdx = +e.target.value; };
  st.speedIdx = 3;
  $('#tl-mode').onchange = (e) => { st.mode = +e.target.value; };
  $('#tl-date').onchange = (e) => { const d = dateToDay(e.target.value); if (isFinite(d)) setDay(d); else e.target.value = dayToISO(st.cur); };
  $('#tl-hour').oninput = (e) => { st.hour = +e.target.value; $('#tl-hour-v').textContent = String(st.hour).padStart(2, '0') + ':00'; emit('time', st.cur); };
  $('#tl-now').onclick = () => setDay(NDAYS);
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); const d = xToDay(e.offsetX); if (e.shiftKey) drag = { brush: true, a: d }; else { drag = { scrub: true }; setDay(d); } });
  cv.addEventListener('pointermove', (e) => { hoverDay = xToDay(e.offsetX); if (drag?.scrub) setDay(hoverDay); else if (drag?.brush) { st.f.range = [Math.min(drag.a, hoverDay), Math.max(drag.a, hoverDay)]; emit('filters'); } draw(); });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('pointerleave', () => { hoverDay = null; draw(); });
  cv.addEventListener('dblclick', () => { if (st.f.range) { st.f.range = null; emit('filters'); } });
  on('time', () => { readout(); draw(); });
  on('filters', () => { const b = $('#tl-brush'); if (st.f.range) { b.classList.remove('hidden'); b.innerHTML = `range ${esc(dayLabel(st.f.range[0]))} → ${esc(dayLabel(st.f.range[1]))} <button class="x" title="clear">×</button>`; b.querySelector('button').onclick = () => { st.f.range = null; emit('filters'); }; } else b.classList.add('hidden'); draw(); });
  on('resize', size); on('layers-changed', draw); on('select', draw);
  size(); readout();
}
export function setDay(d) { st.cur = Math.max(DAYMIN, Math.min(NDAYS, Math.round(d))); emit('time', st.cur); }
function step(s) { const k = s[0] === '-' ? -1 : 1; const u = s[1]; setDay(u === 'D' ? st.cur + k : u === 'M' ? addMonths(st.cur, k) : addYears(st.cur, k)); }
export const stepTime = step;
export function togglePlay() { st.playing = !st.playing; if (st.playing && st.cur >= NDAYS) st.cur = st.f.range ? st.f.range[0] : dayOf(1900); $('#tl-play').textContent = st.playing ? '❚❚' : '▶'; $('#tl-play').setAttribute('aria-label', st.playing ? 'Pause' : 'Play'); emit('play', st.playing); }
let acc = 0;
export function tickPlayback(dt) {
  if (!st.playing) return; const sp = SPEEDS[st.speedIdx ?? 3][1]; const prev = st.cur;
  let next;
  if (sp === 'adaptive') next = posToDay(Math.min(1, dayToPos(st.cur) + dt * 0.02));
  else { acc += sp * dt; const whole = Math.floor(acc); acc -= whole; next = st.cur + whole; }
  const end = st.f.range ? st.f.range[1] : NDAYS;
  if (next >= end) { next = end; togglePlay(); }
  if (next !== prev) { st.cur = Math.round(next); emit('time', st.cur); pulses(prev, st.cur); }
}
function pulses(a, b) {
  let n = 0; for (const c of ctx.cases) { if (c._day > a && c._day <= b && caseVisibleF(c)) { ctx.globe.pulse(c.lat, c.lon, catColor(c.category, c.subtype)); if (++n > 12) break; } }
}
function readout() {
  const inp = $('#tl-date'); if (document.activeElement !== inp) inp.value = dayToISO(st.cur);
  const c = civil(st.cur); $('#tl-label').textContent = c.y <= 0 ? `${1 - c.y} BCE (ISO ${c.y})` : `${c.y}`;
}
function size() { const r = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * r; cv.height = H * r; c2.setTransform(r, 0, 0, r, 0, 0); draw(); }
const dayToX = (d) => PADL + dayToPos(d) * (W - PADL - PADR);
const xToDay = (x) => posToDay(Math.max(0, Math.min(1, (x - PADL) / (W - PADL - PADR))));
export const drawTimeline = () => draw();
function draw() {
  if (!c2 || !W) return; c2.clearRect(0, 0, W, H);
  const top = 14, histTop = 28, histH = H - histTop - 16;
  // segment backgrounds + labels
  const segNames = ['8000 BCE', '1 CE', '1500', '1900', '2026'];
  TL_SEGMENTS.forEach(([p, d], i) => { const x = PADL + p * (W - PADL - PADR); c2.fillStyle = 'rgba(120,190,230,0.25)'; c2.fillRect(x, histTop - 4, 1, histH + 8); c2.fillStyle = '#9DB1C2'; c2.font = '500 11px Inter, sans-serif'; c2.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center'; c2.fillText(segNames[i], x, H - 3); });
  c2.fillStyle = 'rgba(56,232,255,0.05)'; const x1900 = dayToX(dayOf(1900)); c2.fillRect(x1900, histTop - 4, W - PADR - x1900, histH + 8);
  // decade ticks in the modern segment
  c2.fillStyle = 'rgba(157,177,194,0.6)'; c2.font = '400 10px Inter, sans-serif'; c2.textAlign = 'center';
  for (let y = 1910; y <= 2020; y += 10) { const x = dayToX(dayOf(y)); c2.fillRect(x, histTop + histH - 4, 1, 4); if (W > 700 || y % 20 === 0) c2.fillText(String(y), x, H - 3); }
  // histogram: cases (by category colour), plus dated reference layers in grey
  const bins = Math.max(60, Math.floor((W - PADL - PADR) / 3)); const caseBins = new Array(bins).fill(0), refBins = new Array(bins).fill(0), colBins = new Array(bins).fill(null);
  const bi = (d) => Math.min(bins - 1, Math.max(0, Math.floor(dayToPos(d) * bins)));
  for (const c of ctx.cases) if (isFinite(c._day) && caseVisibleF(c)) { const b = bi(c._day); caseBins[b]++; colBins[b] = colBins[b] || catColor(c.category); }
  for (const l of ctx.layers) if (l.on && l.items && l.timeAware !== false && l.kind !== 'ged') for (const it of l.items) if (isFinite(it._day)) refBins[bi(it._day)]++;
  const mx = Math.max(1, ...caseBins), mr = Math.max(1, ...refBins); const bw = (W - PADL - PADR) / bins;
  for (let i = 0; i < bins; i++) {
    if (refBins[i]) { const h = Math.sqrt(refBins[i] / mr) * histH * 0.5; c2.fillStyle = 'rgba(157,177,194,0.35)'; c2.fillRect(PADL + i * bw, histTop + histH - h, Math.max(1, bw - 0.5), h); }
    if (caseBins[i]) { const h = Math.max(3, Math.sqrt(caseBins[i] / mx) * histH); c2.fillStyle = colBins[i]; c2.globalAlpha = 0.9; c2.fillRect(PADL + i * bw, histTop + histH - h, Math.max(1.5, bw - 0.5), h); c2.globalAlpha = 1; }
  }
  // range bars for disputed / imprecise dates (date_low..date_high)
  let lane = 0; for (const c of ctx.cases) if (caseVisibleF(c) && (c._hi - c._lo > 1 || c.date_disputed)) { const xa = dayToX(c._lo), xb = dayToX(c._hi); c2.fillStyle = catColor(c.category); c2.globalAlpha = c === st.selected ? 1 : 0.55; c2.fillRect(xa, top + (lane % 2) * 5, Math.max(2, xb - xa), 3); c2.globalAlpha = 1; lane++; }
  const sel = st.selected; if (sel && isFinite(sel._lo ?? sel._day)) { const xa = dayToX(sel._lo ?? sel._day), xb = dayToX(sel._hi ?? sel._day); c2.strokeStyle = '#fff'; c2.lineWidth = 1.5; c2.strokeRect(xa - 1, top - 2, Math.max(3, xb - xa + 2), 12); }
  // brush
  if (st.f.range) { const xa = dayToX(st.f.range[0]), xb = dayToX(st.f.range[1]); c2.fillStyle = 'rgba(56,232,255,0.14)'; c2.fillRect(xa, histTop - 6, xb - xa, histH + 10); c2.strokeStyle = 'rgba(56,232,255,0.8)'; c2.strokeRect(xa, histTop - 6, xb - xa, histH + 10); }
  // B playhead (compare)
  if (ctx.globe && ctx.globe.compare.mode !== 'off') { const xb = dayToX(st.curB); c2.fillStyle = '#FFC857'; c2.fillRect(xb - 1, histTop - 8, 2, histH + 12); c2.fillText('B', xb, histTop - 10); }
  // playhead
  const x = dayToX(st.cur); c2.fillStyle = '#38E8FF'; c2.fillRect(x - 1, 2, 2, H - 16); c2.beginPath(); c2.arc(x, histTop + histH / 2, 5, 0, Math.PI * 2); c2.fill();
  if (hoverDay != null) { const hx = dayToX(hoverDay); c2.fillStyle = 'rgba(230,241,247,0.5)'; c2.fillRect(hx, histTop, 1, histH); c2.fillStyle = '#E6F1F7'; c2.font = '500 11px "IBM Plex Mono", monospace'; c2.textAlign = hx > W - 120 ? 'right' : 'left'; c2.fillText(dayLabel(hoverDay), hx + (hx > W - 120 ? -6 : 6), histTop + 10); }
}
