// Transactions Page Logic
import { auth } from '../shared/firebase-config.js';
import { getData } from '../shared/db.js';
import { formatCurrency, formatDateTime } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';

let currentUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  currentUser = await initAuthGuard(onUserAuthenticated);
  await initThemeToggle();
});

async function onUserAuthenticated(user) {
  currentUser = user;
  document.body.style.visibility = 'visible';
  await loadTransactions();
}

// Initialize theme toggle
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

// Load transactions
async function loadTransactions() {
  const allTransactions = await getData('TRANSACTIONS');

  if (!allTransactions) {
    showNoTransactions();
    return;
  }

  // Filter user transactions and sort by timestamp
  const userTransactions = Object.entries(allTransactions)
    .filter(([_, txn]) => txn.userId === currentUser.uid)
    .map(([id, txn]) => ({ id, ...txn }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  if (userTransactions.length === 0) {
    showNoTransactions();
    return;
  }

  displayTransactions(userTransactions);
}

// Display transactions with modern compact design
function displayTransactions(transactions) {
  const container = document.getElementById('transactionsContainer');
  if (!container) return;

  container.innerHTML = transactions.map(txn => {
    let amountColor = '#64748b';
    let iconClass = 'fa-exchange-alt';
    let iconBg = 'rgba(100, 116, 139, 0.1)';
    let amountPrefix = '';

    if (txn.type === 'credit') {
      amountColor = '#10b981';
      iconClass = 'fa-arrow-down';
      iconBg = 'rgba(16, 185, 129, 0.1)';
      amountPrefix = '+';
    } else if (txn.type === 'debit') {
      amountColor = '#ef4444';
      iconClass = 'fa-arrow-up';
      iconBg = 'rgba(239, 68, 68, 0.1)';
      amountPrefix = '-';
    }

    return `
      <div style="
        background: var(--card-bg);
        border-radius: 14px;
        padding: 14px;
        margin-bottom: 10px;
        border: 1px solid var(--border-color);
        transition: all 0.3s ease;
        cursor: pointer;
      " class="transaction-item">
        <div style="display: flex; align-items: center; gap: 12px;">
          <!-- Icon -->
          <div style="
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: ${iconBg};
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">
            <i class="fas ${iconClass}" style="font-size: 16px; color: ${amountColor};"></i>
          </div>

          <!-- Details -->
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 13px; font-weight: 700; color: var(--text-color); margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${txn.reason || 'Transaction'}
            </div>
            <div style="font-size: 11px; color: var(--icon-color); opacity: 0.8;">
              ${formatDateTime(txn.timestamp)}
            </div>
          </div>

          <!-- Amount -->
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-size: 16px; font-weight: 900; color: ${amountColor};">
              ${amountPrefix}${formatCurrency(txn.amount)}
            </div>
            <div style="font-size: 9px; font-weight: 600; color: ${amountColor}; opacity: 0.7; text-transform: uppercase;">
              ${txn.type || 'txn'}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add hover effects
  setTimeout(() => {
    document.querySelectorAll('.transaction-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        item.style.transform = 'translateY(-2px)';
        item.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.transform = 'translateY(0)';
        item.style.boxShadow = 'none';
      });
    });
  }, 100);
}

// Show no transactions message
function showNoTransactions() {
  const container = document.getElementById('transactionsContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--text-color); opacity: 0.5;">
      <i class="fas fa-exchange-alt" style="font-size: 48px; margin-bottom: 16px;"></i>
      <p>No transactions yet</p>
    </div>
  `;
}