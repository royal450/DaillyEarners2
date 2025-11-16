// Wallet Page Logic - Fixed pushData Issue
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
  await initThemeToggle();
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
  try {
    const userData = await getData(`USERS/${currentUser.uid}`);
    if (!userData) return;

    const upiEl = document.getElementById('upi');
    const phoneEl = document.getElementById('phone');
    const emailEl = document.getElementById('email');

    if (upiEl) upiEl.textContent = userData.personalInfo?.upiId || 'Not set';
    if (phoneEl) phoneEl.textContent = userData.personalInfo?.phone || 'Not set';
    if (emailEl) emailEl.textContent = userData.personalInfo?.email || currentUser.email || 'Not set';
  } catch (error) {
    console.error('Error loading user info:', error);
  }
}

// Setup payment method toggle
function setupPaymentMethodToggle() {
  const paymentMethod = document.getElementById('paymentMethod');
  const upiFields = document.getElementById('upiFields');
  const bankFields = document.getElementById('bankFields');

  if (paymentMethod && upiFields && bankFields) {
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
  try {
    const { initGlobalTheme, toggleTheme } = await import('../shared/utils.js');
    await initGlobalTheme(currentUser.uid);

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', async () => {
        await toggleTheme(currentUser.uid);
      });
    }
  } catch (error) {
    console.error('Theme toggle error:', error);
  }
}

// Load wallet data with real-time updates
function loadWalletData() {
  try {
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
  } catch (error) {
    console.error('Error loading wallet data:', error);
    showToast('Error loading wallet data', 'error');
  }
}

