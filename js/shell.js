/* ==========================================================================
   Windows 10 Shell Controller:
   Boot, Lock/Login, Desktop Icons & Marquee, Taskbar & Previews, Start Menu
   & Live Tiles, Search, Action Center, Flyouts, Task View, Alt+Tab, Win+X,
   Context Menus, Run Dialog, Winver, Properties, Power & BSOD
   ========================================================================== */

import { State } from './state.js';
import { VFS } from './vfs.js';
import { WM } from './wm.js';
import { GLYPHS, APP_ICONS, hydrateGlyphs } from './icons.js';
import { Sound } from './sound.js';

const WIFI_NETWORKS = [
  { ssid: 'HomeWiFi-5G', secured: true, bars: 4 },
  { ssid: 'Office_Guest', secured: true, bars: 3 },
  { ssid: 'CoffeeShop_Free', secured: false, bars: 2 },
  { ssid: 'iPhone Hotspot', secured: true, bars: 3 }
];

const POWER_MODES = ['Best battery life', 'Better battery', 'Better performance', 'Best performance'];

export class Windows10Shell {
  constructor() {
    this.selectedDesktopIds = new Set();
    this.searchFilter = 'all';
    this.calViewDate = new Date();
    this.calSelectedDate = new Date();
    this.selectedWifi = State.get().connectedWifi;
    this.altTabActive = false;
    this.altTabIdx = 0;
    this.acCollapsed = false;
    this.previewHideTimer = null;
  }

  init() {
    hydrateGlyphs(document);
    State.applyVisuals();
    this._setupStaticIcons();
    this._setupBootAndLock();
    this._setupDesktop();
    this._setupTaskbar();
    this._setupStartMenu();
    this._setupSearch();
    this._setupActionCenter();
    this._setupFlyouts();
    this._setupTaskView();
    this._setupGlobalDismiss();
    this._startClockLoop();

    // Reactive updates
    State.subscribe(() => {
      this.renderTaskbarApps();
      this.renderDesktopIcons();
      this.renderStartTiles();
      this.renderActionCenter();
      this.syncTrayState();
      this.syncUserDisplays();
    });
    VFS.subscribe(() => {
      this.renderDesktopIcons();
    });
    WM.subscribe(() => {
      this.renderTaskbarApps();
      if (!document.getElementById('task-view-overlay').classList.contains('hidden')) {
        this.renderTaskView();
      }
    });

    this.renderDesktopIcons();
    this.renderStartApps();
    this.renderStartTiles();
    this.renderTaskbarApps();
    this.renderActionCenter();
    this.syncTrayState();
    this.syncUserDisplays();
  }

  _setupStaticIcons() {
    document.getElementById('login-avatar').innerHTML = APP_ICONS.userAvatar;
    document.getElementById('start-rail-avatar').innerHTML = APP_ICONS.userAvatar;
    document.querySelectorAll('.acct-mini-avatar').forEach(el => el.innerHTML = APP_ICONS.userAvatar);
    document.getElementById('login-net-btn').innerHTML = GLYPHS.wifi;
    document.getElementById('login-ease-btn').innerHTML = GLYPHS.ease;
    document.getElementById('login-power-btn').innerHTML = GLYPHS.power;
    document.getElementById('lock-status-icons').innerHTML = GLYPHS.wifi + GLYPHS.battery;

    const overflowBtns = document.querySelectorAll('.overflow-tray-item');
    const overflowGlyphs = [GLYPHS.shield, GLYPHS.bluetooth, GLYPHS.cloud, GLYPHS.usb];
    overflowBtns.forEach((b, i) => {
      b.innerHTML = overflowGlyphs[i];
      b.addEventListener('click', () => {
        const [title, body] = b.dataset.toast.split('|');
        this.closeAllPopups();
        this.notify(title, body);
      });
    });
  }

  syncUserDisplays() {
    const s = State.get();
    document.getElementById('login-username').textContent = s.username;
    document.getElementById('start-rail-username').textContent = s.username;
    document.querySelectorAll('.acct-mini-name').forEach(el => el.textContent = s.username);
  }

