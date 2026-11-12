// file://-friendly lazy loader: data files are JS that call GM.reg(name,payload) / GM.tex(name,dataURI)
const reg = {},
  waiting = {},
  tex = {},
  texWait = {};
window.GM = window.GM || {};
window.GM.reg = (name, payload) => {
  reg[name] = payload;
  (waiting[name] || []).forEach((f) => f(payload));
  delete waiting[name];
};
window.GM.tex = (name, uri) => {
  tex[name] = uri;
  (texWait[name] || []).forEach((f) => f(uri));
  delete texWait[name];
};
const injected = new Set();
export function inject(src) {
  return new Promise((res, rej) => {
    if (injected.has(src)) return res();
    injected.add(src);
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => res();
    s.onerror = () => {
      injected.delete(src);
      rej(new Error('failed to load ' + src));
    };
    document.head.appendChild(s);
  });
}
export function loadLayer(name) {
  if (reg[name]) return Promise.resolve(reg[name]);
  return new Promise((res, rej) => {
    (waiting[name] = waiting[name] || []).push(res);
    inject('data/layers/' + name + '.js').catch(rej);
  });
}
export function hasLayer(name) {
  return !!reg[name];
}
export function loadTexURI(name) {
  if (tex[name]) return Promise.resolve(tex[name]);
  return new Promise((res, rej) => {
    (texWait[name] = texWait[name] || []).push(res);
    inject('textures/' + name + '.js').catch(rej);
  });
}
// n: chunk name written by data/build_data.py ('case_details/0003' or 'private/case_details/0003'); numbers are accepted too
export function loadCaseDetails(n) {
  const name = typeof n === 'number' ? 'case_details/' + String(n).padStart(4, '0') : String(n);
  if (reg[name]) return Promise.resolve(reg[name]);
  return new Promise((res, rej) => {
    (waiting[name] = waiting[name] || []).push(res);
    inject('data/' + name + '.js').catch(rej);
  });
}
