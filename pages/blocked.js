(function () {
  'use strict';

  var params      = new URLSearchParams(window.location.search);
  var originalUrl = params.get('originalUrl') || '';
  var siteName    = params.get('siteName')    || '';

  var displayHost = siteName;
  if (!displayHost && originalUrl) {
    try { displayHost = new URL(originalUrl).hostname; } catch(_) {}
  }

  if (displayHost) {
    document.title = displayHost + " - This site can't be reached";
    var pt = document.getElementById('page-title');
    if (pt) pt.textContent = document.title;
    var hd = document.getElementById('hostname-display');
    if (hd) hd.textContent = displayHost;
    var ps = document.getElementById('popup-site');
    if (ps) ps.textContent = displayHost;
  }

  document.getElementById('btn-reload').onclick  = function() { window.location.reload(); };
  document.getElementById('btn-details').onclick = function() { window.history.back(); };

  var lockEl    = document.getElementById('guardian-lock');
  var overlay   = document.getElementById('unlock-overlay');
  var popup     = document.getElementById('unlock-popup');
  var closeBtn  = document.getElementById('popup-close');
  var cancelBtn = document.getElementById('btn-cancel');
  var unlockBtn = document.getElementById('btn-unlock');
  var pwdInput  = document.getElementById('pwd-input');
  var errDiv    = document.getElementById('popup-err');
  var eyeBtn    = document.getElementById('eye-btn');
  var eyeSvg    = document.getElementById('eye-svg');

  var EYE_OPEN  = 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z';
  var EYE_CLOSE = 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 7.61 17 4.5 12 4.5c-1.25 0-2.45.2-3.57.57l2.16 2.16C11.21 7.1 11.6 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z';

  function openPopup() {
    pwdInput.value = ''; errDiv.textContent = '';
    pwdInput.classList.remove('has-error');
    unlockBtn.disabled = false; unlockBtn.textContent = 'Unlock';
    unlockBtn.style.background = '';
    overlay.classList.add('open');
    setTimeout(function() { pwdInput.focus(); }, 180);
  }
  function closePopup() { overlay.classList.remove('open'); }

  lockEl.addEventListener('click', openPopup);
  lockEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPopup(); }
  });
  closeBtn.addEventListener('click',  closePopup);
  cancelBtn.addEventListener('click', closePopup);
  overlay.addEventListener('click',   function(e) { if (e.target === overlay) closePopup(); });

  eyeBtn.addEventListener('click', function() {
    var isPass = pwdInput.type === 'password';
    pwdInput.type = isPass ? 'text' : 'password';
    eyeSvg.querySelector('path').setAttribute('d', isPass ? EYE_CLOSE : EYE_OPEN);
    pwdInput.focus();
  });

  pwdInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doUnlock(); });
  pwdInput.addEventListener('input',   function()  { pwdInput.classList.remove('has-error'); errDiv.textContent = ''; });
  unlockBtn.addEventListener('click',  doUnlock);

  function doUnlock() {
    var pwd = pwdInput.value;
    if (!pwd) { showErr('Please enter the password.'); return; }
    unlockBtn.disabled = true; unlockBtn.textContent = '···';

    try {
      chrome.runtime.sendMessage({ type: 'VERIFY_PASSWORD', password: pwd }, function(res) {
        if (chrome.runtime.lastError) {
          showErr('Extension error — try reloading.'); resetBtn(); return;
        }
        if (res && res.success) {
          unlockBtn.textContent = '✓ Unlocked!';
          unlockBtn.style.background = '#81c995';
          chrome.runtime.sendMessage({ type: 'WHITELIST_TEMP', siteUrl: siteName }, function() {
            setTimeout(function() { window.location.href = originalUrl; }, 450);
          });
        } else {
          if (res && res.reason === 'no_password') {
            showErr('No password set — open the extension to set one.');
          } else {
            showErr('Incorrect password. Try again.');
          }
          resetBtn(); pwdInput.value = ''; pwdInput.focus();
          popup.classList.remove('shake');
          void popup.offsetWidth;
          popup.classList.add('shake');
          popup.addEventListener('animationend', function() { popup.classList.remove('shake'); }, { once: true });
        }
      });
    } catch(ex) {
      showErr('Cannot reach extension. Reload the page.'); resetBtn();
    }
  }

  function resetBtn() { unlockBtn.disabled = false; unlockBtn.textContent = 'Unlock'; unlockBtn.style.background = ''; }
  function showErr(msg) { errDiv.textContent = '\u26a0 ' + msg; pwdInput.classList.add('has-error'); pwdInput.focus(); }
})();
