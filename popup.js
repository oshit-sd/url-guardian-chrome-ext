// URL Guardian - Popup Script

let data = { password: '', passwordSet: false, urls: [] };

// ── Helpers ──────────────────────────────────────────────
function toast(msg, duration = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function saveData(cb) {
  chrome.runtime.sendMessage({ type: 'SAVE_DATA', data }, (res) => {
    if (cb) cb(res);
  });
}

function cleanHost(raw) {
  raw = raw.trim().toLowerCase();
  raw = raw.replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/.*$/,'');
  return raw;
}

// ── Render URL list ───────────────────────────────────────
function renderUrls() {
  const list = document.getElementById('url-list');
  const label = document.getElementById('list-label');
  list.innerHTML = '';

  if (!data.urls || data.urls.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4c1.4 0 2.8.5 3.86 1.44l-7.42 7.42A5.95 5.95 0 0 1 6 10c0-3.31 2.69-6 6-6zm0 12c-1.4 0-2.8-.5-3.86-1.44l7.42-7.42A5.95 5.95 0 0 1 18 12c0 3.31-2.69 6-6 6z"/></svg>
        <p>No URLs protected yet.<br/>Add one above to get started.</p>
      </div>`;
    label.textContent = 'Protected URLs (0)';
    return;
  }

  label.textContent = `Protected URLs (${data.urls.length})`;

  data.urls.forEach((entry, idx) => {
    const isBlocked = entry.status === 'blocked';
    const item = document.createElement('div');
    item.className = 'url-item';
    item.innerHTML = `
      <div class="url-item-icon ${isBlocked ? 'blocked' : 'allowed'}">
        ${isBlocked
          ? `<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`
          : `<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`
        }
      </div>
      <div class="url-item-info">
        <div class="url-item-host">${entry.url}</div>
        <div class="url-item-status ${isBlocked ? 'blocked' : 'allowed'}">${isBlocked ? '🔴 Blocked' : '🟢 Allowed'}</div>
      </div>
      <label class="toggle" title="${isBlocked ? 'Click to allow' : 'Click to block'}">
        <input type="checkbox" ${isBlocked ? 'checked' : ''} data-idx="${idx}" />
        <span class="toggle-slider"></span>
      </label>
      <button class="delete-btn" data-idx="${idx}" title="Remove">
        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>`;
    list.appendChild(item);
  });

  // Toggle handlers
  list.querySelectorAll('.toggle input').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      data.urls[idx].status = e.target.checked ? 'blocked' : 'allowed';
      data.urls[idx].tempAllow = false;
      saveData(() => {
        toast(e.target.checked ? `🔒 ${data.urls[idx].url} blocked` : `🔓 ${data.urls[idx].url} allowed`);
        renderUrls();
      });
    });
  });

  // Delete handlers
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx);
      const removed = data.urls[idx].url;
      data.urls.splice(idx, 1);
      saveData(() => {
        toast(`Removed ${removed}`);
        renderUrls();
      });
    });
  });
}

// ── Tabs ─────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('view-' + tab.dataset.tab).classList.add('active');
  });
});

// Settings shortcut
document.getElementById('settings-toggle').addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector('[data-tab="settings"]').classList.add('active');
  document.getElementById('view-settings').classList.add('active');
});

// ── Add URL ───────────────────────────────────────────────
document.getElementById('add-url-btn').addEventListener('click', () => {
  const raw = document.getElementById('url-input').value;
  if (!raw.trim()) { toast('Please enter a URL'); return; }

  const host = cleanHost(raw);
  if (!host || !host.includes('.')) { toast('Enter a valid domain, e.g. google.com'); return; }

  if (data.urls.find(u => u.url === host)) { toast('This URL is already in the list'); return; }

  data.urls.unshift({ url: host, status: 'blocked', tempAllow: false });
  document.getElementById('url-input').value = '';
  saveData(() => {
    toast(`🔒 ${host} added & blocked`);
    renderUrls();
  });
});

document.getElementById('url-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('add-url-btn').click();
});

// ── Password ──────────────────────────────────────────────
function renderPasswordStatus() {
  const el = document.getElementById('password-status');
  if (data.passwordSet && data.password) {
    el.className = 'status-badge set';
    el.textContent = '✓ Password set';
  } else {
    el.className = 'status-badge unset';
    el.textContent = '⚠ Not set';
  }
}

document.getElementById('save-password-btn').addEventListener('click', () => {
  const p1 = document.getElementById('new-password').value;
  const p2 = document.getElementById('confirm-password').value;

  if (!p1) { toast('Enter a password'); return; }
  if (p1 !== p2) { toast('Passwords do not match'); return; }
  if (p1.length < 4) { toast('Password must be at least 4 characters'); return; }

  data.password = p1;
  data.passwordSet = true;
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';

  saveData(() => {
    toast('✅ Password saved successfully');
    renderPasswordStatus();
  });
});

// ── Init ──────────────────────────────────────────────────
chrome.runtime.sendMessage({ type: 'GET_DATA' }, (res) => {
  if (res) data = res;
  renderUrls();
  renderPasswordStatus();
});
