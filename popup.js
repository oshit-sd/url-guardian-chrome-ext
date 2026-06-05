// URL Guardian — Popup v3

var data = { password: '', passwordSet: false, urls: [] };

// ── Toast ────────────────────────────────────────────────
function toast(msg, dur) {
  dur = dur || 2200;
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, dur);
}

// ── Save ─────────────────────────────────────────────────
function saveData(cb) {
  chrome.runtime.sendMessage({ type: 'SAVE_DATA', data: data }, function(res) {
    if (cb) cb(res);
  });
}

function cleanHost(raw) {
  raw = raw.trim().toLowerCase()
    .replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/.*$/,'');
  return raw;
}

// ═══════════════════════════════════════════════════════
//  CONFIRM PASSWORD MODAL
//  Usage: requirePassword(title, sub, onSuccess)
// ═══════════════════════════════════════════════════════
var confirmCallback = null;

function requirePassword(title, sub, onSuccess) {
  if (!data.passwordSet || !data.password) {
    // No password set — just proceed
    onSuccess();
    return;
  }
  document.getElementById('confirm-title').textContent = title || 'Confirm Action';
  document.getElementById('confirm-sub').textContent   = sub   || 'Enter your master password to continue.';
  document.getElementById('confirm-pwd-input').value   = '';
  document.getElementById('confirm-err').textContent   = '';
  document.getElementById('confirm-pwd-input').classList.remove('err');
  confirmCallback = onSuccess;
  document.getElementById('confirm-overlay').classList.add('open');
  setTimeout(function() { document.getElementById('confirm-pwd-input').focus(); }, 160);
}

document.getElementById('confirm-cancel').addEventListener('click', function() {
  document.getElementById('confirm-overlay').classList.remove('open');
  confirmCallback = null;
});

document.getElementById('confirm-ok').addEventListener('click', function() {
  var pwd = document.getElementById('confirm-pwd-input').value;
  if (!pwd) {
    document.getElementById('confirm-err').textContent = 'Please enter the password.';
    document.getElementById('confirm-pwd-input').classList.add('err');
    return;
  }
  if (pwd !== data.password) {
    document.getElementById('confirm-err').textContent = 'Incorrect password.';
    document.getElementById('confirm-pwd-input').classList.add('err');
    document.getElementById('confirm-pwd-input').value = '';
    document.getElementById('confirm-pwd-input').focus();
    return;
  }
  document.getElementById('confirm-overlay').classList.remove('open');
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});

document.getElementById('confirm-pwd-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('confirm-ok').click();
});

document.getElementById('confirm-pwd-input').addEventListener('input', function() {
  this.classList.remove('err');
  document.getElementById('confirm-err').textContent = '';
});

// ═══════════════════════════════════════════════════════
//  RENDER URL LIST
// ═══════════════════════════════════════════════════════
function renderUrls() {
  var list  = document.getElementById('url-list');
  var label = document.getElementById('list-label');
  list.innerHTML = '';

  if (!data.urls || !data.urls.length) {
    list.innerHTML =
      '<div class="empty">' +
        '<svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4c1.4 0 2.8.5 3.86 1.44l-7.42 7.42A5.95 5.95 0 0 1 6 10c0-3.31 2.69-6 6-6zm0 12c-1.4 0-2.8-.5-3.86-1.44l7.42-7.42A5.95 5.95 0 0 1 18 12c0 3.31-2.69 6-6 6z"/></svg>' +
        '<p>No URLs protected yet.<br/>Add one above to get started.</p>' +
      '</div>';
    label.textContent = 'Protected URLs (0)';
    return;
  }

  label.textContent = 'Protected URLs (' + data.urls.length + ')';

  data.urls.forEach(function(entry, idx) {
    var isBlocked = entry.status === 'blocked';
    var lockPath = 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z';

    var item = document.createElement('div');
    item.className = 'url-item';
    item.innerHTML =
      '<div class="url-icon ' + (isBlocked ? 'blocked' : 'allowed') + '">' +
        '<svg viewBox="0 0 24 24"><path d="' + lockPath + '"/></svg>' +
      '</div>' +
      '<div class="url-info">' +
        '<div class="url-host">' + entry.url + '</div>' +
        '<div class="url-status ' + (isBlocked ? 'blocked' : 'allowed') + '">' +
          (isBlocked ? '🔴 Blocked' : '🟢 Allowed') +
        '</div>' +
      '</div>' +
      '<label class="toggle" title="' + (isBlocked ? 'Click to allow' : 'Click to block') + '">' +
        '<input type="checkbox" ' + (isBlocked ? 'checked' : '') + ' data-idx="' + idx + '"/>' +
        '<span class="tog-track"></span>' +
      '</label>' +
      '<button class="del-btn" data-idx="' + idx + '" title="Remove">' +
        '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>' +
      '</button>';

    list.appendChild(item);
  });

  // Toggle — requires password
  list.querySelectorAll('.toggle input').forEach(function(input) {
    input.addEventListener('change', function(e) {
      var idx     = parseInt(e.target.dataset.idx);
      var url     = data.urls[idx].url;
      var newStat = e.target.checked ? 'blocked' : 'allowed';
      var label   = newStat === 'blocked' ? 'Block' : 'Allow';

      // Revert visual immediately; apply only after password confirmed
      e.target.checked = !e.target.checked;

      requirePassword(
        label + ' ' + url,
        'Enter your master password to ' + label.toLowerCase() + ' this URL.',
        function() {
          data.urls[idx].status    = newStat;
          data.urls[idx].tempAllow = false;
          saveData(function() {
            toast(newStat === 'blocked' ? '🔒 ' + url + ' blocked' : '🔓 ' + url + ' allowed');
            renderUrls();
          });
        }
      );
    });
  });

  // Delete — requires password
  list.querySelectorAll('.del-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      var idx = parseInt(e.currentTarget.dataset.idx);
      var url = data.urls[idx].url;
      requirePassword(
        'Delete ' + url + '?',
        'Enter your master password to remove this URL from protection.',
        function() {
          data.urls.splice(idx, 1);
          saveData(function() {
            toast('🗑 ' + url + ' removed');
            renderUrls();
          });
        }
      );
    });
  });
}

