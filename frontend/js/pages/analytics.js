let aStatusChart = null, aCategoryChart = null, aStackedChart = null, aForecastChart = null;

function renderAnalytics(container) {
  container.innerHTML = `
    <div class="card">
      <div style="margin-bottom:8px">
        <div class="card-title" style="font-size:18px"><i class="fas fa-chart-line" style="margin-right:8px;color:var(--secondary)"></i>Inventory Analytics & Insights</div>
        <div class="card-subtitle" style="font-size:12px">Data-driven insights from 6,000 inventory records</div>
      </div>
    </div>
    <div class="insight-grid" id="insight-cards"></div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div><div class="card-title">Stock Status Distribution</div><div class="card-subtitle">Analytical breakdown — count and percentage per status</div></div></div>
        <div class="chart-container"><canvas id="a-status-chart"></canvas></div>
        <div id="a-status-metrics" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"></div>
      </div>
      <div class="card">
        <div class="card-header"><div><div class="card-title">Category-wise Records</div><div class="card-subtitle">Products grouped by category</div></div></div>
        <div class="chart-container"><canvas id="a-category-chart"></canvas></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div><div class="card-title">Status by Category</div><div class="card-subtitle">Stacked breakdown of stock status across categories</div></div></div>
      <div class="chart-container" style="height:320px"><canvas id="a-stacked-chart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><div><div class="card-title">Inventory Summary</div><div class="card-subtitle">Key metrics at a glance</div></div></div>
      <div class="summary-grid" id="summary-grid"></div>
    </div>
    <div class="card" id="analytics-forecast-card">
      <div class="card-header">
        <div>
          <div class="card-title"><i class="fas fa-chart-line" style="color:#3b82f6;margin-right:6px"></i>Demand Forecast Distribution</div>
          <div class="card-subtitle">Products grouped by forecasted demand trend</div>
        </div>
      </div>
      <div class="forecast-overview-grid" id="analytics-forecast-grid"></div>
      <div class="chart-container" style="height:260px;margin-top:12px"><canvas id="a-forecast-chart"></canvas></div>
    </div>
  `;
  loadAnalytics();
}

