let forecastChart = null;
let selectedForecastProductId = null;

function renderForecasting(container) {
  const preloadedId = localStorage.getItem('forecast_product_id');
  if (preloadedId) {
    selectedForecastProductId = parseInt(preloadedId);
    localStorage.removeItem('forecast_product_id');
  }

  container.innerHTML = `
    <div class="card" style="border-color:rgba(59,130,246,0.2);background:linear-gradient(135deg,var(--bg-card),rgba(59,130,246,0.03))">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:4px">
        <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#6366f1);display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;flex-shrink:0;box-shadow:0 4px 15px rgba(59,130,246,0.3)">
          <i class="fas fa-chart-line"></i>
        </div>
        <div>
          <div class="card-title" style="font-size:20px;margin-bottom:2px">Demand Forecasting</div>
          <div class="card-subtitle" style="font-size:13px">Analyse historical demand patterns and estimate future inventory demand</div>
        </div>
      </div>
      <div id="forecast-demo-badge" style="margin-top:12px"></div>
    </div>

    <div class="card" id="forecast-controls-card">
      <div class="forecast-controls">
        <div class="forecast-control-group">
          <label class="forecast-label">Product</label>
          <select class="forecast-select" id="forecast-product">
            <option value="">Select a product...</option>
          </select>
        </div>
        <div class="forecast-control-group">
          <label class="forecast-label">Forecast Horizon</label>
          <select class="forecast-select" id="forecast-horizon">
            <option value="7">7 Days</option>
            <option value="14">14 Days</option>
            <option value="30">30 Days</option>
          </select>
        </div>
        <div class="forecast-control-group" style="align-self:flex-end">
          <button class="btn btn-primary" id="forecast-generate-btn" onclick="generateForecast()">
            <i class="fas fa-magic"></i> Generate Forecast
          </button>
        </div>
      </div>
    </div>

    <div id="forecast-results" style="display:none">
      <div class="forecast-summary-grid" id="forecast-summary-grid"></div>
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Demand Trend</div>
            <div class="card-subtitle">Historical demand and forecasted values</div>
          </div>
        </div>
        <div class="chart-container" style="height:380px"><canvas id="forecast-chart"></canvas></div>
      </div>
      <div id="forecast-insight-container"></div>
    </div>

    <div id="forecast-empty" style="${selectedForecastProductId ? 'display:none' : ''}">
      <div class="empty-state">
        <i class="fas fa-chart-bar" style="font-size:48px"></i>
        <h3>No Forecast Generated</h3>
        <p>Select a product and forecast horizon above to generate a demand forecast.</p>
      </div>
    </div>
  `;

  loadForecastProducts();
}

async function loadForecastProducts() {
  const select = document.getElementById('forecast-product');
  if (!select) return;
  try {
    const products = await API.forecastProducts();
    select.innerHTML = '<option value="">Select a product...</option>' +
      products.map(p => `<option value="${p.product_id}" ${selectedForecastProductId === p.product_id ? 'selected' : ''}>${displayName(p.product_name)}</option>`).join('');
    document.getElementById('forecast-demo-badge').innerHTML = `
      <div class="demo-badge">
        <i class="fas fa-flask"></i> SIMULATION MODE — Forecasts use synthetic historical demand data for demonstration purposes.
      </div>
    `;
    if (selectedForecastProductId) {
      generateForecast();
    }
  } catch (err) {
    select.innerHTML = '<option value="">Failed to load products</option>';
  }
}

