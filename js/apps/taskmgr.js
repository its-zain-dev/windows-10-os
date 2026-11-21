/* ==========================================================================
   Authentic Windows 10 Task Manager (Processes + Live Canvas Performance)
   ========================================================================== */

import { WM } from '../wm.js';
import { APP_ICONS } from '../icons.js';
import { State } from '../state.js';

export const TaskMgrApp = {
  id: 'taskmgr',
  name: 'Task Manager',
  icon: 'taskmgr',
  width: 720,
  height: 520,
  minWidth: 480,
  minHeight: 360,
  singleInstance: true,

  mount(container, params, api) {
    let tab = 'processes'; // 'processes' | 'performance' | 'startup' | 'users'
    let perfMetric = 'cpu'; // 'cpu' | 'mem' | 'disk' | 'wifi'
    let selectedWinId = null;
    let moreDetails = true;

    const history = {
      cpu: Array.from({ length: 45 }, () => 12 + Math.random() * 16),
      mem: Array.from({ length: 45 }, () => 38 + Math.random() * 6),
      disk: Array.from({ length: 45 }, () => 1 + Math.random() * 7),
      wifi: Array.from({ length: 45 }, () => 2 + Math.random() * 14)
    };

    const bgProcesses = [
      { name: 'Desktop Window Manager', cpu: 1.4, mem: 64.2, disk: 0.0, net: 0.0 },
      { name: 'Windows Explorer', cpu: 0.8, mem: 82.5, disk: 0.1, net: 0.0 },
      { name: 'Antimalware Service Executable', cpu: 0.6, mem: 148.4, disk: 0.2, net: 0.0 },
      { name: 'Service Host: Local System', cpu: 0.3, mem: 38.1, disk: 0.0, net: 0.1 },
      { name: 'System', cpu: 0.2, mem: 14.0, disk: 0.1, net: 0.0 },
      { name: 'Runtime Broker', cpu: 0.1, mem: 26.8, disk: 0.0, net: 0.0 }
    ];

    const root = document.createElement('div');
    root.className = 'tm-root';
    container.appendChild(root);

    const heatCls = (val, t1, t2) => val >= t2 ? 'tm-heat-high' : val >= t1 ? 'tm-heat-med' : 'tm-heat-low';

    const drawGraph = () => {
      const canvas = root.querySelector('#tm-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.clientWidth || 440;
      const h = canvas.height = 190;
      ctx.clearRect(0, 0, w, h);

      const colors = {
        cpu: ['#117dbb', 'rgba(17,125,187,0.18)'],
        mem: ['#8b12ae', 'rgba(139,18,174,0.18)'],
        disk: ['#10893e', 'rgba(16,137,62,0.18)'],
        wifi: ['#a85800', 'rgba(168,88,0,0.18)']
      }[perfMetric];

      // Grid
      ctx.strokeStyle = 'rgba(17,125,187,0.18)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        const y = (h / 10) * i;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (let i = 1; i < 15; i++) {
        const x = (w / 15) * i;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }

      const data = history[perfMetric];
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - (Math.min(100, Math.max(0, v)) / 100) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = colors[1];
      ctx.fill();
    };

    const renderBody = () => {
      const openWins = WM.getAllWindows();
      if (!moreDetails) {
        return `
          <div style="padding:10px;">
            ${openWins.map(w => `
              <div class="tm-simple-row ${selectedWinId === w.id ? 'selected' : ''}" data-wid="${w.id}" style="display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;${selectedWinId === w.id ? 'background:#cce8ff;' : ''}">
                <span style="width:20px;height:20px;display:inline-flex;">${APP_ICONS[w.icon] || ''}</span>
                <span>${w.title}</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      if (tab === 'processes') {
        const cpuNow = Math.round(history.cpu[history.cpu.length - 1]);
        const memNow = Math.round(history.mem[history.mem.length - 1]);
        const diskNow = Math.round(history.disk[history.disk.length - 1]);
        return `
          <table class="tm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>${cpuNow}%<br><small>CPU</small></th>
                <th>${memNow}%<br><small>Memory</small></th>
                <th>${diskNow}%<br><small>Disk</small></th>
                <th>0%<br><small>Network</small></th>
              </tr>
            </thead>
            <tbody>
              <tr style="background:#f5f5f5;"><td colspan="6" style="font-weight:600;color:#0078d7;">Apps (${openWins.length})</td></tr>
              ${openWins.map((w, idx) => {
                const c = (0.4 + ((idx * 1.7 + cpuNow * 0.08) % 5.4)).toFixed(1);
                const m = (48 + idx * 27.3).toFixed(1);
                return `
                  <tr class="${selectedWinId === w.id ? 'selected' : ''}" data-wid="${w.id}">
                    <td><span style="width:16px;height:16px;display:inline-flex;">${APP_ICONS[w.icon] || ''}</span><span>${w.title}</span></td>
                    <td>Running</td>
                    <td class="${heatCls(+c, 3, 8)}">${c}%</td>
                    <td class="${heatCls(+m, 100, 220)}">${m} MB</td>
                    <td class="tm-heat-low">0.1 MB/s</td>
                    <td class="tm-heat-low">0 Mbps</td>
                  </tr>
                `;
              }).join('')}
              <tr style="background:#f5f5f5;"><td colspan="6" style="font-weight:600;color:#0078d7;">Background processes (${bgProcesses.length})</td></tr>
              ${bgProcesses.map(p => `
                <tr>
                  <td><span>⚙️</span><span>${p.name}</span></td>
                  <td></td>
                  <td class="tm-heat-low">${p.cpu.toFixed(1)}%</td>
                  <td class="tm-heat-low">${p.mem.toFixed(1)} MB</td>
                  <td class="tm-heat-low">${p.disk.toFixed(1)} MB/s</td>
                  <td class="tm-heat-low">${p.net.toFixed(1)} Mbps</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      if (tab === 'performance') {
        const cpu = Math.round(history.cpu[history.cpu.length - 1]);
        const mem = Math.round(history.mem[history.mem.length - 1]);
        const disk = Math.round(history.disk[history.disk.length - 1]);
        const wifi = Math.round(history.wifi[history.wifi.length - 1]);
        const titles = {
          cpu: ['CPU', 'Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz'],
          mem: ['Memory', '16.0 GB DDR4 @ 3200 MHz'],
          disk: ['Disk 0 (C:)', 'NVMe SSD 256 GB'],
          wifi: ['Wi-Fi', State.get().connectedWifi || 'Disconnected']
        };
        return `
          <div class="tm-perf-split">
            <div class="tm-perf-sidebar">
              <button class="tm-perf-card ${perfMetric === 'cpu' ? 'active' : ''}" data-pm="cpu">
                <strong>CPU</strong><div>${cpu}% 3.84 GHz</div>
              </button>
              <button class="tm-perf-card ${perfMetric === 'mem' ? 'active' : ''}" data-pm="mem">
                <strong>Memory</strong><div>${(16 * mem / 100).toFixed(1)}/16.0 GB (${mem}%)</div>
              </button>
              <button class="tm-perf-card ${perfMetric === 'disk' ? 'active' : ''}" data-pm="disk">
                <strong>Disk 0 (C:)</strong><div>SSD (NVMe) ${disk}%</div>
              </button>
              <button class="tm-perf-card ${perfMetric === 'wifi' ? 'active' : ''}" data-pm="wifi">
                <strong>Wi-Fi</strong><div>${wifi} Kbps</div>
              </button>
            </div>
            <div class="tm-perf-main">
              <div class="tm-perf-hdr">
                <h2 style="font-size:22px;font-weight:400;">${titles[perfMetric][0]}</h2>
                <span style="color:#555;">${titles[perfMetric][1]}</span>
              </div>
              <canvas id="tm-canvas" class="tm-perf-canvas"></canvas>
              <div class="tm-perf-stats">
                <div><div class="tm-stat-label">Utilization</div><div class="tm-stat-val">${Math.round(history[perfMetric][history[perfMetric].length - 1])}%</div></div>
                <div><div class="tm-stat-label">Processes</div><div class="tm-stat-val">${114 + openWins.length}</div></div>
                <div><div class="tm-stat-label">Threads</div><div class="tm-stat-val">1,842</div></div>
              </div>
            </div>
          </div>
        `;
      }

      if (tab === 'startup') {
        const items = [
          { name: 'Windows Security notification icon', pub: 'Microsoft Corporation', status: 'Enabled', impact: 'Low' },
          { name: 'OneDrive', pub: 'Microsoft Corporation', status: 'Enabled', impact: 'Medium' },
          { name: 'Realtek HD Audio Universal Service', pub: 'Realtek Semiconductor', status: 'Enabled', impact: 'Low' }
        ];
        return `
          <table class="tm-table">
            <thead><tr><th>Name</th><th>Publisher</th><th>Status</th><th>Startup impact</th></tr></thead>
            <tbody>
              ${items.map(i => `<tr><td>${i.name}</td><td>${i.pub}</td><td>${i.status}</td><td>${i.impact}</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }

      return `
        <table class="tm-table">
          <thead><tr><th>User</th><th>Status</th><th>CPU</th><th>Memory</th></tr></thead>
          <tbody>
            <tr><td>👤 ${State.get().username}</td><td>Active</td><td>${Math.round(history.cpu[history.cpu.length - 1])}%</td><td>${(16 * history.mem[history.mem.length - 1] / 100).toFixed(1)} GB</td></tr>
          </tbody>
        </table>
      `;
    };

    const render = () => {
      root.innerHTML = `
        ${moreDetails ? `
          <div class="tm-tabs">
            <button class="tm-tab ${tab === 'processes' ? 'active' : ''}" data-tab="processes">Processes</button>
            <button class="tm-tab ${tab === 'performance' ? 'active' : ''}" data-tab="performance">Performance</button>
            <button class="tm-tab ${tab === 'startup' ? 'active' : ''}" data-tab="startup">Startup</button>
            <button class="tm-tab ${tab === 'users' ? 'active' : ''}" data-tab="users">Users</button>
          </div>
        ` : ''}
        <div class="tm-body">${renderBody()}</div>
        <div class="tm-footer">
          <button class="win32-btn" id="tm-toggle-details">${moreDetails ? '⌃ Fewer details' : '⌄ More details'}</button>
          <button class="win32-btn" id="tm-end-task" ${!selectedWinId ? 'disabled' : ''}>End task</button>
        </div>
      `;

      root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
      root.querySelectorAll('[data-pm]').forEach(b => b.addEventListener('click', () => { perfMetric = b.dataset.pm; render(); }));
      root.querySelectorAll('[data-wid]').forEach(el => {
        el.addEventListener('click', () => { selectedWinId = el.dataset.wid; render(); });
      });
      root.querySelector('#tm-toggle-details').addEventListener('click', () => { moreDetails = !moreDetails; render(); });
      root.querySelector('#tm-end-task').addEventListener('click', () => {
        if (selectedWinId) {
          WM.close(selectedWinId, true);
          selectedWinId = null;
          render();
        }
      });

      if (tab === 'performance' && moreDetails) drawGraph();
    };

    const tick = setInterval(() => {
      const openFactor = WM.getAllWindows().length * 2.5;
      const pushVal = (arr, next) => { arr.push(Math.max(1, Math.min(98, next))); arr.shift(); };
      pushVal(history.cpu, history.cpu[history.cpu.length - 1] * 0.65 + (10 + openFactor + Math.random() * 18) * 0.35);
      pushVal(history.mem, history.mem[history.mem.length - 1] * 0.85 + (36 + openFactor * 1.4 + Math.random() * 4) * 0.15);
      pushVal(history.disk, Math.random() * 9);
      pushVal(history.wifi, State.get().wifiEnabled ? Math.random() * 24 : 0);
      render();
    }, 1100);

    const unsub = WM.subscribe(() => render());
    api.setOnDestroy(() => { clearInterval(tick); unsub(); });
    render();
  }
};
