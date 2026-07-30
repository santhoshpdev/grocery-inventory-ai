const API_BASE = '/api';
const API_TIMEOUT = 15000;
const API_RETRIES = 2;

async function apiFetch(endpoint, options = {}, retries = API_RETRIES) {
  const url = `${API_BASE}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  const config = {
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    ...options,
  };

  try {
    const res = await fetch(url, config);
    clearTimeout(timeoutId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      if (retries > 0) return apiFetch(endpoint, options, retries - 1);
      throw new Error('Request timed out — is the server running?');
    }
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      if (retries > 0) return apiFetch(endpoint, options, retries - 1);
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