async function generateForecast() {
  const productId = parseInt(document.getElementById('forecast-product').value);
  const horizon = parseInt(document.getElementById('forecast-horizon').value);
  if (!productId) { showToast('Please select a product', 'error'); return; }

  const btn = document.getElementById('forecast-generate-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

  try {
    const data = await API.forecast({ product_id: productId, horizon: horizon });

    document.getElementById('forecast-empty').style.display = 'none';
    document.getElementById('forecast-results').style.display = 'block';

    renderForecastSummary(data.summary, horizon);
    safeChart(() => renderForecastChart(data));
    renderForecastInsight(data);
  } catch (err) {
    showToast('Forecast failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-magic"></i> Generate Forecast';
  }
}

function renderForecastSummary(summary, horizon) {
  const grid = document.getElementById('forecast-summary-grid');
  const items = [
    { icon: 'fa-chart-simple', label: 'Average Forecast', value: `${summary.average_forecast} units/day`, color: '#3b82f6' },
    { icon: 'fa-arrow-up', label: 'Peak Forecast', value: `${summary.peak_forecast} units`, color: '#f59e0b' },
    { icon: 'fa-trend-up', label: 'Forecast Trend', value: summary.trend, color: summary.trend === 'Increasing' ? '#10b981' : summary.trend === 'Decreasing' ? '#ef4444' : '#94a3b8' },
    { icon: 'fa-calendar', label: 'Forecast Horizon', value: `Next ${horizon} Days`, color: '#6366f1' },
  ];
  grid.innerHTML = items.map(item => `
    <div class="kpi-card">
      <div class="kpi-icon" style="background:rgba(${hexToRgb(item.color)},0.1);color:${item.color}"><i class="fas ${item.icon}"></i></div>
      <div class="kpi-info">
        <div class="kpi-value" style="color:${item.color}">${item.value}</div>
        <div class="kpi-label">${item.label}</div>
      </div>
    </div>
  `).join('');
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function renderForecastChart(data) {
  const canvas = document.getElementById('forecast-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (forecastChart) forecastChart.destroy();

  const cols = chartColors();
  const tc = chartTickColor();
  const gc = chartGridColor();
  const tooltipOpts = chartTooltip();

  const historicalDates = data.historical.map(d => d.date);
  const historicalDemand = data.historical.map(d => d.demand);
  const forecastDates = data.forecast.map(d => d.date);
  const forecastValues = data.forecast.map(d => d.predicted_demand);

  const lastHistDate = historicalDates[historicalDates.length - 1];
  const allLabels = [...historicalDates, ...forecastDates];

  const histWithGap = [...historicalDemand, null, ...new Array(forecastDates.length).fill(null)];
  const forecastWithGap = [
    ...new Array(historicalDates.length - 1).fill(null),
    historicalDemand[historicalDemand.length - 1],
    null,
    ...forecastValues,
  ];

  forecastChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        {
          label: 'Historical Demand',
          data: histWithGap,
          borderColor: cols[0],
          backgroundColor: cols[0] + '18',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHitRadius: 10,
        },
        {
          label: 'Forecasted Demand',
          data: forecastWithGap,
          borderColor: cols[1],
          backgroundColor: cols[1] + '18',
          borderWidth: 2,
          borderDash: [6, 3],
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHitRadius: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { usePointStyle: true, padding: 16, color: tc },
        },
        tooltip: {
          ...tooltipOpts,
          callbacks: {
            label: function(ctx) {
              if (ctx.parsed.y === null) return null;
              return ctx.dataset.label + ': ' + ctx.parsed.y + ' units';
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gc },
          ticks: { color: tc },
          title: { display: true, text: 'Demand (units)', color: tc },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: tc,
            maxTicksLimit: 15,
            callback: function(val, idx) {
              const label = this.getLabelForValue(val);
              return label ? label.substring(5) : '';
            },
          },
        },
      },
    },
  });
}

function renderForecastInsight(data) {
  const container = document.getElementById('forecast-insight-container');
  if (!container) return;

  const trend = data.summary.trend;
  const status = data.current_stock_status || 'Unknown';
  const inventory = data.current_inventory_level !== undefined ? data.current_inventory_level : '--';
  const avg = data.summary.average_forecast;
  const recommendation = data.recommendation || 'Continue monitoring inventory levels.';

  let trendIcon = 'fa-minus';
  let trendColor = '#94a3b8';
  if (trend === 'Increasing') { trendIcon = 'fa-arrow-trend-up'; trendColor = '#10b981'; }
  else if (trend === 'Decreasing') { trendIcon = 'fa-arrow-trend-down'; trendColor = '#ef4444'; }

  container.innerHTML = `
    <div class="ai-insight-card" style="margin-top:0">
      <div class="ai-insight-icon" style="background:linear-gradient(135deg,#3b82f6,#6366f1)"><i class="fas fa-brain"></i></div>
      <div class="ai-insight-content">
        <div class="ai-insight-title"><i class="fas fa-lightbulb" style="color:#fbbf24;margin-right:6px"></i>AI Forecast Insight</div>
        <div class="forecast-insight-body">
          <div class="forecast-insight-row">
            <span>Demand is expected to <strong style="color:${trendColor}">${trend.toLowerCase()}</strong> <i class="fas ${trendIcon}" style="color:${trendColor}"></i></span>
            <span>over the next ${data.forecast_horizon} days.</span>
          </div>
          <div class="forecast-insight-row">
            <span>Current Stock Status: <strong class="badge badge-${statusBadgeClass(status)}">${status}</strong></span>
          </div>
          <div class="forecast-insight-row">
            <span>Current Inventory: <strong>${inventory} units</strong></span>
            <span>| Forecast Avg: <strong>${avg} units/day</strong></span>
          </div>
          <div class="forecast-insight-row" style="margin-top:8px;padding:12px;background:var(--bg-elevated);border-radius:var(--radius-xs);border:1px solid var(--border)">
            <i class="fas fa-circle-info" style="color:var(--primary);margin-right:8px"></i>
            <span>${recommendation}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
