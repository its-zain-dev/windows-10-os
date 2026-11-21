/* ==========================================================================
   Windows 10 Settings App (ms-settings:) — Fully Working OS Controls
   ========================================================================== */

import { State, WIN10_ACCENTS, WALLPAPERS } from '../state.js';
import { VFS } from '../vfs.js';
import { WM } from '../wm.js';
import { APP_ICONS, GLYPHS } from '../icons.js';
import { Sound } from '../sound.js';

const CATEGORIES = [
  { id: 'system', name: 'System', desc: 'Display, sound, notifications, power', icon: GLYPHS.brightness,
    pages: [
      { id: 'display', name: 'Display' },
      { id: 'sound', name: 'Sound' },
      { id: 'about', name: 'About' }
    ]
  },
  { id: 'personalization', name: 'Personalization', desc: 'Background, lock screen, colors', icon: GLYPHS.pictures,
    pages: [
      { id: 'background', name: 'Background' },
      { id: 'colors', name: 'Colors' },
      { id: 'lockscreen', name: 'Lock screen' },
      { id: 'taskbar', name: 'Taskbar' }
    ]
  },
  { id: 'network', name: 'Network & Internet', desc: 'Wi-Fi, airplane mode, VPN', icon: GLYPHS.wifi,
    pages: [
      { id: 'status', name: 'Status' },
      { id: 'wifi', name: 'Wi-Fi' }
    ]
  },
  { id: 'apps', name: 'Apps', desc: 'Installed apps, defaults', icon: GLYPHS.taskview,
    pages: [
      { id: 'features', name: 'Apps & features' }
    ]
  },
  { id: 'accounts', name: 'Accounts', desc: 'Your info, sign-in options', icon: GLYPHS.ease,
    pages: [
      { id: 'info', name: 'Your info' },
      { id: 'signin', name: 'Sign-in options' }
    ]
  },
  { id: 'time', name: 'Time & Language', desc: 'Date, time, clock format, region', icon: GLYPHS.settings,
    pages: [
      { id: 'datetime', name: 'Date & time' }
    ]
  },
  { id: 'update', name: 'Update & Security', desc: 'Windows Update, recovery, reset', icon: GLYPHS.restart,
    pages: [
      { id: 'winupdate', name: 'Windows Update' },
      { id: 'recovery', name: 'Recovery' }
    ]
  }
];

