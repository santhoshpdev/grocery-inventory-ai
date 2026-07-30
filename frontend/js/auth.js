const AUTH_TOKEN_KEY = 'stockintel_token';
const AUTH_USER_KEY = 'stockintel_user';

let currentUser = null;

function getStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getStoredUser() {
  try {
    const data = localStorage.getItem(AUTH_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function setAuth(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  currentUser = user;
}

function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  currentUser = null;
}

async function checkAuth() {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const user = await apiFetch('/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    currentUser = user;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    return true;
  } catch {
    clearAuth();
    return false;
  }
}

async function login(username, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setAuth(data.access_token, {
    id: data.user_id,
    username: data.username,
    role: data.role,
    is_active: data.is_active,
  });
  return data;
}

function logout() {
  clearAuth();
  window.location.hash = '';
  window.location.reload();
}

function getCurrentUser() {
  return currentUser || getStoredUser();
}

function hasRole(allowedRoles) {
  const user = getCurrentUser();
  return user && allowedRoles.includes(user.role);
}

function isAuthenticated() {
  return !!getStoredToken() && !!getCurrentUser();
}

function getAuthHeaders() {
  const token = getStoredToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

const ROLE_LABELS = {
  'SYSTEM_ADMIN': 'System Administrator',
  'INVENTORY_MANAGER': 'Inventory Manager',
  'INVENTORY_ANALYST': 'Inventory Analyst',
};
