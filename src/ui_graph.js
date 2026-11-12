// Entity / link graph (d3-force on canvas). Edges only from real fields; hover shows the reason.
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import { ctx, st, $, esc, emit, on, S, catColor, caseVisibleF } from './app_core.js';
import { openDossier } from './ui_panels.js';

let open = false,
  sim = null,
  nodes = [],
  links = [],
  cv,
  c2,
  W,
  H,
  view = { x: 0, y: 0, k: 1 },
  hover = null,
  opts = { prox: true, time: false, src: true, people: true };
export function initGraph() {
  $('#graph-close').onclick = () => toggleGraph(false);
  cv = $('#graph-canvas');
  c2 = cv.getContext('2d');
  ['prox', 'time', 'src', 'people'].forEach((k) => {
    const el = $('#g-' + k);
    el.checked = opts[k];
    el.onchange = () => {
      opts[k] = el.checked;
      build();
    };
  });
  on('filters', () => open && build());
  on('select', () => open && draw());
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    const n = nodeAt(e.offsetX, e.offsetY);
    drag = { n, x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y, moved: false };
    if (n) {
      n.fx = n.x;
      n.fy = n.y;
      sim.alphaTarget(0.2).restart();
    }
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.offsetX - drag.x,
        dy = e.offsetY - drag.y;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      if (drag.n) {
        drag.n.fx = (e.offsetX - W / 2 - view.x) / view.k;
        drag.n.fy = (e.offsetY - H / 2 - view.y) / view.k;
      } else {
        view.x = drag.vx + dx;
        view.y = drag.vy + dy;
        draw();
      }
      return;
    }
    hover = nodeAt(e.offsetX, e.offsetY) || edgeAt(e.offsetX, e.offsetY);
    const tip = $('#graph-tip');
    if (hover) {
      tip.hidden = false;
      tip.style.left = e.offsetX + 12 + 'px';
      tip.style.top = e.offsetY + 8 + 'px';
      tip.innerHTML = hover.source
        ? `<b>${esc(hover.why)}</b><br>${esc(hover.source.label)} ↔ ${esc(hover.target.label)}`
        : `<b>${esc(hover.label)}</b><br><span class=muted>${esc(hover.type)}${hover.deg ? ' · ' + hover.deg + ' links' : ''}</span>`;
    } else tip.hidden = true;
    draw();
  });
  cv.addEventListener('pointerup', () => {
    if (drag && drag.n) {
      drag.n.fx = drag.n.fy = null;
      sim.alphaTarget(0);
      if (!drag.moved && drag.n.case) openDossier(drag.n.case);
    }
    drag = null;
  });
  cv.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const k = Math.exp(-e.deltaY * 0.0015);
      view.k = Math.max(0.2, Math.min(5, view.k * k));
      draw();
    },
    { passive: false },
  );
}
export function toggleGraph(show) {
  const el = $('#graph');
  open = show ?? el.hidden;
  el.hidden = !open;
  document.body.classList.toggle('graph-open', open);
  if (open) {
    size();
    build();
  }
  emit('resize');
}
function size() {
  const r = Math.min(2, devicePixelRatio || 1);
  W = cv.clientWidth;
  H = cv.clientHeight;
  cv.width = W * r;
  cv.height = H * r;
  c2.setTransform(r, 0, 0, r, 0, 0);
}
function build() {
  let cs = ctx.cases.filter((c) => caseVisibleF(c));
  const capped = cs.length > 600;
  if (capped) cs = cs.sort((a, b) => b._links.length - a._links.length || (a._gc === 'CIT' ? -1 : 1)).slice(0, 600);
  const byId = new Map();
  nodes = [];
  links = [];
  const N = (id, o) => {
    let n = byId.get(id);
    if (!n) {
      n = { id, deg: 0, ...o };
      byId.set(id, n);
      nodes.push(n);
    }
    return n;
  };
  const E = (a, b, why, kind) => {
    links.push({ source: a, target: b, why, kind });
    a.deg++;
    b.deg++;
  };
  for (const c of cs)
    N('c:' + c.id, { type: c.category, label: c.name, case: c, color: catColor(c.category, c.subtype), r: 6 });
  const caseIds = new Set(cs.map((c) => c.id));
  for (const c of cs) {
    const a = byId.get('c:' + c.id);
    for (const l of c._links) if (caseIds.has(l)) E(a, byId.get('c:' + l), 'linked_case (source CSV)', 'link');
    if (opts.people)
      for (const p of c._people)
        E(
          a,
          N('p:' + p.split(' ').pop().toLowerCase(), {
            type: 'person (witness surname)',
            label: p,
            color: '#E6F1F7',
            r: 4,
          }),
          'named witness',
          'person',
        );
    if (opts.src && c._dom)
      E(a, N('s:' + c._dom, { type: 'source domain', label: c._dom, color: '#7A90A3', r: 4 }), 'source domain', 'src');
  }
  for (let i = 0; i < cs.length; i++)
    for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i],
        b = cs[j];
      if (opts.prox && a.category === b.category) {
        const d = S.haversine(a.lat, a.lon, b.lat, b.lon);
        if (d <= 500)
          E(byId.get('c:' + a.id), byId.get('c:' + b.id), `same category, ${Math.round(d)} km apart`, 'prox');
      }
      if (opts.time && Math.abs(a._day - b._day) <= 365)
        E(byId.get('c:' + a.id), byId.get('c:' + b.id), `${Math.abs(a._day - b._day)} days apart`, 'time');
    }
  // prune entity nodes that connect to a single case (no information)
  const keep = new Set(nodes.filter((n) => n.case || n.deg >= 2));
  nodes = nodes.filter((n) => keep.has(n));
  links = links.filter((l) => keep.has(l.source) && keep.has(l.target));
  if (sim) sim.stop();
  sim = forceSimulation(nodes)
    .force(
      'link',
      forceLink(links)
        .distance((l) => (l.kind === 'link' ? 30 : l.kind === 'prox' ? 60 : 45))
        .strength(0.5),
    )
    .force('charge', forceManyBody().strength(-60))
    .force('center', forceCenter(0, 0))
    .force('collide', forceCollide(9))
    .on('tick', draw);
  $('#graph-stats').textContent =
    `${capped ? 'first 600 of the filtered cases (linked, then CIT first); narrow the filters to see others · ' : ''}${nodes.filter((n) => n.case).length} cases · ${nodes.filter((n) => !n.case).length} entities · ${links.length} links`;
}
const COL = {
  link: '#FFC857',
  person: 'rgba(230,241,247,0.45)',
  src: 'rgba(122,144,163,0.45)',
  prox: 'rgba(56,232,255,0.35)',
  time: 'rgba(185,140,255,0.35)',
};
function draw() {
  if (!c2) return;
  c2.clearRect(0, 0, W, H);
  c2.save();
  c2.translate(W / 2 + view.x, H / 2 + view.y);
  c2.scale(view.k, view.k);
  for (const l of links) {
    c2.strokeStyle = l === hover ? '#fff' : COL[l.kind];
    c2.lineWidth = (l === hover ? 2 : l.kind === 'link' ? 1.6 : 1) / view.k;
    if (l.kind === 'time') c2.setLineDash([3 / view.k, 3 / view.k]);
    c2.beginPath();
    c2.moveTo(l.source.x, l.source.y);
    c2.lineTo(l.target.x, l.target.y);
    c2.stroke();
    c2.setLineDash([]);
  }
  for (const n of nodes) {
    const sel = st.selected && n.case === st.selected;
    c2.fillStyle = n.color;
    c2.beginPath();
    if (n.case) c2.arc(n.x, n.y, n.r, 0, 7);
    else c2.rect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    c2.fill();
    if (sel || n === hover) {
      c2.strokeStyle = '#fff';
      c2.lineWidth = 2 / view.k;
      c2.stroke();
    }
  }
  c2.font = `${11 / view.k}px Inter, sans-serif`;
  c2.fillStyle = '#C9D6E2';
  c2.textAlign = 'left';
  for (const n of nodes)
    if (view.k > 1.2 || !n.case || n.deg > 3 || (st.selected && n.case === st.selected))
      c2.fillText(n.label.length > 32 ? n.label.slice(0, 31) + '…' : n.label, n.x + n.r + 3, n.y + 3);
  c2.restore();
}
const toW = (x, y) => [(x - W / 2 - view.x) / view.k, (y - H / 2 - view.y) / view.k];
function nodeAt(x, y) {
  const [wx, wy] = toW(x, y);
  let b = null,
    bd = 10 / view.k;
  for (const n of nodes) {
    const d = Math.hypot(n.x - wx, n.y - wy);
    if (d < bd) {
      bd = d;
      b = n;
    }
  }
  return b;
}
function edgeAt(x, y) {
  const [wx, wy] = toW(x, y);
  let b = null,
    bd = 4 / view.k;
  for (const l of links) {
    const ax = l.source.x,
      ay = l.source.y,
      bx = l.target.x,
      by = l.target.y;
    const t = Math.max(
      0,
      Math.min(1, ((wx - ax) * (bx - ax) + (wy - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)),
    );
    const d = Math.hypot(wx - ax - t * (bx - ax), wy - ay - t * (by - ay));
    if (d < bd) {
      bd = d;
      b = l;
    }
  }
  return b;
}
