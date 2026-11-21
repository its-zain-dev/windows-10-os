/* ==========================================================================
   Windows 10 Fluent Minesweeper
   ========================================================================== */

import { Sound } from '../sound.js';

export const MinesweeperApp = {
  id: 'minesweeper',
  name: 'Minesweeper',
  icon: 'minesweeper',
  width: 360,
  height: 430,
  minWidth: 320,
  minHeight: 380,

  mount(container, params, api) {
    let rows = 9, cols = 9, minesTotal = 10;
    let board = [];
    let gameOver = false, won = false, started = false;
    let seconds = 0, timer = null;

    const root = document.createElement('div');
    root.className = 'mine-root';
    container.appendChild(root);

    const initGame = () => {
      clearInterval(timer);
      seconds = 0;
      gameOver = false;
      won = false;
      started = false;
      board = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ mine: false, rev: false, flag: false, adj: 0 }))
      );
      render();
    };

    const placeMines = (safeR, safeC) => {
      let placed = 0;
      while (placed < minesTotal) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        if (board[r][c].mine || (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)) continue;
        board[r][c].mine = true;
        placed++;
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (board[r][c].mine) continue;
          let cnt = 0;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) cnt++;
          }
          board[r][c].adj = cnt;
        }
      }
    };

    const reveal = (r, c) => {
      if (gameOver || won) return;
      const cell = board[r][c];
      if (cell.rev || cell.flag) return;
      if (!started) {
        started = true;
        placeMines(r, c);
        timer = setInterval(() => { seconds++; const t = root.querySelector('#m-time'); if (t) t.textContent = seconds; }, 1000);
      }
      cell.rev = true;
      if (cell.mine) {
        gameOver = true;
        clearInterval(timer);
        Sound.error();
        board.forEach(row => row.forEach(x => { if (x.mine) x.rev = true; }));
        render();
        return;
      }
      if (cell.adj === 0) {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) reveal(nr, nc);
        }
      }
      const unrevSafe = board.flat().filter(x => !x.mine && !x.rev).length;
      if (unrevSafe === 0) {
        won = true;
        clearInterval(timer);
        Sound.notify();
      }
      render();
    };

    const render = () => {
      const flags = board.flat().filter(x => x.flag).length;
      root.innerHTML = `
        <div class="mine-bar">
          <div class="mine-stats">
            <span>💣 ${Math.max(0, minesTotal - flags)}</span>
            <span>⏱ <span id="m-time">${seconds}</span>s</span>
          </div>
          <div style="display:flex;gap:6px;">
            <select id="m-diff" style="background:var(--app-input-bg);border:1px solid var(--app-border);padding:3px 6px;">
              <option value="9,9,10" ${rows === 9 ? 'selected' : ''}>Easy (9×9)</option>
              <option value="12,12,22" ${rows === 12 ? 'selected' : ''}>Medium (12×12)</option>
            </select>
            <button class="set-btn accent" id="m-reset" style="padding:4px 12px;">${gameOver ? '😵 Retry' : won ? '😎 Won!' : '🙂 New'}</button>
          </div>
        </div>
        <div class="mine-board" style="grid-template-columns:repeat(${cols}, 28px);">
          ${board.map((row, r) => row.map((cell, c) => {
            const cls = ['mine-cell'];
            let txt = '';
            if (cell.rev) {
              cls.push('revealed');
              if (cell.mine) { cls.push('mine-hit'); txt = '💣'; }
              else if (cell.adj > 0) { cls.push('mine-c' + cell.adj); txt = cell.adj; }
            } else if (cell.flag) {
              txt = '🚩';
            }
            return `<button class="${cls.join(' ')}" data-r="${r}" data-c="${c}">${txt}</button>`;
          }).join('')).join('')}
        </div>
      `;

      root.querySelector('#m-reset').addEventListener('click', initGame);
      root.querySelector('#m-diff').addEventListener('change', (e) => {
        [rows, cols, minesTotal] = e.target.value.split(',').map(Number);
        initGame();
      });
      root.querySelectorAll('.mine-cell').forEach(btn => {
        const r = +btn.dataset.r, c = +btn.dataset.c;
        btn.addEventListener('click', () => reveal(r, c));
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (gameOver || won || board[r][c].rev) return;
          board[r][c].flag = !board[r][c].flag;
          render();
        });
      });
    };

    api.setOnDestroy(() => clearInterval(timer));
    initGame();
  }
};
