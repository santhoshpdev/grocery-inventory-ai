const API_BASE = '/api';

async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('Network error — is the server running?');
    }
    throw err;
  }
}

const API = {
  health: () => apiFetch('/health'),
  dashboard: () => apiFetch('/dashboard'),
  products: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/products${qs ? '?' + qs : ''}`);
  },
  product: (id) => apiFetch(`/products/${id}`),
  inventory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/inventory${qs ? '?' + qs : ''}`);
  },
  predict: (data) => apiFetch('/predict', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  predictions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/predictions${qs ? '?' + qs : ''}`);
  },
  analytics: () => apiFetch('/analytics'),
  metrics: () => apiFetch('/ml/metrics'),
  featureImportance: () => apiFetch('/ml/feature-importance'),
  forecastProducts: () => apiFetch('/forecast/products'),
  forecast: (data) => apiFetch('/forecast', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  forecastOverview: () => apiFetch('/forecast/overview'),
};
