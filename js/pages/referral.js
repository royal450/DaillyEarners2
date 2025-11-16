// Referral Page Logic
import { auth } from '../shared/firebase-config.js';
import { getData } from '../shared/db.js';
import { formatCurrency, formatDate, copyToClipboard } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';

let currentUser = null;
let userRefCode = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  currentUser = await initAuthGuard(onUserAuthenticated);
  await initThemeToggle(); // Initialize theme toggle after user is authenticated
});

async function onUserAuthenticated(user) {
  currentUser = user;
  // Make sure the body is visible only after auth and theme are initialized
  document.body.style.visibility = 'visible';

  await loadReferralData();
}

// Initialize theme toggle
async function initThemeToggle() {
  const { initGlobalTheme, toggleTheme } = await import('../shared/utils.js');
  if (currentUser && currentUser.uid) {
    await initGlobalTheme(currentUser.uid);

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', async () => {
        await toggleTheme(currentUser.uid);
      });
    }
  }
}


// Load referral data
async function loadReferralData() {
  try {
    const userData = await getData(`USERS/${currentUser.uid}`);
    userRefCode = userData?.personalInfo?.refCode;

    if (!userRefCode) {
      console.error('No referral code found for user');
      showNoReferralCode();
      return;
    }

    // Display referral code
    const refCodeEl = document.getElementById('referralCode');
    const refLinkEl = document.getElementById('referralLink');

    const referralLink = `${window.location.origin}/index.html?ref=${userRefCode}`;

    if (refCodeEl) {
      refCodeEl.textContent = userRefCode;
    }

    if (refLinkEl) {
      refLinkEl.textContent = referralLink;
      refLinkEl.style.wordBreak = 'break-all';
    }

  // Copy button functionality
    const copyBtnElement = document.getElementById('copyBtn');
    if (copyBtnElement) {
      copyBtnElement.addEventListener('click', () => {
        copyToClipboard(referralLink);
      });
    }

    // Also add copy on click to link itself
    if (refLinkEl) {
      refLinkEl.style.cursor = 'pointer';
      refLinkEl.addEventListener('click', () => {
        copyToClipboard(referralLink);
      });
    }

    // Load referral statistics
    await loadReferralStats();

    // Load referral list
    await loadReferralList();
  } catch (error) {
    console.error('Error loading referral data:', error);
    showToast('Error loading referral data', 'error');
  }
}

// Show no referral code message
function showNoReferralCode() {
  const refLinkEl = document.getElementById('referralLink');
  if (refLinkEl) {
    refLinkEl.textContent = 'Referral code not found. Please contact support.';
    refLinkEl.style.color = 'red';
  }
}

// Load referral statistics
async function loadReferralStats() {
  try {
    const userData = await getData(`USERS/${currentUser.uid}`);
    const allUsers = await getData('USERS');

    if (!allUsers) {
      updateStatsUI(0, 0);
      return;
    }

    let totalReferrals = 0;

    for (const uid in allUsers) {
      // Skip the current user
      if (uid === currentUser.uid) continue;
      
      const user = allUsers[uid];
      const referrerId = user.personalInfo?.referrerId;
      
      // Check if this user was referred by current user
      if (referrerId && referrerId.toString() === currentUser.uid.toString()) {
        totalReferrals++;
      }
    }

    // Get total earnings from referrals stored in user data
    const totalEarnings = userData?.referrals?.earnings || 0;

    updateStatsUI(totalReferrals, totalEarnings);
  } catch (error) {
    console.error('Error loading referral stats:', error);
    updateStatsUI(0, 0);
  }
}

// Update stats UI
function updateStatsUI(totalReferrals, totalEarnings) {
  const totalRefEl = document.getElementById('totalReferrals');
  const totalEarnedEl = document.getElementById('totalEarned');

  if (totalRefEl) {
    totalRefEl.textContent = totalReferrals;
  }

  if (totalEarnedEl) {
    totalEarnedEl.textContent = totalEarnings;
  }
}

// Load referral list
async function loadReferralList() {
  try {
    const allUsers = await getData('USERS');

    if (!allUsers) {
      showNoReferrals();
      return;
    }

    const referrals = [];

    for (const uid in allUsers) {
      // Skip the current user
      if (uid === currentUser.uid) continue;
      
      const userData = allUsers[uid];
      const referrerId = userData.personalInfo?.referrerId;
      
      // Check if this user was referred by current user
      if (referrerId && referrerId.toString() === currentUser.uid.toString()) {
        referrals.push({
          name: userData.personalInfo?.name || 'User',
          joinDate: userData.personalInfo?.joinDate,
          tasksCompleted: userData.taskHistory?.completed || 0
        });
      }
    }

    if (referrals.length === 0) {
      showNoReferrals();
      return;
    }

    // Sort by join date (newest first)
    referrals.sort((a, b) => (b.joinDate || 0) - (a.joinDate || 0));

    displayReferrals(referrals);
  } catch (error) {
    console.error('Error loading referral list:', error);
    showNoReferrals();
  }
}

// Display referrals
function displayReferrals(referrals) {
  const container = document.getElementById('referralList');
  if (!container) return;

  container.innerHTML = referrals.map(ref => `
    <div style="padding: 16px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-color);">${ref.name}</div>
          <div style="font-size: 12px; color: var(--text-color); opacity: 0.7; margin-top: 4px;">
            <i class="fas fa-calendar"></i> Joined ${formatDate(ref.joinDate)}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 16px; font-weight: 800; color: var(--accent-color);">+₹${ref.tasksCompleted > 0 ? '15' : '5'}</div>
          <div style="font-size: 11px; color: var(--text-color); opacity: 0.6; margin-top: 4px;">${ref.tasksCompleted} tasks</div>
        </div>
      </div>
    </div>
  `).join('');
}

// Show no referrals message
function showNoReferrals() {
  const container = document.getElementById('referralList');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--text-color); opacity: 0.5;">
      <i class="fas fa-users" style="font-size: 48px; margin-bottom: 16px;"></i>
      <p>No referrals yet</p>
      <p style="font-size: 13px; margin-top: 8px;">Share your referral link to earn rewards!</p>
    </div>
  `;
}