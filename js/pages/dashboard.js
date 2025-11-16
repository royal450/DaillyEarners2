// Dashboard Page Logic
import { auth } from '../shared/firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getData, subscribe, unsubscribe, setData, updateData } from '../shared/db.js';
import { formatCurrency, formatDate, getUserBadge, showToast, redirectTo, copyToClipboard } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';

let currentUser = null;
let subscriptions = [];

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  // Initialize auth guard and wait for user
  currentUser = await initAuthGuard(onUserAuthenticated, onUserUnauthenticated);
});

// Called when user is authenticated
async function onUserAuthenticated(user) {
  currentUser = user;
  
  // Show page
  document.body.style.visibility = 'visible';
  
  // Initialize all components
  initThemeToggle();
  initNavigation();
  loadUserData();
  loadTasks();
  
  // Setup menu interactions
  setupMenu();
}

// Called when user is not authenticated
function onUserUnauthenticated() {
  // Only redirect if on a protected page
  console.log('User not authenticated, redirecting to signup');
  redirectTo('index.html');
}

// Initialize theme toggle
async function initThemeToggle() {
  const { initGlobalTheme, toggleTheme } = await import('../shared/utils.js');
  
  // Initialize global theme with real-time sync
  await initGlobalTheme(currentUser.uid);
  
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', async () => {
      await toggleTheme(currentUser.uid);
    });
  }
}

// Initialize navigation
function initNavigation() {
  const walletBtn = document.getElementById('walletBtn');
  const menuBtn = document.getElementById('menuBtn');
  const hamburgerMenu = document.getElementById('hamburgerMenu');
  
  if (walletBtn) {
    walletBtn.addEventListener('click', () => redirectTo('wallet.html'));
  }
  
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const dropdown = document.getElementById('menuDropdown');
      dropdown.classList.toggle('active');
    });
  }
  
  if (hamburgerMenu) {
    hamburgerMenu.addEventListener('click', () => {
      const dropdown = document.getElementById('menuDropdown');
      dropdown.classList.toggle('active');
    });
  }
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menuBtn') && !e.target.closest('#hamburgerMenu') && !e.target.closest('#menuDropdown')) {
      const dropdown = document.getElementById('menuDropdown');
      if (dropdown) {
        dropdown.classList.remove('active');
      }
    }
  });
}

// Load and display user data with real-time updates
async function loadUserData() {
  try {
    // First load data once to show immediately
    const userData = await getData(`USERS/${currentUser.uid}`);
    if (userData) {
      updateUserProfile(userData);
      await updateUserStats(userData);
      checkVerificationStatus(userData);
    }
    
    // Then subscribe to real-time updates
    const userRef = subscribe(`USERS/${currentUser.uid}`, async (userData) => {
      if (!userData) return;
      
      updateUserProfile(userData);
      await updateUserStats(userData);
      checkVerificationStatus(userData);
    });
    
    subscriptions.push(userRef);
  } catch (error) {
    console.error('Error loading user data:', error);
    showToast('Error loading profile data', 'error');
  }
}

// Update user profile section
function updateUserProfile(userData) {
  if (!userData) {
    console.error('No userData provided to updateUserProfile');
    return;
  }
  
  const personalInfo = userData.personalInfo || {};
  
  // Profile initial
  const profileInitial = document.getElementById('profileInitial');
  if (profileInitial) {
    const name = personalInfo.name || personalInfo.email || 'User';
    const initial = name.charAt(0).toUpperCase();
    profileInitial.textContent = initial;
  }
  
  // Profile name with badge
  const profileName = document.getElementById('profileName');
  if (profileName) {
    const badge = getUserBadge(userData);
    const displayName = personalInfo.name || personalInfo.email || 'User';
    profileName.innerHTML = `
      ${displayName}
      <span style="display: inline-flex; align-items: center; gap: 4px; background: ${badge.color === 'green' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; color: ${badge.color === 'green' ? '#22c55e' : '#ef4444'}; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; margin-left: 6px;">
        <i class="fas ${badge.icon}" style="font-size: 9px;"></i>
        ${badge.text}
      </span>
    `;
  }
  
  // Joined date
  const joinedDate = document.getElementById('joinedDate');
  if (joinedDate) {
    const date = personalInfo.joinDate || Date.now();
    joinedDate.textContent = formatDate(date);
  }
  
  // Referral code (clickable to copy)
  const referralCode = document.getElementById('referralCode');
  if (referralCode) {
    const refCode = personalInfo.refCode || 'N/A';
    referralCode.textContent = refCode;
    referralCode.style.cursor = refCode !== 'N/A' ? 'pointer' : 'default';
    if (refCode !== 'N/A') {
      referralCode.onclick = () => {
        const referralLink = `${window.location.origin}/index.html?ref=${refCode}`;
        copyToClipboard(referralLink);
      };
    }
  }
}

