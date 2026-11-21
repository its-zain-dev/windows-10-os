/* ==========================================================================
   Persistent Virtual File System (VFS) for Windows 10
   Supports C:\ tree, Recycle Bin with restore metadata, and localStorage sync
   ========================================================================== */

const STORAGE_KEY = 'win10_os_vfs_v1';

const nowStr = () => new Date().toISOString();

function createDefaultVFS() {
  return {
    root: {
      name: 'C:',
      type: 'drive',
      modified: nowStr(),
      children: {
        Users: {
          name: 'Users',
          type: 'folder',
          modified: nowStr(),
          children: {
            User: {
              name: 'User',
              type: 'folder',
              modified: nowStr(),
              children: {
                Desktop: {
                  name: 'Desktop',
                  type: 'folder',
                  modified: nowStr(),
                  children: {
                    'Welcome.txt': {
                      name: 'Welcome.txt',
                      type: 'file',
                      ext: 'txt',
                      modified: nowStr(),
                      content:
`Welcome to Windows 10!
=======================

This is a faithful Windows 10 Desktop OS replica.

Try out:
- Start Menu (Live Tiles, A-Z Apps, Left Rail, Win+X right-click)
- Taskbar Search, Action Center (Night Light, Brightness, Quick Actions)
- Calendar & Clock Flyout, Wi-Fi, Volume, Battery & Task View Virtual Desktops
- Aero Snap: drag any window to the left, right, top, or corners!
- Core Apps: File Explorer, Settings, Notepad, Calculator, Microsoft Edge,
  Command Prompt (try 'help', 'dir', 'winver', or 'bsod'!), Task Manager,
  Paint, Photos, and Minesweeper.
- Shortcuts: Win+R (Run), Win+E (Explorer), Win+I (Settings),
  Win+L (Lock), Win+D (Show Desktop), Alt+Tab (Window Switcher).
`
                    }
                  }
                },
                Documents: {
                  name: 'Documents',
                  type: 'folder',
                  modified: nowStr(),
                  children: {
                    'Notes.txt': {
                      name: 'Notes.txt',
                      type: 'file',
                      ext: 'txt',
                      modified: nowStr(),
                      content: 'Project Checklist:\n- Review Windows 10 UI fidelity\n- Test File Explorer & Notepad saving\n- Try Dark & Light mode in Settings > Personalization > Colors\n'
                    },
                    'Keyboard Shortcuts.txt': {
                      name: 'Keyboard Shortcuts.txt',
                      type: 'file',
                      ext: 'txt',
                      modified: nowStr(),
                      content: 'Windows 10 Keyboard Shortcuts:\n- Alt + R / Win + R : Run Dialog\n- Alt + E / Win + E : File Explorer\n- Alt + I / Win + I : Settings\n- Alt + D / Win + D : Show Desktop\n- Alt + L / Win + L : Lock Screen\n- Alt + Tab         : Switch Windows\n- Ctrl + Shift + Esc: Task Manager\n'
                    }
                  }
                },
                Downloads: {
                  name: 'Downloads',
                  type: 'folder',
                  modified: nowStr(),
                  children: {
                    'readme_setup.txt': {
                      name: 'readme_setup.txt',
                      type: 'file',
                      ext: 'txt',
                      modified: nowStr(),
                      content: 'Windows 10 Version 22H2 (OS Build 19045.4651)\nAll components installed and ready.\n'
                    }
                  }
                },
                Pictures: {
                  name: 'Pictures',
                  type: 'folder',
                  modified: nowStr(),
                  children: {
                    'Windows 10 Hero.jpg': {
                      name: 'Windows 10 Hero.jpg',
                      type: 'file',
                      ext: 'jpg',
                      modified: nowStr(),
                      src: 'assets/hero-dark.jpg'
                    },
                    'Windows 10 Light.jpg': {
                      name: 'Windows 10 Light.jpg',
                      type: 'file',
                      ext: 'jpg',
                      modified: nowStr(),
                      src: 'assets/hero-light.jpg'
                    },
                    'Beach Cave.jpg': {
                      name: 'Beach Cave.jpg',
                      type: 'file',
                      ext: 'jpg',
                      modified: nowStr(),
                      src: 'assets/lock-cave.jpg'
                    },
                    'Alpine Sunrise.jpg': {
                      name: 'Alpine Sunrise.jpg',
                      type: 'file',
                      ext: 'jpg',
                      modified: nowStr(),
                      src: 'assets/wallpaper-alpine.jpg'
                    }
                  }
                },
                Music: {
                  name: 'Music',
                  type: 'folder',
                  modified: nowStr(),
                  children: {}
                },
                Videos: {
                  name: 'Videos',
                  type: 'folder',
                  modified: nowStr(),
                  children: {}
                }
              }
            }
          }
        },
        Windows: {
          name: 'Windows',
          type: 'folder',
          modified: nowStr(),
          children: {
            System32: {
              name: 'System32',
              type: 'folder',
              modified: nowStr(),
              children: {
                'winver.txt': {
                  name: 'winver.txt',
                  type: 'file',
                  ext: 'txt',
                  modified: nowStr(),
                  content: 'Microsoft Windows 10 Pro\nVersion 22H2 (OS Build 19045.4651)\n'
                }
              }
            }
          }
        },
        'Program Files': {
          name: 'Program Files',
          type: 'folder',
          modified: nowStr(),
          children: {}
        }
      }
    },
    recycleBin: [] // { id, origPath, parentPath, node, deletedAt }
  };
}

