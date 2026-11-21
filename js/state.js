/* ==========================================================================
   Central Windows 10 OS State Store (Persisted in localStorage)
   ========================================================================== */

import { setSoundVolume } from './sound.js';

const STATE_KEY = 'win10_os_state_v1';

export const WIN10_ACCENTS = [
  '#ffb900', '#ff8c00', '#f7630c', '#ca5010', '#da3b01', '#ef6950', '#d13438', '#ff4343',
  '#e74856', '#e81123', '#ea005e', '#c30052', '#e3008c', '#bf0077', '#c239b3', '#9a0089',
  '#0078d7', '#0063b1', '#8e8cd8', '#6b69d6', '#8764b8', '#744da9', '#b146c2', '#881798',
  '#0099bc', '#2d7d9a', '#00b7c3', '#038387', '#00b294', '#018574', '#00cc6a', '#10893e'
];

export const WALLPAPERS = [
  { id: 'hero-dark', name: 'Windows 10 Hero', src: 'assets/hero-dark.jpg' },
  { id: 'hero-light', name: 'Windows 10 Light', src: 'assets/hero-light.jpg' },
  { id: 'lock-cave', name: 'Beach Cave', src: 'assets/lock-cave.jpg' },
  { id: 'alpine', name: 'Alpine Lake', src: 'assets/wallpaper-alpine.jpg' }
];

export const DEFAULT_TILES = [
  { group: 'Productivity', appId: 'edge', label: 'Microsoft Edge', size: 'medium', color: '#0078d7' },
  { group: 'Productivity', appId: 'explorer', label: 'File Explorer', size: 'medium', color: '#0078d7' },
  { group: 'Productivity', appId: 'calendar-flyout', label: 'Calendar', size: 'medium', color: '#0078d7', live: 'calendar' },
  { group: 'Productivity', appId: 'notepad', label: 'Notepad', size: 'medium', color: '#0063b1' },
  { group: 'Productivity', appId: 'calculator', label: 'Calculator', size: 'medium', color: '#2d7d9a' },
  { group: 'Productivity', appId: 'settings', label: 'Settings', size: 'medium', color: '#0078d7' },
  { group: 'Explore', appId: 'weather-mock', label: 'Weather', size: 'wide', color: '#1b75bc', live: 'weather' },
  { group: 'Explore', appId: 'photos', label: 'Photos', size: 'medium', color: '#0078d7', live: 'photos' },
  { group: 'Explore', appId: 'paint', label: 'Paint', size: 'medium', color: '#0099bc' },
  { group: 'Explore', appId: 'cmd', label: 'Command Prompt', size: 'medium', color: '#2b2b2b' },
  { group: 'Explore', appId: 'taskmgr', label: 'Task Manager', size: 'small', color: '#10893e' },
  { group: 'Explore', appId: 'minesweeper', label: 'Minesweeper', size: 'small', color: '#744da9' }
];

function createDefaultState() {
  return {
    pcName: 'DESKTOP-WIN10PC',
    username: 'User',
    pin: '', // empty = instant Sign in button
    winTheme: 'dark', // 'dark' | 'light'
    appTheme: 'dark', // 'dark' | 'light'
    accentColor: '#0078d7',
    accentOnShell: false,
    accentOnTitlebar: false,
    transparency: true,
    wallpaper: 'assets/hero-dark.jpg',
    wallpaperColor: '#001830',
    wallpaperMode: 'picture', // 'picture' | 'solid'
    lockWallpaper: 'assets/lock-cave.jpg',
    brightness: 100,
    nightLight: false,
    nightLightStrength: 45,
    volume: 72,
    muted: false,
    wifiEnabled: true,
    connectedWifi: 'HomeWiFi-5G',
    airplaneMode: false,
    bluetooth: true,
    location: true,
    hotspot: false,
    focusAssist: false,
    batterySaver: false,
    powerMode: 1, // 0..3
    use24Hour: false,
    showSeconds: false,
    keyboardLayout: 'ENG',
    taskbarLock: true,
    taskbarAutoHide: false,
    smallTaskbar: false,
    searchMode: 'box', // 'box' | 'icon' | 'hidden'
    showTaskViewBtn: true,
    desktopIconSize: 'medium', // 'small' | 'medium' | 'large'
    desktopAutoArrange: true,
    desktopAlignGrid: true,
    desktopShowIcons: true,
    desktopIconPositions: {},
    pinnedApps: ['explorer', 'edge', 'notepad', 'calculator', 'cmd', 'settings'],
    startTiles: DEFAULT_TILES,
    notifications: [
      {
        id: 'n_welcome',
        app: 'Windows Security',
        title: 'Your device is protected',
        body: 'No threats found. Windows 10 Pro 22H2 is ready to use.',
        time: 'Just now'
      }
    ],
    calendarEvents: {} // 'YYYY-M-D': ['Event 1']
  };
}

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

