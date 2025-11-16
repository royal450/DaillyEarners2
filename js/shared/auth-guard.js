// Authentication Guard - Protects pages that require login
import { auth } from './firebase-config.js';
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Enable persistence for authentication - keeps user logged in for 1 year
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Auth persistence error:', error);
});

// Store last auth check to prevent unnecessary redirects
const AUTH_CHECK_KEY = 'cashbyking_last_auth_check';
const AUTH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Pages that don't require authentication
const PUBLIC_PAGES = ['index.html', '/'];

// Check if current page requires authentication
function isProtectedPage() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  return !PUBLIC_PAGES.includes(currentPage);
}

// Initialize auth guard
export function initAuthGuard(onAuthenticated, onUnauthenticated) {
  return new Promise((resolve) => {
    // Check if we have a recent successful auth check
    const lastCheck = localStorage.getItem(AUTH_CHECK_KEY);
    const now = Date.now();

    if (lastCheck && (now - parseInt(lastCheck)) < AUTH_CACHE_DURATION) {
      // User was recently authenticated, show page immediately
      document.body.style.visibility = 'visible';
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in - update last check time
        localStorage.setItem(AUTH_CHECK_KEY, now.toString());

        if (onAuthenticated) {
          onAuthenticated(user);
        }
        resolve(user);
      } else {
        // User is signed out - clear auth check
        localStorage.removeItem(AUTH_CHECK_KEY);

        if (isProtectedPage()) {
          // Redirect to signup page
          window.location.href = 'index.html';
        }
        if (onUnauthenticated) {
          onUnauthenticated();
        }
        resolve(null);
      }
      unsubscribe();
    });
  });
}

// Get current authenticated user
export async function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// Redirect if already authenticated (for signup/login pages)
export async function redirectIfAuthenticated(redirectTo = 'dashboard.html') {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = redirectTo;
  }
}