class VirtualFS {
  constructor() {
    this.listeners = new Set();
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.root && parsed.root.children) return parsed;
      }
    } catch {}
    return createDefaultVFS();
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {}
    this.listeners.forEach(fn => fn());
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = createDefaultVFS();
    this._save();
  }

  normalizePath(p) {
    if (!p) return 'C:\\';
    let clean = p.replace(/\//g, '\\').trim();
    if (/^[a-zA-Z]:$/.test(clean)) clean += '\\';
    if (!clean.toUpperCase().startsWith('C:\\') && clean !== 'This PC' && clean !== 'Recycle Bin') {
      clean = 'C:\\' + clean.replace(/^\\+/, '');
    }
    if (clean.length > 3 && clean.endsWith('\\')) clean = clean.slice(0, -1);
    return clean;
  }

  splitPath(p) {
    const norm = this.normalizePath(p);
    if (norm === 'C:\\') return [];
    return norm.slice(3).split('\\').filter(Boolean);
  }

  joinPath(parent, name) {
    const p = this.normalizePath(parent);
    return p.endsWith('\\') ? p + name : p + '\\' + name;
  }

  getParentPath(p) {
    const parts = this.splitPath(p);
    if (parts.length <= 1) return 'C:\\';
    return 'C:\\' + parts.slice(0, -1).join('\\');
  }

  getNode(p) {
    const norm = this.normalizePath(p);
    if (norm === 'C:\\') return this.data.root;
    const parts = this.splitPath(norm);
    let curr = this.data.root;
    for (const part of parts) {
      if (!curr.children) return null;
      // Case-insensitive lookup just like real Windows!
      const matchKey = Object.keys(curr.children).find(k => k.toLowerCase() === part.toLowerCase());
      if (!matchKey) return null;
      curr = curr.children[matchKey];
    }
    return curr;
  }

  listDir(p) {
    const node = this.getNode(p);
    if (!node || !node.children) return [];
    const base = this.normalizePath(p);
    return Object.values(node.children).map(child => ({
      ...child,
      path: this.joinPath(base, child.name)
    })).sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  uniqueName(dirPath, desiredName) {
    const dir = this.getNode(dirPath);
    if (!dir || !dir.children) return desiredName;
    const existing = new Set(Object.keys(dir.children).map(k => k.toLowerCase()));
    if (!existing.has(desiredName.toLowerCase())) return desiredName;
    const dot = desiredName.lastIndexOf('.');
    const hasExt = dot > 0;
    const stem = hasExt ? desiredName.slice(0, dot) : desiredName;
    const ext = hasExt ? desiredName.slice(dot) : '';
    let i = 2;
    while (existing.has(`${stem} (${i})${ext}`.toLowerCase())) i++;
    return `${stem} (${i})${ext}`;
  }

  createFolder(dirPath, name = 'New folder') {
    const dir = this.getNode(dirPath);
    if (!dir || !dir.children) return null;
    const finalName = this.uniqueName(dirPath, name);
    dir.children[finalName] = {
      name: finalName,
      type: 'folder',
      modified: nowStr(),
      children: {}
    };
    this._save();
    return this.joinPath(dirPath, finalName);
  }

  writeFile(dirPath, name, content = '', extra = {}) {
    const dir = this.getNode(dirPath);
    if (!dir || !dir.children) return null;
    const existingKey = Object.keys(dir.children).find(k => k.toLowerCase() === name.toLowerCase());
    const finalName = existingKey || name;
    const dot = finalName.lastIndexOf('.');
    const ext = dot > 0 ? finalName.slice(dot + 1).toLowerCase() : 'txt';
    dir.children[finalName] = {
      name: finalName,
      type: 'file',
      ext,
      modified: nowStr(),
      content,
      ...extra
    };
    this._save();
    return this.joinPath(dirPath, finalName);
  }

  createFileUnique(dirPath, name, content = '', extra = {}) {
    const finalName = this.uniqueName(dirPath, name);
    return this.writeFile(dirPath, finalName, content, extra);
  }

  rename(path, newName) {
    const cleanNew = newName.trim().replace(/[\\/:*?"<>|]/g, '');
    if (!cleanNew) return false;
    const parentPath = this.getParentPath(path);
    const parent = this.getNode(parentPath);
    const oldParts = this.splitPath(path);
    const oldName = oldParts[oldParts.length - 1];
    if (!parent || !parent.children) return false;
    const oldKey = Object.keys(parent.children).find(k => k.toLowerCase() === oldName.toLowerCase());
    if (!oldKey) return false;
    if (oldKey.toLowerCase() !== cleanNew.toLowerCase() &&
        Object.keys(parent.children).some(k => k.toLowerCase() === cleanNew.toLowerCase())) {
      return false;
    }
    const node = parent.children[oldKey];
    delete parent.children[oldKey];
    node.name = cleanNew;
    if (node.type === 'file') {
      const dot = cleanNew.lastIndexOf('.');
      node.ext = dot > 0 ? cleanNew.slice(dot + 1).toLowerCase() : '';
    }
    node.modified = nowStr();
    parent.children[cleanNew] = node;
    this._save();
    return this.joinPath(parentPath, cleanNew);
  }

  deleteToRecycleBin(path) {
    const parentPath = this.getParentPath(path);
    const parent = this.getNode(parentPath);
    const parts = this.splitPath(path);
    const name = parts[parts.length - 1];
    if (!parent || !parent.children) return false;
    const key = Object.keys(parent.children).find(k => k.toLowerCase() === name.toLowerCase());
    if (!key) return false;
    const node = parent.children[key];
    delete parent.children[key];
    this.data.recycleBin.push({
      id: 'rb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      origPath: this.normalizePath(path),
      parentPath,
      node,
      deletedAt: nowStr()
    });
    this._save();
    return true;
  }

  restoreFromRecycleBin(id) {
    const idx = this.data.recycleBin.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const entry = this.data.recycleBin[idx];
    const parent = this.getNode(entry.parentPath) || this.getNode('C:\\Users\\User\\Desktop');
    const targetName = this.uniqueName(entry.parentPath, entry.node.name);
    entry.node.name = targetName;
    parent.children[targetName] = entry.node;
    this.data.recycleBin.splice(idx, 1);
    this._save();
    return true;
  }

  emptyRecycleBin() {
    this.data.recycleBin = [];
    this._save();
  }

  getRecycleBin() {
    return this.data.recycleBin;
  }

  copyNode(srcPath, destDirPath, cut = false) {
    const srcNode = this.getNode(srcPath);
    const destDir = this.getNode(destDirPath);
    if (!srcNode || !destDir || !destDir.children) return false;
    const clone = JSON.parse(JSON.stringify(srcNode));
    const newName = this.uniqueName(destDirPath, clone.name);
    clone.name = newName;
    clone.modified = nowStr();
    destDir.children[newName] = clone;
    if (cut) {
      const parent = this.getNode(this.getParentPath(srcPath));
      if (parent && parent.children) {
        const key = Object.keys(parent.children).find(k => k.toLowerCase() === srcNode.name.toLowerCase());
        if (key) delete parent.children[key];
      }
    }
    this._save();
    return this.joinPath(destDirPath, newName);
  }

  searchAll(query) {
    const q = query.toLowerCase();
    const results = [];
    const walk = (node, currPath) => {
      if (!node.children) return;
      for (const child of Object.values(node.children)) {
        const full = this.joinPath(currPath, child.name);
        if (child.name.toLowerCase().includes(q)) {
          results.push({ ...child, path: full });
        }
        if (child.type === 'folder') walk(child, full);
      }
    };
    walk(this.data.root, 'C:\\');
    return results;
  }

  getSizeBytes(node) {
    if (!node) return 0;
    if (node.type === 'file') {
      if (node.src) return 428150;
      return (node.content || '').length;
    }
    if (node.children) {
      return Object.values(node.children).reduce((sum, c) => sum + this.getSizeBytes(c), 0);
    }
    return 0;
  }

  formatSize(bytes) {
    if (bytes < 1024) return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  getFileTypeLabel(node) {
    if (!node) return 'File';
    if (node.type === 'folder') return 'File folder';
    const ext = (node.ext || '').toLowerCase();
    if (ext === 'txt') return 'Text Document';
    if (ext === 'png') return 'PNG File';
    if (ext === 'jpg' || ext === 'jpeg') return 'JPEG Image';
    if (ext === 'bmp') return 'Bitmap Image';
    return ext ? `${ext.toUpperCase()} File` : 'File';
  }
}

export const VFS = new VirtualFS();
