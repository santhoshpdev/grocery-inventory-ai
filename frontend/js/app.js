let searchTimeout = null;

async function initAuth() {
  const loginPage = document.getElementById('login-page');
  const mainContent = document.getElementById('main-content');
  const navbar = document.getElementById('navbar');

  const isAuth = await checkAuth();

  if (isAuth) {
    loginPage.style.display = 'none';
    navbar.style.display = '';
    mainContent.style.display = '';
    updateUserProfile();
    updateRoleBasedNav();
    initParticles();
    initApp();
  } else {
    loginPage.style.display = '';
    navbar.style.display = 'none';
    mainContent.style.display = 'none';
    initParticles();
  }
}

function initParticles() {
  if (!document.getElementById('particle-canvas')) return;
  new ParticleNetwork('particle-canvas');
  const glow = document.getElementById('mouse-glow');
  if (glow) {
    document.addEventListener('mousemove', (e) => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    });
  }
}

function updateUserProfile() {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById('nav-user-name').textContent = user.username;
  document.getElementById('nav-user-role').textContent = ROLE_LABELS[user.role] || user.role;
  document.getElementById('mobile-user-name').textContent = user.username;
  document.getElementById('mobile-user-role').textContent = ROLE_LABELS[user.role] || user.role;
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  const btnText = btn.querySelector('.login-btn-text');
  const spinner = btn.querySelector('.login-btn-spinner');

  errorEl.style.display = 'none';
  btn.disabled = true;
  btnText.style.display = 'none';
  spinner.style.display = 'inline-block';

  try {
    const result = await API.auth.login({ username, password });
    setAuth(result.access_token, {
      id: result.user_id,
      username: result.username,
      role: result.role,
      is_active: result.is_active,
    });
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('navbar').style.display = '';
    document.getElementById('main-content').style.display = '';
    document.getElementById('ml-status').innerHTML = '<div class="nl-status-dot"></div><span>CatBoost</span>';
    updateUserProfile();
    updateRoleBasedNav();
    handleRoute();

    API.health().then(h => {
      const mlStatusEl = document.getElementById('ml-status');
      if (mlStatusEl) {
        mlStatusEl.innerHTML = h.ml_loaded
          ? '<div class="nl-status-dot"></div><span>CatBoost Online</span>'
          : '<div class="nl-status-dot" style="background:var(--warning)"></div><span>Model Offline</span>';
      }
    }).catch(() => {});
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btnText.style.display = '';
    spinner.style.display = 'none';
  }
  return false;
}

function handleLogout() {
  API.auth.logout().catch(() => {});
  clearAuth();
  document.getElementById('login-page').style.display = '';
  document.getElementById('navbar').style.display = 'none';
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
  window.location.hash = '';
}

function togglePassword() {
  const pw = document.getElementById('login-password');
  const icon = document.getElementById('password-toggle-icon');
  if (pw.type === 'password') {
    pw.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    pw.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

function initApp() {
  const glow = document.getElementById('mouse-glow');

  const searchBtn = document.getElementById('search-btn');
  const globalSearch = document.getElementById('global-search');
  const searchInput = document.getElementById('global-search-input');
  const searchResults = document.getElementById('global-search-results');

  function openSearch() {
    globalSearch?.classList.add('open');
    setTimeout(() => searchInput?.focus(), 100);
  }
  window.closeSearch = function() {
    globalSearch?.classList.remove('open');
    if (searchResults) searchResults.innerHTML = '';
  }

  searchBtn?.addEventListener('click', openSearch);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      globalSearch?.classList.contains('open') ? closeSearch() : openSearch();
    }
    if (e.key === 'Escape') closeSearch();
  });

  searchInput?.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    const q = this.value.trim();
    if (!q) { if (searchResults) searchResults.innerHTML = ''; return; }
    searchTimeout = setTimeout(async () => {
      try {
        const data = await API.inventory({ search: q, per_page: 10 });
        if (searchResults) {
          if (!data || data.length === 0) {
            searchResults.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:13px">No results found</div>';
            return;
          }
          searchResults.innerHTML = data.map(r => `
            <div class="global-search-result" onclick="closeSearch();navigateTo('inventory');document.getElementById('inv-search')?.value='${q.replace(/'/g, "\\'")}';loadInventory()">
              <i class="fas fa-box" style="color:var(--primary-light);font-size:12px"></i>
              <span>${displayName(r.product)}</span>
              <span style="color:var(--text-muted);font-size:12px;margin-left:auto">${r.product?.category || ''} ${r.stock_status ? '<span class="badge badge-' + statusBadgeClass(r.stock_status) + '" style="font-size:10px">' + r.stock_status + '</span>' : ''}</span>
            </div>
          `).join('');
        }
      } catch (e) { /* ignore */ }
    }, 300);
  });

  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      menuBtn.innerHTML = mobileNav.classList.contains('open')
        ? '<i class="fas fa-times"></i>'
        : '<i class="fas fa-bars"></i>';
    });
    document.querySelectorAll('.mobile-nav-link').forEach(el => {
      el.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
      });
    });
  }

  const timeEl = document.getElementById('header-time');
  if (timeEl) {
    function updateTime() {
      const now = new Date();
      timeEl.textContent = now.toLocaleString('en-US', {
        hour: '2-digit', minute: '2-digit',
        hour12: false
      });
    }
    updateTime();
    setInterval(updateTime, 30000);
  }

  function updateNavIndicator(page) {
    const indicator = document.getElementById('nav-indicator');
    const activeLink = document.querySelector('.nav-link.active');
    if (indicator && activeLink) {
      const parent = activeLink.closest('.nav-links');
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        indicator.style.width = linkRect.width + 'px';
        indicator.style.left = (linkRect.left - parentRect.left) + 'px';
        indicator.classList.add('visible');
      }
    }
  }

  const origHandleRoute = window.handleRoute;
  if (origHandleRoute) {
    window.addEventListener('hashchange', () => {
      setTimeout(updateNavIndicator, 200);
    });
  }

  setTimeout(updateNavIndicator, 300);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
      }
    });
  }, { threshold: 0.1 });

  function observeCards() {
    document.querySelectorAll('.animate-fade').forEach(el => observer.observe(el));
  }

  if (origHandleRoute) {
    const origRender = origHandleRoute;
    window.handleRoute = function() {
      origRender();
      setTimeout(observeCards, 400);
      setTimeout(updateNavIndicator, 200);
    };
  }

  document.querySelectorAll('.kpi-card, .card').forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const rotateX = (y - 0.5) * -6;
      const rotateY = (x - 0.5) * 6;
      el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0)';
    });
  });

  handleRoute();
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAuth();
});
