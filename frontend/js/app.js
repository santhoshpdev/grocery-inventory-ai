document.addEventListener('DOMContentLoaded', () => {
  new ParticleNetwork('particle-canvas');

  const glow = document.getElementById('mouse-glow');
  if (glow) {
    document.addEventListener('mousemove', (e) => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    });
  }

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
    const wrapped = function() {
      origHandleRoute();
      setTimeout(updateNavIndicator, 200);
    };
    window.handleRoute = wrapped;

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
});
