// Wallet Page Logic
import { auth } from '../shared/firebase-config.js';
import { getData, subscribe, unsubscribe, pushData, updateBalance, getServerTimestamp } from '../shared/db.js';
import { formatCurrency, formatDateTime, showToast, showConfirm, showLoading, hideLoading } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';
import { notifyWithdrawalRequest } from '../shared/notifications.js';

let currentUser = null;
let subscriptions = [];

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  currentUser = await initAuthGuard(onUserAuthenticated);
  await initThemeToggle(); // Initialize theme toggle
});

async function onUserAuthenticated(user) {
  currentUser = user;
  document.body.style.visibility = 'visible';

  await loadUserInfo();
  loadWalletData();
  setupWithdrawalForm();
  setupPaymentMethodToggle();
}

// Load user information
async function loadUserInfo() {
  const userData = await getData(`USERS/${currentUser.uid}`);
  if (!userData) return;

  const upiEl = document.getElementById('upi');
  const phoneEl = document.getElementById('phone');
  const emailEl = document.getElementById('email');

  if (upiEl) upiEl.textContent = userData.personalInfo?.upiId || 'Not set';
  if (phoneEl) phoneEl.textContent = userData.personalInfo?.phone || 'Not set';
  if (emailEl) emailEl.textContent = userData.personalInfo?.email || 'Not set';
}

// Setup payment method toggle
function setupPaymentMethodToggle() {
  const paymentMethod = document.getElementById('paymentMethod');
  const upiFields = document.getElementById('upiFields');
  const bankFields = document.getElementById('bankFields');

  if (paymentMethod) {
    paymentMethod.addEventListener('change', (e) => {
      if (e.target.value === 'upi') {
        upiFields.style.display = 'block';
        bankFields.style.display = 'none';
      } else {
        upiFields.style.display = 'none';
        bankFields.style.display = 'block';
      }
    });
  }
}

// Theme Toggle Initialization
async function initThemeToggle() {
      const { initGlobalTheme, toggleTheme } = await import('../shared/utils.js');
      await initGlobalTheme(currentUser.uid);

      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', async () => {
          await toggleTheme(currentUser.uid);
        });
      }
    }

// Load wallet data with real-time updates
function loadWalletData() {
  // Subscribe to balance
  const balanceRef = subscribe(`USERS/${currentUser.uid}/financialInfo`, (data) => {
    if (!data) return;

    const balanceEl = document.getElementById('balance');
    const availableBalanceEl = document.getElementById('availableBalance');
    const pendingAmountEl = document.getElementById('pendingAmount');

    if (balanceEl) {
      balanceEl.textContent = (data.balance || 0).toFixed(2);
    }

    if (availableBalanceEl) {
      availableBalanceEl.textContent = (data.balance || 0).toFixed(2);
    }

    if (pendingAmountEl) {
      pendingAmountEl.textContent = '0.00';
    }
  });

  subscriptions.push(balanceRef);

  // Load withdrawal history
  loadWithdrawalHistory();
}

// Load withdrawal history
async function loadWithdrawalHistory() {
  const allWithdrawals = await getData('WITHDRAWALS');
  if (!allWithdrawals) {
    showNoWithdrawals();
    return;
  }

  const userWithdrawals = Object.entries(allWithdrawals)
    .filter(([_, withdrawal]) => withdrawal.userId === currentUser.uid)
    .map(([id, withdrawal]) => ({ id, ...withdrawal }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (userWithdrawals.length === 0) {
    showNoWithdrawals();
    return;
  }

  displayWithdrawals(userWithdrawals);
}

// Display withdrawals
function displayWithdrawals(withdrawals) {
  const container = document.getElementById('withdrawalHistory');
  if (!container) return;

  container.innerHTML = withdrawals.map(w => `
    <div style="padding: 16px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-size: 16px; font-weight: 700; color: var(--text-color);">${formatCurrency(w.amount)}</div>
        <div style="padding: 4px 12px; border-radius: 12px; background: ${getStatusColor(w.status)}; color: white; font-size: 11px; font-weight: 600;">
          ${w.status.toUpperCase()}
        </div>
      </div>
      <div style="font-size: 12px; color: var(--text-color); opacity: 0.7;">
        <div>${w.method} - ${formatDateTime(w.timestamp)}</div>
        ${w.adminReason ? `<div style="margin-top: 4px; color: var(--accent-color);">Reason: ${w.adminReason}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// Show no withdrawals message
function showNoWithdrawals() {
  const container = document.getElementById('withdrawalHistory');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--text-color); opacity: 0.5;">
      <i class="fas fa-receipt" style="font-size: 48px; margin-bottom: 16px;"></i>
      <p>No withdrawal history yet</p>
    </div>
  `;
}

// Get status color
function getStatusColor(status) {
  switch(status) {
    case 'approved': return '#22c55e';
    case 'rejected': return '#ef4444';
    default: return '#f59e0b';
  }
}

// Setup withdrawal form
function setupWithdrawalForm() {
  const form = document.getElementById('withdrawalForm');
  if (!form) return;

  // Prevent default form submission, use button click instead
  const withdrawBtn = form.querySelector('.withdraw-btn');
  if (withdrawBtn) {
    withdrawBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleWithdrawal(e);
    });
  }
}

// Handle withdrawal request
async function handleWithdrawal(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const amount = parseFloat(document.getElementById('withdrawalAmount').value);
  const method = document.getElementById('withdrawalMethod').value;

  // Get user balance
  const userData = await getData(`USERS/${currentUser.uid}`);
  const balance = userData?.financialInfo?.balance || 0;

  // Validate
  if (amount < 50) {
    showToast('Minimum withdrawal amount is ₹50', 'error');
    return;
  }

  if (amount > balance) {
    showToast('Insufficient balance', 'error');
    return;
  }

  // Get payment details based on method
  let details = {};
  if (method === 'UPI') {
    const upiId = document.getElementById('upiId')?.value;
    if (!upiId) {
      showToast('Please enter UPI ID', 'error');
      return;
    }
    details = { upiId };
  } else {
    const accountNumber = document.getElementById('accountNumber')?.value;
    const ifscCode = document.getElementById('ifscCode')?.value;
    const accountName = document.getElementById('accountName')?.value;

    if (!accountNumber || !ifscCode || !accountName) {
      showToast('Please fill all bank details', 'error');
      return;
    }
    details = { accountNumber, ifscCode, accountName };
  }

  const confirmed = await showConfirm(
    'Confirm Withdrawal',
    `Request withdrawal of ${formatCurrency(amount)} via ${method}?`,
    'Confirm',
    'Cancel'
  );

  if (!confirmed) return;

  showLoading(submitBtn, 'Processing...');

  try {
    // Create withdrawal request
    const requestId = await pushData('WITHDRAWALS', {
      userId: currentUser.uid,
      amount,
      method,
      details,
      status: 'pending',
      timestamp: getServerTimestamp()
    });

    // Send notification
    const userName = userData.personalInfo?.name || 'User';
    const userEmail = userData.personalInfo?.email || '';
    await notifyWithdrawalRequest(userName, userEmail, amount, method, details);

    showToast('Withdrawal request submitted successfully!', 'success');

    // Reset form
    e.target.reset();

    // Reload withdrawal history
    loadWithdrawalHistory();

  } catch (error) {
    console.error('Withdrawal error:', error);
    showToast('Error submitting withdrawal request', 'error');
  } finally {
    hideLoading(submitBtn);
  }
}

// Cleanup
window.addEventListener('beforeunload', () => {
  subscriptions.forEach(ref => unsubscribe(ref));
});