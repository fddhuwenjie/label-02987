// 工具函数模块

let toastContainer = null;

export function initToast() {
  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  toastContainer.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;
  document.body.appendChild(toastContainer);
}

export function showToast(message, type = 'info') {
  if (!toastContainer) initToast();
  
  const toast = document.createElement('div');
  const colors = {
    success: 'rgba(76, 175, 80, 0.9)',
    error: 'rgba(244, 67, 54, 0.9)',
    warning: 'rgba(255, 152, 0, 0.9)',
    info: 'rgba(33, 150, 243, 0.9)'
  };
  
  toast.style.cssText = `
    padding: 12px 20px;
    background: ${colors[type] || colors.info};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
    max-width: 300px;
  `;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function updateStatus(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = text;
}

export function log(level, module, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${module}]`;
  
  if (level === 'error') {
    console.error(prefix, message, data || '');
  } else if (level === 'warn') {
    console.warn(prefix, message, data || '');
  } else {
    console.log(prefix, message, data || '');
  }
}

// 防抖函数
export function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
