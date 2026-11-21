/* ==========================================================================
   Classic Windows 10 Notepad (Menus, VFS Open/Save, Find/Replace, Zoom)
   ========================================================================== */

import { VFS } from '../vfs.js';
import { Sound } from '../sound.js';

export const NotepadApp = {
  id: 'notepad',
  name: 'Notepad',
  icon: 'notepad',
  width: 680,
  height: 460,
  minWidth: 360,
  minHeight: 240,

  mount(container, params, api) {
    let filePath = params.filePath || null;
    let dirty = false;
    let wordWrap = true;
    let showStatus = true;
    let zoomPct = 100;
    let openMenu = null;
    let showFind = false;

    const root = document.createElement('div');
    root.className = 'np-root';
    container.appendChild(root);

    root.innerHTML = `
      <div class="np-menubar" id="np-menubar">
        <button class="np-menu-trigger" data-menu="file">File</button>
        <button class="np-menu-trigger" data-menu="edit">Edit</button>
        <button class="np-menu-trigger" data-menu="format">Format</button>
        <button class="np-menu-trigger" data-menu="view">View</button>
        <button class="np-menu-trigger" data-menu="help">Help</button>
        <div class="np-dropdown hidden" id="np-dropdown"></div>
      </div>
      <div class="np-findbar hidden" id="np-findbar">
        <span>Find:</span>
        <input type="text" id="np-find-in" placeholder="Find what..." />
        <span>Replace:</span>
        <input type="text" id="np-rep-in" placeholder="Replace with..." />
        <button class="win32-btn" id="np-find-next">Find Next</button>
        <button class="win32-btn" id="np-rep-all">Replace All</button>
        <button class="win32-btn" id="np-find-close">✕</button>
      </div>
      <textarea class="np-textarea wrap" id="np-ta" spellcheck="false"></textarea>
      <div class="np-statusbar" id="np-status">
        <span id="np-pos">Ln 1, Col 1</span>
        <span id="np-zoom">100%</span>
        <span>Windows (CRLF)</span>
        <span>UTF-8</span>
      </div>
    `;

    const ta = root.querySelector('#np-ta');
    const dd = root.querySelector('#np-dropdown');
    const findbar = root.querySelector('#np-findbar');
    const statusEl = root.querySelector('#np-status');
    const posEl = root.querySelector('#np-pos');
    const zoomEl = root.querySelector('#np-zoom');

    const updateTitle = () => {
      const name = filePath ? VFS.splitPath(filePath).slice(-1)[0] : 'Untitled';
      api.setTitle(`${dirty ? '*' : ''}${name} - Notepad`);
    };

    const loadFile = (p) => {
      const node = VFS.getNode(p);
      if (node && node.type === 'file') {
        filePath = p;
        ta.value = node.content || '';
        dirty = false;
        updateTitle();
        updateCursor();
      }
    };

    const saveFile = (saveAs = false) => {
      if (!filePath || saveAs) {
        const defName = filePath ? VFS.splitPath(filePath).slice(-1)[0] : 'Document.txt';
        const input = prompt('Save file name (saved in C:\\Users\\User\\Documents or full path):', defName);
        if (!input) return false;
        let targetDir = 'C:\\Users\\User\\Documents';
        let name = input.trim();
        if (name.includes('\\')) {
          targetDir = VFS.getParentPath(name);
          name = VFS.splitPath(name).slice(-1)[0];
        }
        if (!name.includes('.')) name += '.txt';
        const written = VFS.writeFile(targetDir, name, ta.value);
        if (!written) { Sound.error(); return false; }
        filePath = written;
      } else {
        const dir = VFS.getParentPath(filePath);
        const name = VFS.splitPath(filePath).slice(-1)[0];
        VFS.writeFile(dir, name, ta.value);
      }
      dirty = false;
      updateTitle();
      window.Win10Shell?.notify('Notepad', `Saved ${VFS.splitPath(filePath).slice(-1)[0]}`);
      return true;
    };

    const openFilePrompt = () => {
      const docs = [...VFS.listDir('C:\\Users\\User\\Desktop'), ...VFS.listDir('C:\\Users\\User\\Documents')]
        .filter(f => f.type === 'file' && !['jpg', 'png', 'bmp'].includes(f.ext));
      const hint = docs.map(d => d.path).join('\n');
      const chosen = prompt(`Enter file path to open:\n\nAvailable text files:\n${hint}`, docs[0]?.path || 'C:\\Users\\User\\Desktop\\Welcome.txt');
      if (chosen) {
        if (VFS.getNode(chosen)) loadFile(chosen);
        else Sound.error();
      }
    };

    const updateCursor = () => {
      const val = ta.value.slice(0, ta.selectionStart);
      const lines = val.split('\n');
      posEl.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
    };

    const applyZoom = () => {
      ta.style.fontSize = Math.round(14 * (zoomPct / 100)) + 'px';
      zoomEl.textContent = zoomPct + '%';
    };

    const closeDropdown = () => {
      openMenu = null;
      dd.classList.add('hidden');
      root.querySelectorAll('.np-menu-trigger').forEach(b => b.classList.remove('open'));
    };

    const MENUS = {
      file: [
        { label: 'New', key: 'Ctrl+N', act: () => { filePath = null; ta.value = ''; dirty = false; updateTitle(); } },
        { label: 'Open...', key: 'Ctrl+O', act: openFilePrompt },
        { label: 'Save', key: 'Ctrl+S', act: () => saveFile(false) },
        { label: 'Save As...', act: () => saveFile(true) },
        { sep: true },
        { label: 'Exit', act: () => api.close() }
      ],
      edit: [
        { label: 'Undo', key: 'Ctrl+Z', act: () => document.execCommand('undo') },
        { sep: true },
        { label: 'Cut', key: 'Ctrl+X', act: () => document.execCommand('cut') },
        { label: 'Copy', key: 'Ctrl+C', act: () => document.execCommand('copy') },
        { label: 'Delete', key: 'Del', act: () => { const s = ta.selectionStart, e = ta.selectionEnd; ta.setRangeText('', s, e, 'end'); dirty = true; updateTitle(); } },
        { sep: true },
        { label: 'Find / Replace...', key: 'Ctrl+F', act: () => { showFind = true; findbar.classList.remove('hidden'); root.querySelector('#np-find-in').focus(); } },
        { label: 'Select All', key: 'Ctrl+A', act: () => ta.select() },
        { label: 'Time/Date', key: 'F5', act: () => { ta.setRangeText(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString(), ta.selectionStart, ta.selectionEnd, 'end'); dirty = true; updateTitle(); } }
      ],
      format: [
        { label: () => (wordWrap ? '✓ ' : '') + 'Word Wrap', act: () => { wordWrap = !wordWrap; ta.classList.toggle('wrap', wordWrap); } }
      ],
      view: [
        { label: 'Zoom In', key: 'Ctrl++', act: () => { zoomPct = Math.min(300, zoomPct + 10); applyZoom(); } },
        { label: 'Zoom Out', key: 'Ctrl+-', act: () => { zoomPct = Math.max(50, zoomPct - 10); applyZoom(); } },
        { label: 'Restore Default Zoom', key: 'Ctrl+0', act: () => { zoomPct = 100; applyZoom(); } },
        { sep: true },
        { label: () => (showStatus ? '✓ ' : '') + 'Status Bar', act: () => { showStatus = !showStatus; statusEl.classList.toggle('hidden', !showStatus); } }
      ],
      help: [
        { label: 'About Notepad', act: () => window.Win10Shell?.showWinver() }
      ]
    };

    root.querySelectorAll('.np-menu-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const m = btn.dataset.menu;
        if (openMenu === m) { closeDropdown(); return; }
        openMenu = m;
        root.querySelectorAll('.np-menu-trigger').forEach(b => b.classList.toggle('open', b === btn));
        dd.style.left = btn.offsetLeft + 'px';
        dd.innerHTML = MENUS[m].map((it, idx) =>
          it.sep ? `<div class="np-dd-sep"></div>` :
          `<button class="np-dd-item" data-idx="${idx}"><span>${typeof it.label === 'function' ? it.label() : it.label}</span><span style="opacity:.6;">${it.key || ''}</span></button>`
        ).join('');
        dd.querySelectorAll('.np-dd-item').forEach(itemBtn => {
          itemBtn.addEventListener('click', () => {
            const act = MENUS[m][+itemBtn.dataset.idx].act;
            closeDropdown();
            act();
          });
        });
        dd.classList.remove('hidden');
      });
    });

    root.addEventListener('click', closeDropdown);
    ta.addEventListener('input', () => { dirty = true; updateTitle(); updateCursor(); });
    ta.addEventListener('keyup', updateCursor);
    ta.addEventListener('click', updateCursor);
    ta.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(false); }
      if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); showFind = true; findbar.classList.remove('hidden'); root.querySelector('#np-find-in').focus(); }
      if (e.key === 'F5') { e.preventDefault(); MENUS.edit[8].act(); }
    });

    // Find & Replace
    root.querySelector('#np-find-close').addEventListener('click', () => { showFind = false; findbar.classList.add('hidden'); });
    root.querySelector('#np-find-next').addEventListener('click', () => {
      const q = root.querySelector('#np-find-in').value;
      if (!q) return;
      const start = ta.selectionEnd;
      let idx = ta.value.toLowerCase().indexOf(q.toLowerCase(), start);
      if (idx === -1) idx = ta.value.toLowerCase().indexOf(q.toLowerCase(), 0);
      if (idx !== -1) { ta.focus(); ta.setSelectionRange(idx, idx + q.length); updateCursor(); }
      else Sound.exclamation();
    });
    root.querySelector('#np-rep-all').addEventListener('click', () => {
      const q = root.querySelector('#np-find-in').value;
      const r = root.querySelector('#np-rep-in').value;
      if (!q) return;
      ta.value = ta.value.split(q).join(r);
      dirty = true;
      updateTitle();
    });

    api.setBeforeClose(() => {
      if (dirty) {
        const res = confirm('Do you want to save changes before closing Notepad?');
        if (res) saveFile(false);
      }
      return true;
    });

    if (filePath) loadFile(filePath);
    else updateTitle();
    setTimeout(() => ta.focus(), 40);
  }
};
