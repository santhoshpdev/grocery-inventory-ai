document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');

  if (menuBtn) {
    menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) sidebar.classList.remove('open');
    });
  });

  const timeEl = document.getElementById('header-time');
  if (timeEl) {
    function updateTime() {
      const now = new Date();
      timeEl.textContent = now.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    updateTime();
    setInterval(updateTime, 30000);
  }

  const mlStatusEl = document.getElementById('ml-status');
  API.health()
    .then(h => {
      if (mlStatusEl) {
        mlStatusEl.innerHTML = h.ml_loaded
          ? '<div class="status-dot active"></div><span>ML: CatBoost Online</span>'
          : '<div class="status-dot error"></div><span>ML Model Unavailable</span>';
      }
    })
    .catch(() => {
      if (mlStatusEl) mlStatusEl.innerHTML = '<div class="status-dot error"></div><span>Server Offline</span>';
    });

  if (typeof handleRoute === 'function') {
    handleRoute();
  } else {
    console.error('Router not loaded');
  }

  new ParticleNetwork('particle-canvas');

  const glow = document.getElementById('mouse-glow');
  if (glow) {
    document.addEventListener('mousemove', (e) => {
      glow.style.left = e.clientX + 'px';
      glow.style.top = e.clientY + 'px';
    });
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
      }
    });
  }, { threshold: 0.1 });

  function observeCards() {
    document.querySelectorAll('.animate-fade').forEach(el => observer.unobserve(el));
    document.querySelectorAll('.animate-fade').forEach(el => observer.observe(el));
  }

  const origHandleRoute = window.handleRoute;
  if (origHandleRoute) {
    const orig = origHandleRoute;
    window.handleRoute = function() {
      orig();
      observeCards();
    };
  }
});
