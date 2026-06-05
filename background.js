// URL Guardian — Background Service Worker v3

/* ── Tab-scoped session allowances: { tabId: Set<hostname> } ── */
var tabSessions = {};

/* ── Init storage ── */
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['guardianData'], function(result) {
    if (!result.guardianData) {
      chrome.storage.local.set({
        guardianData: { password: '', passwordSet: false, urls: [] }
      });
    } else {
      // Clear any stale tempAllow flags on startup
      var d = result.guardianData;
      var changed = false;
      (d.urls || []).forEach(function(u) {
        if (u.tempAllow) { u.tempAllow = false; changed = true; }
      });
      if (changed) chrome.storage.local.set({ guardianData: d });
    }
  });
});

/* ── When a tab is closed, clear its session ── */
chrome.tabs.onRemoved.addListener(function(tabId) {
  delete tabSessions[tabId];
});

/* ── When a tab navigates away (new URL), clear session for that tab ── */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'loading' && tab.url) {
    // Clear session if navigating to a different origin
    if (tabSessions[tabId]) {
      try {
        var newHost = new URL(tab.url).hostname.toLowerCase().replace(/^www\./, '');
        // Keep the session only for the exact allowed host
        // (handled per-host inside tabSessions[tabId])
      } catch(_) {}
    }
    maybeBlock(tabId, tab.url);
  }
});

function isTabAllowed(tabId, hostname) {
  if (!tabSessions[tabId]) return false;
  return tabSessions[tabId].has(hostname);
}

function allowTabHost(tabId, hostname) {
  if (!tabSessions[tabId]) tabSessions[tabId] = new Set();
  tabSessions[tabId].add(hostname);
}

function maybeBlock(tabId, url) {
  var blockedBase = chrome.runtime.getURL('pages/blocked.html');
  if (url.startsWith(blockedBase)) return;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  var hostname;
  try { hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
  catch(_) { return; }

  // Check in-memory tab session first (fast path)
  if (isTabAllowed(tabId, hostname)) return;

  chrome.storage.local.get(['guardianData'], function(result) {
    var data = result.guardianData;
    if (!data || !data.urls || !data.urls.length) return;

    var match = null;
    for (var i = 0; i < data.urls.length; i++) {
      var e = data.urls[i];
      var eh = e.url.toLowerCase().replace(/^www\./, '');
      if (hostname === eh || hostname.endsWith('.' + eh)) { match = e; break; }
    }

    if (!match || match.status !== 'blocked') return;

    // Double-check in-memory session (race-condition safety)
    if (isTabAllowed(tabId, hostname)) return;

    var dest = blockedBase
      + '?originalUrl=' + encodeURIComponent(url)
      + '&siteName='    + encodeURIComponent(match.url);
    chrome.tabs.update(tabId, { url: dest });
  });
}

/* ── Message handler ── */
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  if (msg.type === 'VERIFY_PASSWORD') {
    chrome.storage.local.get(['guardianData'], function(result) {
      var data = result.guardianData;
      if (!data || !data.passwordSet || !data.password) {
        sendResponse({ success: false, reason: 'no_password' }); return;
      }
      sendResponse({ success: msg.password === data.password });
    });
    return true;
  }

  /* Grant tab-scoped session for this site */
  if (msg.type === 'WHITELIST_TEMP') {
    var tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      var host = (msg.siteUrl || '').toLowerCase().replace(/^www\./, '');
      allowTabHost(tabId, host);
    }
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === 'GET_DATA') {
    chrome.storage.local.get(['guardianData'], function(result) {
      sendResponse(result.guardianData || { password: '', passwordSet: false, urls: [] });
    });
    return true;
  }

  if (msg.type === 'SAVE_DATA') {
    chrome.storage.local.set({ guardianData: msg.data }, function() {
      sendResponse({ success: true });
    });
    return true;
  }

  /* Verify password from popup (for delete/toggle actions) */
  if (msg.type === 'VERIFY_ACTION_PASSWORD') {
    chrome.storage.local.get(['guardianData'], function(result) {
      var data = result.guardianData;
      if (!data || !data.passwordSet || !data.password) {
        sendResponse({ success: false, reason: 'no_password' }); return;
      }
      sendResponse({ success: msg.password === data.password });
    });
    return true;
  }
});
