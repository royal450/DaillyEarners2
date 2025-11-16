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

// Display transactions with modern design
function displayTransactions(transactions) {
  const container = document.getElementById('transactionsContainer');
  if (!container) return;

  container.innerHTML = transactions.map(txn => {
    let amountColor = '#64748b';
    let bgGradient = 'rgba(100, 116, 139, 0.1)';
    let iconClass = 'fa-exchange-alt';
    let iconColor = '#64748b';
    let amountPrefix = '';
    let borderColor = 'rgba(100, 116, 139, 0.2)';
    
    if (txn.type === 'credit') {
      amountColor = '#22c55e';
      bgGradient = 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))';
      iconClass = 'fa-arrow-down';
      iconColor = '#22c55e';
      amountPrefix = '+';
      borderColor = 'rgba(34, 197, 94, 0.3)';
    } else if (txn.type === 'debit') {
      amountColor = '#ef4444';
      bgGradient = 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))';
      iconClass = 'fa-arrow-up';
      iconColor = '#ef4444';
      amountPrefix = '-';
      borderColor = 'rgba(239, 68, 68, 0.3)';
    }
    
    return `
      <div style="
        position: relative;
        padding: 20px;
        background: var(--card-bg);
        backdrop-filter: blur(20px);
        border-radius: 16px;
        border: 1.5px solid ${borderColor};
        margin-bottom: 16px;
        overflow: hidden;
        transition: all 0.3s ease;
        cursor: pointer;
      " class="transaction-card">
        <!-- Background Gradient Overlay -->
        <div style="
          position: absolute;
          top: 0;
          right: 0;
          width: 150px;
          height: 100%;
          background: ${bgGradient};
          opacity: 0.6;
          border-radius: 0 16px 16px 0;
        "></div>
        
        <!-- Content -->
        <div style="position: relative; z-index: 1;">
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
            <!-- Icon -->
            <div style="
              width: 48px;
              height: 48px;
              border-radius: 50%;
              background: ${bgGradient};
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            ">
              <i class="fas ${iconClass}" style="font-size: 20px; color: ${iconColor};"></i>
            </div>
            
            <!-- Transaction Details -->
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 15px; font-weight: 700; color: var(--text-color); margin-bottom: 4px; line-height: 1.3;">
                ${txn.reason || 'Transaction'}
              </div>
              <div style="font-size: 12px; color: var(--text-color); opacity: 0.65; display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-clock" style="font-size: 10px;"></i>
                ${formatDateTime(txn.timestamp)}
              </div>
            </div>
            
            <!-- Amount -->
            <div style="
              padding: 12px 20px;
              background: ${bgGradient};
              border-radius: 12px;
              text-align: right;
              border: 1.5px solid ${borderColor};
            ">
              <div style="font-size: 20px; font-weight: 900; color: ${amountColor}; letter-spacing: -0.5px;">
                ${amountPrefix}${formatCurrency(txn.amount)}
              </div>
              <div style="font-size: 9px; font-weight: 700; color: ${amountColor}; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
                ${txn.type || 'Transaction'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add hover effects
  setTimeout(() => {
    document.querySelectorAll('.transaction-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px) scale(1.01)';
        card.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.12)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) scale(1)';
        card.style.boxShadow = 'none';
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