let invPage = 1;

function renderInventory(container) {
  container.innerHTML = `
    <div class="card">
      <div style="margin-bottom:20px">
        <div class="card-title" style="font-size:18px"><i class="fas fa-boxes" style="margin-right:8px;color:var(--primary)"></i>Inventory Records</div>
        <div class="card-subtitle" style="font-size:12px">Browse, search, and filter all product inventory records</div>
      </div>
      <div class="search-bar">
        <input type="text" class="search-input" id="inv-search" placeholder="Search by product name..." />
        <select class="filter-select" id="inv-category">
          <option value="">All Categories</option>
          ${['Bakery','Beverages','Dairy','Frozen','Fruits','Grains','Household','Meat','Snacks','Vegetables'].map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <select class="filter-select" id="inv-status">
          <option value="">All Status</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Normal">Normal</option>
          <option value="Overstock">Overstock</option>
        </select>
      </div>
      <div id="inv-table"><div class="loading-screen" style="min-height:200px"><div class="loader-ring"></div></div></div>
      <div class="pagination" id="inv-pagination" style="display:none">
        <span id="inv-info"></span>
        <div class="pagination-btns" id="inv-btns"></div>
      </div>
    </div>
    <div class="modal-overlay" id="detail-modal">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title" id="modal-title">Product Details</div>
          <button class="modal-close" onclick="document.getElementById('detail-modal').classList.remove('open')">&times;</button>
        </div>
        <div class="modal-body" id="modal-body"><div class="loading-screen" style="min-height:200px"><div class="loader-ring"></div></div></div>
      </div>
    </div>
  `;

  document.getElementById('inv-search').addEventListener('input', debounce(() => { invPage = 1; loadInventory(); }, 300));
  document.getElementById('inv-category').addEventListener('change', () => { invPage = 1; loadInventory(); });
  document.getElementById('inv-status').addEventListener('change', () => { invPage = 1; loadInventory(); });
  loadInventory();
}

async function loadInventory() {
  const search = document.getElementById('inv-search').value;
  const category = document.getElementById('inv-category').value;
  const status = document.getElementById('inv-status').value;
  const params = { page: invPage, per_page: 15 };
  if (search) params.search = search;
  if (category) params.category = category;
  if (status) params.status = status;

  try {
    const data = await API.inventory(params);
    renderInvTable(data);
  } catch (err) {
    document.getElementById('inv-table').innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Failed to load</h3>
        <p>${err.message}</p>
        <button class="btn btn-outline mt-16" onclick="loadInventory()"><i class="fas fa-redo"></i> Retry</button>
      </div>
    `;
  }
}

function renderInvTable(records) {
  const el = document.getElementById('inv-table');
  const pagination = document.getElementById('inv-pagination');

  if (!records || records.length === 0) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><h3>No records found</h3><p>Try adjusting filters</p></div>`;
    pagination.style.display = 'none';
    return;
  }

  pagination.style.display = 'flex';
  document.getElementById('inv-info').textContent = `Showing ${records.length} records`;

  el.innerHTML = `
    <div class="table-container">
      <table>
        <thead><tr><th>Product</th><th>Category</th><th>Inventory</th><th>Sold</th><th>Price</th><th>Reorder</th><th>Demand</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td style="font-weight:600">${r.product?.product_name || 'Unknown'}</td>
              <td style="color:var(--text-muted)">${r.product?.category || '-'}</td>
              <td style="font-weight:600">${r.inventory_level}</td>
              <td>${r.units_sold}</td>
              <td>$${r.unit_price?.toFixed(2)}</td>
              <td>${r.reorder_level}</td>
              <td>${r.demand}</td>
              <td><span class="badge badge-${statusBadgeClass(r.stock_status)}">${r.stock_status}</span></td>
              <td><button class="btn btn-outline" style="padding:5px 12px;font-size:12px" onclick="showDetail(${r.product_id})"><i class="fas fa-eye"></i></button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      ${invPage > 1 ? `<button class="btn btn-outline" style="padding:6px 14px;font-size:12px" onclick="invPage--;loadInventory()"><i class="fas fa-chevron-left"></i> Previous</button>` : ''}
      <button class="btn btn-outline" style="padding:6px 14px;font-size:12px" onclick="invPage++;loadInventory()">Next <i class="fas fa-chevron-right"></i></button>
    </div>
  `;
}

async function showDetail(productId) {
  const modal = document.getElementById('detail-modal');
  const body = document.getElementById('modal-body');
  const title = document.getElementById('modal-title');
  modal.classList.add('open');
  body.innerHTML = '<div class="loading-screen" style="min-height:200px"><div class="loader-ring"></div></div>';

  try {
    const data = await API.product(productId);
    title.textContent = data.product_name + ' — Details';
    const r = data.inventory_records?.[0];

    if (!r) {
      body.innerHTML = `<div class="empty-state"><p>No inventory records found</p></div>`;
      return;
    }

    const fields = [
      ['Product ID', data.product_id], ['Category', data.category], ['Supplier', data.supplier],
      ['Season', data.season], ['Store ID', r.store_id], ['Inventory Level', r.inventory_level],
      ['Units Sold', r.units_sold], ['Unit Price', `$${r.unit_price?.toFixed(2)}`],
      ['Purchase Cost', `$${r.purchase_cost?.toFixed(2)}`], ['Discount', `${r.discount}%`],
      ['Temperature', `${r.temperature}°C`], ['Holiday', r.holiday ? 'Yes' : 'No'],
      ['Promotion', r.promotion ? 'Yes' : 'No'], ['Lead Time', `${r.lead_time} days`],
      ['Shelf Life', `${r.shelf_life} days`], ['Reorder Level', r.reorder_level],
      ['Demand', r.demand], ['Stock Status', `<span class="badge badge-${statusBadgeClass(r.stock_status)}">${r.stock_status}</span>`],
    ];

    body.innerHTML = `
      <div class="detail-grid">
        ${fields.map(([label, value]) => `
          <div class="detail-item"><label>${label}</label><span>${value}</span></div>
        `).join('')}
      </div>
      <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="navigateToPrediction(${data.product_id})">
          <i class="fas fa-brain"></i> Run AI Prediction
        </button>
        <button class="btn btn-outline" onclick="document.getElementById('detail-modal').classList.remove('open')">
          <i class="fas fa-times"></i> Close
        </button>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">Error: ${err.message}</p></div>`;
  }
}

function navigateToPrediction(id) {
  document.getElementById('detail-modal')?.classList.remove('open');
  localStorage.setItem('predict_product_id', id);
  navigateTo('prediction');
}
