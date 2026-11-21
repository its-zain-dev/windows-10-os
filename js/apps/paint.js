/* ==========================================================================
   Classic Windows 10 Paint (mspaint) — Tools, Shapes, Flood Fill, VFS PNG Save
   ========================================================================== */

import { VFS } from '../vfs.js';

const PALETTE = [
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7'
];

export const PaintApp = {
  id: 'paint',
  name: 'Paint',
  icon: 'paint',
  width: 860,
  height: 580,
  minWidth: 520,
  minHeight: 380,

  mount(container, params, api) {
    let tool = 'pencil'; // pencil | eraser | fill | line | rect | ellipse | picker
    let color = '#000000';
    let brushSize = 4;
    let drawing = false;
    let startX = 0, startY = 0;
    let snapshot = null;
    const undoStack = [];

    const root = document.createElement('div');
    root.className = 'paint-root';
    root.innerHTML = `
      <div class="paint-ribbon">
        <div class="paint-group">
          <button class="paint-tool" id="pt-save" title="Save to Pictures">💾 Save</button>
          <button class="paint-tool" id="pt-undo" title="Undo">↩ Undo</button>
          <button class="paint-tool" id="pt-clear" title="Clear Canvas">🗑 Clear</button>
        </div>
        <div class="paint-group">
          <button class="paint-tool active" data-tool="pencil">✏️ Pencil</button>
          <button class="paint-tool" data-tool="fill">🪣 Fill</button>
          <button class="paint-tool" data-tool="eraser">🧽 Eraser</button>
          <button class="paint-tool" data-tool="picker">💧 Picker</button>
          <button class="paint-tool" data-tool="line">╱ Line</button>
          <button class="paint-tool" data-tool="rect">▭ Rect</button>
          <button class="paint-tool" data-tool="ellipse">◯ Oval</button>
        </div>
        <div class="paint-group">
          <label style="font-size:11.5px;display:flex;align-items:center;gap:6px;">
            Size
            <input type="range" id="pt-size" min="1" max="28" value="4" style="width:74px;" />
          </label>
        </div>
        <div class="paint-group" style="border:none;">
          <input type="color" id="pt-color-pick" value="#000000" title="Color 1" style="width:30px;height:30px;border:1px solid #888;cursor:pointer;" />
          <div class="paint-palette" id="pt-palette">
            ${PALETTE.map(c => `<button class="paint-swatch ${c === '#000000' ? 'active' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}
          </div>
        </div>
      </div>
      <div class="paint-stage">
        <canvas class="paint-canvas" id="pt-canvas" width="760" height="430"></canvas>
      </div>
      <div class="paint-statusbar">
        <span id="pt-coords">0, 0px</span>
        <span>760 × 430px</span>
      </div>
    `;
    container.appendChild(root);

    const canvas = root.querySelector('#pt-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const coordsEl = root.querySelector('#pt-coords');
    const colorPick = root.querySelector('#pt-color-pick');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pushUndo = () => {
      undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (undoStack.length > 25) undoStack.shift();
    };

    const hexToRgba = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    };

    const floodFill = (sx, sy, fillHex) => {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = img.data;
      const w = canvas.width, h = canvas.height;
      const idx0 = (sy * w + sx) * 4;
      const target = [d[idx0], d[idx0 + 1], d[idx0 + 2], d[idx0 + 3]];
      const fill = hexToRgba(fillHex);
      if (target.every((v, i) => v === fill[i])) return;
      const match = (i) => Math.abs(d[i] - target[0]) < 12 && Math.abs(d[i + 1] - target[1]) < 12 && Math.abs(d[i + 2] - target[2]) < 12;
      const stack = [[sx, sy]];
      while (stack.length) {
        const [x, y] = stack.pop();
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const idx = (y * w + x) * 4;
        if (!match(idx)) continue;
        d[idx] = fill[0]; d[idx + 1] = fill[1]; d[idx + 2] = fill[2]; d[idx + 3] = 255;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      ctx.putImageData(img, 0, 0);
    };

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [Math.floor(e.clientX - r.left), Math.floor(e.clientY - r.top)];
    };

    canvas.addEventListener('pointerdown', (e) => {
      const [x, y] = getPos(e);
      startX = x; startY = y;
      if (tool === 'picker') {
        const px = ctx.getImageData(x, y, 1, 1).data;
        color = '#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join('');
        colorPick.value = color;
        return;
      }
      pushUndo();
      if (tool === 'fill') {
        floodFill(x, y, color);
        return;
      }
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      ctx.lineWidth = tool === 'eraser' ? brushSize * 2.5 : brushSize;
      if (tool === 'pencil' || tool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.1, y + 0.1);
        ctx.stroke();
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      const [x, y] = getPos(e);
      coordsEl.textContent = `${x}, ${y}px`;
      if (!drawing) return;
      if (tool === 'pencil' || tool === 'eraser') {
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.putImageData(snapshot, 0, 0);
        ctx.beginPath();
        if (tool === 'line') {
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
        } else if (tool === 'rect') {
          ctx.strokeRect(startX, startY, x - startX, y - startY);
        } else if (tool === 'ellipse') {
          ctx.ellipse((startX + x) / 2, (startY + y) / 2, Math.abs(x - startX) / 2, Math.abs(y - startY) / 2, 0, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
    });

    const stopDraw = () => { drawing = false; };
    canvas.addEventListener('pointerup', stopDraw);
    canvas.addEventListener('pointercancel', stopDraw);

    root.querySelectorAll('[data-tool]').forEach(b => {
      b.addEventListener('click', () => {
        tool = b.dataset.tool;
        root.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('active', x === b));
      });
    });

    root.querySelector('#pt-size').addEventListener('input', e => { brushSize = +e.target.value; });
    colorPick.addEventListener('input', e => { color = e.target.value; });
    root.querySelectorAll('.paint-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        color = sw.dataset.c;
        colorPick.value = color;
        root.querySelectorAll('.paint-swatch').forEach(x => x.classList.toggle('active', x === sw));
      });
    });

    root.querySelector('#pt-undo').addEventListener('click', () => {
      if (undoStack.length) ctx.putImageData(undoStack.pop(), 0, 0);
    });
    root.querySelector('#pt-clear').addEventListener('click', () => {
      pushUndo();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    root.querySelector('#pt-save').addEventListener('click', () => {
      const name = prompt('Save drawing to Pictures as:', 'Drawing.png');
      if (!name) return;
      const finalName = name.endsWith('.png') ? name : name + '.png';
      const dataUrl = canvas.toDataURL('image/png');
      VFS.writeFile('C:\\Users\\User\\Pictures', finalName, '', { src: dataUrl, ext: 'png' });
      api.setTitle(`${finalName} - Paint`);
      window.Win10Shell?.notify('Paint', `Saved ${finalName} to Pictures.`);
    });

    api.setTitle('Untitled - Paint');
  }
};
