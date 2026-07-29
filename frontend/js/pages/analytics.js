let aStatusChart = null, aCategoryChart = null;

function renderAnalytics(container) {
  container.innerHTML = `
    <div class="card">
      <div style="margin-bottom:8px">
        <div class="card-title" style="font-size:18px"><i class="fas fa-chart-line" style="margin-right:8px;color:var(--secondary)"></i>Inventory Analytics & Insights</div>
        <div class="card-subtitle" style="font-size:12px">Data-driven insights from ${6000} inventory records</div>
      </div>
    </div>
    <div class="insight-grid" id="insight-cards"></div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div><div class="card-title">Stock Status Distribution</div><div class="card-subtitle">Current inventory health</div></div></div>
        <div class="chart-container"><canvas id="a-status-chart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><div><div class="card-title">Category-wise Records</div><div class="card-subtitle">Products grouped by category</div></div></div>
        <div class="chart-container"><canvas id="a-category-chart"></canvas></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div><div class="card-title">Inventory Summary</div><div class="card-subtitle">Key metrics at a glance</div></div></div>
      <div class="summary-grid" id="summary-grid"></div>
    </div>
  `;
  loadAnalytics();
}

async function loadAnalytics() {
  try {
    const data = await API.dashboard();
    const total = data.low_stock_count + data.normal_stock_count + data.overstock_count;
    const stats = [
      { label: 'Total Records', value: data.total_records, color: 'var(--secondary-light)' },
      { label: 'Total Products', value: data.total_products, color: 'var(--primary-light)' },
      { label: 'Low Stock %', value: total ? ((data.low_stock_count/total)*100).toFixed(1) + '%' : '0%', color: 'var(--danger)' },
      { label: 'Healthy %', value: total ? (((data.normal_stock_count+data.overstock_count)/total)*100).toFixed(1) + '%' : '0%', color: 'var(--success)' },
    ];

    document.getElementById('insight-cards').innerHTML = `
      <div class="insight-card"><div class="kpi-label"><i class="fas fa-tag" style="color:var(--success);margin-right:4px"></i>Most Common Status</div><div class="kpi-value" style="color:var(--success)">Overstock</div><div class="insight-sub">${total ? ((data.overstock_count/total)*100).toFixed(1) : 0}% of all records</div></div>
      <div class="insight-card"><div class="kpi-label"><i class="fas fa-exclamation-triangle" style="color:var(--warning);margin-right:4px"></i>Needs Attention</div><div class="kpi-value" style="color:var(--warning)">${data.low_stock_count}</div><div class="insight-sub">${total ? ((data.low_stock_count/total)*100).toFixed(1) : 0}% require replenishment</div></div>
      <div class="insight-card"><div class="kpi-label"><i class="fas fa-check-circle" style="color:var(--success);margin-right:4px"></i>Adequately Stocked</div><div class="kpi-value" style="color:var(--success)">${data.normal_stock_count}</div><div class="insight-sub">${total ? ((data.normal_stock_count/total)*100).toFixed(1) : 0}% at optimal levels</div></div>
      <div class="insight-card"><div class="kpi-label"><i class="fas fa-archive" style="color:#14b8a6;margin-right:4px"></i>Overstocked</div><div class="kpi-value" style="color:#14b8a6">${data.overstock_count}</div><div class="insight-sub">${total ? ((data.overstock_count/total)*100).toFixed(1) : 0}% excess inventory</div></div>
    `;

    document.getElementById('summary-grid').innerHTML = stats.map(s =>
      `<div class="summary-item"><div class="summary-value" style="color:${s.color}">${s.value}</div><div class="summary-label">${s.label}</div></div>`
    ).join('');

    safeChart(() => {
      const ctx1 = document.getElementById('a-status-chart')?.getContext('2d');
      if (!ctx1) return;
      if (aStatusChart) aStatusChart.destroy();
      aStatusChart = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: data.status_distribution.map(d => d.status),
          datasets: [{ data: data.status_distribution.map(d => d.count), backgroundColor: ['#ef4444','#f59e0b','#10b981'], borderWidth: 0 }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%',
          plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, color: '#94a3b8' } } } },
      });

      const ctx2 = document.getElementById('a-category-chart')?.getContext('2d');
      if (!ctx2) return;
      if (aCategoryChart) aCategoryChart.destroy();
      const catColors = ['#059669','#10b981','#34d399','#6ee7b7','#a7f3d0','#0ea5e9','#3b82f6','#6366f1','#8b5cf6','#a78bfa'];
      aCategoryChart = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: data.category_distribution.map(d => d.category),
          datasets: [{ label: 'Records', data: data.category_distribution.map(d => d.count), backgroundColor: catColors.slice(0, data.category_distribution.length), borderRadius: 4 }],
        },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b' } }, y: { grid: { display: false }, ticks: { color: '#94a3b8' } } } },
      });
    });
  } catch (err) {
    showToast('Failed to load analytics: ' + err.message, 'error');
  }
}
