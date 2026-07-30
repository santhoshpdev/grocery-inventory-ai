const ROUTES = {
  dashboard: { title: 'Dashboard', subtitle: 'AI-Powered Inventory Overview', render: renderDashboard },
  inventory: { title: 'Inventory', subtitle: 'Browse and Manage Products', render: renderInventory },
  prediction: { title: 'AI Prediction', subtitle: 'ML-Powered Stock Status Classification', render: renderPrediction },
  forecasting: { title: 'Demand Forecasting', subtitle: 'Historical Demand Analysis & Future Demand Estimation', render: renderForecasting },
  analytics: { title: 'Analytics & Insights', subtitle: 'Data-Driven Inventory Intelligence', render: renderAnalytics },
  'ml-insights': { title: 'ML Insights', subtitle: 'Model Performance & Explainability', render: renderMLInsights },
};

let currentPage = '';

function showSkeletonForPage(page) {
  const skeletons = {
    dashboard: `
      <div class="skeleton-hero"></div>
      <div class="kpi-grid">
        <div class="skeleton-kpi"></div>
        <div class="skeleton-kpi"></div>
        <div class="skeleton-kpi"></div>
        <div class="skeleton-kpi"></div>
      </div>
      <div class="skeleton-insight"></div>
      <div class="grid-2">
        <div class="skeleton-chart"></div>
        <div class="skeleton-chart"></div>
      </div>
      <div class="grid-2">
        <div class="skeleton-table" style="height:200px"></div>
        <div class="skeleton-table" style="height:200px"></div>
      </div>
    `,
    inventory: `
      <div class="card">
        <div style="margin-bottom:20px">
          <div class="skeleton-title"></div>
        </div>
        <div class="search-bar" style="opacity:0.3;pointer-events:none">
          <div class="skeleton-text" style="height:42px;width:100%"></div>
          <div class="skeleton-text" style="height:42px;width:160px"></div>
          <div class="skeleton-text" style="height:42px;width:160px"></div>
        </div>
        <div class="skeleton-table"></div>
        <div style="display:flex;justify-content:space-between;padding-top:12px">
          <div class="skeleton-text" style="width:120px"></div>
          <div style="display:flex;gap:4px">
            <div class="skeleton-text" style="width:60px"></div>
            <div class="skeleton-text" style="width:60px"></div>
          </div>
        </div>
      </div>
    `,
    prediction: `
      <div class="card">
        <div class="skeleton-title" style="width:160px"></div>
        <div class="grid-3">
          <div class="skeleton-text" style="height:70px"></div>
          <div class="skeleton-text" style="height:70px"></div>
          <div class="skeleton-text" style="height:70px"></div>
        </div>
        <div class="grid-3">
          <div class="skeleton-text" style="height:70px"></div>
          <div class="skeleton-text" style="height:70px"></div>
          <div class="skeleton-text" style="height:70px"></div>
        </div>
        <div class="grid-2">
          <div class="skeleton-text" style="height:70px"></div>
          <div class="skeleton-text" style="height:70px"></div>
        </div>
      </div>
    `,
    forecasting: `
      <div class="card">
        <div class="skeleton-title"></div>
        <div class="forecast-controls" style="opacity:0.3;pointer-events:none">
          <div class="skeleton-text" style="height:42px;width:200px"></div>
          <div class="skeleton-text" style="height:42px;width:200px"></div>
          <div class="skeleton-text" style="height:42px;width:100px"></div>
        </div>
        <div class="skeleton-chart"></div>
      </div>
    `,
    analytics: `
      <div class="card">
        <div class="skeleton-title"></div>
      </div>
      <div class="insight-grid">
        <div class="skeleton-insight"></div>
        <div class="skeleton-insight"></div>
        <div class="skeleton-insight"></div>
        <div class="skeleton-insight"></div>
      </div>
      <div class="grid-2">
        <div class="skeleton-chart"></div>
        <div class="skeleton-chart"></div>
      </div>
      <div class="skeleton-chart" style="height:340px"></div>
      <div class="summary-grid">
        <div class="skeleton-insight" style="height:70px"></div>
        <div class="skeleton-insight" style="height:70px"></div>
        <div class="skeleton-insight" style="height:70px"></div>
        <div class="skeleton-insight" style="height:70px"></div>
      </div>
    `,
    'ml-insights': `
      <div class="card">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
          <div class="skeleton-kpi" style="width:52px;height:52px;border-radius:14px"></div>
          <div style="flex:1">
            <div class="skeleton-title" style="width:280px"></div>
            <div class="skeleton-text" style="width:200px"></div>
          </div>
        </div>
        <div class="skeleton-insight"></div>
      </div>
      <div class="skeleton-chart" style="height:380px"></div>
      <div class="grid-2">
        <div class="skeleton-table" style="height:350px"></div>
        <div class="skeleton-chart" style="height:350px"></div>
      </div>
    `,
  };
  return `<div class="page-skeleton">${skeletons[page] || '<div class="loading-screen"><div class="loader-ring"></div></div>'}</div>`;
}

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
  container.querySelectorAll('.card, .kpi-card, .ml-model-card, .insight-card, .summary-item, .detail-item, .forecast-overview-item, .hero-section, .ai-insight-card, .priority-item, .alert-item').forEach((el, i) => {
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

    content.innerHTML = showSkeletonForPage(page);

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
    }, 100);
  }, 150);
}

window.addEventListener('hashchange', handleRoute);
