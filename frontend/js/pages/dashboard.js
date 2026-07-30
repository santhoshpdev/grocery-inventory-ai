let statusChart = null;
let categoryChart = null;
let forecastTrendChart = null;

function renderDashboard(container) {
  container.innerHTML = `
    <div id="dash-hero"></div>
    <div id="dash-health"></div>
    <div class="kpi-grid" id="kpi-grid"></div>
    <div id="dash-insight"></div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Stock Status Distribution</div>
            <div class="card-subtitle">Current inventory health breakdown</div>
          </div>
        </div>
        <div class="chart-container"><canvas id="status-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Category Distribution</div>
            <div class="card-subtitle">Products by category</div>
          </div>
        </div>
        <div class="chart-container"><canvas id="category-chart"></canvas></div>
      </div>
    </div>
    <div id="dash-priority"></div>
    <div id="dash-forecast-overview"></div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Recent AI Predictions</div>
            <div class="card-subtitle">Latest ML status predictions</div>
          </div>
        </div>
        <div id="recent-predictions">
          <div class="empty-state"><i class="fas fa-robot"></i><h3>No predictions yet</h3><p>Run AI predictions to see them here</p></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Low Stock Alerts</div>
            <div class="card-subtitle">Products requiring immediate attention</div>
          </div>
        </div>
        <div id="alerts-list">
          <div class="empty-state"><i class="fas fa-bell"></i><h3>No alerts</h3><p>All products adequately stocked</p></div>
        </div>
      </div>
    </div>
  `;
  loadDashboardData();
}

