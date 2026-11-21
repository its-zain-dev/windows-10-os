/* ==========================================================================
   Windows 10 Window Manager (Drag, 8-Way Resize, Aero Snap, Virtual Desktops,
   Task View, Alt+Tab, Cascade/Stack/Side-by-Side)
   ========================================================================== */

import { GLYPHS, APP_ICONS } from './icons.js';

class WindowManager {
  constructor() {
    this.apps = new Map();
    this.windows = new Map();
    this.zCounter = 1100;
    this.winSeq = 1;
    this.activeId = null;
    this.listeners = new Set();

    // Virtual Desktops
    this.desktops = [{ id: 1, name: 'Desktop 1' }];
    this.currentDesktop = 1;
    this.desktopSeq = 1;

    // Show desktop toggle memory
    this.showDesktopRestoreIds = null;
  }

  registerApp(def) {
    this.apps.set(def.id, def);
  }

  getApp(id) {
    return this.apps.get(id);
  }

  getAllApps() {
    return Array.from(this.apps.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    this.listeners.forEach(fn => fn());
  }

  openApp(appId, params = {}) {
    const app = this.apps.get(appId);
    if (!app) return null;

    // Single instance apps focus existing if open on current desktop
    if (app.singleInstance) {
      const existing = Array.from(this.windows.values()).find(
        w => w.appId === appId && w.desktopId === this.currentDesktop
      );
      if (existing) {
        if (existing.minimized) this.restore(existing.id);
        this.focus(existing.id);
        if (existing.instance && typeof existing.instance.onParams === 'function') {
          existing.instance.onParams(params);
        }
        return existing.id;
      }
    }

    const layer = document.getElementById('windows-layer');
    const vw = window.innerWidth;
    const vh = window.innerHeight - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-height') || '40', 10);

    const w = Math.min(app.width || 820, vw - 24);
    const h = Math.min(app.height || 540, vh - 24);
    const cascadeOffset = ((this.winSeq - 1) % 8) * 28;
    const x = Math.max(12, Math.min(vw - w - 12, Math.round((vw - w) / 2) - 60 + cascadeOffset));
    const y = Math.max(12, Math.min(vh - h - 12, Math.round((vh - h) / 2) - 50 + cascadeOffset));

    const id = 'win_' + this.winSeq++;
    const el = document.createElement('div');
    el.className = 'win10-window' + (app.frameless ? ' uwp-frameless' : '');
    el.id = id;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.minWidth = (app.minWidth || 300) + 'px';
    el.style.minHeight = (app.minHeight || 200) + 'px';

    const iconSvg = APP_ICONS[app.icon] || APP_ICONS.explorer;
    el.innerHTML = `
      <div class="win-titlebar">
        <div class="win-titlebar-left">
          <span class="win-titlebar-icon">${iconSvg}</span>
          <span class="win-titlebar-text">${app.name}</span>
        </div>
        <div class="win-controls">
          <button class="win-ctrl-btn min" title="Minimize">${GLYPHS.minimize}</button>
          ${app.noMaximize ? '' : `<button class="win-ctrl-btn max" title="Maximize">${GLYPHS.maximize}</button>`}
          <button class="win-ctrl-btn close" title="Close">${GLYPHS.close}</button>
        </div>
      </div>
      <div class="win-body"></div>
      ${app.noResize ? '' : `
        <div class="win-resize n" data-dir="n"></div>
        <div class="win-resize s" data-dir="s"></div>
        <div class="win-resize e" data-dir="e"></div>
        <div class="win-resize w" data-dir="w"></div>
        <div class="win-resize ne" data-dir="ne"></div>
        <div class="win-resize nw" data-dir="nw"></div>
        <div class="win-resize se" data-dir="se"></div>
        <div class="win-resize sw" data-dir="sw"></div>
      `}
    `;

    layer.appendChild(el);

    const winObj = {
      id,
      appId,
      title: app.name,
      icon: app.icon,
      el,
      bodyEl: el.querySelector('.win-body'),
      titleEl: el.querySelector('.win-titlebar-text'),
      maxBtn: el.querySelector('.win-ctrl-btn.max'),
      desktopId: this.currentDesktop,
      minimized: false,
      maximized: false,
      snapped: null,
      rect: { x, y, w, h },
      restoreRect: { x, y, w, h },
      zIndex: ++this.zCounter,
      onBeforeClose: null,
      onDestroy: null,
      instance: null
    };

    this.windows.set(id, winObj);
    this._bindWindowEvents(winObj, app);

    // Mount App
    const api = {
      winId: id,
      setTitle: (t) => this.setTitle(id, t),
      close: () => this.close(id, true),
      openApp: (aid, p) => this.openApp(aid, p),
      setBeforeClose: (fn) => { winObj.onBeforeClose = fn; },
      setOnDestroy: (fn) => { winObj.onDestroy = fn; }
    };
    winObj.instance = app.mount(winObj.bodyEl, params, api) || null;

    this.showDesktopRestoreIds = null;
    this.focus(id);
    this._emit();
    return id;
  }

  _bindWindowEvents(winObj, app) {
    const { el, id } = winObj;

    el.addEventListener('pointerdown', () => {
      this.focus(id);
    });

    // Caption Buttons
    el.querySelector('.win-ctrl-btn.min').addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimize(id);
    });
    if (winObj.maxBtn) {
      winObj.maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMaximize(id);
      });
    }
    el.querySelector('.win-ctrl-btn.close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.close(id);
    });

    // Titlebar Drag + Aero Snap + Double-click Maximize
    const titlebar = el.querySelector('.win-titlebar');
    titlebar.addEventListener('dblclick', (e) => {
      if (e.target.closest('.win-controls') || app.noMaximize) return;
      this.toggleMaximize(id);
    });

    titlebar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.win-controls')) return;
      e.preventDefault();
      this.focus(id);

      let startX = e.clientX;
      let startY = e.clientY;
      let origX = el.offsetLeft;
      let origY = el.offsetTop;
      let dragged = false;
      let snapZone = null;
      const snapEl = document.getElementById('snap-preview');

      const getSnapZone = (cx, cy) => {
        if (app.noMaximize || app.noResize) return null;
        const vw = window.innerWidth;
        const vh = window.innerHeight - this._tbHeight();
        const edge = 12;
        const corner = 72;
        if (cy <= edge) {
          if (cx <= corner) return 'tl';
          if (cx >= vw - corner) return 'tr';
          return 'max';
        }
        if (cx <= edge) {
          if (cy <= corner) return 'tl';
          if (cy >= vh - corner) return 'bl';
          return 'left';
        }
        if (cx >= vw - edge) {
          if (cy <= corner) return 'tr';
          if (cy >= vh - corner) return 'br';
          return 'right';
        }
        return null;
      };

      const showSnapPreview = (zone) => {
        if (!zone) {
          snapEl.classList.add('hidden');
          return;
        }
        const rect = this._getSnapRect(zone);
        snapEl.style.left = rect.x + 'px';
        snapEl.style.top = rect.y + 'px';
        snapEl.style.width = rect.w + 'px';
        snapEl.style.height = rect.h + 'px';
        snapEl.classList.remove('hidden');
      };

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragged && Math.hypot(dx, dy) < 4) return;
        dragged = true;
        el.classList.add('no-transition');

        // Pull down from maximized or snapped
        if (winObj.maximized || winObj.snapped) {
          const ratio = ev.clientX / window.innerWidth;
          winObj.maximized = false;
          winObj.snapped = null;
          el.classList.remove('maximized', 'snapped');
          if (winObj.maxBtn) {
            winObj.maxBtn.innerHTML = GLYPHS.maximize;
            winObj.maxBtn.title = 'Maximize';
          }
          const rw = winObj.restoreRect.w;
          const rh = winObj.restoreRect.h;
          el.style.width = rw + 'px';
          el.style.height = rh + 'px';
          origX = Math.max(0, Math.min(window.innerWidth - rw, Math.round(ev.clientX - rw * ratio)));
          origY = Math.max(0, ev.clientY - 16);
          startX = ev.clientX;
          startY = ev.clientY;
        }

        const nx = origX + (ev.clientX - startX);
        const ny = Math.max(0, Math.min(window.innerHeight - this._tbHeight() - 32, origY + (ev.clientY - startY)));
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
        winObj.rect.x = nx;
        winObj.rect.y = ny;

        snapZone = getSnapZone(ev.clientX, ev.clientY);
        showSnapPreview(snapZone);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        el.classList.remove('no-transition');
        snapEl.classList.add('hidden');
        if (dragged) {
          if (snapZone === 'max') {
            this.maximize(id);
          } else if (snapZone) {
            this.snap(id, snapZone);
          } else {
            winObj.restoreRect = {
              x: el.offsetLeft,
              y: el.offsetTop,
              w: el.offsetWidth,
              h: el.offsetHeight
            };
          }
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    // 8-Way Resize Handles
    el.querySelectorAll('.win-resize').forEach(handle => {
      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || winObj.maximized) return;
        e.preventDefault();
        e.stopPropagation();
        this.focus(id);

        const dir = handle.dataset.dir;
        const startX = e.clientX;
        const startY = e.clientY;
        const startRect = {
          x: el.offsetLeft,
          y: el.offsetTop,
          w: el.offsetWidth,
          h: el.offsetHeight
        };
        const minW = parseInt(el.style.minWidth, 10) || 280;
        const minH = parseInt(el.style.minHeight, 10) || 180;

        el.classList.add('no-transition');
        winObj.snapped = null;
        el.classList.remove('snapped');

        const onMove = (ev) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          let { x, y, w, h } = startRect;

          if (dir.includes('e')) w = Math.max(minW, startRect.w + dx);
          if (dir.includes('s')) h = Math.max(minH, startRect.h + dy);
          if (dir.includes('w')) {
            const nw = Math.max(minW, startRect.w - dx);
            x = startRect.x + (startRect.w - nw);
            w = nw;
          }
          if (dir.includes('n')) {
            const nh = Math.max(minH, startRect.h - dy);
            y = Math.max(0, startRect.y + (startRect.h - nh));
            h = startRect.y + startRect.h - y;
          }

          el.style.left = x + 'px';
          el.style.top = y + 'px';
          el.style.width = w + 'px';
          el.style.height = h + 'px';
          winObj.rect = { x, y, w, h };
          winObj.restoreRect = { x, y, w, h };
        };

        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          el.classList.remove('no-transition');
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
    });
  }

  _tbHeight() {
    return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--taskbar-height') || '40', 10);
  }

  _getSnapRect(zone) {
    const vw = window.innerWidth;
    const vh = window.innerHeight - this._tbHeight();
    const hw = Math.floor(vw / 2);
    const hh = Math.floor(vh / 2);
    switch (zone) {
      case 'left':  return { x: 0, y: 0, w: hw, h: vh };
      case 'right': return { x: hw, y: 0, w: vw - hw, h: vh };
      case 'tl':    return { x: 0, y: 0, w: hw, h: hh };
      case 'tr':    return { x: hw, y: 0, w: vw - hw, h: hh };
      case 'bl':    return { x: 0, y: hh, w: hw, h: vh - hh };
      case 'br':    return { x: hw, y: hh, w: vw - hw, h: vh - hh };
      case 'max':
      default:      return { x: 0, y: 0, w: vw, h: vh };
    }
  }

  snap(id, zone) {
    const w = this.windows.get(id);
    if (!w) return;
    if (!w.maximized && !w.snapped) {
      w.restoreRect = { x: w.el.offsetLeft, y: w.el.offsetTop, w: w.el.offsetWidth, h: w.el.offsetHeight };
    }
    w.maximized = false;
    w.snapped = zone;
    w.el.classList.remove('maximized');
    w.el.classList.add('snapped');
    const r = this._getSnapRect(zone);
    w.el.style.left = r.x + 'px';
    w.el.style.top = r.y + 'px';
    w.el.style.width = r.w + 'px';
    w.el.style.height = r.h + 'px';
    w.rect = { ...r };
    if (w.maxBtn) {
      w.maxBtn.innerHTML = GLYPHS.maximize;
      w.maxBtn.title = 'Maximize';
    }
    this._emit();
  }

  setTitle(id, title) {
    const w = this.windows.get(id);
    if (!w) return;
    w.title = title;
    w.titleEl.textContent = title;
    this._emit();
  }

  focus(id) {
    const w = this.windows.get(id);
    if (!w) return;
    if (w.desktopId !== this.currentDesktop) {
      this.switchDesktop(w.desktopId);
    }
    if (w.minimized) {
      w.minimized = false;
      w.el.classList.remove('minimized');
    }
    this.windows.forEach(win => win.el.classList.remove('focused'));
    w.zIndex = ++this.zCounter;
    w.el.style.zIndex = w.zIndex;
    w.el.classList.add('focused');
    this.activeId = id;
    this._emit();
  }

  blurAll() {
    this.windows.forEach(win => win.el.classList.remove('focused'));
    this.activeId = null;
    this._emit();
  }

  minimize(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.minimized = true;
    w.el.classList.add('minimized');
    w.el.classList.remove('focused');
    if (this.activeId === id) {
      this.activeId = null;
      this._focusTopVisible();
    }
    this._emit();
  }

  restore(id) {
    const w = this.windows.get(id);
    if (!w) return;
    if (w.minimized) {
      w.minimized = false;
      w.el.classList.remove('minimized');
    } else if (w.maximized || w.snapped) {
      w.maximized = false;
      w.snapped = null;
      w.el.classList.remove('maximized', 'snapped');
      const r = w.restoreRect;
      w.el.style.left = r.x + 'px';
      w.el.style.top = r.y + 'px';
      w.el.style.width = r.w + 'px';
      w.el.style.height = r.h + 'px';
      if (w.maxBtn) {
        w.maxBtn.innerHTML = GLYPHS.maximize;
        w.maxBtn.title = 'Maximize';
      }
    }
    this.focus(id);
    this._emit();
  }

  maximize(id) {
    const w = this.windows.get(id);
    if (!w || !w.maxBtn) return;
    if (!w.maximized && !w.snapped) {
      w.restoreRect = { x: w.el.offsetLeft, y: w.el.offsetTop, w: w.el.offsetWidth, h: w.el.offsetHeight };
    }
    w.maximized = true;
    w.snapped = null;
    w.el.classList.remove('snapped');
    w.el.classList.add('maximized');
    w.maxBtn.innerHTML = GLYPHS.restore;
    w.maxBtn.title = 'Restore Down';
    this.focus(id);
    this._emit();
  }

  toggleMaximize(id) {
    const w = this.windows.get(id);
    if (!w) return;
    if (w.maximized) this.restore(id);
    else this.maximize(id);
  }

  close(id, force = false) {
    const w = this.windows.get(id);
    if (!w) return;
    if (!force && typeof w.onBeforeClose === 'function') {
      const allow = w.onBeforeClose();
      if (allow === false) return;
    }
    if (typeof w.onDestroy === 'function') {
      try { w.onDestroy(); } catch {}
    }
    w.el.remove();
    this.windows.delete(id);
    if (this.activeId === id) {
      this.activeId = null;
      this._focusTopVisible();
    }
    this._emit();
  }

  closeByApp(appId) {
    Array.from(this.windows.values())
      .filter(w => w.appId === appId && w.desktopId === this.currentDesktop)
      .forEach(w => this.close(w.id));
  }

  _focusTopVisible() {
    const visible = this.getDesktopWindows().filter(w => !w.minimized);
    if (!visible.length) return;
    visible.sort((a, b) => b.zIndex - a.zIndex);
    this.focus(visible[0].id);
  }

  getDesktopWindows(desktopId = this.currentDesktop) {
    return Array.from(this.windows.values()).filter(w => w.desktopId === desktopId);
  }

  getAllWindows() {
    return Array.from(this.windows.values());
  }

  // Show Desktop Toggle (Win+D or bottom-right sliver)
  toggleShowDesktop() {
    const wins = this.getDesktopWindows();
    const visible = wins.filter(w => !w.minimized);
    if (visible.length > 0) {
      this.showDesktopRestoreIds = visible.map(w => w.id);
      visible.forEach(w => {
        w.minimized = true;
        w.el.classList.add('minimized');
        w.el.classList.remove('focused');
      });
      this.activeId = null;
    } else if (this.showDesktopRestoreIds) {
      this.showDesktopRestoreIds.forEach(id => {
        const w = this.windows.get(id);
        if (w && w.desktopId === this.currentDesktop) {
          w.minimized = false;
          w.el.classList.remove('minimized');
        }
      });
      this.showDesktopRestoreIds = null;
      this._focusTopVisible();
    }
    this._emit();
  }

  // Taskbar Window Arrangements
  cascadeWindows() {
    const wins = this.getDesktopWindows().filter(w => !w.minimized);
    wins.forEach((w, i) => {
      w.maximized = false;
      w.snapped = null;
      w.el.classList.remove('maximized', 'snapped');
      w.el.style.left = (32 + i * 32) + 'px';
      w.el.style.top = (32 + i * 32) + 'px';
      w.el.style.width = '760px';
      w.el.style.height = '480px';
      this.focus(w.id);
    });
  }

  sideBySideWindows() {
    const wins = this.getDesktopWindows().filter(w => !w.minimized);
    if (!wins.length) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight - this._tbHeight();
    const eachW = Math.floor(vw / wins.length);
    wins.forEach((w, i) => {
      w.maximized = false;
      w.snapped = null;
      w.el.classList.remove('maximized', 'snapped');
      w.el.style.left = (i * eachW) + 'px';
      w.el.style.top = '0px';
      w.el.style.width = eachW + 'px';
      w.el.style.height = vh + 'px';
    });
  }

  stackedWindows() {
    const wins = this.getDesktopWindows().filter(w => !w.minimized);
    if (!wins.length) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight - this._tbHeight();
    const eachH = Math.floor(vh / wins.length);
    wins.forEach((w, i) => {
      w.maximized = false;
      w.snapped = null;
      w.el.classList.remove('maximized', 'snapped');
      w.el.style.left = '0px';
      w.el.style.top = (i * eachH) + 'px';
      w.el.style.width = vw + 'px';
      w.el.style.height = eachH + 'px';
    });
  }

  // Virtual Desktops
  createDesktop() {
    this.desktopSeq++;
    const d = { id: this.desktopSeq, name: `Desktop ${this.desktops.length + 1}` };
    this.desktops.push(d);
    this._emit();
    return d;
  }

  switchDesktop(desktopId) {
    if (!this.desktops.some(d => d.id === desktopId)) return;
    this.currentDesktop = desktopId;
    this.windows.forEach(w => {
      const onThis = w.desktopId === desktopId;
      w.el.style.display = onThis ? '' : 'none';
    });
    this.activeId = null;
    this._focusTopVisible();
    this._emit();
  }

  closeDesktop(desktopId) {
    if (this.desktops.length <= 1) return;
    const idx = this.desktops.findIndex(d => d.id === desktopId);
    if (idx === -1) return;
    const fallback = this.desktops[Math.max(0, idx - 1)].id === desktopId
      ? this.desktops[idx + 1].id
      : this.desktops[Math.max(0, idx - 1)].id;
    // Move windows from closed desktop to fallback
    this.windows.forEach(w => {
      if (w.desktopId === desktopId) w.desktopId = fallback;
    });
    this.desktops.splice(idx, 1);
    this.desktops.forEach((d, i) => { d.name = `Desktop ${i + 1}`; });
    this.switchDesktop(this.currentDesktop === desktopId ? fallback : this.currentDesktop);
  }
}

export const WM = new WindowManager();
