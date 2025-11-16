
// Common Utility Functions

// Format currency (Indian Rupees)
export function formatCurrency(amount) {
  return `₹${parseFloat(amount || 0).toFixed(2)}`;
}

// Format date
export function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// Format date with time
export function formatDateTime(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Generate random referral code
export function generateReferralCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Check if user is verified
export function isUserVerified(userData) {
  return userData?.personalInfo?.verified === true;
}

// Get user badge
export function getUserBadge(userData) {
  if (isUserVerified(userData)) {
    return { text: 'Verified', color: 'green', icon: 'fa-check-circle' };
  }
  return { text: 'New', color: 'red', icon: 'fa-user' };
}

// Show loading state
export function showLoading(buttonElement, loadingText = 'Loading...') {
  buttonElement.disabled = true;
  buttonElement.dataset.originalHtml = buttonElement.innerHTML;
  buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
}

// Hide loading state
export function hideLoading(buttonElement) {
  buttonElement.disabled = false;
  if (buttonElement.dataset.originalHtml) {
    buttonElement.innerHTML = buttonElement.dataset.originalHtml;
  }
}

// Show toast notification
export function showToast(message, type = 'success') {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: type,
      title: message,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  } else {
    alert(message);
  }
}

// Show confirmation dialog
export async function showConfirm(title, text, confirmText = 'Yes', cancelText = 'No') {
  if (typeof Swal !== 'undefined') {
    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#64748b'
    });
    return result.isConfirmed;
  } else {
    return confirm(`${title}\n${text}`);
  }
}

// Validate email
export function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Validate phone
export function validatePhone(phone) {
  const regex = /^\d{10}$/;
  return regex.test(phone);
}

// Get query parameter from URL
export function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Redirect to page
export function redirectTo(page) {
  window.location.href = page;
}

// Copy to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Copied to clipboard!', 'success');
  }
}

// Global Theme Management - Database Synced
let themeUnsubscribe = null;

export function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('cashbyking_theme', theme);
}

export function loadTheme() {
  const savedTheme = localStorage.getItem('cashbyking_theme') || 'light';
  applyTheme(savedTheme);
  return savedTheme;
}

export async function initGlobalTheme(userId) {
  if (!userId) return;
  
  const { subscribe, getData, setData } = await import('./db.js');
  
  // Load theme from localStorage first (instant)
  const localTheme = loadTheme();
  
  // Then sync with database and listen for changes
  try {
    const userTheme = await getData(`USERS/${userId}/theme`);
    if (userTheme && userTheme !== localTheme) {
      applyTheme(userTheme);
    } else if (!userTheme) {
      // Save local theme to database
      await setData(`USERS/${userId}/theme`, localTheme);
    }
    
    // Subscribe to real-time theme changes
    if (themeUnsubscribe) {
      const { unsubscribe } = await import('./db.js');
      unsubscribe(themeUnsubscribe);
    }
    
    themeUnsubscribe = subscribe(`USERS/${userId}/theme`, (theme) => {
      if (theme) {
        applyTheme(theme);
        updateThemeUI(theme);
      }
    });
  } catch (error) {
    console.error('Theme sync error:', error);
  }
}

export async function toggleTheme(userId) {
  const currentTheme = document.body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  applyTheme(newTheme);
  updateThemeUI(newTheme);
  
  if (userId) {
    const { setData } = await import('./db.js');
    try {
      await setData(`USERS/${userId}/theme`, newTheme);
    } catch (error) {
      console.error('Theme save error:', error);
    }
  }
  
  return newTheme;
}

function updateThemeUI(theme) {
  const themeTexts = document.querySelectorAll('.theme-text');
  themeTexts.forEach(text => {
    text.textContent = theme === 'dark' ? 'Dark' : 'Light';
  });
}

// Calculate time difference in hours
export function getHoursDifference(timestamp1, timestamp2) {
  return Math.abs(timestamp2 - timestamp1) / (1000 * 60 * 60);
}

// Check if 24 hours have passed
export function has24HoursPassed(lastTimestamp) {
  if (!lastTimestamp) return true;
  const now = Date.now();
  const hoursPassed = getHoursDifference(lastTimestamp, now);
  return hoursPassed >= 24;
}

// Generate random number in range
export function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Sanitize HTML to prevent XSS
export function sanitizeHTML(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