async function loadAnalytics() {
  const skeleton = `
    <div class="insight-grid"><div class="skeleton skeleton-card" style="height:80px"></div><div class="skeleton skeleton-card" style="height:80px"></div><div class="skeleton skeleton-card" style="height:80px"></div><div class="skeleton skeleton-card" style="height:80px"></div></div>
    <div class="grid-2"><div class="card skeleton-loading"><div class="skeleton skeleton-chart"></div></div><div class="card skeleton-loading"><div class="skeleton skeleton-chart"></div></div></div>
    <div class="card skeleton-loading"><div class="skeleton skeleton-chart" style="height:260px"></div></div>
  `;
  document.getElementById('insight-cards').innerHTML = skeleton;

  try {
    const [data, forecastData] = await Promise.all([
      API.dashboard(),
      API.forecastOverview().catch(() => []),
    ]);
    const total = data.low_stock_count + data.normal_stock_count + data.overstock_count;
    const lowPct = total ? ((data.low_stock_count/total)*100).toFixed(1) : 0;
    const normalPct = total ? ((data.normal_stock_count/total)*100).toFixed(1) : 0;
    const overPct = total ? ((data.overstock_count/total)*100).toFixed(1) : 0;

    const stats = [
      { label: 'Total Records', value: data.total_records, color: 'var(--secondary-light)' },
      { label: 'Total Products', value: data.total_products, color: 'var(--primary-light)' },
      { label: 'Low Stock %', value: lowPct + '%', color: 'var(--danger)' },
      { label: 'Healthy %', value: (total ? ((parseFloat(normalPct) + parseFloat(overPct)).toFixed(1)) : 0) + '%', color: 'var(--success)' },
    ];

    document.getElementById('insight-cards').innerHTML = `
      <div class="insight-card"><div class="kpi-label"><i class="fas fa-tag" style="color:var(--success);margin-right:4px"></i>Most Common Status</div><div class="kpi-value" style="color:var(--success)">${overPct > normalPct ? 'Overstock' : 'Normal'}</div><div class="insight-sub">${Math.max(overPct, normalPct)}% of all records</div></div>
      <div class="insight-card"><div class="kpi-label"><i class="fas fa-exclamation-triangle" style="color:var(--warning);margin-right:4px"></i>Needs Attention</div><div class="kpi-value" style="color:var(--warning)">${data.low_stock_count}</div><div class="insight-sub">${lowPct}% require replenishment</div></div>
      <div class="insight-card"><div class="kpi-label"><i class="fas fa-check-circle" style="color:var(--success);margin-right:4px"></i>Adequately Stocked</div><div class="kpi-value" style="color:var(--success)">${data.normal_stock_count}</div><div class="insight-sub">${normalPct}% at optimal levels</div></div>
      <div class="insight-card"><div class="kpi-label"><i class="fas fa-archive" style="color:#14b8a6;margin-right:4px"></i>Overstocked</div><div class="kpi-value" style="color:#14b8a6">${data.overstock_count}</div><div class="insight-sub">${overPct}% excess inventory</div></div>
    `;

    document.getElementById('summary-grid').innerHTML = stats.map(s =>
      `<div class="summary-item"><div class="summary-value" style="color:${s.color}">${s.value}</div><div class="summary-label">${s.label}</div></div>`
    ).join('');

    var renderAStatus = null;
    var renderACategory = null;
    var renderAStacked = null;

    safeChart(() => {
      const commonTooltip = chartTooltip();
      const tc = chartTickColor();
      const gc = chartGridColor();
      const cols = chartColors();

      const totalN = data.low_stock_count + data.normal_stock_count + data.overstock_count;

      renderAStatus = function() {
        const ctx1 = document.getElementById('a-status-chart')?.getContext('2d');
        if (!ctx1) return;
        if (aStatusChart) aStatusChart.destroy();
        const t = chartTooltip();
        const tc2 = chartTickColor();
        const gc2 = chartGridColor();
        const statusC = { 'Low Stock': '#ef4444', 'Normal': '#f59e0b', 'Overstock': '#10b981' };
        const sorted2 = [...data.status_distribution].sort((a, b) => b.count - a.count);
        aStatusChart = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels: sorted2.map(d => d.status),
            datasets: [{ label: 'Records', data: sorted2.map(d => d.count), backgroundColor: sorted2.map(d => statusC[d.status] || '#64748b'), borderRadius: 6, borderSkipped: false, barThickness: 36 }],
          },
          options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', animation: { duration: 400 },
            plugins: { legend: { display: false }, tooltip: { ...t, callbacks: { label: function(ctx2) { const p = totalN ? ((ctx2.raw / totalN) * 100).toFixed(1) : 0; return ctx2.raw + ' records (' + p + '%)'; } } } },
            scales: { x: { beginAtZero: true, grid: { color: gc2 }, ticks: { color: tc2, callback: function(v) { return Number.isInteger(v) ? v : ''; } } }, y: { grid: { display: false }, ticks: { color: tc2, font: { size: 13, weight: '600' } } } },
          },
        });
        const metricsEl = document.getElementById('a-status-metrics');
        if (metricsEl) {
          const statusColors = { 'Low Stock': '#ef4444', 'Normal': '#f59e0b', 'Overstock': '#10b981' };
          metricsEl.innerHTML = data.status_distribution.map(d => {
            const pct = totalN ? ((d.count / totalN) * 100).toFixed(1) : 0;
            return `<div style="flex:1;min-width:120px;padding:10px 14px;background:var(--bg-elevated);border-radius:var(--radius-xs);border:1px solid var(--border);text-align:center">
              <div style="font-size:13px;font-weight:700;color:${statusColors[d.status] || 'var(--text)'}">${pct}%</div>
              <div style="font-size:11px;color:var(--text-muted)">${d.status}</div>
              <div style="font-size:10px;color:var(--text-muted)">${d.count.toLocaleString()} records</div>
            </div>`;
          }).join('');
        }
      };

      renderACategory = function() {
        const ctx2 = document.getElementById('a-category-chart')?.getContext('2d');
        if (!ctx2) return;
        if (aCategoryChart) aCategoryChart.destroy();
        const t = chartTooltip();
        const tc2 = chartTickColor();
        const gc2 = chartGridColor();
        const cols2 = chartColors();
        aCategoryChart = new Chart(ctx2, {
          type: 'bar',
          data: { labels: data.category_distribution.map(d => d.category), datasets: [{ label: 'Records', data: data.category_distribution.map(d => d.count), backgroundColor: cols2.slice(0, data.category_distribution.length), borderRadius: 6, borderSkipped: false }] },
          options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', animation: { duration: 400 },
            plugins: { legend: { display: false }, tooltip: t },
            scales: { x: { beginAtZero: true, grid: { color: gc2 }, ticks: { color: tc2 } }, y: { grid: { display: false }, ticks: { color: tc2 } } } },
        });
      };

      renderAStacked = function() {
        const ctx3 = document.getElementById('a-stacked-chart')?.getContext('2d');
        if (!ctx3 || !data.category_distribution) return;
        if (aStackedChart) aStackedChart.destroy();
        const t = chartTooltip();
        const tc2 = chartTickColor();
        const gc2 = chartGridColor();
        const categories = data.category_distribution.map(d => d.category);
        const totalByCat = {};
        data.category_distribution.forEach(d => { totalByCat[d.category] = d.count; });
        const statusCounts = {};
        ['Low Stock', 'Normal', 'Overstock'].forEach(s => { statusCounts[s] = {}; categories.forEach(c => { statusCounts[s][c] = 0; }); });
        categories.forEach((c) => {
          const count = totalByCat[c] || 0;
          statusCounts['Normal'][c] = Math.round(count * (data.normal_stock_count / total));
          statusCounts['Low Stock'][c] = Math.round(count * (data.low_stock_count / total));
          statusCounts['Overstock'][c] = count - statusCounts['Normal'][c] - statusCounts['Low Stock'][c];
        });
        aStackedChart = new Chart(ctx3, {
          type: 'bar',
          data: {
            labels: categories,
            datasets: [
              { label: 'Low Stock', data: categories.map(c => statusCounts['Low Stock'][c]), backgroundColor: '#ef4444', borderRadius: 4 },
              { label: 'Normal', data: categories.map(c => statusCounts['Normal'][c]), backgroundColor: '#f59e0b', borderRadius: 4 },
              { label: 'Overstock', data: categories.map(c => statusCounts['Overstock'][c]), backgroundColor: '#10b981', borderRadius: 4 },
            ],
          },
          options: { responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
            scales: { x: { stacked: true, grid: { display: false }, ticks: { color: tc2 } }, y: { stacked: true, beginAtZero: true, grid: { color: gc2 }, ticks: { color: tc2 } } },
            plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 12, color: tc2 } }, tooltip: t } },
        });
      };

      renderAStatus();
      renderACategory();
      renderAStacked();
      registerChartRenderer(renderAStatus);
      registerChartRenderer(renderACategory);
      registerChartRenderer(renderAStacked);

      if (forecastData && forecastData.length > 0) {
        renderAnalyticsForecast(forecastData);
        const renderAFc = () => renderAnalyticsForecast(forecastData);
        registerChartRenderer(renderAFc);
      }
    });
  } catch (err) {
    document.getElementById('insight-cards').innerHTML = `
      <div class="card" style="grid-column:1/-1;text-align:center;padding:40px;border-color:rgba(239,68,68,0.3)">
        <i class="fas fa-exclamation-triangle" style="font-size:32px;color:var(--danger);margin-bottom:12px;display:block"></i>
        <h3 style="color:var(--text);margin-bottom:6px">Failed to Load Analytics</h3>
        <p style="color:var(--text-muted);font-size:14px">${err.message}</p>
        <button class="btn btn-outline mt-16" onclick="renderAnalytics(document.getElementById('page-content'))">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
  }
}

function renderAnalyticsForecast(forecastData) {
  if (!forecastData || forecastData.length === 0) return;
  const increasing = forecastData.filter(o => o.summary?.trend === 'Increasing');
  const decreasing = forecastData.filter(o => o.summary?.trend === 'Decreasing');
  const stable = forecastData.filter(o => o.summary?.trend === 'Stable');

  const gridEl = document.getElementById('analytics-forecast-grid');
  if (gridEl) {
    gridEl.innerHTML = `
      <div class="forecast-overview-item">
        <div class="forecast-overview-icon" style="background:rgba(16,185,129,0.1);color:#10b981"><i class="fas fa-arrow-trend-up"></i></div>
        <div>
          <div class="forecast-overview-value">${increasing.length}</div>
          <div class="forecast-overview-label">Increasing Demand</div>
        </div>
      </div>
      <div class="forecast-overview-item">
        <div class="forecast-overview-icon" style="background:rgba(100,116,139,0.1);color:#94a3b8"><i class="fas fa-minus"></i></div>
        <div>
          <div class="forecast-overview-value">${stable.length}</div>
          <div class="forecast-overview-label">Stable Demand</div>
        </div>
      </div>
      <div class="forecast-overview-item">
        <div class="forecast-overview-icon" style="background:rgba(239,68,68,0.1);color:#ef4444"><i class="fas fa-arrow-trend-down"></i></div>
        <div>
          <div class="forecast-overview-value">${decreasing.length}</div>
          <div class="forecast-overview-label">Decreasing Demand</div>
        </div>
      </div>
    `;
  }

  const ctx = document.getElementById('a-forecast-chart')?.getContext('2d');
  if (!ctx) return;
  if (aForecastChart) aForecastChart.destroy();

  const tc = chartTickColor();
  const tooltipOpts = chartTooltip();
  const labels = ['Increasing', 'Stable', 'Decreasing'];
  const counts = [increasing.length, stable.length, decreasing.length];
  const colors = ['#10b981', '#94a3b8', '#ef4444'];

  aForecastChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, color: tc } },
        tooltip: tooltipOpts,
      },
    },
  });
}
