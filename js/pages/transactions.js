// Transactions Page Logic
import { auth } from '../shared/firebase-config.js';
import { getData } from '../shared/db.js';
import { formatCurrency, formatDateTime } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';

let currentUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  currentUser = await initAuthGuard(onUserAuthenticated);
  await initThemeToggle(); // Initialize theme toggle after user is authenticated
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

// Display transactions
function displayTransactions(transactions) {
  const container = document.getElementById('transactionsContainer');
  if (!container) return;

  container.innerHTML = transactions.map(txn => `
    <div style="padding: 16px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-size: 14px; font-weight: 600; color: var(--text-color);">${txn.reason || 'Transaction'}</div>
        <div style="font-size: 18px; font-weight: 800; color: ${txn.type === 'credit' ? '#22c55e' : '#ef4444'};">
          ${txn.type === 'credit' ? '+' : '-'}${formatCurrency(txn.amount)}
        </div>
      </div>
      <div style="font-size: 12px; color: var(--text-color); opacity: 0.7;">
        <i class="fas fa-clock"></i> ${formatDateTime(txn.timestamp)}
      </div>
    </div>
  `).join('');
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