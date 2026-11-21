/* ==========================================================================
   Windows 10 Photos App — Gallery Viewer, Zoom, Rotate, Set as Wallpaper
   ========================================================================== */

import { VFS } from '../vfs.js';
import { State } from '../state.js';

export const PhotosApp = {
  id: 'photos',
  name: 'Photos',
  icon: 'photos',
  width: 820,
  height: 560,
  minWidth: 460,
  minHeight: 340,

  mount(container, params, api) {
    let zoom = 1;
    let rotation = 0;

    const getImages = () => {
      const all = [
        ...VFS.listDir('C:\\Users\\User\\Pictures'),
        ...VFS.listDir('C:\\Users\\User\\Desktop')
      ].filter(f => f.type === 'file' && f.src);
      return all;
    };

    let images = getImages();
    let idx = 0;
    if (params.filePath) {
      const found = images.findIndex(i => i.path.toLowerCase() === params.filePath.toLowerCase());
      if (found >= 0) idx = found;
      else {
        const node = VFS.getNode(params.filePath);
        if (node && node.src) { images.unshift({ ...node, path: params.filePath }); idx = 0; }
      }
    }

    const root = document.createElement('div');
    root.className = 'photos-root';
    container.appendChild(root);

    const render = () => {
      images = getImages();
      if (idx >= images.length) idx = Math.max(0, images.length - 1);
      const curr = images[idx];
      api.setTitle(curr ? `${curr.name} - Photos` : 'Photos');

      root.innerHTML = `
        <div class="photos-toolbar">
          <div style="font-size:13px;">${curr ? curr.name : 'No photos'}</div>
          <div class="photos-actions">
            <button class="photos-btn" id="ph-zout" title="Zoom out">－</button>
            <button class="photos-btn" id="ph-zin" title="Zoom in">＋</button>
            <button class="photos-btn" id="ph-rot" title="Rotate">↻ Rotate</button>
            <button class="photos-btn" id="ph-wp" title="Set as Desktop Background">🖼️ Set as background</button>
          </div>
        </div>
        <div class="photos-stage">
          ${curr ? `
            <button class="photos-nav prev" id="ph-prev">‹</button>
            <img src="${curr.src}" alt="${curr.name}" style="transform:scale(${zoom}) rotate(${rotation}deg);" />
            <button class="photos-nav next" id="ph-next">›</button>
          ` : '<div style="opacity:.6;">No images in Pictures folder.</div>'}
        </div>
        <div class="photos-filmstrip">
          ${images.map((im, i) => `
            <img class="photos-thumb ${i === idx ? 'active' : ''}" src="${im.src}" data-i="${i}" title="${im.name}" />
          `).join('')}
        </div>
      `;

      root.querySelector('#ph-zout')?.addEventListener('click', () => { zoom = Math.max(0.4, zoom - 0.2); render(); });
      root.querySelector('#ph-zin')?.addEventListener('click', () => { zoom = Math.min(3, zoom + 0.2); render(); });
      root.querySelector('#ph-rot')?.addEventListener('click', () => { rotation = (rotation + 90) % 360; render(); });
      root.querySelector('#ph-prev')?.addEventListener('click', () => { idx = (idx - 1 + images.length) % images.length; zoom = 1; rotation = 0; render(); });
      root.querySelector('#ph-next')?.addEventListener('click', () => { idx = (idx + 1) % images.length; zoom = 1; rotation = 0; render(); });
      root.querySelector('#ph-wp')?.addEventListener('click', () => {
        if (!curr) return;
        State.update({ wallpaper: curr.src, wallpaperMode: 'picture' });
        window.Win10Shell?.notify('Photos', `"${curr.name}" set as Desktop background.`);
      });
      root.querySelectorAll('.photos-thumb').forEach(el => {
        el.addEventListener('click', () => { idx = +el.dataset.i; zoom = 1; rotation = 0; render(); });
      });
    };

    const unsub = VFS.subscribe(() => render());
    api.setOnDestroy(() => unsub());
    render();
  }
};
