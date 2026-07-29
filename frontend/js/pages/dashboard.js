let statusChart = null;
let categoryChart = null;

function renderDashboard(container) {
  container.innerHTML = `
    <div class="kpi-grid" id="kpi-grid"></div>
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
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Recent Predictions</div>
            <div class="card-subtitle">Latest AI status predictions</div>
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
    renderKPI(data);
    safeChart(() => createStatusChart(data.status_distribution));
    safeChart(() => createCategoryChart(data.category_distribution));
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

function renderKPI(data) {
  const total = data.low_stock_count + data.normal_stock_count + data.overstock_count;
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

function createStatusChart(distribution) {
  const canvas = document.getElementById('status-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: distribution.map(d => d.status),
      datasets: [{
        data: distribution.map(d => d.count),
        backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '72%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, color: '#94a3b8' } },
      },
    },
  });
}

function createCategoryChart(distribution) {
  const canvas = document.getElementById('category-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (categoryChart) categoryChart.destroy();
  const data = distribution.slice(0, 10);
  const colors = ['#059669','#10b981','#34d399','#6ee7b7','#a7f3d0','#0ea5e9','#3b82f6','#6366f1','#8b5cf6','#a78bfa'];
  categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.category),
      datasets: [{
        label: 'Records',
        data: data.map(d => d.count),
        backgroundColor: colors.slice(0, data.length),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
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

function renderAlerts(alerts) {
  const el = document.getElementById('alerts-list');
  if (!alerts || alerts.length === 0) return;
  el.innerHTML = alerts.map(a => `
    <div class="alert-item" style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border)">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--danger-bg);display:flex;align-items:center;justify-content:center;color:var(--danger);flex-shrink:0">
        <i class="fas fa-exclamation" style="font-size:14px"></i>
      </div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:14px">${a.product_name}</div>
        <div style="font-size:12px;color:var(--text-muted)">Inventory Level: ${a.inventory_level} units</div>
      </div>
      <span class="badge badge-danger">Low Stock</span>
    </div>
  `).join('');
}
