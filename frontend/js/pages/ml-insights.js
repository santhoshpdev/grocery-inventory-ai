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
    safeChart(() => renderModelChart(metricsData.models));
    renderModelRankings(metricsData.models);
    safeChart(() => renderImportanceChart(importanceData.features));
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

function renderModelChart(models) {
  const ctx = document.getElementById('model-chart')?.getContext('2d');
  if (!ctx) return;
  if (modelChart) modelChart.destroy();
  const sorted = [...models].sort((a, b) => a.accuracy - b.accuracy);
  modelChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(m => m.name),
      datasets: [
        { label: 'Accuracy', data: sorted.map(m => m.accuracy), backgroundColor: sorted.map(m => m.name === 'CatBoost' ? '#059669' : '#334155'), borderRadius: 3 },
        { label: 'Precision', data: sorted.map(m => m.precision), backgroundColor: sorted.map(m => m.name === 'CatBoost' ? '#10b981' : '#475569'), borderRadius: 3 },
        { label: 'Recall', data: sorted.map(m => m.recall), backgroundColor: sorted.map(m => m.name === 'CatBoost' ? '#34d399' : '#64748b'), borderRadius: 3 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 16, color: '#94a3b8' } } },
      scales: {
        y: { beginAtZero: true, max: 1, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', callback: v => (v*100)+'%' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
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

function renderImportanceChart(features) {
  const ctx = document.getElementById('importance-chart')?.getContext('2d');
  if (!ctx || !features || features.length === 0) return;
  if (importanceChart) importanceChart.destroy();
  const top = features.slice(0, 12).reverse();
  importanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top.map(f => f.Feature),
      datasets: [{
        label: 'Importance',
        data: top.map(f => f.Importance),
        backgroundColor: top.map((_, i) => {
          const t = 0.3 + (i / top.length) * 0.7;
          return `rgba(5, 150, 105, ${t})`;
        }),
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
        y: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
      },
    },
  });
}