class OSState {
  constructor() {
    this.listeners = new Set();
    this.clipboard = null; // { type: 'vfs', path, cut }
    this.data = this._load();
  }

  _load() {
    const def = createDefaultState();
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) return { ...def, ...JSON.parse(raw) };
    } catch {}
    return def;
  }

  _save() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(this.data));
    } catch {}
  }

  get() {
    return this.data;
  }

  update(patch) {
    Object.assign(this.data, patch);
    this._save();
    this.applyVisuals();
    this.listeners.forEach(fn => fn(this.data, patch));
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  resetAll() {
    localStorage.removeItem(STATE_KEY);
    this.data = createDefaultState();
    this._save();
    this.applyVisuals();
    this.listeners.forEach(fn => fn(this.data, this.data));
  }

  applyVisuals() {
    const s = this.data;
    const html = document.documentElement;
    html.setAttribute('data-win-theme', s.winTheme);
    html.setAttribute('data-app-theme', s.appTheme);
    html.setAttribute('data-accent-shell', String(s.accentOnShell));
    html.setAttribute('data-accent-titlebar', String(s.accentOnTitlebar));
    html.setAttribute('data-transparency', String(s.transparency));
    html.setAttribute('data-small-taskbar', String(s.smallTaskbar));

    html.style.setProperty('--accent', s.accentColor);
    html.style.setProperty('--accent-rgb', hexToRgb(s.accentColor));
    html.style.setProperty('--accent-hover', shadeColor(s.accentColor, 12));
    html.style.setProperty('--accent-light', shadeColor(s.accentColor, 26));
    html.style.setProperty('--accent-dark', shadeColor(s.accentColor, -22));

    // Wallpaper
    const wp = document.getElementById('desktop-wallpaper');
    if (wp) {
      if (s.wallpaperMode === 'solid') {
        wp.style.backgroundImage = 'none';
        wp.style.backgroundColor = s.wallpaperColor;
      } else {
        wp.style.backgroundImage = `url('${s.wallpaper}')`;
        wp.style.backgroundColor = '#001830';
      }
    }

    // Lock / Login Background
    const lockCurtain = document.getElementById('lock-curtain');
    const loginBg = document.getElementById('login-bg');
    if (lockCurtain) lockCurtain.style.backgroundImage = `url('${s.lockWallpaper}')`;
    if (loginBg) loginBg.style.backgroundImage = `url('${s.lockWallpaper}')`;

    // Brightness & Night light
    const brightOv = document.getElementById('display-brightness-overlay');
    if (brightOv) {
      brightOv.style.opacity = ((100 - s.brightness) / 100 * 0.72).toFixed(3);
    }
    const nightOv = document.getElementById('display-nightlight-overlay');
    if (nightOv) {
      nightOv.style.opacity = s.nightLight ? ((s.nightLightStrength / 100) * 0.85).toFixed(3) : '0';
    }

    // Taskbar options
    const tb = document.getElementById('taskbar');
    if (tb) tb.classList.toggle('autohide', !!s.taskbarAutoHide);

    const searchWrap = document.getElementById('tb-search-wrap');
    const searchIconBtn = document.getElementById('tb-search-icon-btn');
    if (searchWrap && searchIconBtn) {
      searchWrap.classList.toggle('hidden', s.searchMode !== 'box');
      searchIconBtn.classList.toggle('hidden', s.searchMode !== 'icon');
    }

    const tvBtn = document.getElementById('tb-taskview-btn');
    if (tvBtn) tvBtn.classList.toggle('hidden', !s.showTaskViewBtn);

    // Sound engine
    setSoundVolume(s.volume, s.muted);
  }
}

export const State = new OSState();
