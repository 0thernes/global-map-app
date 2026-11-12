// Audio: CC0 music bed + UI SFX (see CREDITS.md). Starts muted; nothing plays until the user interacts (autoplay rules).
// HTMLAudioElement is used (not fetch/WebAudio decode) so it works from file:// as well as http(s).
const BASE = 'assets/audio/';
const FILES = {
  score: 'score_persistence_cinameng.mp3',
  drone: 'drone_manaos_tozan.mp3',
  blip: 'ui_blip.mp3',
  tick: 'ui_tick.mp3',
  whoosh: 'whoosh.mp3',
  boom: 'boom_low.mp3',
  chatter: 'data_chatter.mp3',
};
const KEY = 'gm.audio';
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
})();
export const audio = {
  muted: saved.muted ?? true,
  music: saved.music ?? 0.45,
  sfx: saved.sfx ?? 0.6,
  unlocked: false,
  _music: [],
  _pool: {},
};
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ muted: audio.muted, music: audio.music, sfx: audio.sfx }));
  } catch {}
};
function el(name, loop = false) {
  const a = new Audio(BASE + FILES[name]);
  a.loop = loop;
  a.preload = loop ? 'auto' : 'auto';
  return a;
}
function applyMusic() {
  for (const m of audio._music) {
    m.el.volume = audio.muted ? 0 : audio.music * m.gain;
    if (audio.muted || !audio.unlocked) m.el.pause();
    else if (m.el.paused) m.el.play().catch(() => {});
  }
}
/** call from a user gesture (click/keydown); safe to call repeatedly */
export function unlockAudio() {
  if (audio.unlocked) return;
  audio.unlocked = true;
  if (!audio._music.length) audio._music = [
    { el: el('score', true), gain: 0.8 },
    { el: el('drone', true), gain: 0.55 },
  ];
  applyMusic();
}
export function setMuted(m) {
  audio.muted = !!m;
  if (!m) unlockAudio();
  applyMusic();
  save();
}
export function setVolumes({ music, sfx }) {
  if (music != null) audio.music = +music;
  if (sfx != null) audio.sfx = +sfx;
  applyMusic();
  save();
}
let lastPlay = {};
/** fire-and-forget SFX; rate-limited per sound so rapid UI events don't stack */
export function sfx(name, gain = 1) {
  if (audio.muted || !audio.unlocked || !FILES[name]) return;
  const now = performance.now();
  if (now - (lastPlay[name] || 0) < 60) return;
  lastPlay[name] = now;
  const pool = (audio._pool[name] = audio._pool[name] || []);
  let a = pool.find((x) => x.paused || x.ended);
  if (!a) {
    if (pool.length >= 4) return;
    a = el(name);
    pool.push(a);
  }
  a.volume = Math.max(0, Math.min(1, audio.sfx * gain));
  a.currentTime = 0;
  a.play().catch(() => {});
}
export const AUDIO_CREDITS = [
  { file: FILES.score, title: 'Persistence (loop)', author: 'cinameng', license: 'CC0 1.0', url: 'https://opengameart.org/content/persistence', use: 'music bed' },
  { file: FILES.drone, title: 'Manaos Drones (drone 1, first 90 s, faded)', author: 'Tozan', license: 'CC0 1.0', url: 'https://opengameart.org/content/manaos-drones', use: 'ambient drone' },
  { file: FILES.blip, title: 'rollover2 (51 UI sound effects)', author: 'Kenney (kenney.nl)', license: 'CC0 1.0', url: 'https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks', use: 'UI blip' },
  { file: FILES.tick, title: 'click3 (51 UI sound effects)', author: 'Kenney (kenney.nl)', license: 'CC0 1.0', url: 'https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks', use: 'UI tick' },
  { file: FILES.whoosh, title: 'swish-9 (Swishes Sound Pack)', author: 'artisticdude', license: 'CC0 1.0', url: 'https://opengameart.org/content/swishes-sound-pack', use: 'fly-to whoosh' },
  { file: FILES.boom, title: 'lowDown (63 Digital sound effects), pitched down 1 octave + low-pass', author: 'Kenney (kenney.nl)', license: 'CC0 1.0', url: 'https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc', use: 'reveal boom' },
  { file: FILES.chatter, title: 'tone1 (63 Digital sound effects)', author: 'Kenney (kenney.nl)', license: 'CC0 1.0', url: 'https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc', use: 'data chatter' },
];
