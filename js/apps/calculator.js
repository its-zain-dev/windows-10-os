/* ==========================================================================
   Authentic Windows 10 UWP Fluent Calculator (Standard + Scientific + History)
   ========================================================================== */

export const CalculatorApp = {
  id: 'calculator',
  name: 'Calculator',
  icon: 'calculator',
  width: 340,
  height: 528,
  minWidth: 320,
  minHeight: 460,
  frameless: true,

  mount(container, params, api) {
    let mode = 'standard'; // 'standard' | 'scientific'
    let drawerOpen = false;
    let showHistory = false;
    let current = '0';
    let stored = null;
    let operator = null;
    let waitingNew = false;
    let exprText = '';
    let memory = null;
    let history = [];

    const root = document.createElement('div');
    root.className = 'calc-root';
    container.appendChild(root);

    const fmt = (num) => {
      if (!Number.isFinite(num)) return 'Cannot divide by zero';
      const s = String(Number(num.toPrecision(12)));
      return s;
    };

    const compute = (a, b, op) => {
      switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? Infinity : a / b;
        case '^': return Math.pow(a, b);
        default: return b;
      }
    };

    const opSym = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };

    const press = (cmd) => {
      if (/^[0-9]$/.test(cmd)) {
        if (waitingNew || current === '0' || current.startsWith('Cannot')) {
          current = cmd;
          waitingNew = false;
        } else if (current.length < 16) {
          current += cmd;
        }
      } else if (cmd === '.') {
        if (waitingNew) { current = '0.'; waitingNew = false; }
        else if (!current.includes('.')) current += '.';
      } else if (cmd === 'C') {
        current = '0'; stored = null; operator = null; exprText = ''; waitingNew = false;
      } else if (cmd === 'CE') {
        current = '0';
      } else if (cmd === 'BS') {
        if (!waitingNew) current = current.length > 1 ? current.slice(0, -1) : '0';
      } else if (cmd === 'NEG') {
        if (current !== '0') current = current.startsWith('-') ? current.slice(1) : '-' + current;
      } else if (cmd === '%') {
        const v = parseFloat(current);
        current = fmt(stored !== null ? (stored * v) / 100 : v / 100);
      } else if (['+', '-', '*', '/', '^'].includes(cmd)) {
        const val = parseFloat(current);
        if (stored !== null && operator && !waitingNew) {
          stored = compute(stored, val, operator);
          current = fmt(stored);
        } else {
          stored = val;
        }
        operator = cmd;
        exprText = `${fmt(stored)} ${opSym[cmd]}`;
        waitingNew = true;
      } else if (cmd === '=') {
        if (operator && stored !== null) {
          const val = parseFloat(current);
          const res = compute(stored, val, operator);
          const eq = `${fmt(stored)} ${opSym[operator]} ${fmt(val)} =`;
          exprText = eq;
          current = fmt(res);
          history.unshift({ eq, res: current });
          if (history.length > 30) history.pop();
          stored = null;
          operator = null;
          waitingNew = true;
        }
      } else {
        // Unary / Scientific functions
        const v = parseFloat(current);
        let r = v;
        let label = '';
        if (cmd === 'inv') { r = v === 0 ? Infinity : 1 / v; label = `1/(${v})`; }
        if (cmd === 'sq')  { r = v * v; label = `sqr(${v})`; }
        if (cmd === 'sqrt'){ r = v < 0 ? NaN : Math.sqrt(v); label = `√(${v})`; }
        if (cmd === 'sin') { r = Math.sin(v * Math.PI / 180); label = `sin(${v})`; }
        if (cmd === 'cos') { r = Math.cos(v * Math.PI / 180); label = `cos(${v})`; }
        if (cmd === 'tan') { r = Math.tan(v * Math.PI / 180); label = `tan(${v})`; }
        if (cmd === 'log') { r = Math.log10(v); label = `log(${v})`; }
        if (cmd === 'ln')  { r = Math.log(v); label = `ln(${v})`; }
        if (cmd === 'pi')  { r = Math.PI; label = 'π'; }
        if (cmd === 'e')   { r = Math.E; label = 'e'; }
        if (cmd === 'fact'){
          let f = 1;
          for (let i = 2; i <= Math.min(170, Math.max(0, Math.floor(v))); i++) f *= i;
          r = f; label = `fact(${Math.floor(v)})`;
        }
        exprText = label;
        current = Number.isNaN(r) ? 'Invalid input' : fmt(r);
        waitingNew = true;
      }
      render();
    };

    const memCmd = (c) => {
      const v = parseFloat(current) || 0;
      if (c === 'MC') memory = null;
      if (c === 'MR' && memory !== null) { current = fmt(memory); waitingNew = true; }
      if (c === 'M+') memory = (memory || 0) + v;
      if (c === 'M-') memory = (memory || 0) - v;
      if (c === 'MS') memory = v;
      render();
    };

    const STD_KEYS = [
      ['%', '%'], ['CE', 'CE'], ['C', 'C'], ['⌫', 'BS'],
      ['¹/x', 'inv'], ['x²', 'sq'], ['²√x', 'sqrt'], ['÷', '/'],
      ['7', '7', 'num'], ['8', '8', 'num'], ['9', '9', 'num'], ['×', '*'],
      ['4', '4', 'num'], ['5', '5', 'num'], ['6', '6', 'num'], ['−', '-'],
      ['1', '1', 'num'], ['2', '2', 'num'], ['3', '3', 'num'], ['+', '+'],
      ['+/−', 'NEG', 'num'], ['0', '0', 'num'], ['.', '.', 'num'], ['=', '=', 'eq']
    ];

    const SCI_KEYS = [
      ['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan'], ['π', 'pi'], ['e', 'e'],
      ['x²', 'sq'], ['¹/x', 'inv'], ['²√x', 'sqrt'], ['C', 'C'], ['⌫', 'BS'],
      ['xʸ', '^'], ['log', 'log'], ['ln', 'ln'], ['n!', 'fact'], ['÷', '/'],
      ['7', '7', 'num'], ['8', '8', 'num'], ['9', '9', 'num'], ['CE', 'CE'], ['×', '*'],
      ['4', '4', 'num'], ['5', '5', 'num'], ['6', '6', 'num'], ['%', '%'], ['−', '-'],
      ['1', '1', 'num'], ['2', '2', 'num'], ['3', '3', 'num'], ['+/−', 'NEG'], ['+', '+'],
      ['0', '0', 'num'], ['.', '.', 'num'], ['=', '=', 'eq']
    ];

    const render = () => {
      const keys = mode === 'scientific' ? SCI_KEYS : STD_KEYS;
      root.innerHTML = `
        <div class="calc-main">
          <div class="calc-topbar">
            <div class="calc-topbar-left">
              <button class="calc-icon-btn" id="c-menu" title="Open Navigation">☰</button>
              <span class="calc-mode-title">${mode === 'scientific' ? 'Scientific' : 'Standard'}</span>
            </div>
            <button class="calc-icon-btn" id="c-hist" title="History">🕒</button>
          </div>
          <div class="calc-display">
            <div class="calc-expr">${exprText}</div>
            <div class="calc-val">${current}</div>
          </div>
          <div class="calc-mem-bar">
            <button class="calc-mem-btn" data-mem="MC" ${memory === null ? 'disabled' : ''}>MC</button>
            <button class="calc-mem-btn" data-mem="MR" ${memory === null ? 'disabled' : ''}>MR</button>
            <button class="calc-mem-btn" data-mem="M+">M+</button>
            <button class="calc-mem-btn" data-mem="M-">M-</button>
            <button class="calc-mem-btn" data-mem="MS">MS</button>
          </div>
          <div class="calc-keypad ${mode === 'scientific' ? 'sci' : ''}">
            ${keys.map(([label, cmd, cls]) => `
              <button class="calc-key ${cls || ''}" data-cmd="${cmd}" ${cmd === '=' && mode === 'scientific' ? 'style="grid-column:span 3;"' : ''}>${label}</button>
            `).join('')}
          </div>
        </div>
        ${showHistory ? `
          <div class="calc-history-pane">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong>History</strong>
              <button class="calc-icon-btn" id="c-hist-clr" style="width:26px;height:26px;" title="Clear history">🗑</button>
            </div>
            ${history.length ? history.map((h, i) => `
              <div class="calc-hist-item" data-hidx="${i}">
                <div class="calc-hist-eq">${h.eq}</div>
                <div class="calc-hist-res">${h.res}</div>
              </div>
            `).join('') : '<div style="color:var(--app-text-secondary);font-size:12px;">There\'s no history yet</div>'}
          </div>
        ` : ''}
        ${drawerOpen ? `
          <div class="calc-drawer">
            <button class="calc-drawer-item ${mode === 'standard' ? 'active' : ''}" data-mode="standard">Standard</button>
            <button class="calc-drawer-item ${mode === 'scientific' ? 'active' : ''}" data-mode="scientific">Scientific</button>
          </div>
        ` : ''}
      `;

      root.querySelector('#c-menu').addEventListener('click', (e) => { e.stopPropagation(); drawerOpen = !drawerOpen; render(); });
      root.querySelector('#c-hist').addEventListener('click', () => { showHistory = !showHistory; render(); });
      root.querySelector('#c-hist-clr')?.addEventListener('click', () => { history = []; render(); });
      root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; drawerOpen = false; render(); }));
      root.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => press(b.dataset.cmd)));
      root.querySelectorAll('[data-mem]').forEach(b => b.addEventListener('click', () => memCmd(b.dataset.mem)));
      root.querySelectorAll('[data-hidx]').forEach(el => el.addEventListener('click', () => {
        current = history[+el.dataset.hidx].res;
        waitingNew = true;
        render();
      }));
    };

    const onKey = (e) => {
      const winEl = document.getElementById(api.winId);
      if (!winEl || !winEl.classList.contains('focused')) return;
      if (/^[0-9.]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (['+', '-', '*', '/'].includes(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); press('='); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('BS'); }
      else if (e.key === 'Escape') { e.preventDefault(); press('C'); }
    };
    window.addEventListener('keydown', onKey);
    api.setOnDestroy(() => window.removeEventListener('keydown', onKey));

    render();
  }
};
