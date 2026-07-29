const ROUTES = {
  dashboard: { title: 'Dashboard', subtitle: 'AI-Powered Inventory Overview', render: renderDashboard },
  inventory: { title: 'Inventory', subtitle: 'Browse and Manage Products', render: renderInventory },
  prediction: { title: 'AI Prediction', subtitle: 'ML-Powered Stock Status Classification', render: renderPrediction },
  analytics: { title: 'Analytics & Insights', subtitle: 'Data-Driven Inventory Intelligence', render: renderAnalytics },
  'ml-insights': { title: 'ML Insights', subtitle: 'Model Performance & Explainability', render: renderMLInsights },
};

let currentPage = '';

function navigateTo(page) {
  window.location.hash = page;
}

function getCurrentPage() {
  const hash = window.location.hash.replace('#', '');
  return hash && ROUTES[hash] ? hash : 'dashboard';
}

function typewriter(el, text, speed = 20) {
  if (!el) return;
  el.textContent = '';
  el.classList.add('typewriter-cursor');
  let i = 0;
  function tick() {
    if (i < text.length) {
      el.textContent += text[i];
      i++;
      setTimeout(tick, speed);
    } else {
      el.classList.remove('typewriter-cursor');
    }
  }
  tick();
}

function addAnimateFade(container) {
  container.querySelectorAll('.card, .kpi-card, .ml-model-card, .insight-card, .summary-item, .detail-item').forEach((el, i) => {
    el.classList.add('animate-fade');
    const delay = Math.min((i % 8) + 1, 8);
    el.classList.add('stagger-' + delay);
  });
  container.classList.add('page-content-enter');
  setTimeout(() => {
    container.querySelectorAll('.animate-fade').forEach(el => {
      el.classList.add('in-view');
    });
  }, 50);
}

function handleRoute() {
  const page = getCurrentPage();
  if (page === currentPage) return;
  currentPage = page;

  const route = ROUTES[page];
  const titleEl = document.getElementById('page-title');
  const subEl = document.getElementById('page-subtitle');

  if (titleEl) typewriter(titleEl, route.title);
  if (subEl) subEl.textContent = route.subtitle;

  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  const content = document.getElementById('page-content');
  if (!content) return;

  const transitionOverlay = document.getElementById('page-transition');
  if (transitionOverlay) {
    transitionOverlay.classList.add('active');
  }

  setTimeout(() => {
    if (transitionOverlay) {
      transitionOverlay.classList.remove('active');
    }

    content.innerHTML = `
      <div class="loading-screen">
        <div class="loader-ring"><div class="loader-ring-inner"></div></div>
        <p class="loader-text">Loading ${route.title.toLowerCase()}...</p>
      </div>
    `;

    setTimeout(() => {
      try {
        route.render(content);
        addAnimateFade(content);
      } catch (e) {
        console.error('Render error:', e);
        content.innerHTML = `
          <div class="card" style="text-align:center;padding:40px;border-color:rgba(239,68,68,0.3)">
            <i class="fas fa-exclamation-triangle" style="font-size:36px;color:var(--danger);margin-bottom:12px;display:block"></i>
            <h3 style="color:var(--text);margin-bottom:6px">Something went wrong</h3>
            <p style="color:var(--text-muted)">${e.message}</p>
            <button class="btn btn-primary mt-16" onclick="location.reload()">Reload Page</button>
          </div>
        `;
      }
    }, 200);
  }, 350);
}

window.addEventListener('hashchange', handleRoute);