async function loadDashboardData() {
  try {
    const data = await API.dashboard();
    const total = data.low_stock_count + data.normal_stock_count + data.overstock_count;
    const healthScore = total ? Math.round(((data.normal_stock_count + data.overstock_count * 0.5) / total) * 100) : 0;

    renderHero(data, total, healthScore);
    renderHealthScore(healthScore);
    renderKPI(data, total);
    renderAIInsight(data, total);
    const renderStatusChart = () => createStatusChart(data.status_distribution);
    const renderCategoryChart = () => createCategoryChart(data.category_distribution);
    safeChart(renderStatusChart);
    safeChart(renderCategoryChart);
    registerChartRenderer(renderStatusChart);
    registerChartRenderer(renderCategoryChart);
    renderPriority(data, total);
    renderForecastOverview();
    renderRecentPredictions(data.recent_predictions);
    renderAlerts(data.recent_alerts);
  } catch (err) {
    document.getElementById('kpi-grid').innerHTML = `
      <div class="card" style="grid-column:1/-1;text-align:center;padding:40px;border-color:rgba(239,68,68,0.3)">
        <i class="fas fa-exclamation-triangle" style="font-size:32px;color:var(--danger);margin-bottom:12px;display:block"></i>
        <h3 style="color:var(--text);margin-bottom:6px">Failed to Load Dashboard</h3>
        <p style="color:var(--text-muted);font-size:14px">${err.message}</p>
        <button class="btn btn-outline mt-16" onclick="renderDashboard(document.getElementById('page-content'))">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
  }
}

function renderHero(data, total, healthScore) {
  const catLabels = data.category_distribution?.map(c => c.category).join(', ') || '';
  document.getElementById('dash-hero').innerHTML = `
    <div class="hero-section">
      <div class="hero-content">
        <div class="hero-title">Good <span id="dash-greeting"></span>, <span class="text-gradient">StockIntel AI</span></div>
        <div class="hero-subtitle">Your AI-powered inventory intelligence system is active. Monitor stock health, run predictions, and explore ${data.total_records.toLocaleString()} inventory records across ${data.total_products} products.</div>
        <div class="hero-stats">
          <span class="hero-stat"><i class="fas fa-database"></i> <strong>${data.total_records.toLocaleString()}</strong> records</span>
          <span class="hero-stat"><i class="fas fa-box"></i> <strong>${data.total_products}</strong> products</span>
          <span class="hero-stat"><i class="fas fa-microchip"></i> <strong>99.17%</strong> CatBoost accuracy</span>
          <span class="hero-stat"><i class="fas fa-tag"></i> ${catLabels}</span>
        </div>
      </div>
      <div class="hero-visual">
        <div class="health-score" id="health-score-ring">
          <div class="health-score-text">
            <div class="health-score-value" id="health-value">0</div>
            <div class="health-score-label">Health</div>
          </div>
        </div>
      </div>
    </div>
  `;
  const h = new Date().getHours();
  const greeting = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  document.getElementById('dash-greeting').textContent = greeting;
}

function renderHealthScore(score) {
  const container = document.getElementById('health-score-ring');
  if (!container) return;
  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 100;
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const cx = 50, cy = 50, r = 40, start = -Math.PI / 2;
  const end = start + (Math.PI * 2 * Math.min(score / 100, 1));
  ctx.clearRect(0, 0, 100, 100);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 6; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, start, end);
  ctx.strokeStyle = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
  const valEl = document.getElementById('health-value');
  if (valEl) animateCounter(valEl, score, '%');
}

function renderAIInsight(data, total) {
  const lowPct = total ? ((data.low_stock_count / total) * 100).toFixed(1) : 0;
  const normalPct = total ? ((data.normal_stock_count / total) * 100).toFixed(1) : 0;
  const overPct = total ? ((data.overstock_count / total) * 100).toFixed(1) : 0;
  const insight = lowPct > 20
    ? `⚠️ ${lowPct}% of inventory is low stock — consider urgent replenishment. Focus on high-demand items with low shelf life.`
    : overPct > 40
    ? `📦 ${overPct}% of inventory is overstocked — consider promotions or reducing orders for slow-moving items.`
    : `✅ Inventory is well-balanced: ${normalPct}% normal, ${overPct}% overstocked, ${lowPct}% low stock. CatBoost model is at 99.17% accuracy.`;

  document.getElementById('dash-insight').innerHTML = `
    <div class="ai-insight-card">
      <div class="ai-insight-icon"><i class="fas fa-brain"></i></div>
      <div class="ai-insight-content">
        <div class="ai-insight-title"><i class="fas fa-lightbulb" style="color:#fbbf24;margin-right:6px"></i>AI Insight</div>
        <div class="ai-insight-text">${insight}</div>
      </div>
    </div>
  `;
}

function renderKPI(data, total) {
  const lowPct = total ? ((data.low_stock_count / total) * 100).toFixed(1) : 0;
  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-icon green"><i class="fas fa-box"></i></div>
      <div class="kpi-info">
        <div class="kpi-value"><span class="counter" id="kpi-products">0</span></div>
        <div class="kpi-label">Total Products</div>
        <div class="kpi-trend up"><i class="fas fa-database"></i> ${data.total_records} records</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon amber"><i class="fas fa-exclamation-triangle"></i></div>
      <div class="kpi-info">
        <div class="kpi-value" style="color:var(--warning)"><span class="counter" id="kpi-low">0</span></div>
        <div class="kpi-label">Low Stock Items</div>
        <div class="kpi-trend down"><i class="fas fa-arrow-up"></i> ${lowPct}% of total</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon blue"><i class="fas fa-check-circle"></i></div>
      <div class="kpi-info">
        <div class="kpi-value" style="color:var(--secondary-light)"><span class="counter" id="kpi-normal">0</span></div>
        <div class="kpi-label">Normal Stock</div>
        <div class="kpi-trend up"><i class="fas fa-thumbs-up"></i> Adequately stocked</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon teal"><i class="fas fa-archive"></i></div>
      <div class="kpi-info">
        <div class="kpi-value" style="color:#14b8a6"><span class="counter" id="kpi-over">0</span></div>
        <div class="kpi-label">Overstock</div>
        <div class="kpi-trend up"><i class="fas fa-boxes"></i> Excess inventory</div>
      </div>
    </div>
  `;
  setTimeout(() => {
    animateCounter(document.getElementById('kpi-products'), data.total_products);
    animateCounter(document.getElementById('kpi-low'), data.low_stock_count);
    animateCounter(document.getElementById('kpi-normal'), data.normal_stock_count);
    animateCounter(document.getElementById('kpi-over'), data.overstock_count);
  }, 100);
}

function renderPriority(data, total) {
  const alerts = data.recent_alerts?.slice(0, 5) || [];
  const overstockCount = data.overstock_count || 0;
  const normalCount = data.normal_stock_count || 0;
  const lowCount = data.low_stock_count || 0;
  const items = [];
  if (alerts.length > 0) {
    alerts.slice(0, 3).forEach(a => {
      items.push({ icon: 'fa-exclamation', iconBg: 'var(--danger-bg)', iconColor: 'var(--danger)', name: displayName(a.product_name), meta: `Inventory: ${a.inventory_level} units`, badge: 'Low Stock', badgeClass: 'badge-danger' });
    });
  }
  if (total) {
    items.push({ icon: 'fa-chart-pie', iconBg: 'var(--warning-bg)', iconColor: 'var(--warning)', name: 'Stock Distribution', meta: `${lowCount} low · ${normalCount} normal · ${overstockCount} overstock`, badge: `${Math.round((lowCount/total)*100)}% Low`, badgeClass: lowCount/total > 0.2 ? 'badge-danger' : 'badge-warning' });
  }
  if (items.length === 0) return;
  document.getElementById('dash-priority').innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title"><i class="fas fa-bell" style="color:var(--warning);margin-right:6px"></i>Priority Attention</div>
          <div class="card-subtitle">Items requiring immediate action</div>
        </div>
      </div>
      ${items.map(item => `
        <div class="priority-item">
          <div class="priority-icon" style="background:${item.iconBg};color:${item.iconColor}"><i class="fas ${item.icon}"></i></div>
          <div class="priority-info">
            <div class="priority-name">${item.name}</div>
            <div class="priority-meta">${item.meta}</div>
          </div>
          <span class="badge ${item.badgeClass} priority-badge">${item.badge}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function getThemeTextColor() {
  const style = getComputedStyle(document.documentElement);
  const isLight = document.documentElement.getAttribute('data-mode') === 'light' || document.documentElement.getAttribute('data-theme') === 'light';
  const text = style.getPropertyValue('--text').trim();
  if (text) return text;
  return isLight ? '#0f172a' : '#f0f4f8';
}

function getThemeMutedColor() {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue('--text-muted').trim() || '#64748b';
}

const statusChartPlugin = {
  id: 'centerText',
  beforeDraw(chart) {
    const { width, height, ctx } = chart;
    ctx.save();
    const total = chart.config.data.datasets[0].data.reduce((a, b) => a + b, 0);
    const cx = width / 2;
    const cy = height / 2 - 6;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 26px Inter, sans-serif';
    ctx.fillStyle = getThemeTextColor();
    ctx.fillText(total.toLocaleString(), cx, cy - 4);
    ctx.font = '500 11px Inter, sans-serif';
    ctx.fillStyle = getThemeMutedColor();
    ctx.fillText('Total Records', cx, cy + 18);
    ctx.restore();
  },
};

function createStatusChart(distribution) {
  const canvas = document.getElementById('status-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (statusChart) statusChart.destroy();
  const tc = chartTickColor();
  const tooltipOpts = chartTooltip();

  const total = distribution.reduce((s, d) => s + d.count, 0);
  const statusColors = { 'Low Stock': '#ef4444', 'Normal': '#f59e0b', 'Overstock': '#10b981' };
  const statusLabels = { 'Low Stock': 'Low Stock', 'Normal': 'Normal Stock', 'Overstock': 'Overstock' };

  const labels = ['Low Stock', 'Normal', 'Overstock'];
  const data = labels.map(l => {
    const found = distribution.find(d => d.status === l);
    return found ? found.count : 0;
  });
  const colors = labels.map(l => statusColors[l]);
  const displayLabels = labels.map(l => statusLabels[l]);

  const totalPct = total || 1;

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: displayLabels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: ['rgba(239,68,68,0.3)', 'rgba(245,158,11,0.3)', 'rgba(16,185,129,0.3)'],
        borderWidth: 2,
        hoverOffset: 12,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      radius: '90%',
      animation: {
        animateRotate: true,
        duration: 1000,
        easing: 'easeOutQuart',
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle',
            color: tc,
            font: { size: 12, weight: '600' },
            generateLabels: function(chart) {
              const ds = chart.data.datasets[0];
              return chart.data.labels.map((label, i) => ({
                text: `${label}: ${ds.data[i].toLocaleString()} (${((ds.data[i] / totalPct) * 100).toFixed(1)}%)`,
                fillStyle: ds.backgroundColor[i],
                strokeStyle: ds.borderColor[i],
                pointStyle: 'circle',
                index: i,
              }));
            },
          },
        },
        tooltip: {
          ...tooltipOpts,
          callbacks: {
            title: function(items) {
              return items[0].label;
            },
            label: function(ctx) {
              const pct = total ? ((ctx.raw / total) * 100).toFixed(1) : 0;
              return ` ${ctx.raw.toLocaleString()} products  (${pct}%)`;
            },
            afterLabel: function(ctx) {
              if (ctx.dataIndex === 0) return ' ⚠️ Needs attention';
              if (ctx.dataIndex === 2) return ' 📦 Excess inventory';
              return '';
            },
          },
        },
      },
    },
    plugins: [statusChartPlugin],
  });
}

function createCategoryChart(distribution) {
  const canvas = document.getElementById('category-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (categoryChart) categoryChart.destroy();
  const data = distribution.slice(0, 10);
  const cols = chartColors();
  const tc = chartTickColor();
  const gc = chartGridColor();
  const tooltipOpts = chartTooltip();
  categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.category),
      datasets: [{
        label: 'Records',
        data: data.map(d => d.count),
        backgroundColor: cols.slice(0, data.length),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: {
        legend: { display: false },
        tooltip: tooltipOpts,
      },
      scales: {
        y: { beginAtZero: true, grid: { color: gc }, ticks: { color: tc } },
        x: { grid: { display: false }, ticks: { color: tc } },
      },
    },
  });
}

function renderRecentPredictions(predictions) {
  const el = document.getElementById('recent-predictions');
  if (!predictions || predictions.length === 0) return;
  el.innerHTML = `
    <div class="table-container">
      <table>
        <thead><tr><th>ID</th><th>Status</th><th>Confidence</th><th>Time</th></tr></thead>
        <tbody>
          ${predictions.slice(0, 8).map(p => `
            <tr>
              <td style="font-weight:600">#${p.id}</td>
              <td><span class="badge badge-${statusBadgeClass(p.predicted_status)}">${p.predicted_status}</span></td>
              <td style="font-weight:600">${(p.confidence * 100).toFixed(1)}%</td>
              <td style="color:var(--text-muted)">${new Date(p.created_at).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderForecastOverview() {
  const el = document.getElementById('dash-forecast-overview');
  if (!el) return;
  try {
    const overview = await API.forecastOverview();
    if (!overview || overview.length === 0) {
      el.innerHTML = '';
      return;
    }
    const increasing = overview.filter(o => o.summary?.trend === 'Increasing');
    const decreasing = overview.filter(o => o.summary?.trend === 'Decreasing');
    const stable = overview.filter(o => o.summary?.trend === 'Stable');
    const highest = overview.reduce((a, b) => (a.summary?.average_forecast || 0) > (b.summary?.average_forecast || 0) ? a : b, overview[0]);

    el.innerHTML = `
      <div class="card" style="margin-top:4px">
        <div class="card-header">
          <div>
            <div class="card-title"><i class="fas fa-chart-line" style="color:#3b82f6;margin-right:6px"></i>Demand Forecast Trend</div>
            <div class="card-subtitle">Future demand prediction across products</div>
          </div>
          <button class="btn btn-outline" style="padding:6px 14px;font-size:12px" onclick="navigateTo('forecasting')">
            <i class="fas fa-external-link-alt"></i> Open Forecasting
          </button>
        </div>
        <div class="forecast-overview-grid">
          <div class="forecast-overview-item">
            <div class="forecast-overview-icon" style="background:rgba(16,185,129,0.1);color:#10b981"><i class="fas fa-arrow-trend-up"></i></div>
            <div>
              <div class="forecast-overview-value">${increasing.length}</div>
              <div class="forecast-overview-label">Demand Increasing</div>
            </div>
          </div>
          <div class="forecast-overview-item">
            <div class="forecast-overview-icon" style="background:rgba(100,116,139,0.1);color:#94a3b8"><i class="fas fa-minus"></i></div>
            <div>
              <div class="forecast-overview-value">${stable.length}</div>
              <div class="forecast-overview-label">Demand Stable</div>
            </div>
          </div>
          <div class="forecast-overview-item">
            <div class="forecast-overview-icon" style="background:rgba(239,68,68,0.1);color:#ef4444"><i class="fas fa-arrow-trend-down"></i></div>
            <div>
              <div class="forecast-overview-value">${decreasing.length}</div>
              <div class="forecast-overview-label">Demand Decreasing</div>
            </div>
          </div>
          <div class="forecast-overview-item">
            <div class="forecast-overview-icon" style="background:rgba(245,158,11,0.1);color:#f59e0b"><i class="fas fa-trophy"></i></div>
            <div>
              <div class="forecast-overview-value">${highest.summary?.average_forecast || '—'}</div>
              <div class="forecast-overview-label">Highest Avg Forecast (units/day)</div>
            </div>
          </div>
        </div>
        <div class="chart-container" style="height:280px;margin-top:16px"><canvas id="dash-forecast-chart"></canvas></div>
      </div>
    `;
    const renderFcTrend = () => renderForecastTrendChart(overview);
    safeChart(renderFcTrend);
    registerChartRenderer(renderFcTrend);
  } catch (e) {
    el.innerHTML = '';
  }
}

function renderForecastTrendChart(overview) {
  const canvas = document.getElementById('dash-forecast-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (forecastTrendChart) forecastTrendChart.destroy();

  const cols = chartColors();
  const tc = chartTickColor();
  const gc = chartGridColor();
  const tooltipOpts = chartTooltip();
  const datasets = [];
  const colors = cols;
  const allLabels = new Set();

  overview.slice(0, 6).forEach((item, idx) => {
    if (!item.forecast) return;
    const vals = {};
    item.forecast.forEach(f => {
      const shortDate = f.date.substring(5);
      vals[shortDate] = f.predicted_demand;
      allLabels.add(shortDate);
    });
    const prodName = displayName(item.product_name);
    datasets.push({
      label: prodName,
      data: Array.from(allLabels).map(d => vals[d] || null),
      borderColor: colors[idx % colors.length],
      backgroundColor: colors[idx % colors.length] + '18',
      borderWidth: 2,
      fill: false,
      tension: 0.3,
      pointRadius: 2,
      pointHitRadius: 8,
    });
  });

  const sortedLabels = Array.from(allLabels).sort();

  datasets.forEach(ds => {
    ds.data = sortedLabels.map(d => {
      const idx2 = ds.data.indexOf(d) > -1 ? null : null;
      return ds.originalData ? null : null;
    });
  });

  datasets.forEach(ds => {
    ds.data = sortedLabels.map(d => {
      const found = overview.slice(0, 6).find((_, i) => colors[i % colors.length] === ds.borderColor);
      if (!found || !found.forecast) return null;
      const match = found.forecast.find(f => f.date.substring(5) === d);
      return match ? match.predicted_demand : null;
    });
  });

  forecastTrendChart = new Chart(ctx, {
    type: 'line',
    data: { labels: sortedLabels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 12, color: tc, font: { size: 10 } } },
        tooltip: {
          ...tooltipOpts,
          callbacks: {
            title: function(items) {
              return 'Date: ' + items[0].label;
            },
            label: function(ctx) {
              return ' ' + ctx.dataset.label + ': ' + ctx.raw + ' units';
            },
            afterLabel: function() {
              return ' Forecast horizon: 7 days';
            },
          },
        },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: gc }, ticks: { color: tc }, title: { display: true, text: 'Demand (units)', color: tc } },
        x: { grid: { display: false }, ticks: { color: tc, maxTicksLimit: 10 } },
      },
    },
  });
}

function renderAlerts(alerts) {
  const el = document.getElementById('alerts-list');
  if (!alerts || alerts.length === 0) return;
  el.innerHTML = alerts.map(a => `
    <div class="alert-item" style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border)">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--danger-bg);display:flex;align-items:center;justify-content:center;color:var(--danger);flex-shrink:0">
        <i class="fas fa-exclamation" style="font-size:14px"></i>
      </div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:14px">${displayName(a.product_name)}</div>
        <div style="font-size:12px;color:var(--text-muted)">Inventory Level: ${a.inventory_level} units</div>
      </div>
      <span class="badge badge-danger">Low Stock</span>
    </div>
  `).join('');
}