  /* ========================================================================
     BOOT, LOCK, LOGIN, POWER & BSOD
     ======================================================================== */
  _setupBootAndLock() {
    const bootEl = document.getElementById('boot-screen');
    const lockCont = document.getElementById('lock-container');
    const curtain = document.getElementById('lock-curtain');
    const signInBtn = document.getElementById('login-signin-btn');
    const pinRow = document.getElementById('login-pin-row');
    const pinInput = document.getElementById('login-pin-input');
    const pinSubmit = document.getElementById('login-pin-submit');
    const pinErr = document.getElementById('login-pin-error');
    const pinHint = document.getElementById('login-pin-hint');
    const welcomeEl = document.getElementById('login-welcome');

    let bootDone = false;
    const finishBoot = () => {
      if (bootDone) return;
      bootDone = true;
      bootEl.classList.add('fade-out');
      this.lock(true);
      setTimeout(() => {
        bootEl.classList.remove('active', 'fade-out');
      }, 420);
    };

    const bootTimer = setTimeout(finishBoot, 1650);
    bootEl.addEventListener('click', () => { clearTimeout(bootTimer); finishBoot(); });
    window.addEventListener('keydown', (e) => {
      if (bootEl.classList.contains('active')) { clearTimeout(bootTimer); finishBoot(); }
      else if (lockCont.classList.contains('active')) {
        if (!curtain.classList.contains('dismissed')) {
          dismissCurtain();
        } else if (e.key === 'Escape') {
          curtain.classList.remove('dismissed');
        } else if (e.key === 'Enter' && !State.get().pin && welcomeEl.classList.contains('hidden')) {
          completeLogin();
        }
      }
    });

    const dismissCurtain = () => {
      curtain.classList.add('dismissed');
      const pin = State.get().pin;
      if (pin) {
        signInBtn.classList.add('hidden');
        pinRow.classList.remove('hidden');
        pinErr.textContent = '';
        pinHint.textContent = 'Enter your Windows Hello PIN';
        pinInput.value = '';
        setTimeout(() => pinInput.focus(), 200);
      } else {
        pinRow.classList.add('hidden');
        signInBtn.classList.remove('hidden');
      }
    };

    curtain.addEventListener('click', dismissCurtain);

    // Swipe up on lock screen
    let swipeStartY = null;
    curtain.addEventListener('pointerdown', (e) => { swipeStartY = e.clientY; });
    curtain.addEventListener('pointerup', (e) => {
      if (swipeStartY !== null && swipeStartY - e.clientY > 40) dismissCurtain();
      swipeStartY = null;
    });

    const completeLogin = () => {
      signInBtn.classList.add('hidden');
      pinRow.classList.add('hidden');
      welcomeEl.classList.remove('hidden');
      Sound.startup();
      setTimeout(() => {
        lockCont.style.opacity = '0';
        setTimeout(() => {
          lockCont.classList.remove('active');
          lockCont.style.opacity = '';
          welcomeEl.classList.add('hidden');
          if (!this._welcomed) {
            this._welcomed = true;
            this.notify('Windows 10', 'Welcome back! Try Start Menu, File Explorer, Settings, or press Alt+R for Run.');
          }
        }, 320);
      }, 650);
    };

    signInBtn.addEventListener('click', completeLogin);

    const tryPin = () => {
      if (pinInput.value === State.get().pin) completeLogin();
      else {
        Sound.error();
        pinErr.textContent = 'The PIN is incorrect. Try again.';
        pinInput.value = '';
        pinInput.focus();
      }
    };
    pinSubmit.addEventListener('click', tryPin);
    pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryPin(); });

    // Login screen power button
    const lpBtn = document.getElementById('login-power-btn');
    const lpMenu = document.getElementById('login-power-menu');
    lpBtn.addEventListener('click', (e) => { e.stopPropagation(); lpMenu.classList.toggle('hidden'); });
    lpMenu.querySelectorAll('[data-power]').forEach(b => {
      b.addEventListener('click', () => { lpMenu.classList.add('hidden'); this.powerAction(b.dataset.power); });
    });
  }

  lock(instant = false) {
    this.closeAllPopups();
    const lockCont = document.getElementById('lock-container');
    const curtain = document.getElementById('lock-curtain');
    curtain.classList.remove('dismissed');
    document.getElementById('login-welcome').classList.add('hidden');
    lockCont.classList.add('active');
    if (!instant) Sound.notify();
  }

  powerAction(action) {
    this.closeAllPopups();
    if (action === 'sleep') {
      this.lock();
      return;
    }
    const ps = document.getElementById('power-screen');
    const txt = document.getElementById('power-screen-text');
    txt.textContent = action === 'restart' ? 'Restarting' : 'Shutting down';
    ps.classList.add('active');

    setTimeout(() => {
      if (action === 'restart') {
        ps.classList.remove('active');
        // Show boot screen briefly then lock
        const bootEl = document.getElementById('boot-screen');
        bootEl.classList.add('active');
        setTimeout(() => {
          bootEl.classList.remove('active');
          this.lock(true);
        }, 1600);
      } else {
        // Powered off black screen — click anywhere to power back on
        ps.style.background = '#000000';
        ps.innerHTML = `<div style="color:rgba(255,255,255,0.45);text-align:center;cursor:pointer;">
          <div style="font-size:48px;margin-bottom:14px;">⏻</div>
          <div style="font-size:15px;">PC is turned off. Click anywhere to power on.</div>
        </div>`;
        const powerOn = () => {
          ps.removeEventListener('click', powerOn);
          ps.classList.remove('active');
          ps.style.background = '';
          ps.innerHTML = `<div class="power-screen-content"><div class="win10-spinner power-spinner"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div><div id="power-screen-text" class="power-screen-text">Shutting down</div></div>`;
          const bootEl = document.getElementById('boot-screen');
          bootEl.classList.add('active');
          setTimeout(() => {
            bootEl.classList.remove('active');
            this.lock(true);
          }, 1500);
        };
        ps.addEventListener('click', powerOn);
      }
    }, 1800);
  }

  triggerBSOD(stopCode = 'CRITICAL_PROCESS_DIED') {
    this.closeAllPopups();
    Sound.error();
    const bsod = document.getElementById('bsod-screen');
    const pctEl = document.getElementById('bsod-pct');
    document.getElementById('bsod-code').textContent = stopCode;
    bsod.classList.add('active');
    let pct = 0;
    pctEl.textContent = '0';
    const iv = setInterval(() => {
      pct = Math.min(100, pct + Math.floor(8 + Math.random() * 18));
      pctEl.textContent = String(pct);
      if (pct >= 100) {
        clearInterval(iv);
        setTimeout(() => {
          bsod.classList.remove('active');
          this.lock(true);
        }, 900);
      }
    }, 340);
  }

  /* ========================================================================
     DESKTOP ICONS, MARQUEE SELECTION, DRAG & CONTEXT MENUS
     ======================================================================== */
  _getDesktopEntries() {
    const rbFull = VFS.getRecycleBin().length > 0;
    const builtins = [
      { id: 'sys:thispc', name: 'This PC', icon: APP_ICONS.thispc, open: () => WM.openApp('explorer', { path: 'This PC' }) },
      { id: 'sys:recycle', name: 'Recycle Bin', icon: rbFull ? APP_ICONS.recycleFull : APP_ICONS.recycleEmpty, open: () => WM.openApp('explorer', { path: 'Recycle Bin' }) },
      { id: 'app:edge', name: 'Microsoft Edge', icon: APP_ICONS.edge, open: () => WM.openApp('edge') },
      { id: 'app:notepad', name: 'Notepad', icon: APP_ICONS.notepad, open: () => WM.openApp('notepad') },
      { id: 'app:calculator', name: 'Calculator', icon: APP_ICONS.calculator, open: () => WM.openApp('calculator') },
      { id: 'app:paint', name: 'Paint', icon: APP_ICONS.paint, open: () => WM.openApp('paint') },
      { id: 'app:cmd', name: 'Command Prompt', icon: APP_ICONS.cmd, open: () => WM.openApp('cmd') },
      { id: 'app:settings', name: 'Settings', icon: APP_ICONS.settings, open: () => WM.openApp('settings') }
    ];

    const vfsItems = VFS.listDir('C:\\Users\\User\\Desktop').map(it => ({
      id: 'vfs:' + it.path,
      name: it.name,
      vfsPath: it.path,
      icon: it.type === 'folder' ? APP_ICONS.folder
        : ['jpg', 'jpeg', 'png', 'bmp'].includes(it.ext) ? APP_ICONS.imagefile
        : APP_ICONS.textfile,
      open: () => {
        if (it.type === 'folder') WM.openApp('explorer', { path: it.path });
        else if (['jpg', 'jpeg', 'png', 'bmp'].includes(it.ext)) WM.openApp('photos', { filePath: it.path });
        else WM.openApp('notepad', { filePath: it.path });
      }
    }));

    return [...builtins, ...vfsItems];
  }

  renderDesktopIcons() {
    const s = State.get();
    const cont = document.getElementById('desktop-icons');
    cont.className = `desktop-icons size-${s.desktopIconSize}` + (s.desktopShowIcons ? '' : ' hidden-icons');
    cont.innerHTML = '';

    const cellW = s.desktopIconSize === 'small' ? 74 : s.desktopIconSize === 'large' ? 104 : 84;
    const cellH = s.desktopIconSize === 'small' ? 76 : s.desktopIconSize === 'large' ? 112 : 94;
    const areaH = Math.max(200, cont.clientHeight - 12);
    const maxRows = Math.max(1, Math.floor(areaH / cellH));

    const entries = this._getDesktopEntries();
    entries.forEach((ent, idx) => {
      const col = Math.floor(idx / maxRows);
      const row = idx % maxRows;
      const savedPos = !s.desktopAutoArrange && s.desktopIconPositions[ent.id];
      const left = savedPos ? savedPos.x : (8 + col * cellW);
      const top = savedPos ? savedPos.y : (8 + row * cellH);

      const el = document.createElement('div');
      el.className = 'desktop-icon' + (this.selectedDesktopIds.has(ent.id) ? ' selected' : '');
      el.dataset.id = ent.id;
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.innerHTML = `
        <div class="desktop-icon-img">${ent.icon}</div>
        <div class="desktop-icon-label">${ent.name}</div>
      `;

      // Click / Double-click / Drag
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        this.closeAllPopups();
        WM.blurAll();

        if (!e.ctrlKey && !this.selectedDesktopIds.has(ent.id)) {
          this.selectedDesktopIds.clear();
        }
        this.selectedDesktopIds.add(ent.id);
        this._syncDesktopSelectionUI();

        // Drag icon if auto-arrange is off
        const sx = e.clientX, sy = e.clientY;
        const ox = el.offsetLeft, oy = el.offsetTop;
        let moved = false;

        const onMove = (ev) => {
          if (State.get().desktopAutoArrange) return;
          if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
          moved = true;
          el.classList.add('dragging');
          el.style.left = Math.max(4, ox + (ev.clientX - sx)) + 'px';
          el.style.top = Math.max(4, oy + (ev.clientY - sy)) + 'px';
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          el.classList.remove('dragging');
          if (moved) {
            let fx = el.offsetLeft, fy = el.offsetTop;
            if (State.get().desktopAlignGrid) {
              fx = 8 + Math.round((fx - 8) / cellW) * cellW;
              fy = 8 + Math.round((fy - 8) / cellH) * cellH;
            }
            const posMap = { ...State.get().desktopIconPositions, [ent.id]: { x: Math.max(8, fx), y: Math.max(8, fy) } };
            State.update({ desktopIconPositions: posMap });
          }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });

      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        ent.open();
      });

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectedDesktopIds.clear();
        this.selectedDesktopIds.add(ent.id);
        this._syncDesktopSelectionUI();

        const items = [{ label: 'Open', bold: true, action: () => ent.open() }];
        if (ent.id === 'sys:recycle') {
          items.push({ sep: true });
          items.push({
            label: 'Empty Recycle Bin',
            disabled: VFS.getRecycleBin().length === 0,
            action: () => { VFS.emptyRecycleBin(); Sound.recycle(); }
          });
        }
        if (ent.vfsPath) {
          items.push(
            { sep: true },
            { label: 'Cut', action: () => { State.clipboard = { type: 'vfs', path: ent.vfsPath, cut: true }; } },
            { label: 'Copy', action: () => { State.clipboard = { type: 'vfs', path: ent.vfsPath, cut: false }; } },
            { sep: true },
            { label: 'Delete', action: () => { VFS.deleteToRecycleBin(ent.vfsPath); Sound.recycle(); } },
            { label: 'Rename', action: () => this._startInlineRename(el, ent.vfsPath) },
            { sep: true },
            { label: 'Properties', action: () => this.showProperties(ent.vfsPath) }
          );
        }
        this.showContextMenu(e.clientX, e.clientY, items);
      });

      cont.appendChild(el);
    });
  }

  _startInlineRename(iconEl, vfsPath) {
    const labelEl = iconEl.querySelector('.desktop-icon-label');
    const oldName = labelEl.textContent;
    const input = document.createElement('input');
    input.className = 'desktop-rename-input';
    input.value = oldName;
    labelEl.replaceWith(input);
    input.focus();
    const dot = oldName.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 ? dot : oldName.length);

    let done = false;
    const commit = (save) => {
      if (done) return;
      done = true;
      if (save && input.value.trim() && input.value.trim() !== oldName) {
        VFS.rename(vfsPath, input.value.trim());
      } else {
        this.renderDesktopIcons();
      }
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') commit(true);
      if (e.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', () => commit(true));
  }

  _syncDesktopSelectionUI() {
    document.querySelectorAll('.desktop-icon').forEach(el => {
      el.classList.toggle('selected', this.selectedDesktopIds.has(el.dataset.id));
    });
  }

  _setupDesktop() {
    const area = document.getElementById('desktop-area');
    const marquee = document.getElementById('selection-marquee');

    // Marquee selection box
    area.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.desktop-icon')) return;
      this.closeAllPopups();
      WM.blurAll();
      this.selectedDesktopIds.clear();
      this._syncDesktopSelectionUI();

      const sx = e.clientX, sy = e.clientY;
      let active = false;

      const onMove = (ev) => {
        if (!active && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        active = true;
        marquee.classList.remove('hidden');
        const x = Math.min(sx, ev.clientX);
        const y = Math.min(sy, ev.clientY);
        const w = Math.abs(ev.clientX - sx);
        const h = Math.abs(ev.clientY - sy);
        marquee.style.left = x + 'px';
        marquee.style.top = y + 'px';
        marquee.style.width = w + 'px';
        marquee.style.height = h + 'px';

        this.selectedDesktopIds.clear();
        document.querySelectorAll('.desktop-icon').forEach(ic => {
          const r = ic.getBoundingClientRect();
          if (r.left < x + w && r.right > x && r.top < y + h && r.bottom > y) {
            this.selectedDesktopIds.add(ic.dataset.id);
          }
        });
        this._syncDesktopSelectionUI();
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        marquee.classList.add('hidden');
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    // Authentic Windows 10 Desktop Right-Click Context Menu
    area.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.desktop-icon')) return;
      e.preventDefault();
      const s = State.get();
      this.showContextMenu(e.clientX, e.clientY, [
        {
          label: 'View',
          submenu: [
            { label: 'Large icons', checked: s.desktopIconSize === 'large', action: () => State.update({ desktopIconSize: 'large' }) },
            { label: 'Medium icons', checked: s.desktopIconSize === 'medium', action: () => State.update({ desktopIconSize: 'medium' }) },
            { label: 'Small icons', checked: s.desktopIconSize === 'small', action: () => State.update({ desktopIconSize: 'small' }) },
            { sep: true },
            { label: 'Auto arrange icons', checked: s.desktopAutoArrange, action: () => State.update({ desktopAutoArrange: !s.desktopAutoArrange }) },
            { label: 'Align icons to grid', checked: s.desktopAlignGrid, action: () => State.update({ desktopAlignGrid: !s.desktopAlignGrid }) },
            { sep: true },
            { label: 'Show desktop icons', checked: s.desktopShowIcons, action: () => State.update({ desktopShowIcons: !s.desktopShowIcons }) }
          ]
        },
        {
          label: 'Sort by',
          submenu: [
            { label: 'Name', action: () => { State.update({ desktopIconPositions: {}, desktopAutoArrange: true }); } },
            { label: 'Item type', action: () => { State.update({ desktopIconPositions: {}, desktopAutoArrange: true }); } }
          ]
        },
        {
          label: 'Refresh',
          action: () => {
            const ic = document.getElementById('desktop-icons');
            ic.classList.remove('refreshing');
            void ic.offsetWidth;
            ic.classList.add('refreshing');
            this.renderDesktopIcons();
          }
        },
        { sep: true },
        {
          label: 'Paste',
          disabled: !(State.clipboard && State.clipboard.type === 'vfs'),
          action: () => {
            if (State.clipboard?.type === 'vfs') {
              VFS.copyNode(State.clipboard.path, 'C:\\Users\\User\\Desktop', State.clipboard.cut);
              if (State.clipboard.cut) State.clipboard = null;
            }
          }
        },
        { sep: true },
        {
          label: 'New',
          submenu: [
            {
              label: 'Folder',
              icon: APP_ICONS.folder,
              action: () => {
                const p = VFS.createFolder('C:\\Users\\User\\Desktop', 'New folder');
                setTimeout(() => {
                  const el = document.querySelector(`.desktop-icon[data-id="vfs:${CSS.escape(p)}"]`);
                  if (el) this._startInlineRename(el, p);
                }, 40);
              }
            },
            {
              label: 'Text Document',
              icon: APP_ICONS.textfile,
              action: () => {
                const p = VFS.createFileUnique('C:\\Users\\User\\Desktop', 'New Text Document.txt', '');
                setTimeout(() => {
                  const el = document.querySelector(`.desktop-icon[data-id="vfs:${CSS.escape(p)}"]`);
                  if (el) this._startInlineRename(el, p);
                }, 40);
              }
            }
          ]
        },
        { sep: true },
        { label: 'Open Command Prompt here', icon: APP_ICONS.cmd, action: () => WM.openApp('cmd', { cwd: 'C:\\Users\\User\\Desktop' }) },
        { sep: true },
        { label: 'Display settings', action: () => WM.openApp('settings', { category: 'system', page: 'display' }) },
        { label: 'Personalize', action: () => WM.openApp('settings', { category: 'personalization', page: 'background' }) }
      ]);
    });

    window.addEventListener('resize', () => this.renderDesktopIcons());
  }

  /* ========================================================================
     TASKBAR, THUMBNAIL PREVIEWS, WIN+X & CONTEXT MENU
     ======================================================================== */
  _setupTaskbar() {
    const startBtn = document.getElementById('tb-start-btn');
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sm = document.getElementById('start-menu');
      const wasOpen = !sm.classList.contains('hidden');
      this.closeAllPopups();
      if (!wasOpen) {
        sm.classList.remove('hidden');
        startBtn.classList.add('active');
        this.renderStartTiles();
      }
    });

    // Right-click Start button -> Authentic Win+X Power User Menu
    startBtn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showWinXMenu();
    });

    // Task View Button
    document.getElementById('tb-taskview-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleTaskView();
    });

    // Show Desktop Sliver
    document.getElementById('tb-show-desktop').addEventListener('click', () => {
      this.closeAllPopups();
      WM.toggleShowDesktop();
    });

    // Taskbar Right-Click Context Menu
    document.getElementById('taskbar').addEventListener('contextmenu', (e) => {
      if (e.target.closest('#tb-start-btn') || e.target.closest('.tb-app-item')) return;
      e.preventDefault();
      const s = State.get();
      this.showContextMenu(e.clientX, e.clientY, [
        {
          label: 'Search',
          submenu: [
            { label: 'Hidden', checked: s.searchMode === 'hidden', action: () => State.update({ searchMode: 'hidden' }) },
            { label: 'Show search icon', checked: s.searchMode === 'icon', action: () => State.update({ searchMode: 'icon' }) },
            { label: 'Show search box', checked: s.searchMode === 'box', action: () => State.update({ searchMode: 'box' }) }
          ]
        },
        { label: 'Show Task View button', checked: s.showTaskViewBtn, action: () => State.update({ showTaskViewBtn: !s.showTaskViewBtn }) },
        { sep: true },
        { label: 'Cascade windows', action: () => WM.cascadeWindows() },
        { label: 'Show windows stacked', action: () => WM.stackedWindows() },
        { label: 'Show windows side by side', action: () => WM.sideBySideWindows() },
        { label: 'Show the desktop', action: () => WM.toggleShowDesktop() },
        { sep: true },
        { label: 'Task Manager', action: () => WM.openApp('taskmgr') },
        { sep: true },
        { label: 'Lock the taskbar', checked: s.taskbarLock, action: () => State.update({ taskbarLock: !s.taskbarLock }) },
        { label: 'Taskbar settings', action: () => WM.openApp('settings', { category: 'personalization', page: 'taskbar' }) }
      ]);
    });

    // Taskbar preview hover retention
    const prev = document.getElementById('taskbar-preview');
    prev.addEventListener('pointerenter', () => clearTimeout(this.previewHideTimer));
    prev.addEventListener('pointerleave', () => {
      this.previewHideTimer = setTimeout(() => prev.classList.add('hidden'), 180);
    });
  }

  renderTaskbarApps() {
    const container = document.getElementById('tb-apps');
    const pinned = State.get().pinnedApps;
    const deskWins = WM.getDesktopWindows();

    // Build ordered unique app list: pinned + any open unpinned apps
    const orderedIds = [...pinned];
    deskWins.forEach(w => {
      if (!orderedIds.includes(w.appId)) orderedIds.push(w.appId);
    });

    container.innerHTML = '';
    orderedIds.forEach(appId => {
      const app = WM.getApp(appId);
      if (!app) return;
      const wins = deskWins.filter(w => w.appId === appId);
      const isRunning = wins.length > 0;
      const isFocused = wins.some(w => w.id === WM.activeId && !w.minimized);

      const btn = document.createElement('button');
      btn.className = 'tb-app-item' + (isRunning ? ' running' : '') + (isFocused ? ' focused' : '') + (wins.length > 1 ? ' multi' : '');
      btn.title = app.name;
      btn.innerHTML = `<span class="tb-app-icon">${APP_ICONS[app.icon] || ''}</span>`;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeAllPopups();
        if (!isRunning) {
          WM.openApp(appId);
        } else if (wins.length === 1) {
          const w = wins[0];
          if (w.id === WM.activeId && !w.minimized) WM.minimize(w.id);
          else WM.restore(w.id);
        } else {
          // Cycle or show preview
          this._showTaskbarPreview(btn, app, wins);
        }
      });

      btn.addEventListener('pointerenter', () => {
        if (wins.length > 0) {
          clearTimeout(this.previewHideTimer);
          this._showTaskbarPreview(btn, app, wins);
        }
      });
      btn.addEventListener('pointerleave', () => {
        this.previewHideTimer = setTimeout(() => {
          document.getElementById('taskbar-preview').classList.add('hidden');
        }, 200);
      });

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isPinned = pinned.includes(appId);
        const menu = [
          { label: app.name, icon: APP_ICONS[app.icon], bold: true, action: () => WM.openApp(appId) },
          {
            label: isPinned ? 'Unpin from taskbar' : 'Pin to taskbar',
            action: () => {
              const next = isPinned ? pinned.filter(x => x !== appId) : [...pinned, appId];
              State.update({ pinnedApps: next });
            }
          }
        ];
        if (isRunning) {
          menu.push({ sep: true });
          menu.push({ label: wins.length > 1 ? 'Close all windows' : 'Close window', action: () => WM.closeByApp(appId) });
        }
        this.showContextMenu(e.clientX, e.clientY, menu);
      });

      container.appendChild(btn);
    });
  }

  _showTaskbarPreview(anchorEl, app, wins) {
    const prev = document.getElementById('taskbar-preview');
    prev.innerHTML = wins.map(w => `
      <div class="tb-preview-card" data-pwid="${w.id}">
        <div class="tb-preview-hdr">
          <span class="tb-preview-icon">${APP_ICONS[app.icon] || ''}</span>
          <span class="tb-preview-title">${w.title}</span>
          <button class="tb-preview-close" data-pclose="${w.id}" title="Close">✕</button>
        </div>
        <div class="tb-preview-thumb">
          <div class="tb-preview-thumb-bar"></div>
          <div class="tb-preview-thumb-icon">${APP_ICONS[app.icon] || ''}</div>
          <div style="font-size:11px;opacity:.7;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${w.title}</div>
        </div>
      </div>
    `).join('');

    prev.classList.remove('hidden');
    const r = anchorEl.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - prev.offsetWidth - 8, r.left + r.width / 2 - prev.offsetWidth / 2));
    prev.style.left = left + 'px';

    prev.querySelectorAll('[data-pwid]').forEach(c => {
      c.addEventListener('click', (e) => {
        if (e.target.dataset.pclose) return;
        WM.restore(c.dataset.pwid);
        prev.classList.add('hidden');
      });
    });
    prev.querySelectorAll('[data-pclose]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        WM.close(b.dataset.pclose);
        prev.classList.add('hidden');
      });
    });
  }

  /* ========================================================================
     START MENU (Left Rail + A-Z Apps + Live Tiles)
     ======================================================================== */
  _setupStartMenu() {
    const rail = document.getElementById('start-rail');
    document.getElementById('start-rail-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      rail.classList.toggle('expanded');
    });

    document.querySelectorAll('[data-start-folder]').forEach(b => {
      b.addEventListener('click', () => {
        this.closeAllPopups();
        WM.openApp('explorer', { path: b.dataset.startFolder });
      });
    });
    document.querySelectorAll('[data-launch-app]').forEach(b => {
      b.addEventListener('click', () => {
        this.closeAllPopups();
        WM.openApp(b.dataset.launchApp);
      });
    });

    // Power Popup
    const pBtn = document.getElementById('start-power-btn');
    const pMenu = document.getElementById('start-power-menu');
    const uBtn = document.getElementById('start-user-btn');
    const uMenu = document.getElementById('start-user-menu');

    pBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      uMenu.classList.add('hidden');
      pMenu.classList.toggle('hidden');
    });
    pMenu.querySelectorAll('[data-power]').forEach(b => {
      b.addEventListener('click', () => this.powerAction(b.dataset.power));
    });

    uBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pMenu.classList.add('hidden');
      uMenu.classList.toggle('hidden');
    });
    uMenu.querySelectorAll('[data-user-action]').forEach(b => {
      b.addEventListener('click', () => {
        const act = b.dataset.userAction;
        this.closeAllPopups();
        if (act === 'account') WM.openApp('settings', { category: 'accounts', page: 'info' });
        else this.lock();
      });
    });
  }

  renderStartApps() {
    const list = document.getElementById('start-apps-list');
    const jump = document.getElementById('start-letter-jump');
    const apps = WM.getAllApps();

    const groups = new Map();
    apps.forEach(a => {
      const ch = a.name[0].toUpperCase();
      if (!groups.has(ch)) groups.set(ch, []);
      groups.get(ch).push(a);
    });

    list.innerHTML = '';
    for (const [letter, items] of groups) {
      const hdr = document.createElement('div');
      hdr.className = 'start-letter-hdr';
      hdr.id = `start-ltr-${letter}`;
      hdr.textContent = letter;
      hdr.addEventListener('click', (e) => {
        e.stopPropagation();
        jump.classList.remove('hidden');
      });
      list.appendChild(hdr);

      items.forEach(app => {
        const row = document.createElement('div');
        row.className = 'start-app-row';
        row.innerHTML = `
          <span class="start-app-icon">${APP_ICONS[app.icon] || ''}</span>
          <span class="start-app-name">${app.name}</span>
        `;
        row.addEventListener('click', () => {
          this.closeAllPopups();
          WM.openApp(app.id);
        });
        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const pinned = State.get().pinnedApps;
          const isPinned = pinned.includes(app.id);
          this.showContextMenu(e.clientX, e.clientY, [
            { label: 'Open', bold: true, action: () => { this.closeAllPopups(); WM.openApp(app.id); } },
            {
              label: 'Pin to Start',
              action: () => {
                const tiles = [...State.get().startTiles, { group: 'Productivity', appId: app.id, label: app.name, size: 'medium', color: State.get().accentColor }];
                State.update({ startTiles: tiles });
              }
            },
            {
              label: isPinned ? 'Unpin from taskbar' : 'Pin to taskbar',
              action: () => {
                State.update({ pinnedApps: isPinned ? pinned.filter(x => x !== app.id) : [...pinned, app.id] });
              }
            }
          ]);
        });
        list.appendChild(row);
      });
    }

    // Build A-Z Jump Overlay
    jump.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(ch =>
      `<button class="jump-letter-btn ${groups.has(ch) ? 'has-apps' : 'disabled'}" data-jump="${ch}">${ch}</button>`
    ).join('');
    jump.querySelectorAll('[data-jump]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        jump.classList.add('hidden');
        document.getElementById(`start-ltr-${b.dataset.jump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  renderStartTiles() {
    const col = document.getElementById('start-tiles-col');
    const tiles = State.get().startTiles;
    const groups = new Map();
    tiles.forEach((t, idx) => {
      if (!groups.has(t.group)) groups.set(t.group, []);
      groups.get(t.group).push({ ...t, _idx: idx });
    });

    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const dayNum = now.getDate();

    col.innerHTML = '';
    for (const [gName, items] of groups) {
      const grp = document.createElement('div');
      grp.className = 'tile-group';
      grp.innerHTML = `<div class="tile-group-title">${gName}</div><div class="tile-grid"></div>`;
      const grid = grp.querySelector('.tile-grid');

      items.forEach(t => {
        const tile = document.createElement('button');
        tile.className = `start-tile size-${t.size}`;
        tile.style.background = t.color || 'var(--accent)';

        if (t.live === 'calendar') {
          tile.innerHTML = `
            <div class="tile-live-cal">
              <span class="tile-live-cal-day">${dayName}</span>
              <span class="tile-live-cal-num">${dayNum}</span>
            </div>
            <span class="tile-label">Calendar</span>
          `;
        } else if (t.live === 'weather') {
          tile.innerHTML = `
            <div class="tile-live-weather">
              <div class="tile-weather-top">
                <span class="tile-weather-temp">72°</span>
                <span style="font-size:28px;">⛅</span>
              </div>
              <div class="tile-weather-desc">Partly Sunny · Seattle</div>
            </div>
          `;
        } else if (t.live === 'photos') {
          tile.innerHTML = `
            <div class="tile-live-photos" style="background-image:url('assets/wallpaper-alpine.jpg')">
              <span class="tile-label">Photos</span>
            </div>
          `;
        } else {
          const app = WM.getApp(t.appId);
          tile.innerHTML = `
            <span class="tile-icon">${APP_ICONS[app?.icon || t.appId] || ''}</span>
            <span class="tile-label">${t.label}</span>
          `;
        }

        tile.addEventListener('click', () => {
          this.closeAllPopups();
          if (t.appId === 'calendar-flyout') this._toggleFlyout('calendar-flyout', 'tray-clock-btn');
          else if (t.appId === 'weather-mock') WM.openApp('edge', { url: 'edge://welcome' });
          else WM.openApp(t.appId);
        });

        tile.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showContextMenu(e.clientX, e.clientY, [
            {
              label: 'Unpin from Start',
              action: () => {
                const next = State.get().startTiles.filter((_, i) => i !== t._idx);
                State.update({ startTiles: next });
              }
            },
            {
              label: 'Resize',
              submenu: ['small', 'medium', 'wide'].map(sz => ({
                label: sz[0].toUpperCase() + sz.slice(1),
                checked: t.size === sz,
                action: () => {
                  const next = State.get().startTiles.map((x, i) => i === t._idx ? { ...x, size: sz } : x);
                  State.update({ startTiles: next });
                }
              }))
            }
          ]);
        });

        grid.appendChild(tile);
      });

      col.appendChild(grp);
    }
  }

  /* ========================================================================
     SEARCH PANEL (Apps, VFS Files, Settings & Live Math)
     ======================================================================== */
  _setupSearch() {
    const input = document.getElementById('tb-search-input');
    const iconBtn = document.getElementById('tb-search-icon-btn');
    const panel = document.getElementById('search-panel');

    const openSearch = () => {
      const wasOpen = !panel.classList.contains('hidden');
      this.closeAllPopups();
      if (!wasOpen || input.value.trim()) {
        panel.classList.remove('hidden');
        this.renderSearch(input.value.trim());
      }
    };

    input.addEventListener('focus', () => {
      this.closeAllPopups();
      panel.classList.remove('hidden');
      this.renderSearch(input.value.trim());
    });
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('input', () => {
      if (panel.classList.contains('hidden')) {
        this.closeAllPopups();
        panel.classList.remove('hidden');
      }
      this.renderSearch(input.value.trim());
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const best = panel.querySelector('.search-result-row.best');
        if (best) best.click();
      } else if (e.key === 'Escape') {
        this.closeAllPopups();
        input.blur();
      }
    });

    iconBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSearch();
    });

    panel.querySelectorAll('.search-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        this.searchFilter = tab.dataset.filter;
        panel.querySelectorAll('.search-tab').forEach(x => x.classList.toggle('active', x === tab));
        this.renderSearch(input.value.trim());
      });
    });
  }

  renderSearch(query) {
    const body = document.getElementById('search-body');
    const apps = WM.getAllApps();

    if (!query) {
      const topIds = ['explorer', 'edge', 'notepad', 'calculator', 'settings', 'cmd', 'paint', 'taskmgr'];
      body.innerHTML = `
        <div class="search-section-title">Top apps</div>
        <div class="search-top-apps">
          ${topIds.map(id => {
            const a = WM.getApp(id);
            return a ? `
              <button class="search-top-card" data-sapp="${a.id}">
                <span class="icon">${APP_ICONS[a.icon] || ''}</span>
                <span class="label">${a.name}</span>
              </button>
            ` : '';
          }).join('')}
        </div>
        <div class="search-section-title">Quick searches</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          <button class="set-btn" data-sq="Personalization">Colors &amp; Themes</button>
          <button class="set-btn" data-sq="Welcome.txt">Welcome.txt</button>
          <button class="set-btn" data-sq="winver">About Windows (winver)</button>
        </div>
      `;
      body.querySelectorAll('[data-sapp]').forEach(b => b.addEventListener('click', () => {
        this.closeAllPopups();
        WM.openApp(b.dataset.sapp);
      }));
      body.querySelectorAll('[data-sq]').forEach(b => b.addEventListener('click', () => {
        const inp = document.getElementById('tb-search-input');
        inp.value = b.dataset.sq;
        this.renderSearch(b.dataset.sq);
      }));
      return;
    }

    const q = query.toLowerCase();
    const results = [];

    // Instant math answer!
    if (/^[\d\s+\-*/().]+$/.test(query) && /[+\-*/]/.test(query)) {
      try {
        const ans = Function(`"use strict"; return (${query})`)();
        if (Number.isFinite(ans)) {
          results.push({
            name: `= ${ans}`,
            type: 'Calculator quick result',
            icon: APP_ICONS.calculator,
            open: () => WM.openApp('calculator')
          });
        }
      } catch {}
    }

    if (this.searchFilter === 'all' || this.searchFilter === 'apps') {
      apps.filter(a => a.name.toLowerCase().includes(q) || a.id.includes(q)).forEach(a => {
        results.push({ name: a.name, type: 'App', icon: APP_ICONS[a.icon], open: () => WM.openApp(a.id) });
      });
      if ('winver'.includes(q) || 'about windows'.includes(q)) {
        results.push({ name: 'winver (About Windows)', type: 'Run command', icon: APP_ICONS.runIcon, open: () => this.showWinver() });
      }
    }

    if (this.searchFilter === 'all' || this.searchFilter === 'settings') {
      const sLinks = [
        { name: 'Background & Wallpaper', cat: 'personalization', page: 'background' },
        { name: 'Colors, Dark Mode & Accent', cat: 'personalization', page: 'colors' },
        { name: 'Display & Night Light', cat: 'system', page: 'display' },
        { name: 'Taskbar Settings', cat: 'personalization', page: 'taskbar' },
        { name: 'Sound Settings', cat: 'system', page: 'sound' },
        { name: 'Windows Update', cat: 'update', page: 'winupdate' }
      ];
      sLinks.filter(x => x.name.toLowerCase().includes(q)).forEach(x => {
        results.push({ name: x.name, type: 'System settings', icon: APP_ICONS.settings, open: () => WM.openApp('settings', { category: x.cat, page: x.page }) });
      });
    }

    if (this.searchFilter === 'all' || this.searchFilter === 'documents') {
      VFS.searchAll(q).slice(0, 8).forEach(f => {
        results.push({
          name: f.name,
          type: f.path,
          icon: f.type === 'folder' ? APP_ICONS.folder : (f.src ? APP_ICONS.imagefile : APP_ICONS.textfile),
          open: () => {
            if (f.type === 'folder') WM.openApp('explorer', { path: f.path });
            else if (f.src) WM.openApp('photos', { filePath: f.path });
            else WM.openApp('notepad', { filePath: f.path });
          }
        });
      });
    }

    if (!results.length) {
      body.innerHTML = `<div style="padding:20px;color:var(--shell-text-muted);">No results found for "${query}".</div>`;
      return;
    }

    const best = results[0];
    body.innerHTML = `
      <div class="search-results-split">
        <div>
          <div class="search-section-title">Best match</div>
          ${results.map((r, i) => `
            <div class="search-result-row ${i === 0 ? 'best' : ''}" data-ridx="${i}">
              <span class="search-result-icon">${r.icon || ''}</span>
              <span class="search-result-meta">
                <span class="search-result-name">${r.name}</span>
                <span class="search-result-type">${r.type}</span>
              </span>
            </div>
          `).join('')}
        </div>
        <div class="search-preview-pane">
          <div class="big-icon">${best.icon || ''}</div>
          <div style="font-size:17px;font-weight:400;">${best.name}</div>
          <div style="font-size:12px;color:var(--shell-text-muted);margin-bottom:8px;">${best.type}</div>
          <button class="search-preview-action" id="search-open-best">↗ Open</button>
        </div>
      </div>
    `;

    body.querySelectorAll('[data-ridx]').forEach(el => {
      el.addEventListener('click', () => {
        const act = results[+el.dataset.ridx].open;
        this.closeAllPopups();
        document.getElementById('tb-search-input').value = '';
        act();
      });
    });
    body.querySelector('#search-open-best')?.addEventListener('click', () => {
      this.closeAllPopups();
      document.getElementById('tb-search-input').value = '';
      best.open();
    });
  }

  /* ========================================================================
     ACTION CENTER & QUICK ACTIONS
     ======================================================================== */
  _setupActionCenter() {
    document.getElementById('tray-ac-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleFlyout('action-center', 'tray-ac-btn');
    });
    document.getElementById('ac-clear-btn').addEventListener('click', () => {
      State.update({ notifications: [] });
    });
    document.getElementById('ac-manage-btn').addEventListener('click', () => {
      this.closeAllPopups();
      WM.openApp('settings', { category: 'system', page: 'display' });
    });
    document.getElementById('ac-collapse-btn').addEventListener('click', () => {
      this.acCollapsed = !this.acCollapsed;
      document.getElementById('ac-quick-grid').classList.toggle('collapsed', this.acCollapsed);
      document.getElementById('ac-collapse-btn').textContent = this.acCollapsed ? 'Expand' : 'Collapse';
    });
    document.getElementById('ac-brightness-slider').addEventListener('input', (e) => {
      State.update({ brightness: +e.target.value });
    });
  }

  renderActionCenter() {
    const s = State.get();
    const list = document.getElementById('ac-notifications');
    const badge = document.getElementById('tray-ac-badge');

    if (s.notifications.length > 0) {
      badge.textContent = String(s.notifications.length);
      badge.classList.remove('hidden');
      list.innerHTML = s.notifications.map(n => `
        <div class="ac-notif-card">
          <div class="ac-notif-top">
            <span>${n.app}</span>
            <span>${n.time} <button class="ac-notif-close" data-nid="${n.id}" title="Dismiss">✕</button></span>
          </div>
          <div class="ac-notif-title">${n.title}</div>
          <div class="ac-notif-body">${n.body}</div>
        </div>
      `).join('');
      list.querySelectorAll('[data-nid]').forEach(b => {
        b.addEventListener('click', () => {
          State.update({ notifications: State.get().notifications.filter(x => x.id !== b.dataset.nid) });
        });
      });
    } else {
      badge.classList.add('hidden');
      list.innerHTML = '<div class="ac-empty">No new notifications</div>';
    }

    const actions = [
      { id: 'wifi', label: s.wifiEnabled && !s.airplaneMode ? (s.connectedWifi || 'Wi-Fi') : 'Wi-Fi', icon: GLYPHS.wifi, active: s.wifiEnabled && !s.airplaneMode, act: () => State.update({ wifiEnabled: !s.wifiEnabled, airplaneMode: false }) },
      { id: 'bt', label: 'Bluetooth', icon: GLYPHS.bluetooth, active: s.bluetooth, act: () => State.update({ bluetooth: !s.bluetooth }) },
      { id: 'night', label: 'Night light', icon: GLYPHS.nightlight, active: s.nightLight, act: () => State.update({ nightLight: !s.nightLight }) },
      { id: 'settings', label: 'All settings', icon: GLYPHS.settings, active: false, act: () => { this.closeAllPopups(); WM.openApp('settings'); } },
      { id: 'air', label: 'Airplane mode', icon: GLYPHS.airplane, active: s.airplaneMode, act: () => State.update({ airplaneMode: !s.airplaneMode }) },
      { id: 'bat', label: 'Battery saver', icon: GLYPHS.battery, active: s.batterySaver, act: () => State.update({ batterySaver: !s.batterySaver, brightness: !s.batterySaver ? 72 : 100 }) },
      { id: 'loc', label: 'Location', icon: GLYPHS.location, active: s.location, act: () => State.update({ location: !s.location }) },
      { id: 'hot', label: 'Mobile hotspot', icon: GLYPHS.hotspot, active: s.hotspot, act: () => State.update({ hotspot: !s.hotspot }) },
      { id: 'focus', label: 'Focus assist', icon: GLYPHS.focus, active: s.focusAssist, act: () => State.update({ focusAssist: !s.focusAssist }) },
      { id: 'snip', label: 'Screen snip', icon: GLYPHS.snip, active: false, act: () => { this.closeAllPopups(); WM.openApp('paint'); this.notify('Snip & Sketch', 'Opened Paint ready for sketching.'); } },
      { id: 'vpn', label: 'VPN', icon: GLYPHS.vpn, active: false, act: () => { this.closeAllPopups(); WM.openApp('settings', { category: 'network' }); } },
      { id: 'proj', label: 'Project', icon: GLYPHS.project, active: false, act: () => { this.closeAllPopups(); WM.openApp('settings', { category: 'system', page: 'display' }); } }
    ];

    const grid = document.getElementById('ac-quick-grid');
    grid.innerHTML = actions.map((a, i) => `
      <button class="ac-quick-tile ${a.active ? 'active' : ''}" data-qidx="${i}">
        <span>${a.icon}</span>
        <span class="ac-quick-tile-label">${a.label}</span>
      </button>
    `).join('');
    grid.querySelectorAll('[data-qidx]').forEach(b => {
      b.addEventListener('click', () => actions[+b.dataset.qidx].act());
    });

    document.getElementById('ac-brightness-slider').value = String(s.brightness);
  }

  /* ========================================================================
     TASKBAR FLYOUTS (Calendar, Volume, Network, Battery, Overflow, Lang)
     ======================================================================== */
  _toggleFlyout(flyoutId, btnId) {
    const fly = document.getElementById(flyoutId);
    const wasOpen = !fly.classList.contains('hidden');
    this.closeAllPopups();
    if (!wasOpen) {
      fly.classList.remove('hidden');
      if (btnId) document.getElementById(btnId)?.classList.add('active');
      if (flyoutId === 'calendar-flyout') this.renderCalendar();
      if (flyoutId === 'network-flyout') this.renderWifiList();
    }
  }

  _setupFlyouts() {
    document.getElementById('tray-clock-btn').addEventListener('click', (e) => { e.stopPropagation(); this._toggleFlyout('calendar-flyout', 'tray-clock-btn'); });
    document.getElementById('tray-volume-btn').addEventListener('click', (e) => { e.stopPropagation(); this._toggleFlyout('volume-flyout', 'tray-volume-btn'); });
    document.getElementById('tray-network-btn').addEventListener('click', (e) => { e.stopPropagation(); this._toggleFlyout('network-flyout', 'tray-network-btn'); });
    document.getElementById('tray-battery-btn').addEventListener('click', (e) => { e.stopPropagation(); this._toggleFlyout('battery-flyout', 'tray-battery-btn'); });
    document.getElementById('tray-overflow-btn').addEventListener('click', (e) => { e.stopPropagation(); this._toggleFlyout('tray-overflow-flyout', 'tray-overflow-btn'); });
    document.getElementById('tray-lang-btn').addEventListener('click', (e) => { e.stopPropagation(); this._toggleFlyout('lang-flyout', 'tray-lang-btn'); });

    // Calendar buttons
    document.getElementById('cal-prev-btn').addEventListener('click', () => {
      this.calViewDate = new Date(this.calViewDate.getFullYear(), this.calViewDate.getMonth() - 1, 1);
      this.renderCalendar();
    });
    document.getElementById('cal-next-btn').addEventListener('click', () => {
      this.calViewDate = new Date(this.calViewDate.getFullYear(), this.calViewDate.getMonth() + 1, 1);
      this.renderCalendar();
    });
    const addEvent = () => {
      const inp = document.getElementById('cal-event-input');
      const txt = inp.value.trim();
      if (!txt) return;
      const key = `${this.calSelectedDate.getFullYear()}-${this.calSelectedDate.getMonth() + 1}-${this.calSelectedDate.getDate()}`;
      const evs = { ...State.get().calendarEvents };
      evs[key] = [...(evs[key] || []), txt];
      State.update({ calendarEvents: evs });
      inp.value = '';
      this.renderCalendar();
    };
    document.getElementById('cal-event-add-btn').addEventListener('click', addEvent);
    document.getElementById('cal-event-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') addEvent(); });

    // Volume controls
    const vSlider = document.getElementById('vol-slider');
    vSlider.addEventListener('input', () => {
      State.update({ volume: +vSlider.value, muted: +vSlider.value === 0 });
    });
    vSlider.addEventListener('change', () => Sound.volumeTick());
    document.getElementById('vol-mute-btn').addEventListener('click', () => {
      State.update({ muted: !State.get().muted });
    });

    // Network quick tiles
    document.getElementById('net-open-settings').addEventListener('click', () => {
      this.closeAllPopups();
      WM.openApp('settings', { category: 'network' });
    });
    document.getElementById('net-wifi-toggle').addEventListener('click', () => {
      State.update({ wifiEnabled: !State.get().wifiEnabled, airplaneMode: false });
      this.renderWifiList();
    });
    document.getElementById('net-airplane-toggle').addEventListener('click', () => {
      State.update({ airplaneMode: !State.get().airplaneMode });
      this.renderWifiList();
    });
    document.getElementById('net-hotspot-toggle').addEventListener('click', () => {
      State.update({ hotspot: !State.get().hotspot });
      this.renderWifiList();
    });

    // Battery slider
    document.getElementById('bat-mode-slider').addEventListener('input', (e) => {
      const m = +e.target.value;
      State.update({ powerMode: m });
      document.getElementById('bat-mode-name').textContent = POWER_MODES[m];
    });
    document.getElementById('bat-settings-link').addEventListener('click', () => {
      this.closeAllPopups();
      WM.openApp('settings', { category: 'system', page: 'display' });
    });

    // Language options
    document.querySelectorAll('.lang-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        State.update({ keyboardLayout: opt.dataset.lang });
        document.querySelectorAll('.lang-opt').forEach(x => x.classList.toggle('active', x === opt));
        this.closeAllPopups();
      });
    });
  }

  syncTrayState() {
    const s = State.get();
    // Volume
    const volBtn = document.getElementById('tray-volume-btn');
    const muteBtn = document.getElementById('vol-mute-btn');
    const volGlyph = s.muted || s.volume === 0 ? GLYPHS.volumeMute : GLYPHS.volumeHigh;
    volBtn.innerHTML = volGlyph;
    volBtn.title = s.muted ? 'Speakers: Muted' : `Speakers: ${s.volume}%`;
    muteBtn.innerHTML = volGlyph;
    document.getElementById('vol-slider').value = String(s.muted ? 0 : s.volume);
    document.getElementById('vol-pct').textContent = String(s.muted ? 0 : s.volume);

    // Network
    const netBtn = document.getElementById('tray-network-btn');
    netBtn.innerHTML = s.airplaneMode ? GLYPHS.airplane : (s.wifiEnabled && s.connectedWifi ? GLYPHS.wifi : GLYPHS.wifiOff);
    netBtn.title = s.airplaneMode ? 'Airplane mode' : (s.wifiEnabled && s.connectedWifi ? `${s.connectedWifi}\nInternet access` : 'Not connected');
    document.getElementById('net-wifi-toggle').classList.toggle('active', s.wifiEnabled && !s.airplaneMode);
    document.getElementById('net-airplane-toggle').classList.toggle('active', s.airplaneMode);
    document.getElementById('net-hotspot-toggle').classList.toggle('active', s.hotspot);

    // Language & Battery
    document.getElementById('tray-lang-btn').textContent = s.keyboardLayout;
    document.getElementById('bat-mode-slider').value = String(s.powerMode);
    document.getElementById('bat-mode-name').textContent = POWER_MODES[s.powerMode];
  }

  renderWifiList() {
    const s = State.get();
    const list = document.getElementById('wifi-list');
    if (s.airplaneMode || !s.wifiEnabled) {
      list.innerHTML = `<div style="padding:20px 18px;color:var(--shell-text-muted);">${s.airplaneMode ? 'Airplane mode is turned on.' : 'Wi-Fi is turned off.'}</div>`;
      return;
    }
    list.innerHTML = WIFI_NETWORKS.map(n => {
      const isConn = s.connectedWifi === n.ssid;
      const isSel = this.selectedWifi === n.ssid;
      return `
        <div class="wifi-item ${isSel ? 'selected' : ''}" data-ssid="${n.ssid}">
          <div class="wifi-row-top">
            <span>${GLYPHS.wifi}</span>
            <div>
              <div class="wifi-name">${n.ssid}</div>
              <div class="wifi-sub">${isConn ? 'Connected, secured' : (n.secured ? 'Secured' : 'Open')}</div>
            </div>
          </div>
          ${isSel ? `
            <div class="wifi-action-row">
              <button class="wifi-btn" data-wifi-act="${isConn ? 'disc' : 'conn'}" data-target="${n.ssid}">${isConn ? 'Disconnect' : 'Connect'}</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    list.querySelectorAll('.wifi-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.dataset.wifiAct) return;
        this.selectedWifi = el.dataset.ssid;
        this.renderWifiList();
      });
    });
    list.querySelectorAll('[data-wifi-act]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (b.dataset.wifiAct === 'disc') State.update({ connectedWifi: '' });
        else {
          State.update({ connectedWifi: b.dataset.target });
          this.notify('Network', `Connected to ${b.dataset.target}`);
        }
        this.renderWifiList();
      });
    });
  }

  renderCalendar() {
    const year = this.calViewDate.getFullYear();
    const month = this.calViewDate.getMonth();
    const today = new Date();
    document.getElementById('cal-month-label').textContent = this.calViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const evMap = State.get().calendarEvents || {};

    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ d: prevDays - i, m: month - 1, y: year, other: true });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ d, m: month, y: year, other: false });
    while (cells.length < 42) cells.push({ d: cells.length - (firstDay + daysInMonth) + 1, m: month + 1, y: year, other: true });

    const grid = document.getElementById('cal-days-grid');
    grid.innerHTML = cells.map((c, i) => {
      const dt = new Date(c.y, c.m, c.d);
      const isToday = dt.toDateString() === today.toDateString();
      const isSel = dt.toDateString() === this.calSelectedDate.toDateString();
      const key = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
      const hasEv = (evMap[key] || []).length > 0;
      return `<button class="cal-day ${c.other ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''} ${hasEv ? 'has-event' : ''}" data-ci="${i}">${c.d}</button>`;
    }).join('');

    grid.querySelectorAll('[data-ci]').forEach(b => {
      b.addEventListener('click', () => {
        const c = cells[+b.dataset.ci];
        this.calSelectedDate = new Date(c.y, c.m, c.d);
        this.renderCalendar();
      });
    });

    const isSelToday = this.calSelectedDate.toDateString() === today.toDateString();
    document.getElementById('cal-selected-label').textContent = isSelToday
      ? 'Today'
      : this.calSelectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const skey = `${this.calSelectedDate.getFullYear()}-${this.calSelectedDate.getMonth() + 1}-${this.calSelectedDate.getDate()}`;
    const evs = evMap[skey] || [];
    const evEl = document.getElementById('cal-events-list');
    evEl.innerHTML = evs.length ? evs.map((txt, idx) => `
      <div class="cal-event-item"><span>${txt}</span><button data-del-ev="${idx}" style="opacity:.7;cursor:pointer;">✕</button></div>
    `).join('') : 'No events';
    evEl.querySelectorAll('[data-del-ev]').forEach(b => {
      b.addEventListener('click', () => {
        const next = { ...State.get().calendarEvents };
        next[skey] = next[skey].filter((_, i) => i !== +b.dataset.delEv);
        State.update({ calendarEvents: next });
        this.renderCalendar();
      });
    });
  }

  /* ========================================================================
     TASK VIEW + VIRTUAL DESKTOPS & ALT+TAB
     ======================================================================== */
  _setupTaskView() {
    const ov = document.getElementById('task-view-overlay');
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.id === 'tv-windows-grid') this.toggleTaskView(false);
    });
    document.getElementById('tv-new-desktop-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      WM.createDesktop();
      this.renderTaskView();
    });
  }

  toggleTaskView(force) {
    const ov = document.getElementById('task-view-overlay');
    const show = typeof force === 'boolean' ? force : ov.classList.contains('hidden');
    this.closeAllPopups();
    if (show) {
      ov.classList.remove('hidden');
      document.getElementById('tb-taskview-btn').classList.add('active');
      this.renderTaskView();
    } else {
      ov.classList.add('hidden');
      document.getElementById('tb-taskview-btn').classList.remove('active');
    }
  }

  renderTaskView() {
    const dList = document.getElementById('tv-desktops-list');
    const wp = State.get().wallpaper;
    dList.innerHTML = WM.desktops.map(d => `
      <div class="tv-desktop-card ${d.id === WM.currentDesktop ? 'active' : ''}" data-did="${d.id}">
        <div class="tv-desktop-card-title">
          <span>${d.name}</span>
          ${WM.desktops.length > 1 ? `<button class="tv-desktop-close" data-cdid="${d.id}">✕</button>` : ''}
        </div>
        <div class="tv-desktop-thumb" style="background-image:url('${wp}')"></div>
      </div>
    `).join('');

    dList.querySelectorAll('[data-did]').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.dataset.cdid) return;
        WM.switchDesktop(+el.dataset.did);
        this.renderTaskView();
      });
    });
    dList.querySelectorAll('[data-cdid]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        WM.closeDesktop(+b.dataset.cdid);
        this.renderTaskView();
      });
    });

    const wins = WM.getDesktopWindows();
    const grid = document.getElementById('tv-windows-grid');
    document.getElementById('tv-empty-hint').classList.toggle('hidden', wins.length > 0);
    grid.innerHTML = wins.map(w => `
      <div class="tv-win-card" data-tvw="${w.id}">
        <div class="tv-win-card-hdr">
          <span class="tb-preview-icon">${APP_ICONS[w.icon] || ''}</span>
          <span class="tv-win-card-title">${w.title}</span>
          <button class="tb-preview-close" data-tvc="${w.id}">✕</button>
        </div>
        <div class="tv-win-card-body">
          <div style="width:54px;height:54px;">${APP_ICONS[w.icon] || ''}</div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-tvw]').forEach(c => {
      c.addEventListener('click', (e) => {
        if (e.target.dataset.tvc) return;
        this.toggleTaskView(false);
        WM.restore(c.dataset.tvw);
      });
    });
    grid.querySelectorAll('[data-tvc]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        WM.close(b.dataset.tvc);
        this.renderTaskView();
      });
    });
  }

  cycleAltTab() {
    const wins = WM.getDesktopWindows();
    if (!wins.length) return;
    const ov = document.getElementById('alttab-overlay');
    const list = document.getElementById('alttab-list');
    if (!this.altTabActive) {
      this.altTabActive = true;
      this.altTabIdx = wins.length > 1 ? 1 : 0;
    } else {
      this.altTabIdx = (this.altTabIdx + 1) % wins.length;
    }
    list.innerHTML = wins.map((w, i) => `
      <div class="alttab-card ${i === this.altTabIdx ? 'selected' : ''}" data-atw="${w.id}">
        <div class="tb-preview-hdr">
          <span class="tb-preview-icon">${APP_ICONS[w.icon] || ''}</span>
          <span class="tb-preview-title">${w.title}</span>
        </div>
        <div class="tb-preview-thumb" style="height:86px;">
          <div class="tb-preview-thumb-icon">${APP_ICONS[w.icon] || ''}</div>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-atw]').forEach(c => {
      c.addEventListener('click', () => {
        this.altTabActive = false;
        ov.classList.add('hidden');
        WM.restore(c.dataset.atw);
      });
    });
    ov.classList.remove('hidden');
  }

  commitAltTab() {
    if (!this.altTabActive) return;
    this.altTabActive = false;
    const wins = WM.getDesktopWindows();
    const target = wins[this.altTabIdx];
    document.getElementById('alttab-overlay').classList.add('hidden');
    if (target) WM.restore(target.id);
  }

  /* ========================================================================
     CONTEXT MENU, WIN+X, SYSTEM DIALOGS (RUN, WINVER, PROPERTIES), TOASTS
     ======================================================================== */
  showContextMenu(x, y, items) {
    this.hideContextMenus();
    const menu = document.getElementById('context-menu');

    const buildItems = (arr) => arr.map(it => {
      if (it.sep) return `<div class="ctx-sep"></div>`;
      const cls = ['ctx-item'];
      if (it.disabled) cls.push('disabled');
      if (it.bold) cls.push('bold');
      const leftMark = it.checked ? `<span class="ctx-check">✓</span>`
        : it.icon ? `<span class="ctx-icon">${it.icon}</span>` : '';
      if (it.submenu) {
        return `<div class="${cls.join(' ')}">${leftMark}<span>${it.label}</span><span class="ctx-arrow">▸</span><div class="ctx-submenu">${buildItems(it.submenu)}</div></div>`;
      }
      return `<div class="${cls.join(' ')}" data-act="1">${leftMark}<span>${it.label}</span></div>`;
    }).join('');

    menu.innerHTML = buildItems(items);
    menu.classList.remove('hidden');

    // Bind actions recursively
    const bindList = (containerEl, arr) => {
      const children = Array.from(containerEl.children);
      children.forEach((el, idx) => {
        const it = arr[idx];
        if (!it || it.sep) return;
        if (it.submenu) {
          const sub = el.querySelector('.ctx-submenu');
          bindList(sub, it.submenu);
        } else if (it.action && !it.disabled) {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideContextMenus();
            it.action();
          });
        }
      });
    };
    bindList(menu, items);

    // Clamp to viewport
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    const left = x + mw > window.innerWidth ? Math.max(4, window.innerWidth - mw - 4) : x;
    const top = y + mh > window.innerHeight ? Math.max(4, window.innerHeight - mh - 4) : y;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    if (left + mw + 200 > window.innerWidth) {
      menu.querySelectorAll('.ctx-submenu').forEach(s => s.classList.add('flip-left'));
    }
  }

  showWinXMenu() {
    this.closeAllPopups();
    const menu = document.getElementById('winx-menu');
    const entries = [
      { label: 'Apps and Features', act: () => WM.openApp('settings', { category: 'apps' }) },
      { label: 'Power Options', act: () => WM.openApp('settings', { category: 'system', page: 'display' }) },
      { label: 'System', act: () => WM.openApp('settings', { category: 'system', page: 'about' }) },
      { label: 'Network Connections', act: () => WM.openApp('settings', { category: 'network' }) },
      { sep: true },
      { label: 'Command Prompt', act: () => WM.openApp('cmd') },
      { label: 'Task Manager', act: () => WM.openApp('taskmgr') },
      { label: 'Settings', act: () => WM.openApp('settings') },
      { label: 'File Explorer', act: () => WM.openApp('explorer') },
      { label: 'Search', act: () => document.getElementById('tb-search-input')?.focus() },
      { label: 'Run', act: () => this.showRunDialog() },
      { sep: true },
      { label: 'Shut down', act: () => this.powerAction('shutdown') },
      { label: 'Restart', act: () => this.powerAction('restart') },
      { label: 'Sign out / Lock', act: () => this.lock() },
      { sep: true },
      { label: 'Desktop', act: () => WM.toggleShowDesktop() }
    ];
    menu.innerHTML = entries.map((e, i) => e.sep ? `<div class="ctx-sep"></div>` : `<div class="ctx-item" data-wxi="${i}">${e.label}</div>`).join('');
    menu.querySelectorAll('[data-wxi]').forEach(el => {
      el.addEventListener('click', () => {
        menu.classList.add('hidden');
        entries[+el.dataset.wxi].act();
      });
    });
    menu.classList.remove('hidden');
  }

  showRunDialog() {
    this.closeAllPopups();
    const layer = document.getElementById('system-modal-layer');
    const dlg = document.createElement('div');
    dlg.className = 'sys-dialog';
    dlg.style.left = '16px';
    dlg.style.bottom = '54px';
    dlg.style.width = '408px';
    dlg.innerHTML = `
      <div class="sys-dialog-titlebar">
        <div class="sys-dialog-titlebar-left"><span style="width:16px;height:16px;display:inline-flex;">${APP_ICONS.runIcon}</span><span>Run</span></div>
        <button class="sys-dialog-close" title="Close">✕</button>
      </div>
      <div class="sys-dialog-body">
        <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:16px;">
          <span style="width:36px;height:36px;flex-shrink:0;">${APP_ICONS.runIcon}</span>
          <span>Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <label for="run-cmd-in" style="min-width:40px;">Open:</label>
          <input type="text" id="run-cmd-in" class="win32-input" placeholder="notepad, calc, cmd, winver, ms-settings:, bsod" />
        </div>
      </div>
      <div class="sys-dialog-footer">
        <button class="win32-btn primary" id="run-ok">OK</button>
        <button class="win32-btn" id="run-cancel">Cancel</button>
      </div>
    `;
    layer.appendChild(dlg);

    const inp = dlg.querySelector('#run-cmd-in');
    const close = () => dlg.remove();
    const execute = () => {
      const cmd = inp.value.trim().toLowerCase();
      close();
      if (!cmd) return;
      const map = {
        notepad: () => WM.openApp('notepad'),
        calc: () => WM.openApp('calculator'),
        calculator: () => WM.openApp('calculator'),
        cmd: () => WM.openApp('cmd'),
        explorer: () => WM.openApp('explorer'),
        mspaint: () => WM.openApp('paint'),
        paint: () => WM.openApp('paint'),
        taskmgr: () => WM.openApp('taskmgr'),
        edge: () => WM.openApp('edge'),
        msedge: () => WM.openApp('edge'),
        photos: () => WM.openApp('photos'),
        minesweeper: () => WM.openApp('minesweeper'),
        'ms-settings:': () => WM.openApp('settings'),
        settings: () => WM.openApp('settings'),
        winver: () => this.showWinver(),
        bsod: () => this.triggerBSOD('RUN_DIALOG_BSOD')
      };
      if (map[cmd]) map[cmd]();
      else if (VFS.getNode(cmd)) WM.openApp('explorer', { path: cmd });
      else {
        Sound.error();
        this.notify('Run', `Windows cannot find '${cmd}'. Make sure you typed the name correctly.`);
      }
    };

    dlg.querySelector('.sys-dialog-close').addEventListener('click', close);
    dlg.querySelector('#run-cancel').addEventListener('click', close);
    dlg.querySelector('#run-ok').addEventListener('click', execute);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') execute();
      if (e.key === 'Escape') close();
    });
    setTimeout(() => inp.focus(), 20);
  }

  showWinver() {
    const layer = document.getElementById('system-modal-layer');
    const dlg = document.createElement('div');
    dlg.className = 'sys-dialog';
    dlg.style.left = Math.max(20, Math.round(window.innerWidth / 2 - 230)) + 'px';
    dlg.style.top = Math.max(40, Math.round(window.innerHeight / 2 - 200)) + 'px';
    dlg.style.width = '460px';
    dlg.innerHTML = `
      <div class="sys-dialog-titlebar">
        <div class="sys-dialog-titlebar-left"><span>About Windows</span></div>
        <button class="sys-dialog-close">✕</button>
      </div>
      <div style="background:#ffffff;">
        <div class="winver-banner">
          <svg viewBox="0 0 88 88" width="42" height="42"><path fill="#0078D7" d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.026 45.7zm4.326-39.025L87.314 0v41.527l-47.318.376zm47.329 39.349l-.011 41.34-47.318-6.678-.066-34.739z"/></svg>
          <span class="winver-banner-text">Windows 10</span>
        </div>
        <div class="winver-body">
          <p>Microsoft Windows<br>Version 22H2 (OS Build 19045.4651)<br>© Microsoft Corporation. All rights reserved.</p>
          <p style="margin-top:12px;">The Windows 10 Pro operating system and its user interface are protected by trademark and other pending or existing intellectual property rights.</p>
          <p style="margin-top:16px;">This product is licensed under the Microsoft Software License Terms to:<br><strong>${State.get().username}</strong></p>
        </div>
      </div>
      <div class="sys-dialog-footer">
        <button class="win32-btn primary" id="wv-ok">OK</button>
      </div>
    `;
    layer.appendChild(dlg);
    const close = () => dlg.remove();
    dlg.querySelector('.sys-dialog-close').addEventListener('click', close);
    dlg.querySelector('#wv-ok').addEventListener('click', close);
  }

  showProperties(vfsPath) {
    const node = VFS.getNode(vfsPath);
    if (!node) return;
    const layer = document.getElementById('system-modal-layer');
    const dlg = document.createElement('div');
    dlg.className = 'sys-dialog';
    dlg.style.left = Math.max(20, Math.round(window.innerWidth / 2 - 190)) + 'px';
    dlg.style.top = Math.max(40, Math.round(window.innerHeight / 2 - 210)) + 'px';
    dlg.style.width = '380px';
    const icon = node.type === 'folder' ? APP_ICONS.folder : (node.src ? APP_ICONS.imagefile : APP_ICONS.textfile);
    dlg.innerHTML = `
      <div class="sys-dialog-titlebar">
        <div class="sys-dialog-titlebar-left"><span>${node.name} Properties</span></div>
        <button class="sys-dialog-close">✕</button>
      </div>
      <div class="props-tabs"><span class="props-tab">General</span></div>
      <div class="sys-dialog-body">
        <div style="display:flex;align-items:center;gap:14px;">
          <span style="width:36px;height:36px;flex-shrink:0;">${icon}</span>
          <input type="text" class="win32-input" id="prop-name" value="${node.name}" />
        </div>
        <div class="props-grid">
          <span class="props-k">Type:</span><span class="props-v">${VFS.getFileTypeLabel(node)}</span>
          <span class="props-k">Location:</span><span class="props-v">${VFS.getParentPath(vfsPath)}</span>
          <span class="props-k">Size:</span><span class="props-v">${VFS.formatSize(VFS.getSizeBytes(node))} (${VFS.getSizeBytes(node).toLocaleString()} bytes)</span>
          <span class="props-k">Modified:</span><span class="props-v">${new Date(node.modified).toLocaleString()}</span>
        </div>
      </div>
      <div class="sys-dialog-footer">
        <button class="win32-btn primary" id="prop-ok">OK</button>
        <button class="win32-btn" id="prop-cancel">Cancel</button>
      </div>
    `;
    layer.appendChild(dlg);
    const close = () => dlg.remove();
    dlg.querySelector('.sys-dialog-close').addEventListener('click', close);
    dlg.querySelector('#prop-cancel').addEventListener('click', close);
    dlg.querySelector('#prop-ok').addEventListener('click', () => {
      const nn = dlg.querySelector('#prop-name').value.trim();
      if (nn && nn !== node.name) VFS.rename(vfsPath, nn);
      close();
    });
  }

  notify(app, body, title) {
    const t = title || app;
    const item = {
      id: 'n_' + Date.now() + Math.random().toString(36).slice(2, 5),
      app,
      title: t,
      body,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const next = [item, ...State.get().notifications].slice(0, 15);
    State.update({ notifications: next });

    if (State.get().focusAssist) return;
    Sound.notify();

    const cont = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'win10-toast';
    toast.innerHTML = `
      <div class="toast-hdr"><span>${app}</span><button style="color:#aaa;cursor:pointer;">✕</button></div>
      <div class="toast-title">${t}</div>
      <div class="toast-body">${body}</div>
    `;
    toast.querySelector('button').addEventListener('click', () => toast.remove());
    cont.appendChild(toast);
    setTimeout(() => toast.remove(), 4800);
  }

  /* ========================================================================
     GLOBAL POPUP DISMISS & LIVE CLOCK LOOP
     ======================================================================== */
  hideContextMenus() {
    document.getElementById('context-menu').classList.add('hidden');
    document.getElementById('winx-menu').classList.add('hidden');
  }

  closeAllPopups() {
    this.hideContextMenus();
    [
      'start-menu', 'search-panel', 'action-center', 'calendar-flyout',
      'volume-flyout', 'network-flyout', 'battery-flyout',
      'tray-overflow-flyout', 'lang-flyout', 'taskbar-preview',
      'start-power-menu', 'start-user-menu', 'start-letter-jump'
    ].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('start-rail')?.classList.remove('expanded');
    document.querySelectorAll('.tb-btn.active, .tb-tray-btn.active').forEach(b => b.classList.remove('active'));
  }

  _setupGlobalDismiss() {
    document.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#context-menu, #winx-menu')) return;
      this.hideContextMenus();
      if (e.target.closest('#start-menu, #search-panel, #action-center, .taskbar-flyout, #taskbar, #taskbar-preview')) return;
      this.closeAllPopups();
    });
  }

  _startClockLoop() {
    const updateClock = () => {
      const now = new Date();
      const s = State.get();

      // Taskbar Time & Date
      const timeOpts = {
        hour: 'numeric',
        minute: '2-digit',
        ...(s.showSeconds ? { second: '2-digit' } : {}),
        hour12: !s.use24Hour
      };
      document.getElementById('tb-clock-time').textContent = now.toLocaleTimeString('en-US', timeOpts);
      document.getElementById('tb-clock-date').textContent = now.toLocaleDateString('en-US');

      // Lock screen huge clock
      document.getElementById('lock-time').textContent = now.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: !s.use24Hour
      }).replace(/\s?[AP]M$/, '');
      document.getElementById('lock-date').textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
      });

      // Calendar flyout big seconds clock
      const bigTimeEl = document.getElementById('cal-big-time');
      if (s.use24Hour) {
        bigTimeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      } else {
        const parts = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).split(' ');
        bigTimeEl.innerHTML = `${parts[0]} <span class="cal-ampm">${parts[1] || ''}</span>`;
      }
      document.getElementById('cal-big-date').textContent = now.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });
    };

    updateClock();
    setInterval(updateClock, 1000);
  }
}