// ═══════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════
document.querySelectorAll('.tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
    tab.classList.add('active');
    document.getElementById('view-' + tab.dataset.tab).classList.add('active');
  });
});

document.getElementById('settings-toggle').addEventListener('click', function() {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
  document.querySelector('[data-tab="settings"]').classList.add('active');
  document.getElementById('view-settings').classList.add('active');
});

// ═══════════════════════════════════════════════════════
//  ADD URL
// ═══════════════════════════════════════════════════════
document.getElementById('add-url-btn').addEventListener('click', function() {
  var raw = document.getElementById('url-input').value;
  if (!raw.trim()) { toast('Please enter a URL'); return; }
  var host = cleanHost(raw);
  if (!host || !host.includes('.')) { toast('Enter a valid domain, e.g. google.com'); return; }
  if (data.urls.find(function(u) { return u.url === host; })) { toast('Already in the list'); return; }

  data.urls.unshift({ url: host, status: 'blocked', tempAllow: false });
  document.getElementById('url-input').value = '';
  saveData(function() {
    toast('🔒 ' + host + ' added & blocked');
    renderUrls();
  });
});

document.getElementById('url-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('add-url-btn').click();
});

// ═══════════════════════════════════════════════════════
//  PASSWORD
// ═══════════════════════════════════════════════════════
function renderPasswordStatus() {
  var el = document.getElementById('password-status');
  var currField = document.getElementById('current-password');
  var hintEl    = document.getElementById('curr-pwd-hint');

  if (data.passwordSet && data.password) {
    el.className = 'badge set';
    el.textContent = '✓ Password set';
    currField.style.display = 'block';
    hintEl.textContent = 'Enter your current password, then set a new one.';
  } else {
    el.className = 'badge unset';
    el.textContent = '⚠ Not set';
    currField.style.display = 'none';
    hintEl.textContent = 'No password set yet — add one to protect your blocked URLs.';
  }
}

document.getElementById('save-password-btn').addEventListener('click', function() {
  var currPwd = document.getElementById('current-password').value;
  var newPwd  = document.getElementById('new-password').value;
  var confPwd = document.getElementById('confirm-password').value;

  // Validate current password if one is already set
  if (data.passwordSet && data.password) {
    if (!currPwd) { toast('Enter your current password'); return; }
    if (currPwd !== data.password) { toast('❌ Current password is incorrect'); return; }
  }

  if (!newPwd)           { toast('Enter a new password'); return; }
  if (newPwd.length < 4) { toast('Password must be at least 4 characters'); return; }
  if (newPwd !== confPwd){ toast('Passwords do not match'); return; }

  data.password    = newPwd;
  data.passwordSet = true;

  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value     = '';
  document.getElementById('confirm-password').value = '';

  saveData(function() {
    toast('✅ Password saved successfully');
    renderPasswordStatus();
  });
});

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
chrome.runtime.sendMessage({ type: 'GET_DATA' }, function(res) {
  if (res) data = res;
  renderUrls();
  renderPasswordStatus();
});