// Load withdrawal history
async function loadWithdrawalHistory() {
  try {
    const allWithdrawals = await getData('WITHDRAWALS');
    if (!allWithdrawals) {
      showNoWithdrawals();
      return;
    }

    // Filter user's withdrawals and sort by timestamp
    const userWithdrawals = Object.entries(allWithdrawals)
      .filter(([_, withdrawal]) => withdrawal.userId === currentUser.uid)
      .map(([id, withdrawal]) => ({ id, ...withdrawal }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (userWithdrawals.length === 0) {
      showNoWithdrawals();
      return;
    }

    displayWithdrawals(userWithdrawals);
  } catch (error) {
    console.error('Error loading withdrawal history:', error);
    showNoWithdrawals();
  }
}

// Display withdrawals
function displayWithdrawals(withdrawals) {
  const container = document.getElementById('withdrawHistory');
  if (!container) {
    console.error('Withdraw history container not found');
    return;
  }

  container.innerHTML = withdrawals.map(w => `
    <div class="withdraw-item">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-size: 16px; font-weight: 700; color: var(--text-color);">${formatCurrency(w.amount)}</div>
        <div class="status-badge ${getStatusClass(w.status)}">
          ${w.status.toUpperCase()}
        </div>
      </div>
      <div style="font-size: 12px; color: var(--text-color); opacity: 0.7;">
        <div>${w.method} • ${formatDateTime(w.timestamp)}</div>
        ${w.adminReason ? `<div style="margin-top: 4px; color: var(--accent-color); font-style: italic;">${w.adminReason}</div>` : ''}
        ${w.details?.upiId ? `<div style="margin-top: 2px;">UPI: ${w.details.upiId}</div>` : ''}
        ${w.details?.accountNumber ? `<div style="margin-top: 2px;">Acc: ${w.details.accountNumber}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// Show no withdrawals message
function showNoWithdrawals() {
  const container = document.getElementById('withdrawHistory');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--text-color); opacity: 0.5;">
      <i class="fas fa-receipt" style="font-size: 48px; margin-bottom: 16px;"></i>
      <p>No withdrawal history yet</p>
      <p style="font-size: 12px; margin-top: 8px;">Your withdrawal requests will appear here</p>
    </div>
  `;
}

// Get status class
function getStatusClass(status) {
  switch(status) {
    case 'approved': return 'status-approved';
    case 'rejected': return 'status-rejected';
    default: return 'status-pending';
  }
}

// Setup withdrawal form
function setupWithdrawalForm() {
  const withdrawBtn = document.querySelector('.withdraw-btn');
  if (!withdrawBtn) {
    console.error('Withdraw button not found');
    return;
  }

  withdrawBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await handleWithdrawal();
  });

  console.log('Withdrawal form setup completed');
}

// Custom loading function
function setLoadingState(loading) {
  const withdrawBtn = document.querySelector('.withdraw-btn');
  if (!withdrawBtn) return;

  if (loading) {
    withdrawBtn.disabled = true;
    withdrawBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    withdrawBtn.style.opacity = '0.7';
  } else {
    withdrawBtn.disabled = false;
    withdrawBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Request Withdrawal';
    withdrawBtn.style.opacity = '1';
  }
}

// Handle withdrawal request - FIXED pushData Issue
async function handleWithdrawal() {
  console.log('🚀 Withdrawal process started...');

  // Get form values
  const amountInput = document.getElementById('withdrawAmount');
  const paymentMethod = document.getElementById('paymentMethod');
  
  if (!amountInput || !paymentMethod) {
    showToast('Form elements not found', 'error');
    return;
  }

  const amount = parseFloat(amountInput.value);
  const method = paymentMethod.value;

  console.log('📝 Form values:', { amount, method });

  // Validate amount
  if (!amount || isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid amount', 'error');
    return;
  }

  if (amount < 50) {
    showToast('Minimum withdrawal amount is ₹50', 'error');
    return;
  }

  // Get user data and balance
  let userData;
  try {
    userData = await getData(`USERS/${currentUser.uid}`);
    if (!userData) {
      showToast('User data not found', 'error');
      return;
    }

    const balance = userData?.financialInfo?.balance || 0;
    console.log('💰 User balance:', balance);

    if (amount > balance) {
      showToast(`Insufficient balance. Available: ₹${balance.toFixed(2)}`, 'error');
      return;
    }
  } catch (error) {
    console.error('❌ Error fetching user data:', error);
    showToast('Error checking balance', 'error');
    return;
  }

  // Get payment details based on method
  let details = {};
  if (method === 'upi') {
    const upiId = document.getElementById('upiId')?.value;
    if (!upiId || upiId.trim() === '') {
      showToast('Please enter UPI ID', 'error');
      return;
    }
    
    if (!isValidUPI(upiId)) {
      showToast('Please enter a valid UPI ID (e.g., name@paytm)', 'error');
      return;
    }
    
    details = { upiId: upiId.trim() };
  } else {
    const accountNumber = document.getElementById('accountNumber')?.value;
    const ifscCode = document.getElementById('ifscCode')?.value;
    const accountName = document.getElementById('accountName')?.value;

    if (!accountNumber || !ifscCode || !accountName) {
      showToast('Please fill all bank details', 'error');
      return;
    }
    
    if (accountNumber.length < 9) {
      showToast('Please enter valid account number', 'error');
      return;
    }
    
    if (ifscCode.length !== 11) {
      showToast('IFSC code must be 11 characters', 'error');
      return;
    }
    
    details = { 
      accountNumber: accountNumber.trim(), 
      ifscCode: ifscCode.trim().toUpperCase(), 
      accountName: accountName.trim() 
    };
  }

  // Confirmation dialog
  const confirmed = await showConfirm(
    'Confirm Withdrawal',
    `Are you sure you want to withdraw ${formatCurrency(amount)} via ${method.toUpperCase()}?`,
    'Yes, Withdraw',
    'Cancel'
  );

  if (!confirmed) {
    console.log('❌ Withdrawal cancelled by user');
    return;
  }

  setLoadingState(true);

  try {
    console.log('💸 Starting balance deduction...');
    
    // ✅ Balance deduction
    await updateBalance(currentUser.uid, -amount, `Withdrawal request via ${method.toUpperCase()}`);
    console.log('✅ Balance deducted successfully');

    // Create withdrawal request with manual ID
    const timestamp = Date.now();
    const withdrawalId = 'withdrawal_' + timestamp + '_' + Math.random().toString(36).substr(2, 9);
    
    const withdrawalData = {
      userId: currentUser.uid,
      userName: userData.personalInfo?.name || 'User',
      userEmail: userData.personalInfo?.email || currentUser.email || '',
      userPhone: userData.personalInfo?.phone || '',
      amount: amount,
      method: method.toUpperCase(),
      details: details,
      status: 'pending',
      timestamp: timestamp,
      createdAt: getServerTimestamp(),
      originalBalance: userData?.financialInfo?.balance || 0
    };

    console.log('📤 Creating withdrawal request with ID:', withdrawalId);

    // ✅ FIX: Use setData instead of pushData with manual ID
    await setData(`WITHDRAWALS/${withdrawalId}`, withdrawalData);
    console.log('✅ Withdrawal request created successfully');

    // Create transaction record
    const transactionId = 'txn_' + timestamp + '_' + Math.random().toString(36).substr(2, 9);
    const transactionData = {
      userId: currentUser.uid,
      type: 'debit',
      amount: amount,
      reason: `Withdrawal request (${method.toUpperCase()}) - Pending approval`,
      timestamp: timestamp,
      withdrawalId: withdrawalId,
      status: 'pending'
    };

    await setData(`TRANSACTIONS/${transactionId}`, transactionData);
    console.log('✅ Transaction record created');

    // Send notification to admin
    try {
      const userName = userData.personalInfo?.name || 'User';
      const userEmail = userData.personalInfo?.email || currentUser.email || '';
      await notifyWithdrawalRequest(userName, userEmail, amount, method.toUpperCase(), details);
      console.log('📧 Admin notification sent');
    } catch (notifyError) {
      console.error('❌ Notification error:', notifyError);
    }

    showToast(`✅ Withdrawal request submitted! ₹${amount} deducted. Admin will process within 24-48 hours.`, 'success');

    // Reset form
    resetWithdrawalForm();

    // Reload data
    setTimeout(() => {
      loadWalletData();
      loadWithdrawalHistory();
    }, 1000);

  } catch (error) {
    console.error('❌ Withdrawal submission error:', error);
    console.error('Error details:', error.message, error.stack);
    showToast('Error submitting withdrawal request. Please try again.', 'error');
  } finally {
    setLoadingState(false);
  }
}

// Validate UPI ID
function isValidUPI(upi) {
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return upiRegex.test(upi);
}

// Reset withdrawal form
function resetWithdrawalForm() {
  const amountInput = document.getElementById('withdrawAmount');
  const upiInput = document.getElementById('upiId');
  const accountNumberInput = document.getElementById('accountNumber');
  const ifscInput = document.getElementById('ifscCode');
  const accountNameInput = document.getElementById('accountName');
  const paymentMethod = document.getElementById('paymentMethod');

  if (amountInput) amountInput.value = '';
  if (upiInput) upiInput.value = '';
  if (accountNumberInput) accountNumberInput.value = '';
  if (ifscInput) ifscInput.value = '';
  if (accountNameInput) accountNameInput.value = '';
  if (paymentMethod) paymentMethod.value = 'upi';
  
  // Reset to UPI fields
  const upiFields = document.getElementById('upiFields');
  const bankFields = document.getElementById('bankFields');
  if (upiFields) upiFields.style.display = 'block';
  if (bankFields) bankFields.style.display = 'none';
}

// Cleanup
window.addEventListener('beforeunload', () => {
  subscriptions.forEach(ref => {
    if (ref && typeof ref === 'function') {
      unsubscribe(ref);
    }
  });
});

// Debug function
window.debugWalletData = async function() {
  console.log('🐛 === WALLET DEBUG INFO ===');
  console.log('Current User:', currentUser);
  
  try {
    const userData = await getData(`USERS/${currentUser.uid}`);
    console.log('User Data:', userData);
    
    const withdrawals = await getData('WITHDRAWALS');
    console.log('All Withdrawals:', withdrawals);
    
    const userWithdrawals = withdrawals ? Object.entries(withdrawals)
      .filter(([_, w]) => w.userId === currentUser.uid)
      .map(([id, w]) => ({ id, ...w })) : [];
    console.log('User Withdrawals:', userWithdrawals);
    
  } catch (error) {
    console.error('Debug error:', error);
  }
};

console.log('✅ Wallet.js loaded - Withdrawal system ready with pushData fix');
