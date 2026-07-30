let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  new ParticleNetwork('particle-canvas');

  const glow = document.getElementById('mouse-glow');
  if (glow) {
    document.addEventListener('mousemove', (e) => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    });
  }

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

  const mlStatusEl = document.getElementById('ml-status');
  API.health()
    .then(h => {
      if (mlStatusEl) {
        mlStatusEl.innerHTML = h.ml_loaded
          ? '<div class="nl-status-dot"></div><span>CatBoost Online</span>'
          : '<div class="nl-status-dot" style="background:var(--warning)"></div><span>Model Offline</span>';
      }
    })
    .catch(() => {
      if (mlStatusEl) mlStatusEl.innerHTML = '<div class="nl-status-dot" style="background:var(--danger)"></div><span>Server Offline</span>';
    });

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
});
