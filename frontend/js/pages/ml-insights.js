let modelChart = null, importanceChart = null;

function renderMLInsights(container) {
  container.innerHTML = `
    <div class="card" style="border-color:rgba(5,150,105,0.2);background:linear-gradient(135deg,var(--bg-card),rgba(5,150,105,0.03))">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:4px">
        <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--primary),#0d9488);display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;flex-shrink:0;box-shadow:0 4px 15px rgba(5,150,105,0.3)">
          <i class="fas fa-trophy"></i>
        </div>
        <div>
          <div class="card-title" style="font-size:20px;margin-bottom:2px">Machine Learning Model Insights</div>
          <div class="card-subtitle" style="font-size:13px">Performance comparison of 7 trained classifiers — <strong>CatBoost</strong> achieved 99.17% accuracy</div>
        </div>
      </div>
      <div id="best-model" style="margin-top:16px"></div>
      <div id="ml-description" style="margin-top:16px"></div>
    </div>
    <div class="card">
      <div class="card-header"><div><div class="card-title">Model Performance Comparison</div><div class="card-subtitle">Accuracy, Precision, Recall across all models</div></div></div>
      <div class="chart-container" style="height:380px"><canvas id="model-chart"></canvas></div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div><div class="card-title">Model Rankings</div><div class="card-subtitle">Sorted by accuracy (descending)</div></div></div>
        <div id="model-rankings"></div>
      </div>
      <div class="card">
        <div class="card-header"><div><div class="card-title">Feature Importance</div><div class="card-subtitle">Top features driving CatBoost predictions</div></div></div>
        <div class="chart-container" style="height:350px"><canvas id="importance-chart"></canvas></div>
      </div>
    </div>
  `;
  loadMLData();
}

async function loadMLData() {
  try {
    const [metricsData, importanceData] = await Promise.all([
      API.metrics(),
      API.featureImportance(),
    ]);
    renderBestModel(metricsData.models);
    renderMLDescription(metricsData.models, importanceData.features);
    safeChart(() => renderModelChart(metricsData.models));
    renderModelRankings(metricsData.models);
    safeChart(() => renderImportanceChart(importanceData.features));
    renderForecastMetrics();
  } catch (err) {
    showToast('Failed to load ML insights: ' + err.message, 'error');
  }
}

function renderBestModel(models) {
  const best = models.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
  document.getElementById('best-model').innerHTML = `
    <div class="ml-model-card best">
      <div class="ml-model-rank"><i class="fas fa-crown"></i></div>
      <div class="ml-model-info">
        <div class="ml-model-name">${best.name} <span style="font-size:11px;color:var(--success);font-weight:600;margin-left:8px">★ BEST PERFORMER</span></div>
        <div class="ml-model-metric">Accuracy: ${(best.accuracy*100).toFixed(2)}% • Precision: ${(best.precision*100).toFixed(2)}% • Recall: ${(best.recall*100).toFixed(2)}% • F1: ${(best.f1*100).toFixed(2)}% • ROC-AUC: ${best.roc_auc.toFixed(4)}</div>
      </div>
      <div class="ml-model-score">${(best.accuracy*100).toFixed(1)}%</div>
    </div>
  `;
}

function renderMLDescription(models, features) {
  const best = models.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
  const top3 = features?.slice(0, 3).map(f => f.Feature).join(', ') || '';
  document.getElementById('ml-description').innerHTML = `
    <div class="ai-insight-card" style="margin-bottom:0">
      <div class="ai-insight-icon" style="background:linear-gradient(135deg,var(--secondary),#818cf8)"><i class="fas fa-microchip"></i></div>
      <div class="ai-insight-content">
        <div class="ai-insight-title">How the Model Works</div>
        <div class="ai-insight-text">
          The <strong>${best.name}</strong> classifier was trained on 6,000 labeled inventory records with 18 features. It predicts stock status (Low Stock, Normal, Overstock) using gradient boosting with 200 trees. The top 3 most influential features are: <strong>${top3}</strong>. ${best.name} outperforms 6 other models with ${(best.accuracy*100).toFixed(1)}% accuracy and near-perfect ROC-AUC of ${best.roc_auc.toFixed(4)}.
        </div>
      </div>
    </div>
  `;
}

