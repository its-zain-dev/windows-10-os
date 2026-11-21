/* ==========================================================================
   Windows 10 OS Entrypoint — App Registration, Shell Boot & Shortcuts
   ========================================================================== */

import { WM } from './wm.js';
import { Windows10Shell } from './shell.js';

import { ExplorerApp } from './apps/explorer.js';
import { SettingsApp } from './apps/settings.js';
import { NotepadApp } from './apps/notepad.js';
import { CalculatorApp } from './apps/calculator.js';
import { EdgeApp } from './apps/edge.js';
import { CmdApp } from './apps/cmd.js';
import { TaskMgrApp } from './apps/taskmgr.js';
import { PaintApp } from './apps/paint.js';
import { PhotosApp } from './apps/photos.js';
import { MinesweeperApp } from './apps/minesweeper.js';

// Register curated Windows 10 core apps
[
  ExplorerApp,
  SettingsApp,
  NotepadApp,
  CalculatorApp,
  EdgeApp,
  CmdApp,
  TaskMgrApp,
  PaintApp,
  PhotosApp,
  MinesweeperApp
].forEach(app => WM.registerApp(app));

const shell = new Windows10Shell();
window.Win10Shell = shell;
window.Win10WM = WM;

shell.init();

// Global Windows 10 Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  const locked = document.getElementById('lock-container').classList.contains('active') ||
                 document.getElementById('boot-screen').classList.contains('active');
  if (locked) return;

  // Alt+Tab window switcher
  if (e.altKey && e.key === 'Tab') {
    e.preventDefault();
    shell.cycleAltTab();
    return;
  }

  // Ctrl+Shift+Esc -> Task Manager
  if (e.ctrlKey && e.shiftKey && e.key === 'Escape') {
    e.preventDefault();
    WM.openApp('taskmgr');
    return;
  }

  // Alt+<Key> (works cleanly in browsers since OS captures real Win key!)
  if (e.altKey && !e.ctrlKey && !e.shiftKey) {
    const k = e.key.toLowerCase();
    if (k === 'r') { e.preventDefault(); shell.showRunDialog(); }
    if (k === 'e') { e.preventDefault(); WM.openApp('explorer'); }
    if (k === 'i') { e.preventDefault(); WM.openApp('settings'); }
    if (k === 'd') { e.preventDefault(); WM.toggleShowDesktop(); }
    if (k === 'l') { e.preventDefault(); shell.lock(); }
    if (k === 'x') { e.preventDefault(); shell.showWinXMenu(); }
  }

  // Escape closes popups / Task View
  if (e.key === 'Escape') {
    shell.closeAllPopups();
    shell.toggleTaskView(false);
  }

  // Desktop Icon keyboard shortcuts (F2 rename, Delete, Enter open) when no window focused
  if (!WM.activeId && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
    const sel = Array.from(shell.selectedDesktopIds);
    if (sel.length === 1 && e.key === 'F2' && sel[0].startsWith('vfs:')) {
      e.preventDefault();
      const vfsPath = sel[0].slice(4);
      const el = document.querySelector(`.desktop-icon[data-id="${CSS.escape(sel[0])}"]`);
      if (el) shell._startInlineRename(el, vfsPath);
    } else if (sel.length > 0 && e.key === 'Delete') {
      const vfsSel = sel.filter(id => id.startsWith('vfs:'));
      if (vfsSel.length) {
        e.preventDefault();
        import('./vfs.js').then(({ VFS }) => {
          vfsSel.forEach(id => VFS.deleteToRecycleBin(id.slice(4)));
          shell.selectedDesktopIds.clear();
        });
      }
    } else if (sel.length > 0 && e.key === 'Enter') {
      e.preventDefault();
      sel.forEach(id => {
        const el = document.querySelector(`.desktop-icon[data-id="${CSS.escape(id)}"]`);
        el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      });
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Alt') {
    shell.commitAltTab();
  }
});
