function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function safeChart(fn) {
  if (typeof Chart !== 'undefined') {
    try { fn(); } catch(e) { console.warn('Chart error:', e); }
  } else {
    const check = setInterval(() => {
      if (typeof Chart !== 'undefined') {
        clearInterval(check);
        try { fn(); } catch(e) { console.warn('Chart error:', e); }
      }
    }, 200);
    setTimeout(() => clearInterval(check), 10000);
  }
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function animateCounter(el, target, suffix = '', duration = 800) {
  if (!el) return;
  let current = 0;
  const steps = 30;
  const increment = target / steps;
  const interval = duration / steps;
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = Math.round(current) + suffix;
  }, interval);
}

function statusBadgeClass(status) {
  if (status === 'Low Stock') return 'danger';
  if (status === 'Overstock') return 'success';
  return 'warning';
}

function initTheme() {
  const themes = ['emerald', 'ocean', 'purple', 'rose', 'sunset'];
  const randomTheme = themes[Math.floor(Math.random() * themes.length)];
  const randomMode = Math.random() < 0.5 ? 'dark' : 'light';

  const html = document.documentElement;
  html.setAttribute('data-theme', randomTheme);

  if (randomMode === 'light') {
    html.setAttribute('data-mode', 'light');
  } else {
    html.removeAttribute('data-mode');
  }

  localStorage.setItem('opencode_theme', randomTheme);
  localStorage.setItem('opencode_mode', randomMode);

  updateThemeCheck(randomTheme);
  updateThemeModeLabel();
}

function setTheme(theme) {
  const html = document.documentElement;
  html.setAttribute('data-theme', theme);
  localStorage.setItem('opencode_theme', theme);
  updateThemeCheck(theme);
  updateThemeModeLabel();
  updateThemeIcon();
  closeThemeDropdown();

  document.querySelectorAll('.chat-toggle, .chat-avatar, .chat-send, .brand-icon, .brand-badge')
    .forEach(el => {
      if (el) el.style.transition = 'background 0.4s ease, background-color 0.4s ease';
    });

  setTimeout(refreshAllCharts, 50);
}

function toggleMode() {
  const html = document.documentElement;
  const hasLight = html.getAttribute('data-mode') === 'light' || html.getAttribute('data-theme') === 'light';
  if (hasLight) {
    html.removeAttribute('data-mode');
    html.removeAttribute('data-theme');
    html.setAttribute('data-theme', localStorage.getItem('opencode_theme') || 'emerald');
    localStorage.setItem('opencode_mode', 'dark');
  } else {
    html.setAttribute('data-mode', 'light');
    localStorage.setItem('opencode_mode', 'light');
  }
  updateThemeModeLabel();
  updateThemeIcon();
  closeThemeDropdown();
  setTimeout(refreshAllCharts, 50);
}

function updateThemeCheck(theme) {
  document.querySelectorAll('.theme-check').forEach(el => el.style.display = 'none');
  const check = document.getElementById('check-' + theme);
  if (check) check.style.display = 'block';
}

function updateThemeModeLabel() {
  const label = document.getElementById('theme-mode-label');
  if (!label) return;
  const html = document.documentElement;
  const isLight = html.getAttribute('data-mode') === 'light' || html.getAttribute('data-theme') === 'light';
  label.textContent = isLight ? 'Dark Mode' : 'Light Mode';
}

function toggleThemeDropdown() {
  const dd = document.getElementById('theme-dropdown');
  if (dd) dd.classList.toggle('open');
}

function closeThemeDropdown() {
  const dd = document.getElementById('theme-dropdown');
  if (dd) dd.classList.remove('open');
}

document.addEventListener('click', function(e) {
  const wrapper = document.querySelector('.theme-selector-wrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    closeThemeDropdown();
  }
});

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = '<i class="fas fa-palette"></i>';
}

function chartColors() {
  const style = getComputedStyle(document.documentElement);
  const chartStr = style.getPropertyValue('--chart-colors').trim();
  if (chartStr) return chartStr.split(',').map(c => c.trim());
  return ['#059669', '#10b981', '#34d399', '#6ee7b7', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6'];
}

function chartTooltip() {
  return {
    backgroundColor: 'rgba(7,11,20,0.9)',
    titleColor: '#f0f4f8',
    bodyColor: '#94a3b8',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, padding: 12, cornerRadius: 8,
  };
}

function chartGridColor() {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue('--border').trim() || 'rgba(255,255,255,0.04)';
}

function chartTickColor() {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue('--text-muted').trim() || '#64748b';
}

const _chartRenderers = [];

function registerChartRenderer(fn) {
  if (typeof fn === 'function' && !_chartRenderers.includes(fn)) {
    _chartRenderers.push(fn);
  }
}

function refreshAllCharts() {
  _chartRenderers.forEach(fn => {
    try { fn(); } catch (e) { console.warn('Chart re-render error:', e); }
  });
}

function exportCSV(records, filename = 'inventory-export.csv') {
  if (!records || records.length === 0) return;
  const headers = Object.keys(records[0]);
  const rows = records.map(r => headers.map(h => {
    const v = r[h];
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  }));
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