// Update user statistics
async function updateUserStats(userData) {
  const financialInfo = userData.financialInfo || {};
  const taskHistory = userData.taskHistory || {};
  
  // Profile earnings (balance)
  const profileEarnings = document.getElementById('profileEarnings');
  if (profileEarnings) {
    profileEarnings.textContent = formatCurrency(financialInfo.balance || 0);
  }
  
  // Total referrals count and earnings
  const totalReferrals = document.getElementById('totalReferrals');
  if (totalReferrals) {
    const referralCount = await getReferralCount(currentUser.uid);
    totalReferrals.textContent = referralCount;
  }
  
  // Tasks completed
  const tasksCompleted = document.getElementById('tasksCompleted');
  if (tasksCompleted) {
    tasksCompleted.textContent = taskHistory.completed || 0;
  }
}

// Check verification status and show/hide Telegram notice
function checkVerificationStatus(userData) {
  const personalInfo = userData.personalInfo || {};
  const telegramNotice = document.getElementById('telegramNotice');
  
  if (telegramNotice) {
    if (!personalInfo.verified) {
      telegramNotice.style.display = 'block';
      telegramNotice.innerHTML = `
        <i class="fas fa-shield-alt" style="color: var(--accent-color); margin-right: 6px; font-size: 11px;"></i>
        Join our <a href="https://t.me/CashByKing" target="_blank" style="color: var(--accent-color); font-weight: 700; text-decoration: none;">Telegram Channel</a> for verification & updates!
      `;
    } else {
      telegramNotice.style.display = 'none';
    }
  }
}

// Get referral count
async function getReferralCount(userId) {
  const allUsers = await getData('USERS');
  if (!allUsers) return 0;
  
  let count = 0;
  for (const uid in allUsers) {
    if (allUsers[uid].personalInfo?.referrerId === userId) {
      count++;
    }
  }
  return count;
}

// Load and display tasks
async function loadTasks() {
  const allTasks = await getData('TASKS');
  if (!allTasks) {
    showNoTasksMessage();
    return;
  }
  
  // Filter active tasks
  const activeTasks = Object.entries(allTasks)
    .filter(([_, task]) => task.status === 'active')
    .map(([id, task]) => ({ id, ...task }));
  
  if (activeTasks.length === 0) {
    showNoTasksMessage();
    return;
  }
  
  displayTasks(activeTasks);
}

// Display tasks in the UI
function displayTasks(tasks) {
  const tasksContainer = document.getElementById('tasksContainer');
  if (!tasksContainer) return;
  
  tasksContainer.innerHTML = '';
  
  tasks.forEach(task => {
    const taskCard = createTaskCard(task);
    tasksContainer.appendChild(taskCard);
  });
}

// Create task card element
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.style.cssText = `
    background: var(--card-bg);
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 16px;
    border: 1px solid var(--border-color);
    cursor: pointer;
    transition: all 0.3s ease;
  `;
  
  card.innerHTML = `
    <div style="display: flex; gap: 12px; align-items: flex-start;">
      <div style="width: 60px; height: 60px; border-radius: 12px; background: ${task.thumbnail ? `url(${task.thumbnail}) center/cover` : 'var(--accent-gradient)'}; flex-shrink: 0;"></div>
      <div style="flex: 1;">
        <h3 style="font-size: 15px; font-weight: 700; color: var(--text-color); margin-bottom: 4px;">${task.title || 'Task'}</h3>
        <p style="font-size: 12px; color: var(--text-color); opacity: 0.7; margin-bottom: 8px; line-height: 1.4;">${(task.description || '').substring(0, 80)}...</p>
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--text-color); opacity: 0.6;">
            <span><i class="fas fa-heart"></i> ${task.likes || 0}</span>
            <span><i class="fas fa-users"></i> ${task.completedBy ? task.completedBy.length : 0} completed</span>
          </div>
          <div style="font-size: 16px; font-weight: 800; color: var(--accent-color);">${formatCurrency(task.price || 0)}</div>
        </div>
      </div>
    </div>
  `;
  
  card.addEventListener('click', () => {
    redirectTo(`task-detail.html?id=${task.id}`);
  });
  
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-2px)';
    card.style.boxShadow = 'var(--card-shadow)';
  });
  
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = 'none';
  });
  
  return card;
}

