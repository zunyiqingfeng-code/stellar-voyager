/* 星海远航 · 存档 */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  const KEY = 'stellar-voyager-save-v1';

  const Save = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data && data.version === 1 ? data : null;
      } catch (e) { return null; }
    },
    save(data) {
      try {
        data.version = 1;
        data.savedAt = Date.now();
        localStorage.setItem(KEY, JSON.stringify(data));
        return true;
      } catch (e) { return false; }
    },
    wipe() { try { localStorage.removeItem(KEY); } catch (e) {} },
    has() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
  };

  S.Save = Save;
})(typeof window !== 'undefined' ? window : globalThis);
