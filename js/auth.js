(function () {
  const AUTH_KEY = 'cabc_auth';
  const CREDS = { email: 'admin@cabc.com', password: 'cabc1906' };

  const qs = (s) => document.querySelector(s);
  const $modal = qs('#loginModal');
  const $backdrop = qs('#loginBackdrop');
  const $close = qs('#loginClose');
  const $cancel = qs('#loginCancel');
  const $submit = qs('#loginSubmit');
  const $email = qs('#loginEmail');
  const $pass = qs('#loginPassword');
  const $error = qs('#loginError');
  const $adminLink = qs('#adminLoginLink');

  function isLoggedIn() {
    try { return localStorage.getItem(AUTH_KEY) === '1'; } catch { return false; }
  }
  function login(email, password) {
    if (email?.trim().toLowerCase() === CREDS.email && password === CREDS.password) {
      try { localStorage.setItem(AUTH_KEY, '1'); } catch {}
      return true;
    }
    return false;
  }
  function logout() {
    try { localStorage.removeItem(AUTH_KEY); } catch {}
  }

  function openModal() {
    if (!$modal) return;
    $modal.setAttribute('aria-hidden', 'false');
    $modal.style.display = 'block';
    $error && ($error.textContent = '');
    if ($email) $email.value = '';
    if ($pass) $pass.value = '';
    setTimeout(() => $email?.focus(), 0);
  }
  function closeModal() {
    if (!$modal) return;
    $modal.setAttribute('aria-hidden', 'true');
    $modal.style.display = 'none';
  }

  function handleLogin() {
    const e = $email?.value || '';
    const p = $pass?.value || '';
    if (!e || !p) { $error && ($error.textContent = 'Enter email and password.'); return; }
    if (login(e, p)) {
      closeModal();
      location.href = './dashboard.html';
    } else {
      $error && ($error.textContent = 'Invalid credentials.');
    }
  }

  // Wire events (only if elements exist on the page)
  $adminLink && $adminLink.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (isLoggedIn()) {
      location.href = './dashboard.html';
    } else {
      openModal();
    }
  });
  $submit && $submit.addEventListener('click', (ev) => { ev.preventDefault(); handleLogin(); });
  [$close, $cancel, $backdrop].forEach(el => el && el.addEventListener('click', closeModal));
  [$email, $pass].forEach(el => el && el.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); }));

  // If already logged in, reflect that in the menu item
  if ($adminLink && isLoggedIn()) {
    $adminLink.setAttribute('href', './dashboard.html');
    $adminLink.textContent = 'Dashboard';
  }

  // Expose tiny API
  window.CABCAuth = { isLoggedIn, logout };

  // If redirected with auth=required, optionally open login
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('auth') === 'required' && !isLoggedIn()) {
      openModal();
      history.replaceState({}, '', location.pathname); // clean URL
    }
  } catch {}
})();