// Show no tasks message
function showNoTasksMessage() {
  const tasksContainer = document.getElementById('tasksContainer');
  if (!tasksContainer) return;
  
  tasksContainer.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--text-color); opacity: 0.6;">
      <i class="fas fa-tasks" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
      <p style="font-size: 16px; font-weight: 600;">No active tasks available</p>
      <p style="font-size: 13px; margin-top: 8px;">Check back later for new earning opportunities!</p>
    </div>
  `;
}

// Setup menu interactions
function setupMenu() {
  // Logout functionality
  const logoutBtn = document.querySelector('a[href="/logout"]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      try {
        await signOut(auth);
        showToast('Logged out successfully', 'success');
        redirectTo('index.html');
      } catch (error) {
        showToast('Error logging out', 'error');
      }
    });
  }
}

// Request notification permission
window.requestNotificationPermission = async function() {
  if (!('Notification' in window)) {
    showToast('Your browser does not support notifications', 'error');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      showToast('Notifications enabled successfully!', 'success');
      updateNotificationUI('granted');
      
      // Save to database
      await updateData(`USERS/${currentUser.uid}/notifications`, {
        enabled: true,
        permission: 'granted',
        enabledAt: Date.now()
      });
      
      // Send test notification
      new Notification('CashByKing', {
        body: 'You will now receive instant task notifications!',
        icon: '/favicon.ico'
      });
    } else {
      showToast('Notification permission denied', 'warning');
      updateNotificationUI('denied');
    }
  } catch (error) {
    console.error('Notification permission error:', error);
    showToast('Error enabling notifications', 'error');
  }
};

// Update notification card UI
function updateNotificationUI(status) {
  const notificationCard = document.getElementById('notificationCard');
  const notificationTitle = document.getElementById('notificationTitle');
  const notificationSubtitle = document.getElementById('notificationSubtitle');
  const notificationIcon = document.getElementById('notificationIcon');
  const notificationArrow = document.getElementById('notificationArrow');
  
  if (!notificationCard) return;
  
  if (status === 'granted') {
    notificationTitle.textContent = 'Notifications Enabled';
    notificationSubtitle.innerHTML = '<span><i class="fas fa-check-circle" style="font-size: 10px;"></i> Active</span> <span style="opacity: 0.7;">•</span> <span>Receiving Updates</span>';
    notificationIcon.className = 'fas fa-check-circle';
    notificationArrow.innerHTML = '<i class="fas fa-check"></i>';
    notificationCard.style.pointerEvents = 'none';
    notificationCard.style.opacity = '0.7';
  }
}

// Check notification permission on load
if ('Notification' in window && Notification.permission === 'granted') {
  updateNotificationUI('granted');
}

// PWA Install functionality
let deferredPrompt;
const pwaInstallBanner = document.getElementById('pwaInstallBanner');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Show install banner
  if (pwaInstallBanner) {
    pwaInstallBanner.style.display = 'block';
  }
});

window.installPWA = async function() {
  if (!deferredPrompt) {
    showToast('PWA already installed or not available', 'info');
    return;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    showToast('App installed successfully!', 'success');
    if (pwaInstallBanner) {
      pwaInstallBanner.style.display = 'none';
    }
    
    // Track installation in database
    await updateData(`USERS/${currentUser.uid}/pwa`, {
      installed: true,
      installedAt: Date.now()
    });
  }
  
  deferredPrompt = null;
};

window.addEventListener('appinstalled', () => {
  if (pwaInstallBanner) {
    pwaInstallBanner.style.display = 'none';
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  subscriptions.forEach(ref => unsubscribe(ref));
});