export const SettingsApp = {
  id: 'settings',
  name: 'Settings',
  icon: 'settings',
  width: 920,
  height: 600,
  minWidth: 640,
  minHeight: 420,
  singleInstance: true,
  frameless: true,

  mount(container, params, api) {
    let activeCat = params.category || null;
    let activePage = params.page || null;
    let searchFilter = '';
    let updateStatus = 'You\'re up to date';
    let checkingUpdate = false;

    const root = document.createElement('div');
    root.className = 'set-root';
    container.appendChild(root);

    const openPage = (catId, pageId) => {
      const cat = CATEGORIES.find(c => c.id === catId);
      if (!cat) { activeCat = null; activePage = null; }
      else {
        activeCat = cat.id;
        activePage = pageId || cat.pages[0].id;
      }
      render();
    };

    const renderPane = () => {
      const s = State.get();

      if (activeCat === 'system' && activePage === 'display') {
        return `
          <h2>Display</h2>
          <div class="set-group">
            <h3>Brightness and color</h3>
            <label class="set-label">Change brightness for the built-in display (<span id="s-bright-val">${s.brightness}</span>%)</label>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
              <input type="range" class="win10-slider" id="s-bright" min="30" max="100" value="${s.brightness}" />
            </div>
            <label class="set-label">Night light</label>
            <p class="set-desc">Displays emit blue light, which can keep you up at night. Night light displays warmer colors to help you sleep.</p>
            <label class="win10-toggle">
              <input type="checkbox" id="s-night" ${s.nightLight ? 'checked' : ''} />
              <span class="win10-toggle-track"></span>
              <span>${s.nightLight ? 'On' : 'Off'}</span>
            </label>
            <div style="margin-top:14px;">
              <label class="set-label">Strength (<span id="s-night-str-val">${s.nightLightStrength}</span>%)</label>
              <input type="range" class="win10-slider" id="s-night-str" min="15" max="90" value="${s.nightLightStrength}" style="width:100%;" />
            </div>
          </div>
          <div class="set-group">
            <h3>Scale and layout</h3>
            <p class="set-desc">Display resolution: ${window.innerWidth} × ${window.innerHeight} (Recommended)</p>
          </div>
        `;
      }

      if (activeCat === 'system' && activePage === 'sound') {
        return `
          <h2>Sound</h2>
          <div class="set-group">
            <h3>Output</h3>
            <p class="set-desc">Choose your output device: Speakers (Realtek High Definition Audio)</p>
            <label class="set-label">Master volume (<span id="s-vol-val">${s.muted ? 'Muted' : s.volume + '%'}</span>)</label>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <input type="range" class="win10-slider" id="s-vol" min="0" max="100" value="${s.volume}" />
              <button class="set-btn" id="s-test-snd">Test sound</button>
            </div>
          </div>
        `;
      }

      if (activeCat === 'system' && activePage === 'about') {
        return `
          <h2>About</h2>
          <div class="set-group">
            <h3>Device specifications</h3>
            <div class="set-specs-table">
              <span class="set-specs-k">Device name</span><span>${s.pcName}</span>
              <span class="set-specs-k">Processor</span><span>Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz</span>
              <span class="set-specs-k">Installed RAM</span><span>16.0 GB (15.8 GB usable)</span>
              <span class="set-specs-k">System type</span><span>64-bit operating system, x64-based processor</span>
            </div>
            <button class="set-btn" id="s-rename-pc">Rename this PC</button>
          </div>
          <div class="set-group">
            <h3>Windows specifications</h3>
            <div class="set-specs-table">
              <span class="set-specs-k">Edition</span><span>Windows 10 Pro</span>
              <span class="set-specs-k">Version</span><span>22H2</span>
              <span class="set-specs-k">OS build</span><span>19045.4651</span>
              <span class="set-specs-k">Experience</span><span>Windows Feature Experience Pack 1000.19060.1000.0</span>
            </div>
          </div>
        `;
      }

      if (activeCat === 'personalization' && activePage === 'background') {
        const previewStyle = s.wallpaperMode === 'solid'
          ? `background-color:${s.wallpaperColor};`
          : `background-image:url('${s.wallpaper}');`;
        return `
          <h2>Background</h2>
          <div class="set-wallpaper-preview" style="${previewStyle}"></div>
          <div class="set-group">
            <label class="set-label">Background</label>
            <select class="set-select" id="s-wp-mode">
              <option value="picture" ${s.wallpaperMode === 'picture' ? 'selected' : ''}>Picture</option>
              <option value="solid" ${s.wallpaperMode === 'solid' ? 'selected' : ''}>Solid color</option>
            </select>
          </div>
          ${s.wallpaperMode === 'picture' ? `
            <div class="set-group">
              <label class="set-label">Choose your picture</label>
              <div class="set-wp-thumbs">
                ${WALLPAPERS.map(w => `
                  <button class="set-wp-thumb ${s.wallpaper === w.src ? 'active' : ''}" data-wp="${w.src}" title="${w.name}" style="background-image:url('${w.src}')"></button>
                `).join('')}
              </div>
              <div style="margin-top:14px;">
                <label class="set-btn" style="display:inline-block;">
                  Browse custom image
                  <input type="file" id="s-wp-upload" accept="image/*" style="display:none;" />
                </label>
              </div>
            </div>
          ` : `
            <div class="set-group">
              <label class="set-label">Choose your background color</label>
              <div class="set-color-swatches">
                ${WIN10_ACCENTS.slice(0, 16).map(c => `
                  <button class="set-swatch ${s.wallpaperColor === c ? 'active' : ''}" data-solid="${c}" style="background:${c}"></button>
                `).join('')}
              </div>
            </div>
          `}
        `;
      }

      if (activeCat === 'personalization' && activePage === 'colors') {
        const preset = s.winTheme === s.appTheme ? s.winTheme : 'custom';
        return `
          <h2>Colors</h2>
          <div class="set-group">
            <label class="set-label">Choose your color</label>
            <select class="set-select" id="s-color-preset">
              <option value="dark" ${preset === 'dark' ? 'selected' : ''}>Dark</option>
              <option value="light" ${preset === 'light' ? 'selected' : ''}>Light</option>
              <option value="custom" ${preset === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
          </div>
          <div class="set-group">
            <label class="set-label">Choose your default Windows mode (Start, Taskbar, Action Center)</label>
            <select class="set-select" id="s-win-theme">
              <option value="dark" ${s.winTheme === 'dark' ? 'selected' : ''}>Dark</option>
              <option value="light" ${s.winTheme === 'light' ? 'selected' : ''}>Light</option>
            </select>
          </div>
          <div class="set-group">
            <label class="set-label">Choose your default app mode</label>
            <select class="set-select" id="s-app-theme">
              <option value="dark" ${s.appTheme === 'dark' ? 'selected' : ''}>Dark</option>
              <option value="light" ${s.appTheme === 'light' ? 'selected' : ''}>Light</option>
            </select>
          </div>
          <div class="set-group">
            <label class="set-label">Transparency effects (Acrylic)</label>
            <label class="win10-toggle">
              <input type="checkbox" id="s-trans" ${s.transparency ? 'checked' : ''} />
              <span class="win10-toggle-track"></span>
              <span>${s.transparency ? 'On' : 'Off'}</span>
            </label>
          </div>
          <div class="set-group">
            <h3>Choose your accent color</h3>
            <div class="set-color-swatches">
              ${WIN10_ACCENTS.map(c => `
                <button class="set-swatch ${s.accentColor.toLowerCase() === c.toLowerCase() ? 'active' : ''}" data-accent="${c}" style="background:${c}"></button>
              `).join('')}
            </div>
            <label class="set-checkbox-row">
              <input type="checkbox" id="s-acc-shell" ${s.accentOnShell ? 'checked' : ''} />
              <span>Start, taskbar, and action center</span>
            </label>
            <label class="set-checkbox-row">
              <input type="checkbox" id="s-acc-title" ${s.accentOnTitlebar ? 'checked' : ''} />
              <span>Title bars and window borders</span>
            </label>
          </div>
        `;
      }

      if (activeCat === 'personalization' && activePage === 'lockscreen') {
        return `
          <h2>Lock screen</h2>
          <div class="set-wallpaper-preview" style="background-image:url('${s.lockWallpaper}');"></div>
          <div class="set-group">
            <label class="set-label">Choose your lock screen picture</label>
            <div class="set-wp-thumbs">
              ${WALLPAPERS.map(w => `
                <button class="set-wp-thumb ${s.lockWallpaper === w.src ? 'active' : ''}" data-lockwp="${w.src}" title="${w.name}" style="background-image:url('${w.src}')"></button>
              `).join('')}
            </div>
            <div style="margin-top:16px;">
              <button class="set-btn accent" id="s-lock-now">Preview Lock Screen now (Win+L)</button>
            </div>
          </div>
        `;
      }

      if (activeCat === 'personalization' && activePage === 'taskbar') {
        return `
          <h2>Taskbar</h2>
          <div class="set-group">
            <label class="set-label">Automatically hide the taskbar in desktop mode</label>
            <label class="win10-toggle">
              <input type="checkbox" id="s-tb-hide" ${s.taskbarAutoHide ? 'checked' : ''} />
              <span class="win10-toggle-track"></span>
              <span>${s.taskbarAutoHide ? 'On' : 'Off'}</span>
            </label>
          </div>
          <div class="set-group">
            <label class="set-label">Use small taskbar buttons</label>
            <label class="win10-toggle">
              <input type="checkbox" id="s-tb-small" ${s.smallTaskbar ? 'checked' : ''} />
              <span class="win10-toggle-track"></span>
              <span>${s.smallTaskbar ? 'On' : 'Off'}</span>
            </label>
          </div>
          <div class="set-group">
            <label class="set-label">Search on taskbar</label>
            <select class="set-select" id="s-tb-search">
              <option value="box" ${s.searchMode === 'box' ? 'selected' : ''}>Show search box</option>
              <option value="icon" ${s.searchMode === 'icon' ? 'selected' : ''}>Show search icon</option>
              <option value="hidden" ${s.searchMode === 'hidden' ? 'selected' : ''}>Hidden</option>
            </select>
          </div>
        `;
      }

      if (activeCat === 'network') {
        return `
          <h2>Network &amp; Internet</h2>
          <div class="set-group">
            <h3>Network status</h3>
            <p class="set-desc">${s.airplaneMode ? 'Airplane mode is on. Not connected.' : s.wifiEnabled && s.connectedWifi ? `You're connected to the Internet via <strong>${s.connectedWifi}</strong>.` : 'Not connected to Wi-Fi.'}</p>
            <label class="set-label">Wi-Fi</label>
            <label class="win10-toggle" style="margin-bottom:16px;">
              <input type="checkbox" id="s-wifi" ${s.wifiEnabled && !s.airplaneMode ? 'checked' : ''} />
              <span class="win10-toggle-track"></span>
              <span>${s.wifiEnabled && !s.airplaneMode ? 'On' : 'Off'}</span>
            </label>
            <label class="set-label">Airplane mode</label>
            <label class="win10-toggle">
              <input type="checkbox" id="s-air" ${s.airplaneMode ? 'checked' : ''} />
              <span class="win10-toggle-track"></span>
              <span>${s.airplaneMode ? 'On' : 'Off'}</span>
            </label>
          </div>
        `;
      }

      if (activeCat === 'apps') {
        const apps = WM.getAllApps();
        return `
          <h2>Apps &amp; features</h2>
          <p class="set-desc">${apps.length} installed Windows 10 apps</p>
          <div style="display:flex;flex-direction:column;gap:4px;max-width:620px;">
            ${apps.map(a => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--app-surface);border:1px solid var(--app-border);">
                <div style="display:flex;align-items:center;gap:12px;">
                  <span style="width:28px;height:28px;display:inline-flex;">${APP_ICONS[a.icon] || ''}</span>
                  <div>
                    <div style="font-size:13.5px;">${a.name}</div>
                    <div style="font-size:11.5px;color:var(--app-text-secondary);">Microsoft Corporation</div>
                  </div>
                </div>
                <button class="set-btn" data-launch-id="${a.id}">Open</button>
              </div>
            `).join('')}
          </div>
        `;
      }

      if (activeCat === 'accounts') {
        return `
          <h2>${activePage === 'signin' ? 'Sign-in options' : 'Your info'}</h2>
          <div class="set-group" style="display:flex;align-items:center;gap:18px;margin-bottom:24px;">
            <div style="width:72px;height:72px;border-radius:50%;overflow:hidden;">${APP_ICONS.userAvatar}</div>
            <div>
              <div style="font-size:20px;font-weight:400;">${s.username}</div>
              <div style="font-size:12.5px;color:var(--app-text-secondary);">Local Account · Administrator</div>
            </div>
          </div>
          <div class="set-group">
            <label class="set-label">Display Name</label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="s-user-input" class="set-select" value="${s.username}" />
              <button class="set-btn accent" id="s-user-save">Save</button>
            </div>
          </div>
          <div class="set-group">
            <h3>Windows Hello PIN</h3>
            <p class="set-desc">${s.pin ? 'A sign-in PIN is currently set.' : 'No PIN is set (Sign-in screen unlocks with one click).'}</p>
            <div style="display:flex;gap:8px;">
              <input type="password" id="s-pin-input" class="set-select" placeholder="Enter new PIN (leave empty to remove)" value="${s.pin}" />
              <button class="set-btn" id="s-pin-save">Update PIN</button>
            </div>
          </div>
        `;
      }

      if (activeCat === 'time') {
        return `
          <h2>Date &amp; time</h2>
          <div class="set-group">
            <p class="set-desc">Current time: <strong>${new Date().toLocaleString()}</strong></p>
            <label class="set-label">Use 24-hour clock format</label>
            <label class="win10-toggle" style="margin-bottom:16px;">
              <input type="checkbox" id="s-24h" ${s.use24Hour ? 'checked' : ''} />
              <span class="win10-toggle-track"></span>
              <span>${s.use24Hour ? 'On' : 'Off'}</span>
            </label>
            <label class="set-label">Show seconds in taskbar clock</label>
            <label class="win10-toggle">
              <input type="checkbox" id="s-sec" ${s.showSeconds ? 'checked' : ''} />
              <span class="win10-toggle-track"></span>
              <span>${s.showSeconds ? 'On' : 'Off'}</span>
            </label>
          </div>
        `;
      }

      if (activeCat === 'update') {
        return `
          <h2>${activePage === 'recovery' ? 'Recovery' : 'Windows Update'}</h2>
          ${activePage === 'recovery' ? `
            <div class="set-group">
              <h3>Reset this PC</h3>
              <p class="set-desc">Resetting restores all Windows 10 settings, desktop icons, and virtual files back to factory defaults.</p>
              <button class="set-btn" id="s-reset-os" style="background:#c42b1c;color:#fff;">Reset this PC</button>
            </div>
          ` : `
            <div class="set-group">
              <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
                <span style="font-size:28px;color:#10893e;">✓</span>
                <div>
                  <div style="font-size:18px;">${checkingUpdate ? 'Checking for updates...' : updateStatus}</div>
                  <div style="font-size:12px;color:var(--app-text-secondary);">Last checked: Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
              <button class="set-btn accent" id="s-check-upd" ${checkingUpdate ? 'disabled' : ''}>Check for updates</button>
            </div>
          `}
        `;
      }

      return '';
    };

    const render = () => {
      if (!activeCat) {
        const filtered = CATEGORIES.filter(c =>
          !searchFilter ||
          c.name.toLowerCase().includes(searchFilter) ||
          c.desc.toLowerCase().includes(searchFilter)
        );
        root.innerHTML = `
          <div class="set-home">
            <div class="set-home-title">Windows Settings</div>
            <input type="text" id="set-home-search" class="set-home-search" placeholder="Find a setting" value="${searchFilter}" />
            <div class="set-cat-grid">
              ${filtered.map(c => `
                <button class="set-cat-card" data-cat="${c.id}">
                  <span class="set-cat-icon">${c.icon}</span>
                  <div>
                    <div class="set-cat-name">${c.name}</div>
                    <div class="set-cat-desc">${c.desc}</div>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>
        `;
        root.querySelector('#set-home-search')?.addEventListener('input', (e) => {
          searchFilter = e.target.value.toLowerCase();
          render();
          const el = root.querySelector('#set-home-search');
          if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        });
        root.querySelectorAll('[data-cat]').forEach(b => {
          b.addEventListener('click', () => openPage(b.dataset.cat));
        });
        return;
      }

      const cat = CATEGORIES.find(c => c.id === activeCat);
      root.innerHTML = `
        <div class="set-subpage">
          <div class="set-nav">
            <button class="set-nav-home" id="set-go-home"><span>🏠</span><span>Home</span></button>
            <div class="set-nav-cat">${cat.name}</div>
            ${cat.pages.map(p => `
              <button class="set-nav-item ${activePage === p.id ? 'active' : ''}" data-page="${p.id}">${p.name}</button>
            `).join('')}
          </div>
          <div class="set-pane">${renderPane()}</div>
        </div>
      `;

      bindPaneEvents();
    };

    const bindPaneEvents = () => {
      root.querySelector('#set-go-home')?.addEventListener('click', () => { activeCat = null; activePage = null; render(); });
      root.querySelectorAll('[data-page]').forEach(b => {
        b.addEventListener('click', () => { activePage = b.dataset.page; render(); });
      });

      let isSliding = false;
      const bindSlider = (sel, valSel, fn, suffix = '') => {
        const el = root.querySelector(sel);
        if (!el) return;
        el.addEventListener('pointerdown', () => { isSliding = true; });
        el.addEventListener('pointerup', () => { isSliding = false; });
        el.addEventListener('input', e => {
          isSliding = true;
          const v = +e.target.value;
          const lbl = root.querySelector(valSel);
          if (lbl) lbl.textContent = v + suffix;
          fn(v);
        });
        el.addEventListener('change', () => { isSliding = false; });
      };
      bindSlider('#s-bright', '#s-bright-val', v => State.update({ brightness: v }));
      bindSlider('#s-night-str', '#s-night-str-val', v => State.update({ nightLightStrength: v }));
      bindSlider('#s-vol', '#s-vol-val', v => State.update({ volume: v, muted: false }), '%');
      root.dataset.sliding = '';
      root._isSliding = () => isSliding;

      root.querySelector('#s-night')?.addEventListener('change', e => State.update({ nightLight: e.target.checked }));
      root.querySelector('#s-test-snd')?.addEventListener('click', () => Sound.notify());
      root.querySelector('#s-rename-pc')?.addEventListener('click', () => {
        const nn = prompt('Rename your PC:', State.get().pcName);
        if (nn && nn.trim()) State.update({ pcName: nn.trim().toUpperCase() });
      });

      root.querySelector('#s-wp-mode')?.addEventListener('change', e => State.update({ wallpaperMode: e.target.value }));
      root.querySelectorAll('[data-wp]').forEach(b => {
        b.addEventListener('click', () => State.update({ wallpaper: b.dataset.wp, wallpaperMode: 'picture' }));
      });
      root.querySelectorAll('[data-solid]').forEach(b => {
        b.addEventListener('click', () => State.update({ wallpaperColor: b.dataset.solid, wallpaperMode: 'solid' }));
      });
      root.querySelector('#s-wp-upload')?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => State.update({ wallpaper: reader.result, wallpaperMode: 'picture' });
        reader.readAsDataURL(file);
      });

      root.querySelector('#s-color-preset')?.addEventListener('change', e => {
        if (e.target.value === 'dark') State.update({ winTheme: 'dark', appTheme: 'dark' });
        if (e.target.value === 'light') State.update({ winTheme: 'light', appTheme: 'light' });
      });
      root.querySelector('#s-win-theme')?.addEventListener('change', e => State.update({ winTheme: e.target.value }));
      root.querySelector('#s-app-theme')?.addEventListener('change', e => State.update({ appTheme: e.target.value }));
      root.querySelector('#s-trans')?.addEventListener('change', e => State.update({ transparency: e.target.checked }));
      root.querySelectorAll('[data-accent]').forEach(b => {
        b.addEventListener('click', () => State.update({ accentColor: b.dataset.accent }));
      });
      root.querySelector('#s-acc-shell')?.addEventListener('change', e => State.update({ accentOnShell: e.target.checked }));
      root.querySelector('#s-acc-title')?.addEventListener('change', e => State.update({ accentOnTitlebar: e.target.checked }));

      root.querySelectorAll('[data-lockwp]').forEach(b => {
        b.addEventListener('click', () => State.update({ lockWallpaper: b.dataset.lockwp }));
      });
      root.querySelector('#s-lock-now')?.addEventListener('click', () => window.Win10Shell?.lock());

      root.querySelector('#s-tb-hide')?.addEventListener('change', e => State.update({ taskbarAutoHide: e.target.checked }));
      root.querySelector('#s-tb-small')?.addEventListener('change', e => State.update({ smallTaskbar: e.target.checked }));
      root.querySelector('#s-tb-search')?.addEventListener('change', e => State.update({ searchMode: e.target.value }));

      root.querySelector('#s-wifi')?.addEventListener('change', e => State.update({ wifiEnabled: e.target.checked, airplaneMode: false }));
      root.querySelector('#s-air')?.addEventListener('change', e => State.update({ airplaneMode: e.target.checked }));

      root.querySelectorAll('[data-launch-id]').forEach(b => {
        b.addEventListener('click', () => api.openApp(b.dataset.launchId));
      });

      root.querySelector('#s-user-save')?.addEventListener('click', () => {
        const v = root.querySelector('#s-user-input')?.value.trim();
        if (v) { State.update({ username: v }); window.Win10Shell?.notify('Settings', `Account display name updated to ${v}.`); }
      });
      root.querySelector('#s-pin-save')?.addEventListener('click', () => {
        const v = root.querySelector('#s-pin-input')?.value.trim() || '';
        State.update({ pin: v });
        window.Win10Shell?.notify('Sign-in options', v ? 'Windows Hello PIN updated.' : 'PIN removed.');
      });

      root.querySelector('#s-24h')?.addEventListener('change', e => State.update({ use24Hour: e.target.checked }));
      root.querySelector('#s-sec')?.addEventListener('change', e => State.update({ showSeconds: e.target.checked }));

      root.querySelector('#s-check-upd')?.addEventListener('click', () => {
        checkingUpdate = true;
        render();
        setTimeout(() => {
          checkingUpdate = false;
          updateStatus = 'You\'re up to date (Windows 10 22H2)';
          Sound.notify();
          render();
        }, 1600);
      });

      root.querySelector('#s-reset-os')?.addEventListener('click', () => {
        if (confirm('Reset all Windows 10 settings and virtual files to factory defaults?')) {
          VFS.reset();
          State.resetAll();
          window.Win10Shell?.notify('Recovery', 'Windows 10 has been reset to defaults.');
        }
      });
    };

    const unsub = State.subscribe(() => {
      if (root._isSliding && root._isSliding()) return;
      render();
    });
    api.setOnDestroy(() => unsub());
    render();

    return {
      onParams(p) {
        if (p.category) openPage(p.category, p.page);
      }
    };
  }
};
