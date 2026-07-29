function renderPrediction(container) {
  const savedId = localStorage.getItem('predict_product_id') || '';
  localStorage.removeItem('predict_product_id');

  container.innerHTML = `
    <div class="card" style="border-color:rgba(99,102,241,0.2);background:linear-gradient(135deg,var(--bg-card),rgba(99,102,241,0.03))">
      <div style="display:flex;align-items:flex-start;gap:16px">
        <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--secondary),#818cf8);display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;flex-shrink:0;box-shadow:0 4px 15px rgba(99,102,241,0.3)">
          <i class="fas fa-brain"></i>
        </div>
        <div>
          <div class="card-title" style="font-size:20px;margin-bottom:4px">AI Stock Status Prediction</div>
          <div class="card-subtitle" style="font-size:13px">Enter 18 product and inventory features to predict stock status using the trained <strong>CatBoost</strong> model (99.17% accuracy)</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div style="margin-bottom:20px">
        <div class="card-title" style="font-size:18px"><i class="fas fa-sliders-h" style="margin-right:8px;color:var(--primary)"></i>Input Features</div>
        <div class="card-subtitle" style="font-size:12px">All 18 fields are required by the ML model</div>
      </div>
      <form id="predict-form" onsubmit="submitPrediction(event)">
        <div class="form-grid">
          <div class="form-group"><label>Product ID</label><input type="number" name="product_id" value="${savedId}" required /></div>
          <div class="form-group"><label>Product Name</label><input type="text" name="product_name" placeholder="e.g. Product_001" required /></div>
          <div class="form-group"><label>Store ID</label><select name="store_id" required>${Array.from({length:10},(_,i)=>`<option value="${i+1}">Store ${i+1}</option>`).join('')}</select></div>
          <div class="form-group"><label>Category</label><select name="category" required><option value="">Select...</option>${['Bakery','Beverages','Dairy','Frozen','Fruits','Grains','Household','Meat','Snacks','Vegetables'].map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
          <div class="form-group"><label>Supplier</label><select name="supplier" required><option value="">Select...</option>${Array.from({length:15},(_,i)=>`<option value="Supplier_${i+1}">Supplier_${i+1}</option>`).join('')}</select></div>
          <div class="form-group"><label>Season</label><select name="season" required><option value="">Select...</option>${['Rainy','Spring','Summer','Winter'].map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div>
          <div class="form-group"><label>Inventory Level</label><input type="number" name="inventory_level" min="30" max="600" placeholder="30-600" required /></div>
          <div class="form-group"><label>Units Sold</label><input type="number" name="units_sold" min="1" max="100" placeholder="1-100" required /></div>
          <div class="form-group"><label>Unit Price ($)</label><input type="number" step="0.01" name="unit_price" min="0" placeholder="0.00" required /></div>
          <div class="form-group"><label>Purchase Cost ($)</label><input type="number" step="0.01" name="purchase_cost" min="0" placeholder="0.00" required /></div>
          <div class="form-group"><label>Discount (%)</label><input type="number" name="discount" min="0" max="25" placeholder="0-25" required /></div>
          <div class="form-group"><label>Temperature</label><input type="number" step="0.1" name="temperature" placeholder="15.0-40.0" required /></div>
          <div class="form-group"><label>Holiday</label><select name="holiday" required><option value="0">No</option><option value="1">Yes</option></select></div>
          <div class="form-group"><label>Promotion</label><select name="promotion" required><option value="0">No</option><option value="1">Yes</option></select></div>
          <div class="form-group"><label>Lead Time (days)</label><input type="number" name="lead_time" min="1" max="10" placeholder="1-10" required /></div>
          <div class="form-group"><label>Shelf Life (days)</label><input type="number" name="shelf_life" min="3" max="365" placeholder="3-365" required /></div>
          <div class="form-group"><label>Reorder Level</label><input type="number" name="reorder_level" min="40" max="150" placeholder="40-150" required /></div>
          <div class="form-group"><label>Demand</label><input type="number" name="demand" min="1" max="112" placeholder="1-112" required /></div>
        </div>
        <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary" id="predict-btn" style="padding:13px 28px">
            <i class="fas fa-robot"></i> <span>Run Prediction</span>
          </button>
          <button type="button" class="btn btn-outline" onclick="fillSampleData()">
            <i class="fas fa-database"></i> Load Sample
          </button>
          <button type="reset" class="btn btn-outline" onclick="document.getElementById('prediction-result').innerHTML=''">
            <i class="fas fa-undo"></i> Clear
          </button>
        </div>
      </form>
    </div>
    <div id="prediction-result"></div>
  `;
}

