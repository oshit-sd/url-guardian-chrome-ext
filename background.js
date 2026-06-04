// URL Guardian — Background Service Worker v2

/* ── Init storage on install ── */
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['guardianData'], function(result) {
    if (!result.guardianData) {
      chrome.storage.local.set({
        guardianData: { password: '', passwordSet: false, urls: [] }
      });
    }
  });
});

/* ── Intercept tab navigations ── */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'loading' && tab.url) {
    maybeBlock(tabId, tab.url);
  }
});

function maybeBlock(tabId, url) {
  // Never redirect our own blocked page — avoids infinite loops
  var blockedBase = chrome.runtime.getURL('pages/blocked.html');
  if (url.startsWith(blockedBase)) return;

  // Only intercept real web pages
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  var hostname;
  try { hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); }
  catch(_) { return; }

  chrome.storage.local.get(['guardianData'], function(result) {
    var data = result.guardianData;
    if (!data || !data.urls || data.urls.length === 0) return;

    var match = null;
    for (var i = 0; i < data.urls.length; i++) {
      var entry    = data.urls[i];
      var entryHost = entry.url.toLowerCase().replace(/^www\./, '');
      if (hostname === entryHost || hostname.endsWith('.' + entryHost)) {
        match = entry;
        break;
      }
    }

    if (!match) return;
    if (match.status !== 'blocked') return;
    if (match.tempAllow === true) return;   // already unlocked this session

    var dest = blockedBase
      + '?originalUrl=' + encodeURIComponent(url)
      + '&siteName='    + encodeURIComponent(match.url);

    chrome.tabs.update(tabId, { url: dest });
  });
}

/* ── Message handler ── */
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  /* Verify password */
  if (msg.type === 'VERIFY_PASSWORD') {
    chrome.storage.local.get(['guardianData'], function(result) {
      var data = result.guardianData;
      if (!data || !data.passwordSet || !data.password) {
        sendResponse({ success: false, reason: 'no_password' });
        return;
      }
      sendResponse({ success: msg.password === data.password });
    });
    return true;  // keep channel open for async
  }

  /* Temporarily allow a site after correct password */
  if (msg.type === 'WHITELIST_TEMP') {
    chrome.storage.local.get(['guardianData'], function(result) {
      var data = result.guardianData;
      if (!data) { sendResponse({ success: false }); return; }

      var siteArg = (msg.siteUrl || '').toLowerCase().replace(/^www\./, '');
      var idx = -1;
      for (var i = 0; i < data.urls.length; i++) {
        var h = data.urls[i].url.toLowerCase().replace(/^www\./, '');
        if (h === siteArg) { idx = i; break; }
      }

      if (idx === -1) { sendResponse({ success: false }); return; }

      data.urls[idx].tempAllow = true;
      chrome.storage.local.set({ guardianData: data }, function() {
        sendResponse({ success: true });

        // Auto-expire after 30 min
        (function(capturedIdx) {
          setTimeout(function() {
            chrome.storage.local.get(['guardianData'], function(r) {
              if (r.guardianData && r.guardianData.urls[capturedIdx]) {
                r.guardianData.urls[capturedIdx].tempAllow = false;
                chrome.storage.local.set({ guardianData: r.guardianData });
              }
            });
          }, 30 * 60 * 1000);
        })(idx);
      });
    });
    return true;
  }

  /* Get all data */
  if (msg.type === 'GET_DATA') {
    chrome.storage.local.get(['guardianData'], function(result) {
      sendResponse(result.guardianData || { password: '', passwordSet: false, urls: [] });
    });
    return true;
  }

  /* Save all data */
  if (msg.type === 'SAVE_DATA') {
    chrome.storage.local.set({ guardianData: msg.data }, function() {
      sendResponse({ success: true });
    });
    return true;
  }
});
