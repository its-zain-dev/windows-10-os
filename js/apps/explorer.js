/* ==========================================================================
   Windows 10 File Explorer (Ribbon, Breadcrumb, This PC, Recycle Bin, CRUD)
   ========================================================================== */

import { VFS } from '../vfs.js';
import { State } from '../state.js';
import { APP_ICONS } from '../icons.js';
import { Sound } from '../sound.js';

export const ExplorerApp = {
  id: 'explorer',
  name: 'File Explorer',
  icon: 'explorer',
  width: 880,
  height: 560,
  minWidth: 520,
  minHeight: 340,

  mount(container, params, api) {
    let currentPath = params.path || 'This PC';
    let history = [currentPath];
    let histIdx = 0;
    let selectedPath = null;
    let selectedRbId = null;
    let viewMode = 'details'; // 'details' | 'medium' | 'large'
    let activeRibbon = 'home';
    let searchQuery = '';
    let editingAddress = false;

    const root = document.createElement('div');
    root.className = 'exp-root';
    container.appendChild(root);

    const getItemIcon = (item) => {
      if (item.type === 'folder') return APP_ICONS.folder;
      const ext = (item.ext || '').toLowerCase();
      if (['jpg', 'jpeg', 'png', 'bmp', 'gif'].includes(ext)) return APP_ICONS.imagefile;
      return APP_ICONS.textfile;
    };

    const navigate = (path, push = true) => {
      const target = (path === 'This PC' || path === 'Recycle Bin') ? path : VFS.normalizePath(path);
      if (target !== 'This PC' && target !== 'Recycle Bin' && !VFS.getNode(target)) {
        Sound.error();
        window.Win10Shell?.notify('File Explorer', `Windows can't find '${path}'. Check the spelling and try again.`);
        return;
      }
      currentPath = target;
      selectedPath = null;
      selectedRbId = null;
      searchQuery = '';
      editingAddress = false;
      if (push) {
        history = history.slice(0, histIdx + 1);
        history.push(currentPath);
        histIdx = history.length - 1;
      }
      const titleName = currentPath === 'This PC' ? 'This PC'
        : currentPath === 'Recycle Bin' ? 'Recycle Bin'
        : currentPath === 'C:\\' ? 'Local Disk (C:)'
        : VFS.splitPath(currentPath).slice(-1)[0];
      api.setTitle(titleName);
      render();
    };

    const openItem = (item) => {
      if (item.type === 'folder') {
        navigate(item.path);
        return;
      }
      const ext = (item.ext || '').toLowerCase();
      if (['jpg', 'jpeg', 'png', 'bmp', 'gif'].includes(ext)) {
        api.openApp('photos', { filePath: item.path });
      } else {
        api.openApp('notepad', { filePath: item.path });
      }
    };

    const canModifyHere = () => currentPath !== 'This PC' && currentPath !== 'Recycle Bin';

    const renderRibbon = () => {
      if (currentPath === 'Recycle Bin') {
        const rbCount = VFS.getRecycleBin().length;
        return `
          <button class="exp-rbtn" id="exp-empty-rb" ${rbCount === 0 ? 'disabled' : ''}><span>🗑️</span><span>Empty Bin</span></button>
          <button class="exp-rbtn" id="exp-restore-sel" ${!selectedRbId ? 'disabled' : ''}><span>↩️</span><span>Restore item</span></button>
          <button class="exp-rbtn" id="exp-restore-all" ${rbCount === 0 ? 'disabled' : ''}><span>♻️</span><span>Restore all</span></button>
        `;
      }
      if (activeRibbon === 'view') {
        return `
          <button class="exp-rbtn" data-view="large"><span>🖼️</span><span>Large icons</span></button>
          <button class="exp-rbtn" data-view="medium"><span>🗂️</span><span>Medium icons</span></button>
          <button class="exp-rbtn" data-view="details"><span>📋</span><span>Details</span></button>
        `;
      }
      if (activeRibbon === 'share') {
        return `
          <button class="exp-rbtn" id="exp-prop-btn" ${!selectedPath ? 'disabled' : ''}><span>ℹ️</span><span>Properties</span></button>
          <button class="exp-rbtn" id="exp-copy-path" ${!selectedPath ? 'disabled' : ''}><span>🔗</span><span>Copy path</span></button>
        `;
      }
      const hasClip = State.clipboard && State.clipboard.type === 'vfs';
      return `
        <button class="exp-rbtn" id="exp-copy" ${!selectedPath ? 'disabled' : ''}><span>📄</span><span>Copy</span></button>
        <button class="exp-rbtn" id="exp-paste" ${!hasClip || !canModifyHere() ? 'disabled' : ''}><span>📋</span><span>Paste</span></button>
        <button class="exp-rbtn" id="exp-cut" ${!selectedPath ? 'disabled' : ''}><span>✂️</span><span>Cut</span></button>
        <div class="exp-rsep"></div>
        <button class="exp-rbtn" id="exp-delete" ${!selectedPath ? 'disabled' : ''}><span>🗑️</span><span>Delete</span></button>
        <button class="exp-rbtn" id="exp-rename" ${!selectedPath ? 'disabled' : ''}><span>✏️</span><span>Rename</span></button>
        <div class="exp-rsep"></div>
        <button class="exp-rbtn" id="exp-new-folder" ${!canModifyHere() ? 'disabled' : ''}><span>📁</span><span>New folder</span></button>
        <button class="exp-rbtn" id="exp-new-txt" ${!canModifyHere() ? 'disabled' : ''}><span>📝</span><span>New text</span></button>
        <div class="exp-rsep"></div>
        <button class="exp-rbtn" id="exp-prop-btn" ${!selectedPath ? 'disabled' : ''}><span>ℹ️</span><span>Properties</span></button>
      `;
    };

    const renderAddressCrumbs = () => {
      if (editingAddress) {
        return `<input type="text" class="exp-path-input" id="exp-path-input" value="${currentPath.replace(/"/g, '&quot;')}" />`;
      }
      if (currentPath === 'This PC' || currentPath === 'Recycle Bin') {
        return `<span class="exp-crumb" data-nav="${currentPath}">${currentPath}</span>`;
      }
      const parts = VFS.splitPath(currentPath);
      let acc = 'C:\\';
      let html = `<span class="exp-crumb" data-nav="This PC">This PC</span><span class="exp-crumb-sep">›</span><span class="exp-crumb" data-nav="C:\\">Local Disk (C:)</span>`;
      for (const p of parts) {
        acc = VFS.joinPath(acc, p);
        html += `<span class="exp-crumb-sep">›</span><span class="exp-crumb" data-nav="${acc}">${p}</span>`;
      }
      return html;
    };

    const renderMainContent = () => {
      if (currentPath === 'This PC' && !searchQuery) {
        const quickFolders = [
          { name: 'Desktop', path: 'C:\\Users\\User\\Desktop' },
          { name: 'Documents', path: 'C:\\Users\\User\\Documents' },
          { name: 'Downloads', path: 'C:\\Users\\User\\Downloads' },
          { name: 'Music', path: 'C:\\Users\\User\\Music' },
          { name: 'Pictures', path: 'C:\\Users\\User\\Pictures' },
          { name: 'Videos', path: 'C:\\Users\\User\\Videos' }
        ];
        return `
          <div class="thispc-section-hdr">Folders (6)</div>
          <div class="exp-grid">
            ${quickFolders.map(f => `
              <div class="exp-tile" data-open-folder="${f.path}">
                <div class="exp-tile-icon">${APP_ICONS.folder}</div>
                <div class="exp-tile-name">${f.name}</div>
              </div>
            `).join('')}
          </div>
          <div class="thispc-section-hdr" style="margin-top:20px;">Devices and drives (1)</div>
          <div class="thispc-drives">
            <div class="drive-card" data-open-folder="C:\\">
              <div class="drive-icon">${APP_ICONS.drive}</div>
              <div class="drive-info">
                <div class="drive-name">Local Disk (C:)</div>
                <div class="drive-bar-bg"><div class="drive-bar-fill" style="width: 38%;"></div></div>
                <div class="drive-space">148 GB free of 237 GB</div>
              </div>
            </div>
          </div>
        `;
      }

      if (currentPath === 'Recycle Bin') {
        const items = VFS.getRecycleBin();
        if (!items.length) {
          return `<div style="padding:24px;color:var(--app-text-secondary);text-align:center;">This folder is empty.</div>`;
        }
        return `
          <table class="exp-table">
            <thead><tr><th>Name</th><th>Original Location</th><th>Date deleted</th><th>Type</th></tr></thead>
            <tbody>
              ${items.map(r => `
                <tr class="exp-row ${selectedRbId === r.id ? 'selected' : ''}" data-rb-id="${r.id}">
                  <td><div class="exp-name-cell"><span class="exp-row-icon">${getItemIcon(r.node)}</span><span>${r.node.name}</span></div></td>
                  <td>${r.parentPath}</td>
                  <td>${new Date(r.deletedAt).toLocaleString()}</td>
                  <td>${VFS.getFileTypeLabel(r.node)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      const items = searchQuery
        ? VFS.searchAll(searchQuery)
        : VFS.listDir(currentPath);

      if (!items.length) {
        return `<div style="padding:24px;color:var(--app-text-secondary);text-align:center;">${searchQuery ? 'No items match your search.' : 'This folder is empty.'}</div>`;
      }

      if (viewMode === 'details') {
        return `
          <table class="exp-table">
            <thead><tr><th>Name</th><th>Date modified</th><th>Type</th><th>Size</th></tr></thead>
            <tbody>
              ${items.map(it => `
                <tr class="exp-row ${selectedPath === it.path ? 'selected' : ''}" data-item-path="${it.path}">
                  <td><div class="exp-name-cell"><span class="exp-row-icon">${getItemIcon(it)}</span><span>${it.name}</span></div></td>
                  <td>${new Date(it.modified).toLocaleString()}</td>
                  <td>${VFS.getFileTypeLabel(it)}</td>
                  <td>${it.type === 'folder' ? '' : VFS.formatSize(VFS.getSizeBytes(it))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      return `
        <div class="exp-grid ${viewMode === 'large' ? 'large' : ''}">
          ${items.map(it => `
            <div class="exp-tile ${selectedPath === it.path ? 'selected' : ''}" data-item-path="${it.path}">
              <div class="exp-tile-icon">${getItemIcon(it)}</div>
              <div class="exp-tile-name">${it.name}</div>
            </div>
          `).join('')}
        </div>
      `;
    };

    const render = () => {
      const sideItems = [
        { label: 'Desktop', path: 'C:\\Users\\User\\Desktop', icon: APP_ICONS.folder },
        { label: 'Downloads', path: 'C:\\Users\\User\\Downloads', icon: APP_ICONS.folder },
        { label: 'Documents', path: 'C:\\Users\\User\\Documents', icon: APP_ICONS.folder },
        { label: 'Pictures', path: 'C:\\Users\\User\\Pictures', icon: APP_ICONS.folder },
        { label: 'Music', path: 'C:\\Users\\User\\Music', icon: APP_ICONS.folder },
        { label: 'Videos', path: 'C:\\Users\\User\\Videos', icon: APP_ICONS.folder }
      ];

      const itemCount = currentPath === 'This PC' ? 7
        : currentPath === 'Recycle Bin' ? VFS.getRecycleBin().length
        : (searchQuery ? VFS.searchAll(searchQuery).length : VFS.listDir(currentPath).length);

      root.innerHTML = `
        <div class="exp-ribbon-tabs">
          <button class="exp-rtab file-tab" id="exp-file-tab">File</button>
          <button class="exp-rtab ${activeRibbon === 'home' ? 'active' : ''}" data-rtab="home">Home</button>
          <button class="exp-rtab ${activeRibbon === 'share' ? 'active' : ''}" data-rtab="share">Share</button>
          <button class="exp-rtab ${activeRibbon === 'view' ? 'active' : ''}" data-rtab="view">View</button>
        </div>
        <div class="exp-ribbon-bar">${renderRibbon()}</div>
        <div class="exp-nav-bar">
          <button class="exp-nav-btn" id="exp-back" title="Back" ${histIdx <= 0 ? 'disabled' : ''}>←</button>
          <button class="exp-nav-btn" id="exp-fwd" title="Forward" ${histIdx >= history.length - 1 ? 'disabled' : ''}>→</button>
          <button class="exp-nav-btn" id="exp-up" title="Up" ${currentPath === 'This PC' || currentPath === 'Recycle Bin' ? 'disabled' : ''}>↑</button>
          <div class="exp-address-bar" id="exp-addr">${renderAddressCrumbs()}</div>
          <input type="text" class="exp-search-box" id="exp-search" placeholder="Search ${currentPath === 'This PC' ? 'This PC' : 'folder'}" value="${searchQuery.replace(/"/g, '&quot;')}" />
        </div>
        <div class="exp-main">
          <div class="exp-sidebar">
            <div class="exp-side-section">Quick access</div>
            ${sideItems.map(s => `
              <button class="exp-side-item ${currentPath.toLowerCase() === s.path.toLowerCase() ? 'active' : ''}" data-nav="${s.path}">
                <span class="exp-side-icon">${s.icon}</span><span>${s.label}</span>
              </button>
            `).join('')}
            <div class="exp-side-section" style="margin-top:8px;">This PC</div>
            <button class="exp-side-item ${currentPath === 'This PC' ? 'active' : ''}" data-nav="This PC">
              <span class="exp-side-icon">${APP_ICONS.thispc}</span><span>This PC</span>
            </button>
            <button class="exp-side-item ${currentPath === 'C:\\' ? 'active' : ''}" data-nav="C:\\">
              <span class="exp-side-icon">${APP_ICONS.drive}</span><span>Local Disk (C:)</span>
            </button>
            <button class="exp-side-item ${currentPath === 'Recycle Bin' ? 'active' : ''}" data-nav="Recycle Bin">
              <span class="exp-side-icon">${VFS.getRecycleBin().length ? APP_ICONS.recycleFull : APP_ICONS.recycleEmpty}</span><span>Recycle Bin</span>
            </button>
          </div>
          <div class="exp-content" id="exp-content">${renderMainContent()}</div>
        </div>
        <div class="exp-statusbar">
          <span>${itemCount} item${itemCount === 1 ? '' : 's'}${selectedPath || selectedRbId ? '  |  1 item selected' : ''}</span>
          <div class="exp-view-toggles">
            <button class="${viewMode === 'details' ? 'active' : ''}" data-view="details" title="Details">Details</button>
            <button class="${viewMode === 'large' ? 'active' : ''}" data-view="large" title="Large thumbnails">Icons</button>
          </div>
        </div>
      `;

      bindEvents();
    };

    const doRename = () => {
      if (!selectedPath) return;
      const node = VFS.getNode(selectedPath);
      if (!node) return;
      const nn = prompt('Rename item:', node.name);
      if (nn && nn !== node.name) {
        const res = VFS.rename(selectedPath, nn);
        if (res) selectedPath = res;
        else Sound.error();
      }
    };

    const bindEvents = () => {
      root.querySelectorAll('[data-rtab]').forEach(b => {
        b.addEventListener('click', () => { activeRibbon = b.dataset.rtab; render(); });
      });
      root.querySelector('#exp-file-tab')?.addEventListener('click', () => {
        api.openApp('cmd', { cwd: canModifyHere() ? currentPath : 'C:\\Users\\User' });
      });
      root.querySelectorAll('[data-view]').forEach(b => {
        b.addEventListener('click', () => { viewMode = b.dataset.view; render(); });
      });
      root.querySelectorAll('[data-nav]').forEach(el => {
        el.addEventListener('click', (e) => { e.stopPropagation(); navigate(el.dataset.nav); });
      });
      root.querySelectorAll('[data-open-folder]').forEach(el => {
        el.addEventListener('dblclick', () => navigate(el.dataset.openFolder));
        el.addEventListener('click', () => {
          root.querySelectorAll('.exp-tile, .drive-card').forEach(x => x.classList.remove('selected'));
          el.classList.add('selected');
        });
      });

      root.querySelector('#exp-back')?.addEventListener('click', () => {
        if (histIdx > 0) { histIdx--; navigate(history[histIdx], false); }
      });
      root.querySelector('#exp-fwd')?.addEventListener('click', () => {
        if (histIdx < history.length - 1) { histIdx++; navigate(history[histIdx], false); }
      });
      root.querySelector('#exp-up')?.addEventListener('click', () => {
        if (currentPath === 'C:\\') navigate('This PC');
        else navigate(VFS.getParentPath(currentPath));
      });

      // Editable Address Bar
      const addr = root.querySelector('#exp-addr');
      addr?.addEventListener('click', (e) => {
        if (e.target === addr && !editingAddress) {
          editingAddress = true;
          render();
          const inp = root.querySelector('#exp-path-input');
          inp?.focus();
          inp?.select();
        }
      });
      const pathInp = root.querySelector('#exp-path-input');
      pathInp?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate(pathInp.value);
        if (e.key === 'Escape') { editingAddress = false; render(); }
      });
      pathInp?.addEventListener('blur', () => { editingAddress = false; render(); });

      // Live Search
      const searchEl = root.querySelector('#exp-search');
      searchEl?.addEventListener('input', () => {
        searchQuery = searchEl.value.trim();
        render();
        const s2 = root.querySelector('#exp-search');
        if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); }
      });

      // File/Folder rows & tiles
      root.querySelectorAll('[data-item-path]').forEach(el => {
        const p = el.dataset.itemPath;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedPath = p;
          render();
        });
        el.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const node = VFS.getNode(p);
          if (node) openItem({ ...node, path: p });
        });
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectedPath = p;
          render();
          const node = VFS.getNode(p);
          window.Win10Shell?.showContextMenu(e.clientX, e.clientY, [
            { label: 'Open', bold: true, action: () => node && openItem({ ...node, path: p }) },
            { sep: true },
            { label: 'Cut', action: () => { State.clipboard = { type: 'vfs', path: p, cut: true }; render(); } },
            { label: 'Copy', action: () => { State.clipboard = { type: 'vfs', path: p, cut: false }; render(); } },
            { sep: true },
            { label: 'Delete', action: () => { VFS.deleteToRecycleBin(p); Sound.recycle(); selectedPath = null; } },
            { label: 'Rename', action: () => doRename() },
            { sep: true },
            { label: 'Properties', action: () => window.Win10Shell?.showProperties(p) }
          ]);
        });
      });

      // Recycle Bin rows
      root.querySelectorAll('[data-rb-id]').forEach(el => {
        el.addEventListener('click', () => { selectedRbId = el.dataset.rbId; render(); });
      });

      // Ribbon actions
      root.querySelector('#exp-new-folder')?.addEventListener('click', () => {
        if (!canModifyHere()) return;
        selectedPath = VFS.createFolder(currentPath, 'New folder');
      });
      root.querySelector('#exp-new-txt')?.addEventListener('click', () => {
        if (!canModifyHere()) return;
        selectedPath = VFS.createFileUnique(currentPath, 'New Text Document.txt', '');
      });
      root.querySelector('#exp-delete')?.addEventListener('click', () => {
        if (!selectedPath) return;
        VFS.deleteToRecycleBin(selectedPath);
        Sound.recycle();
        selectedPath = null;
      });
      root.querySelector('#exp-rename')?.addEventListener('click', doRename);
      root.querySelector('#exp-copy')?.addEventListener('click', () => {
        if (selectedPath) { State.clipboard = { type: 'vfs', path: selectedPath, cut: false }; render(); }
      });
      root.querySelector('#exp-cut')?.addEventListener('click', () => {
        if (selectedPath) { State.clipboard = { type: 'vfs', path: selectedPath, cut: true }; render(); }
      });
      root.querySelector('#exp-paste')?.addEventListener('click', () => {
        if (State.clipboard?.type === 'vfs' && canModifyHere()) {
          VFS.copyNode(State.clipboard.path, currentPath, State.clipboard.cut);
          if (State.clipboard.cut) State.clipboard = null;
        }
      });
      root.querySelector('#exp-prop-btn')?.addEventListener('click', () => {
        if (selectedPath) window.Win10Shell?.showProperties(selectedPath);
      });
      root.querySelector('#exp-copy-path')?.addEventListener('click', () => {
        if (selectedPath) navigator.clipboard?.writeText(selectedPath).catch(() => {});
      });
      root.querySelector('#exp-empty-rb')?.addEventListener('click', () => {
        VFS.emptyRecycleBin();
        Sound.recycle();
        selectedRbId = null;
      });
      root.querySelector('#exp-restore-sel')?.addEventListener('click', () => {
        if (selectedRbId) { VFS.restoreFromRecycleBin(selectedRbId); selectedRbId = null; }
      });
      root.querySelector('#exp-restore-all')?.addEventListener('click', () => {
        [...VFS.getRecycleBin()].forEach(r => VFS.restoreFromRecycleBin(r.id));
        selectedRbId = null;
      });

      // Click empty space clears selection
      root.querySelector('#exp-content')?.addEventListener('click', (e) => {
        if (e.target.id === 'exp-content') { selectedPath = null; selectedRbId = null; render(); }
      });
    };

    const unsub = VFS.subscribe(() => render());
    api.setOnDestroy(() => unsub());
    navigate(currentPath, false);

    return {
      onParams(p) {
        if (p.path) navigate(p.path);
      }
    };
  }
};
