// Signup Page Logic
import { auth } from '../shared/firebase-config.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { setData, getData, runDbTransaction } from '../shared/db.js';
import { generateReferralCode, showToast, showLoading, hideLoading } from '../shared/utils.js';
import { redirectIfAuthenticated } from '../shared/auth-guard.js';

// Check if user is already logged in
redirectIfAuthenticated('dashboard.html');

// Theme Toggle
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  const icon = themeToggle.querySelector('i');

  // Load saved theme
  const savedTheme = localStorage.getItem('cashbyking_theme') || 'light';
  body.setAttribute('data-theme', savedTheme);
  icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

  themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('cashbyking_theme', newTheme);
    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  });
}

// Initialize theme toggle on page load
document.addEventListener('DOMContentLoaded', initThemeToggle);

// Show page after theme is set
document.body.style.visibility = 'visible';

// Handle form submission
const signupForm = document.getElementById('signupForm');
const submitBtn = document.getElementById('submitBtn');

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const countryCode = document.getElementById('countryCode').value;
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const inviteCode = document.getElementById('inviteCode').value.trim();

  // Validation
  if (!name || !email || !phone || !password) {
    showToast('Please fill all required fields', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }

  const fullPhone = countryCode + phone;

  showLoading(submitBtn, 'Creating Account...');

  try {
    // Create Firebase Auth account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Generate referral code
    const referralCode = generateReferralCode();

    // Create user data
    const userData = {
      personalInfo: {
        name: name,
        email: email,
        phone: fullPhone,
        verified: false,
        joinedAt: Date.now(),
        referralCode: referralCode
      },
      financialInfo: {
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0
      },
      taskHistory: {
        pending: 0,
        completed: 0,
        rejected: 0
      },
      referrals: {
        count: 0,
        earnings: 0
      }
    };

    // Handle referral if invite code provided
    if (inviteCode) {
      const allUsers = await getData('USERS');
      if (allUsers) {
        const referrerId = Object.keys(allUsers).find(
          uid => allUsers[uid].personalInfo?.referralCode === inviteCode
        );

        if (referrerId) {
          userData.personalInfo.referrerId = referrerId;
          // Increment referrer's count
          await runDbTransaction(`USERS/${referrerId}/referrals/count`, (current) => (current || 0) + 1);
        }
      }
    }

    // Save user data to database
    await setData(`USERS/${user.uid}`, userData);

    showToast('Account created successfully!', 'success');

    // Redirect to dashboard
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);

  } catch (error) {
    console.error('Signup error:', error);
    handleAuthError(error);
  } finally {
    hideLoading(submitBtn);
  }
});

// Handle auth errors
function handleAuthError(error) {
  let message = 'An error occurred. Please try again.';

  switch (error.code) {
    case 'auth/email-already-in-use':
      message = 'This email is already registered. Please login instead.';
      break;
    case 'auth/invalid-email':
      message = 'Invalid email address.';
      break;
    case 'auth/weak-password':
      message = 'Password is too weak. Please use a stronger password.';
      break;
    case 'auth/network-request-failed':
      message = 'Network error. Please check your internet connection.';
      break;
  }

  showToast(message, 'error');
}