async function submitPrediction(event) {
  event.preventDefault();
  const form = document.getElementById('predict-form');
  const btn = document.getElementById('predict-btn');
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());

  const nums = ['product_id','store_id','inventory_level','units_sold','discount','holiday','promotion','lead_time','shelf_life','reorder_level','demand'];
  const floats = ['unit_price','purchase_cost','temperature'];
  nums.forEach(k => data[k] = parseInt(data[k]));
  floats.forEach(k => data[k] = parseFloat(data[k]));

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Processing...';

  document.getElementById('prediction-result').innerHTML = `
    <div class="card" style="text-align:center;padding:40px">
      <div class="loader-ring" style="margin:0 auto 16px"></div>
      <p style="color:var(--text-muted)">Running prediction through CatBoost model...</p>
    </div>
  `;

  try {
    const result = await API.predict(data);
    displayResult(result);
    showToast('Prediction completed successfully', 'success');
  } catch (err) {
    document.getElementById('prediction-result').innerHTML = `
      <div class="card" style="border-color:rgba(239,68,68,0.3);text-align:center;padding:32px">
        <i class="fas fa-exclamation-circle" style="font-size:36px;color:var(--danger);margin-bottom:12px;display:block"></i>
        <h3 style="color:var(--text);margin-bottom:6px">Prediction Failed</h3>
        <p style="color:var(--text-muted);font-size:14px">${err.message}</p>
      </div>
    `;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-robot"></i> <span>Run Prediction</span>';
  }
}

function displayResult(result) {
  const colors = {
    'Low Stock': {from: '#dc2626', to: '#b91c1c'},
    'Normal': {from: '#d97706', to: '#b45309'},
    'Overstock': {from: '#059669', to: '#047857'},
  };
  const c = colors[result.predicted_status] || colors['Normal'];

  document.getElementById('prediction-result').innerHTML = `
    <div class="result-card" style="background:linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)">
      <div class="result-label">AI PREDICTION RESULT</div>
      <div class="result-status">
        <i class="fas ${result.predicted_status === 'Low Stock' ? 'fa-exclamation-triangle' : result.predicted_status === 'Normal' ? 'fa-check-circle' : 'fa-archive'}"></i>
        ${result.predicted_status}
      </div>
      <div class="result-confidence">${(result.confidence * 100).toFixed(1)}%</div>
      <div class="result-label">Model Confidence</div>
      <div class="result-probs">
        ${Object.entries(result.probabilities).map(([s, p]) => `
          <div class="prob-item">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;opacity:0.7">${s}</div>
            <div style="font-size:24px;font-weight:800;margin:4px 0">${(p * 100).toFixed(1)}%</div>
            <div class="prob-bar"><div class="prob-fill" style="width:${p * 100}%"></div></div>
          </div>
        `).join('')}
      </div>
      <div class="result-recommendation">
        <i class="fas fa-lightbulb" style="color:#fbbf24"></i>
        ${result.recommendation}
      </div>
      <div style="margin-top:16px;display:flex;justify-content:center;gap:24px;font-size:12px;opacity:0.6">
        <span><i class="fas fa-microchip"></i> Model: ${result.model_name}</span>
        <span><i class="fas fa-chart-bar"></i> 99.17% Accuracy</span>
      </div>
    </div>
  `;
}

function fillSampleData() {
  const samples = [
    { label: 'Product_001 (Overstock)', data: {product_id:1, product_name:'Product_001', category:'Meat', supplier:'Supplier_6', store_id:5, inventory_level:272, units_sold:16, unit_price:40.98, purchase_cost:25.39, discount:5, temperature:28.3, holiday:0, promotion:1, lead_time:1, shelf_life:47, reorder_level:78, season:'Winter', demand:24 }},
    { label: 'Product_041 (Low Stock)', data: {product_id:41, product_name:'Product_041', category:'Meat', supplier:'Supplier_9', store_id:4, inventory_level:49, units_sold:3, unit_price:18.55, purchase_cost:14.36, discount:20, temperature:37.6, holiday:0, promotion:1, lead_time:10, shelf_life:95, reorder_level:75, season:'Winter', demand:9 }},
    { label: 'Product_007 (Normal)', data: {product_id:7, product_name:'Product_007', category:'Household', supplier:'Supplier_2', store_id:8, inventory_level:278, units_sold:42, unit_price:34.04, purchase_cost:27.38, discount:25, temperature:34.0, holiday:1, promotion:1, lead_time:5, shelf_life:364, reorder_level:118, season:'Winter', demand:49 }},
  ];
  const sample = samples[0].data;
  const form = document.getElementById('predict-form');
  for (const [k, v] of Object.entries(sample)) {
    const el = form.elements[k];
    if (el) el.value = v;
  }
  showToast('Loaded sample: Product_001 (expected: Overstock)', 'info');
}
