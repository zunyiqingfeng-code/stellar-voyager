/* 星海远航 · DOM UI 助手（面板/提示/确认） */
(function (root) {
  'use strict';
  const S = (root.STARFALL = root.STARFALL || {});

  const UI = {
    el(id) { return document.getElementById(id); },

    show(el) { el && el.classList.remove('hidden'); },
    hide(el) { el && el.classList.add('hidden'); },
    toggle(el, on) { el && el.classList.toggle('hidden', !on); },

    /** 弹出短消息 */
    toast(msg, kind = 'info', dur = 3400) {
      const box = this.el('toasts');
      if (!box) return;
      const t = document.createElement('div');
      t.className = 'toast ' + kind;
      t.innerHTML = msg;
      box.appendChild(t);
      while (box.children.length > 5) box.removeChild(box.firstChild);
      setTimeout(() => { t.classList.add('fade'); setTimeout(() => t.remove(), 450); }, dur);
    },

    _openModals: [],

    /** 模态面板（支持层叠：内层关闭后外层仍可交互） */
    modal(opts) {
      const rootEl = this.el('modal-root');
      this.hideTooltip();
      rootEl.classList.add('active');
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      const modal = document.createElement('div');
      modal.className = 'modal ' + (opts.width || 'narrow');

      const head = document.createElement('div');
      head.className = 'modal-head';
      const titleWrap = document.createElement('div');
      titleWrap.innerHTML = '<h2>' + (opts.title || '') + '</h2>' + (opts.sub ? '<div class="sub">' + opts.sub + '</div>' : '');
      head.appendChild(titleWrap);
      if (opts.closable !== false) {
        const x = document.createElement('button');
        x.className = 'x-btn'; x.textContent = '×';
        x.onclick = close;
        head.appendChild(x);
      }
      modal.appendChild(head);

      const body = document.createElement('div');
      body.className = 'modal-body';
      if (typeof opts.body === 'string') body.innerHTML = opts.body;
      else if (opts.body) body.appendChild(opts.body);
      modal.appendChild(body);

      const foot = document.createElement('div');
      foot.className = 'modal-foot';
      (opts.buttons || []).forEach((b) => {
        const btn = document.createElement('button');
        btn.className = 'btn ' + (b.kind || '');
        btn.innerHTML = b.label;
        btn.disabled = !!b.disabled;
        btn.onclick = () => { if (b.cb) b.cb(close); else close(); };
        foot.appendChild(btn);
      });
      if (opts.buttons?.length) modal.appendChild(foot);

      rootEl.appendChild(backdrop);
      rootEl.appendChild(modal);

      let closed = false;
      function close() {
        if (closed) return;
        closed = true;
        backdrop.remove(); modal.remove();
        const idx = UI._openModals.indexOf(close);
        if (idx >= 0) UI._openModals.splice(idx, 1);
        if (UI._openModals.length === 0) rootEl.classList.remove('active');
        if (opts.onClose) opts.onClose();
      }
      UI._openModals.push(close);
      return { close, root: modal, body, head, foot };
    },

    confirm(title, text, opts = {}) {
      const buttons = [
        { label: opts.cancelLabel || '取消', cb: (c) => { c(); if (opts.onCancel) opts.onCancel(); } },
        { label: opts.okLabel || '确定', kind: opts.okKind || 'btn-primary', cb: (c) => { c(); if (opts.onOk) opts.onOk(); } }
      ];
      return this.modal({ title, body: text, buttons });
    },

    tooltip(text) {
      const t = this.el('tooltip');
      t.innerHTML = text;
      t.classList.remove('hidden');
      return t;
    },
    moveTooltip(x, y) {
      const t = this.el('tooltip');
      const w = t.offsetWidth, h = t.offsetHeight;
      t.style.left = Math.min(x + 16, window.innerWidth - w - 8) + 'px';
      t.style.top = Math.min(y + 16, window.innerHeight - h - 8) + 'px';
    },
    hideTooltip() { this.el('tooltip').classList.add('hidden'); },

    /** 清空某容器 */
    clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); },

    /** 关闭全部模态弹窗（逐个触发 onClose，保证外部状态一致） */
    closeAll() {
      const rootEl = this.el('modal-root');
      if (!rootEl) return;
      while (this._openModals.length) this._openModals[this._openModals.length - 1]();
      rootEl.classList.remove('active');
    },

    /** 格式化大数字 */
    fmt(n) {
      if (n == null) return '-';
      const abs = Math.abs(n);
      if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'G';
      if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
      if (abs >= 1e4) return (n / 1e3).toFixed(1) + 'k';
      if (Number.isInteger(n)) return n.toString();
      return n.toFixed(1);
    }
  };

  S.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);