function renderModelChart(models) {
  const ctx = document.getElementById('model-chart')?.getContext('2d');
  if (!ctx) return;
  if (modelChart) modelChart.destroy();
  const sorted = [...models].sort((a, b) => a.accuracy - b.accuracy);
  const cols = chartColors();
  const tc = chartTickColor();
  const gc = chartGridColor();
  modelChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(m => m.name),
      datasets: [
        { label: 'Accuracy', data: sorted.map(m => m.accuracy), backgroundColor: sorted.map(m => m.name === 'CatBoost' ? cols[0] : '#334155'), borderRadius: 4, borderSkipped: false },
        { label: 'Precision', data: sorted.map(m => m.precision), backgroundColor: sorted.map(m => m.name === 'CatBoost' ? cols[1] : '#475569'), borderRadius: 4, borderSkipped: false },
        { label: 'Recall', data: sorted.map(m => m.recall), backgroundColor: sorted.map(m => m.name === 'CatBoost' ? cols[2] : '#64748b'), borderRadius: 4, borderSkipped: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, padding: 16, color: tc } },
        tooltip: { ...chartTooltip(), callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.raw*100).toFixed(1)}%` } },
      },
      scales: {
        y: { beginAtZero: true, max: 1, grid: { color: gc }, ticks: { color: tc, callback: v => (v*100)+'%' } },
        x: { grid: { display: false }, ticks: { color: tc } },
      },
    },
  });
}

function renderModelRankings(models) {
  const sorted = [...models].sort((a, b) => b.accuracy - a.accuracy);
  document.getElementById('model-rankings').innerHTML = sorted.map((m, i) => `
    <div class="ml-model-card" style="${i === 0 ? 'border-color:var(--primary);background:var(--sidebar-active)' : ''}">
      <div class="ml-model-rank" style="${i === 0 ? 'background:var(--primary);color:#fff' : ''}">${i + 1}</div>
      <div class="ml-model-info">
        <div class="ml-model-name">${m.name}</div>
        <div class="ml-model-metric">Prec: ${(m.precision*100).toFixed(1)}% • Rec: ${(m.recall*100).toFixed(1)}% • F1: ${(m.f1*100).toFixed(1)}% • ROC: ${m.roc_auc.toFixed(4)}</div>
      </div>
      <div class="ml-model-score">${(m.accuracy*100).toFixed(1)}%</div>
    </div>
  `).join('');
}

async function renderForecastMetrics() {
  const container = document.getElementById('model-rankings');
  if (!container) return;

  const forecastSection = document.createElement('div');
  forecastSection.id = 'forecast-metrics-section';
  forecastSection.style.marginTop = '32px';
  forecastSection.innerHTML = `
    <div class="card" style="border-color:rgba(59,130,246,0.2)">
      <div class="card-header">
        <div>
          <div class="card-title"><i class="fas fa-chart-line" style="color:#3b82f6;margin-right:6px"></i>Forecasting Model</div>
          <div class="card-subtitle">Time-series demand forecasting using synthetic historical data</div>
        </div>
      </div>
      <div class="ml-model-card" style="border-color:rgba(59,130,246,0.2)">
        <div class="ml-model-rank" style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;font-size:14px"><i class="fas fa-chart-simple"></i></div>
        <div class="ml-model-info">
          <div class="ml-model-name">Holt-Winters Exponential Smoothing <span style="font-size:11px;color:#3b82f6;font-weight:600;margin-left:8px">DEMAND FORECAST</span></div>
          <div class="ml-model-metric">
            Task: Future Demand Prediction &bull;
            Data: Synthetic Historical Demand &bull;
            Seasonality: Weekly (7-day pattern) &bull;
            Trend: Additive
          </div>
        </div>
      </div>
      <div style="padding:16px;background:var(--bg-elevated);border-radius:var(--radius-xs);margin-top:12px;border:1px solid var(--border)">
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div><span style="color:var(--text-muted);font-size:12px">Model Type</span><div style="font-weight:600;font-size:14px;margin-top:2px">Holt-Winters</div></div>
          <div><span style="color:var(--text-muted);font-size:12px">Training Data</span><div style="font-weight:600;font-size:14px;margin-top:2px">9,000 synthetic records</div></div>
          <div><span style="color:var(--text-muted);font-size:12px">Products</span><div style="font-weight:600;font-size:14px;margin-top:2px">200 products</div></div>
          <div><span style="color:var(--text-muted);font-size:12px">History per Product</span><div style="font-weight:600;font-size:14px;margin-top:2px">90 days</div></div>
          <div><span style="color:var(--text-muted);font-size:12px">Evaluation</span><div style="font-weight:600;font-size:14px;margin-top:2px">Chronological 80/20 split</div></div>
        </div>
      </div>
    </div>
  `;
  container.parentNode.insertBefore(forecastSection, container.nextSibling);
}

function renderImportanceChart(features) {
  const ctx = document.getElementById('importance-chart')?.getContext('2d');
  if (!ctx || !features || features.length === 0) return;
  if (importanceChart) importanceChart.destroy();
  const top = features.slice(0, 12).reverse();
  const cols = chartColors();
  const tc = chartTickColor();
  const gc = chartGridColor();
  importanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(f => f.Feature),
      datasets: [{
        label: 'Importance',
        data: top.map(f => f.Importance),
        backgroundColor: top.map((_, i) => {
          const t = 0.3 + (i / top.length) * 0.7;
          return cols[0] + Math.round(t * 255).toString(16).padStart(2, '0');
        }),
        borderRadius: 6, borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      animation: { duration: 800 },
      plugins: {
        legend: { display: false },
        tooltip: { ...chartTooltip(), callbacks: { label: ctx => `Importance: ${(ctx.raw*100).toFixed(1)}%` } },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: gc }, ticks: { color: tc } },
        y: { grid: { display: false }, ticks: { color: tc, font: { size: 11 } } },
      },
    },
  });
}
