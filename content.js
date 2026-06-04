// URL Guardian - Content Script
// Injects a subtle lock icon on blocked pages for password unlock

(function () {
  // Only run on the blocked page
  if (window.location.href.includes(chrome.runtime.getURL('pages/blocked.html'))) return;

  const params = new URLSearchParams(window.location.search);
  // This content script runs on all pages - handled via blocked.html redirect
  // The lock icon injection is done in blocked.html itself
})();
