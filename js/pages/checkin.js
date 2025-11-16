// Daily Check-in Page Logic
import { auth } from '../shared/firebase-config.js';
import { getData, setData, updateData, updateBalance, getServerTimestamp } from '../shared/db.js';
import { formatCurrency, has24HoursPassed, randomInRange, showToast, formatDateTime } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';

let currentUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  currentUser = await initAuthGuard(onUserAuthenticated);
});

async function onUserAuthenticated(user) {
  currentUser = user;
  document.body.style.visibility = 'visible';

  loadCheckInStatus();
  setupCheckInButton();
  await initThemeToggle(); // Initialize theme toggle
}

// Theme Toggle Logic
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

// Load check-in status
async function loadCheckInStatus() {
  const checkinData = await getData(`CHECKINS/${currentUser.uid}`);

  const lastCheckIn = checkinData?.lastCheckIn;
  const currentStreak = checkinData?.streak || 0;

  // Render day grid
  renderDayGrid(currentStreak);

  const canCheckIn = !lastCheckIn || has24HoursPassed(lastCheckIn);

  const checkInBtn = document.getElementById('checkInBtn');
  if (checkInBtn) {
    checkInBtn.disabled = !canCheckIn;
    if (!canCheckIn) {
      checkInBtn.innerHTML = '<i class="fas fa-clock"></i> Check back in 24 hours';
    } else {
      checkInBtn.innerHTML = '<i class="fas fa-gift"></i> Claim Daily Reward';
    }
  }

  // Load check-in history
  loadCheckInHistory();
}

// Render day grid
function renderDayGrid(currentStreak) {
  const dayGrid = document.getElementById('dayGrid');
  if (!dayGrid) return;

  dayGrid.innerHTML = '';
  
  for (let day = 1; day <= 7; day++) {
    const dayCard = document.createElement('div');
    dayCard.className = 'day-card';
    
    if (day <= currentStreak) {
      dayCard.classList.add('claimed');
    }
    
    dayCard.innerHTML = `
      <div style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">Day ${day}</div>
      <div style="font-size: 14px; opacity: 0.8;">
        ${day <= currentStreak ? '<i class="fas fa-check-circle"></i> Claimed' : '₹1-10'}
      </div>
    `;
    
    dayGrid.appendChild(dayCard);
  }
}

// Setup check-in button
function setupCheckInButton() {
  const checkInBtn = document.getElementById('checkInBtn');
  if (checkInBtn) {
    checkInBtn.addEventListener('click', handleCheckIn);
  }
}

// Handle check-in
async function handleCheckIn() {
  const checkInBtn = document.getElementById('checkInBtn');

  try {
    checkInBtn.disabled = true;
    checkInBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    // Get current check-in data
    const checkinData = await getData(`CHECKINS/${currentUser.uid}`) || {};
    const lastCheckIn = checkinData.lastCheckIn;

    // Verify 24 hours have passed
    if (lastCheckIn && !has24HoursPassed(lastCheckIn)) {
      showToast('You can only check in once every 24 hours', 'error');
      loadCheckInStatus();
      return;
    }

    // Calculate streak
    const currentTime = Date.now();
    let newStreak = 1;

    if (lastCheckIn && currentTime - lastCheckIn < 48 * 60 * 60 * 1000) {
      // Within 48 hours - continue streak
      newStreak = (checkinData.streak || 0) + 1;
      if (newStreak > 7) newStreak = 1; // Reset after 7 days
    }

    // Generate random reward (1-10 rupees)
    const reward = randomInRange(1, 10);

    // Update balance
    await updateBalance(currentUser.uid, reward, `Daily check-in reward - Day ${newStreak}`);

    // Update check-in data
    await setData(`CHECKINS/${currentUser.uid}`, {
      lastCheckIn: currentTime,
      streak: newStreak,
      totalRewards: (checkinData.totalRewards || 0) + reward
    });

    // Add to history
    const history = checkinData.history || [];
    history.unshift({
      date: currentTime,
      reward,
      streak: newStreak
    });

    // Keep only last 30 check-ins
    if (history.length > 30) {
      history.splice(30);
    }

    await updateData(`CHECKINS/${currentUser.uid}`, {
      history
    });

    // Show success message
    showToast(`🎉 You earned ${formatCurrency(reward)}! Day ${newStreak} streak!`, 'success');

    // Reload status
    loadCheckInStatus();

  } catch (error) {
    console.error('Check-in error:', error);
    showToast('Error processing check-in', 'error');
    checkInBtn.disabled = false;
    checkInBtn.innerHTML = '<i class="fas fa-gift"></i> Claim Daily Reward';
  }
}

// Load check-in history
async function loadCheckInHistory() {
  const checkinData = await getData(`CHECKINS/${currentUser.uid}`);
  const history = checkinData?.history || [];

  const container = document.getElementById('checkInHistory');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-color); opacity: 0.5;">
        <i class="fas fa-calendar-check" style="font-size: 48px; margin-bottom: 16px;"></i>
        <p>No check-in history yet</p>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map(h => `
    <div style="padding: 16px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 14px; font-weight: 600; color: var(--text-color);">Day ${h.streak} Reward</div>
          <div style="font-size: 12px; color: var(--text-color); opacity: 0.7; margin-top: 4px;">${formatDateTime(h.date)}</div>
        </div>
        <div style="font-size: 18px; font-weight: 800; color: var(--accent-color);">+${formatCurrency(h.reward)}</div>
      </div>
    </div>
  `).join('');
}