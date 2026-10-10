// عالم الصفحة: نفس كود أداة Tampermonkey، مع بدائل لدوال GM_ تعتمد على الجسر
(function () {
  'use strict';
  let S = null;
  const req = m => document.dispatchEvent(new CustomEvent('tahdir-ext-req', { detail: JSON.stringify(m) }));
  const api = {
    GM_getValue: (k, d) => (S && Object.prototype.hasOwnProperty.call(S, k) ? JSON.parse(JSON.stringify(S[k])) : d),
    GM_setValue: (k, v) => { S[k] = JSON.parse(JSON.stringify(v)); req({ type: 'set', key: k, value: S[k] }); },
    GM_deleteValue: k => { delete S[k]; req({ type: 'del', key: k }); },
    GM_openInTab: (url) => req({ type: 'open', url: String(url) }),
    GM_registerMenuCommand: () => {}
  };
  document.addEventListener('tahdir-ext-snap', e => {
    if (S) return;
    try { S = JSON.parse(String(e.detail)) || {}; } catch (x) { S = {}; }
    if (location.hostname === 'tahdir.hudhaifa-bio.workers.dev') document.documentElement.setAttribute('data-tahdir-ext', '__EXTVER__');
    __RUN__(api.GM_getValue, api.GM_setValue, api.GM_deleteValue, api.GM_openInTab, api.GM_registerMenuCommand, window);
  });
  req({ type: 'hello' });
})();
