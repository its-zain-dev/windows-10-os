/* ==========================================================================
   Microsoft Edge (Windows 10 Classic Chromium Edge — Multi-Tab Browser)
   ========================================================================== */

export const EdgeApp = {
  id: 'edge',
  name: 'Microsoft Edge',
  icon: 'edge',
  width: 980,
  height: 620,
  minWidth: 520,
  minHeight: 360,

  mount(container, params, api) {
    let tabSeq = 1;
    let tabs = [
      { id: tabSeq++, title: 'New tab', url: params.url || 'edge://newtab', hist: [params.url || 'edge://newtab'], idx: 0 }
    ];
    let activeTabId = tabs[0].id;

    const root = document.createElement('div');
    root.className = 'edge-root';
    container.appendChild(root);

    const getTab = () => tabs.find(t => t.id === activeTabId) || tabs[0];

    const normalizeUrl = (input) => {
      const raw = input.trim();
      if (!raw || raw === 'edge://newtab') return 'edge://newtab';
      if (raw.startsWith('edge://')) return raw;
      if (/^https?:\/\//i.test(raw)) return raw;
      if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return 'https://' + raw;
      return 'https://en.wikipedia.org/wiki/Special:Search?search=' + encodeURIComponent(raw);
    };

    const titleFor = (url) => {
      if (url === 'edge://newtab') return 'New tab';
      if (url === 'edge://welcome') return 'Welcome to Windows 10';
      if (url === 'edge://shortcuts') return 'Windows 10 Shortcuts';
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
    };

    const navigate = (url, push = true) => {
      const t = getTab();
      const norm = normalizeUrl(url);
      t.url = norm;
      t.title = titleFor(norm);
      if (push) {
        t.hist = t.hist.slice(0, t.idx + 1);
        t.hist.push(norm);
        t.idx = t.hist.length - 1;
      }
      api.setTitle(`${t.title} - Microsoft Edge`);
      render();
    };

    const renderViewport = (t) => {
      if (t.url === 'edge://newtab') {
        const links = [
          { name: 'Welcome', url: 'edge://welcome', bg: '#0078d7', badge: 'W' },
          { name: 'Shortcuts', url: 'edge://shortcuts', bg: '#10893e', badge: '⌨' },
          { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Windows_10', bg: '#444', badge: 'W' },
          { name: 'Example', url: 'https://example.com', bg: '#744da9', badge: 'E' },
          { name: 'Archive', url: 'https://archive.org', bg: '#ca5010', badge: 'A' }
        ];
        return `
          <div class="edge-ntp">
            <div style="font-size:32px;font-weight:300;letter-spacing:.5px;">Microsoft Edge</div>
            <div class="edge-ntp-search-box">
              <input type="text" id="edge-ntp-q" placeholder="Search Wikipedia or enter web address" />
            </div>
            <div class="edge-quick-links">
              ${links.map(l => `
                <button class="edge-ql-card" data-go="${l.url}">
                  <span class="edge-ql-badge" style="background:${l.bg}">${l.badge}</span>
                  <span style="font-size:12px;">${l.name}</span>
                </button>
              `).join('')}
            </div>
          </div>
        `;
      }

      if (t.url === 'edge://welcome') {
        return `
          <div class="edge-local-page">
            <h1 style="color:#0078d7;font-weight:300;font-size:34px;margin-bottom:12px;">Welcome to Windows 10</h1>
            <p style="margin-bottom:16px;color:#444;">You are browsing inside Microsoft Edge on Windows 10 Pro Version 22H2.</p>
            <h3 style="margin:18px 0 8px;">What you can explore in this OS:</h3>
            <ul style="padding-left:20px;line-height:1.9;">
              <li><strong>Start Menu &amp; Live Tiles</strong>: Expand the left rail, browse A-Z apps, resize or unpin tiles via right-click.</li>
              <li><strong>Full Window Management</strong>: Drag windows to screen edges or corners for Aero Snap, or open Task View to add Virtual Desktops!</li>
              <li><strong>Action Center &amp; Taskbar Flyouts</strong>: Try Night Light, Brightness slider, Wi-Fi list, Volume slider, Battery mode, and Interactive Calendar with reminders.</li>
              <li><strong>Shared Virtual File System</strong>: Files saved in Notepad or Paint immediately show up on the Desktop, File Explorer, and Command Prompt (<code>dir</code>, <code>type</code>).</li>
            </ul>
          </div>
        `;
      }

      if (t.url === 'edge://shortcuts') {
        return `
          <div class="edge-local-page">
            <h1 style="color:#0078d7;font-weight:300;font-size:32px;margin-bottom:16px;">Windows 10 Keyboard Shortcuts</h1>
            <table style="width:100%;border-collapse:collapse;font-size:13.5px;">
              <tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Alt + R</strong> (or Win+R)</td><td style="padding:8px;border-bottom:1px solid #ddd;">Open Run dialog (try <code>winver</code>, <code>cmd</code>, <code>bsod</code>)</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Alt + E</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">Open File Explorer</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Alt + I</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">Open Windows Settings</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Alt + D</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">Show / Hide Desktop</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Alt + L</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">Lock Screen</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Alt + Tab</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">Switch between open windows</td></tr>
              <tr><td style="padding:8px;border-bottom:1px solid #ddd;"><strong>Ctrl + Shift + Esc</strong></td><td style="padding:8px;border-bottom:1px solid #ddd;">Open Task Manager</td></tr>
            </table>
          </div>
        `;
      }

      return `
        <iframe class="edge-iframe" src="${t.url}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
      `;
    };

    const render = () => {
      const t = getTab();
      root.innerHTML = `
        <div class="edge-tabs-bar">
          ${tabs.map(tb => `
            <div class="edge-tab ${tb.id === activeTabId ? 'active' : ''}" data-tid="${tb.id}">
              <span class="edge-tab-title">${tb.title}</span>
              <button class="edge-tab-close" data-close-tid="${tb.id}" title="Close tab">✕</button>
            </div>
          `).join('')}
          <button class="edge-newtab-btn" id="edge-add-tab" title="New tab">+</button>
        </div>
        <div class="edge-toolbar">
          <button class="edge-nav-btn" id="edge-back" title="Back" ${t.idx <= 0 ? 'disabled' : ''}>←</button>
          <button class="edge-nav-btn" id="edge-fwd" title="Forward" ${t.idx >= t.hist.length - 1 ? 'disabled' : ''}>→</button>
          <button class="edge-nav-btn" id="edge-reload" title="Refresh">↻</button>
          <button class="edge-nav-btn" id="edge-home" title="Home">⌂</button>
          <input type="text" class="edge-url-input" id="edge-url" value="${t.url === 'edge://newtab' ? '' : t.url}" placeholder="Search or enter web address" />
        </div>
        <div class="edge-favbar">
          <button class="edge-fav" data-go="edge://welcome">★ Welcome to Windows 10</button>
          <button class="edge-fav" data-go="edge://shortcuts">★ Shortcuts</button>
          <button class="edge-fav" data-go="https://en.wikipedia.org/wiki/Windows_10">★ Wikipedia: Windows 10</button>
          <button class="edge-fav" data-go="https://example.com">★ Example.com</button>
        </div>
        <div class="edge-viewport">${renderViewport(t)}</div>
      `;

      root.querySelectorAll('[data-tid]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.dataset.closeTid) return;
          activeTabId = +el.dataset.tid;
          api.setTitle(`${getTab().title} - Microsoft Edge`);
          render();
        });
      });
      root.querySelectorAll('[data-close-tid]').forEach(b => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const cid = +b.dataset.closeTid;
          if (tabs.length === 1) { api.close(); return; }
          tabs = tabs.filter(x => x.id !== cid);
          if (activeTabId === cid) activeTabId = tabs[tabs.length - 1].id;
          render();
        });
      });
      root.querySelector('#edge-add-tab').addEventListener('click', () => {
        const nt = { id: tabSeq++, title: 'New tab', url: 'edge://newtab', hist: ['edge://newtab'], idx: 0 };
        tabs.push(nt);
        activeTabId = nt.id;
        render();
      });
      root.querySelector('#edge-back').addEventListener('click', () => {
        if (t.idx > 0) { t.idx--; navigate(t.hist[t.idx], false); }
      });
      root.querySelector('#edge-fwd').addEventListener('click', () => {
        if (t.idx < t.hist.length - 1) { t.idx++; navigate(t.hist[t.idx], false); }
      });
      root.querySelector('#edge-reload').addEventListener('click', () => render());
      root.querySelector('#edge-home').addEventListener('click', () => navigate('edge://newtab'));

      const urlIn = root.querySelector('#edge-url');
      urlIn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate(urlIn.value);
      });
      const ntpIn = root.querySelector('#edge-ntp-q');
      ntpIn?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate(ntpIn.value);
      });
      root.querySelectorAll('[data-go]').forEach(el => {
        el.addEventListener('click', () => navigate(el.dataset.go));
      });
    };

    render();
  }
};
