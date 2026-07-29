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
