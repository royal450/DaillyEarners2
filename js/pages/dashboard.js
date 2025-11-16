// Dashboard Page Logic - Ultra Modern with Attractive Task Cards
import { auth } from '../shared/firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getData, subscribe, unsubscribe, setData, updateData } from '../shared/db.js';
import { formatCurrency, formatDate, getUserBadge, showToast, redirectTo, copyToClipboard } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';

let currentUser = null;
let subscriptions = [];

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  currentUser = await initAuthGuard(onUserAuthenticated, onUserUnauthenticated);
});

async function onUserAuthenticated(user) {
  currentUser = user;
  document.body.style.visibility = 'visible';
  
  initThemeToggle();
  initNavigation();
  loadUserData();
  loadTasks();
  setupMenu();
}

function onUserUnauthenticated() {
  redirectTo('index.html');
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
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#menuBtn') && !e.target.closest('#hamburgerMenu') && !e.target.closest('#menuDropdown')) {
      const dropdown = document.getElementById('menuDropdown');
      if (dropdown) {
        dropdown.classList.remove('active');
      }
    }
  });
}

// Load user data with real-time updates
async function loadUserData() {
  try {
    const userData = await getData(`USERS/${currentUser.uid}`);
    if (userData) {
      updateUserProfile(userData);
      await updateUserStats(userData);
      checkVerificationStatus(userData);
    }
    
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
  if (!userData) return;
  
  const personalInfo = userData.personalInfo || {};
  
  const profileInitial = document.getElementById('profileInitial');
  if (profileInitial) {
    const name = personalInfo.name || personalInfo.email || 'User';
    const initial = name.charAt(0).toUpperCase();
    profileInitial.textContent = initial;
  }
  
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
  
  const joinedDate = document.getElementById('joinedDate');
  if (joinedDate) {
    const date = personalInfo.joinDate || Date.now();
    joinedDate.textContent = formatDate(date);
  }
  
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
  
  const profileEarnings = document.getElementById('profileEarnings');
  if (profileEarnings) {
    profileEarnings.textContent = formatCurrency(financialInfo.balance || 0);
  }
  
  const totalReferrals = document.getElementById('totalReferrals');
  if (totalReferrals) {
    const referralCount = await getReferralCount(currentUser.uid);
    totalReferrals.textContent = referralCount;
  }
  
  const tasksCompleted = document.getElementById('tasksCompleted');
  if (tasksCompleted) {
    tasksCompleted.textContent = taskHistory.completed || 0;
  }
}

// Check verification status
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
  
  const activeTasks = Object.entries(allTasks)
    .filter(([_, task]) => task.status === 'active' || !task.status)
    .map(([id, task]) => ({ id, ...task }));
  
  if (activeTasks.length === 0) {
    showNoTasksMessage();
    return;
  }
  
  displayTasks(activeTasks);
}

// Display tasks in the UI - ULTRA MODERN DESIGN
function displayTasks(tasks) {
  const tasksContainer = document.getElementById('tasksContainer');
  if (!tasksContainer) return;
  
  tasksContainer.innerHTML = '';
  
  tasks.forEach((task, index) => {
    const taskCard = createModernTaskCard(task, index);
    tasksContainer.appendChild(taskCard);
  });
}

// Generate random likes between 100-200
function generateRandomLikes() {
  return Math.floor(Math.random() * 101) + 100; // 100-200 range
}

// Generate random completion count
function generateRandomCompletions() {
  return Math.floor(Math.random() * 151) + 50; // 50-200 range
}

// Create ultra modern task card
function createModernTaskCard(task, index) {
  const card = document.createElement('div');
  card.className = 'modern-task-card';
  
  // Generate attractive random stats
  const randomLikes = generateRandomLikes();
  const randomCompletions = generateRandomCompletions();
  const randomEngagement = Math.floor(Math.random() * 301) + 200; // 200-500
  
  // Task data with fallbacks
  const taskTitle = task.title || task.taskTitle || 'Earn Money Task';
  const taskDescription = task.description || task.desc || 'Complete this task and earn instant rewards!';
  const taskPrice = task.price || task.amount || task.reward || 25;
  const taskThumbnail = task.thumbnail || task.image || '';
  
  // Category based on index for variety
  const categories = ['Social Media', 'YouTube', 'App Install', 'Survey', 'Website Visit'];
  const taskCategory = categories[index % categories.length];
  
  // Difficulty badge color
  const difficulties = ['#10b981', '#f59e0b', '#ef4444'];
  const difficultyColor = difficulties[index % difficulties.length];
  const difficultyText = ['Easy', 'Medium', 'Hard'][index % 3];
  
  card.style.cssText = `
    background: linear-gradient(135deg, var(--nav-bg) 0%, rgba(99,102,241,0.05) 100%);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    padding: 0;
    margin-bottom: 20px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    position: relative;
  `;
  
  card.innerHTML = `
    <!-- Premium Glow Effect -->
    <div style="position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--accent-color), transparent); opacity: 0.6;"></div>
    
    <!-- Difficulty Badge -->
    <div style="position: absolute; top: 16px; left: 16px; background: ${difficultyColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; z-index: 2; box-shadow: 0 4px 12px ${difficultyColor}40;">
      ${difficultyText}
    </div>
    
    <!-- Category Badge -->
    <div style="position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.7); backdrop-filter: blur(10px); color: white; padding: 6px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; z-index: 2;">
      ${taskCategory}
    </div>
    
    <!-- Thumbnail with Gradient Overlay -->
    <div style="width: 100%; height: 160px; background: ${taskThumbnail ? `url('${taskThumbnail}') center/cover` : 'var(--accent-gradient)'}; position: relative; overflow: hidden; border-radius: 24px 24px 0 0;">
      <div style="position: absolute; inset: 0; background: linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(139,92,246,0.2) 100%);"></div>
      <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 20px; background: linear-gradient(transparent, rgba(0,0,0,0.8));">
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 24px; font-weight: 900; color: white; margin-bottom: 4px; text-shadow: 0 2px 8px rgba(0,0,0,0.5);">${formatCurrency(taskPrice)}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.9); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">INSTANT REWARD</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; color: rgba(255,255,255,0.9); font-weight: 700; margin-bottom: 2px;">${randomCompletions}+ Completed</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.7);">Trusted by users</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Card Content -->
    <div style="padding: 20px;">
      <!-- Title with Icon -->
      <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
        <div style="width: 40px; height: 40px; border-radius: 12px; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(99,102,241,0.3);">
          <i class="fas fa-${getTaskIcon(taskCategory)}"></i>
        </div>
        <div style="flex: 1;">
          <h3 style="font-size: 17px; font-weight: 800; color: var(--text-color); margin-bottom: 6px; line-height: 1.3;">${taskTitle}</h3>
          <p style="font-size: 13px; color: var(--text-color); opacity: 0.7; line-height: 1.5; margin-bottom: 0;">${taskDescription}</p>
        </div>
      </div>
      
      <!-- Stats Row -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; padding: 12px; background: rgba(99,102,241,0.05); border-radius: 16px; border: 1px solid rgba(99,102,241,0.1);">
        <!-- Likes -->
        <div style="text-align: center;">
          <div style="font-size: 18px; font-weight: 900; color: var(--accent-color); margin-bottom: 2px;">${randomLikes}</div>
          <div style="font-size: 10px; color: var(--text-color); opacity: 0.7; font-weight: 600; text-transform: uppercase;">Likes</div>
        </div>
        
        <!-- Engagement -->
        <div style="text-align: center;">
          <div style="font-size: 18px; font-weight: 900; color: #f59e0b; margin-bottom: 2px;">${randomEngagement}</div>
          <div style="font-size: 10px; color: var(--text-color); opacity: 0.7; font-weight: 600; text-transform: uppercase;">Active</div>
        </div>
        
        <!-- Rating -->
        <div style="text-align: center;">
          <div style="font-size: 18px; font-weight: 900; color: #10b981; margin-bottom: 2px;">4.8</div>
          <div style="font-size: 10px; color: var(--text-color); opacity: 0.7; font-weight: 600; text-transform: uppercase;">Rating</div>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div style="display: flex; gap: 10px;">
        <!-- Like Button -->
        <button 
          class="modern-like-btn" 
          data-task-id="${task.id}"
          style="flex: 1; 
                 background: rgba(99,102,241,0.1); 
                 border: 2px solid rgba(99,102,241,0.2);
                 padding: 12px 16px; 
                 border-radius: 14px; 
                 font-size: 12px; 
                 font-weight: 800; 
                 color: var(--accent-color); 
                 cursor: pointer; 
                 transition: all 0.3s ease;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 gap: 6px;">
          <i class="fas fa-heart" style="font-size: 12px;"></i>
          <span>LIKE</span>
        </button>
        
        <!-- Start Button -->
        <button 
          class="modern-start-btn" 
          data-task-id="${task.id}"
          style="flex: 2; 
                 background: linear-gradient(135deg, #10b981, #059669); 
                 border: none; 
                 padding: 14px 20px; 
                 border-radius: 14px; 
                 font-size: 13px; 
                 font-weight: 800; 
                 color: white; 
                 cursor: pointer; 
                 transition: all 0.3s ease;
                 box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 gap: 8px;
                 text-transform: uppercase;
                 letter-spacing: 0.5px;">
          <i class="fas fa-rocket" style="font-size: 12px;"></i>
          <span>START TASK</span>
        </button>
      </div>
    </div>
  `;
  
  // Add premium hover effects
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-8px) scale(1.02)';
    card.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(99,102,241,0.1)';
  });
  
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0) scale(1)';
    card.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
  });
  
  // Add click event to entire card
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.modern-like-btn') && !e.target.closest('.modern-start-btn')) {
      redirectTo(`task-detail.html?id=${task.id}`);
    }
  });
  
  // Add like button functionality
  const likeBtn = card.querySelector('.modern-like-btn');
  likeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await handleTaskLike(task.id);
  });
  
  // Add start button functionality
  const startBtn = card.querySelector('.modern-start-btn');
  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    redirectTo(`task-detail.html?id=${task.id}`);
  });
  
  // Enhanced button hover effects
  likeBtn.addEventListener('mouseenter', () => {
    likeBtn.style.background = 'rgba(99,102,241,0.2)';
    likeBtn.style.borderColor = 'rgba(99,102,241,0.4)';
    likeBtn.style.transform = 'scale(1.05)';
  });
  
  likeBtn.addEventListener('mouseleave', () => {
    likeBtn.style.background = 'rgba(99,102,241,0.1)';
    likeBtn.style.borderColor = 'rgba(99,102,241,0.2)';
    likeBtn.style.transform = 'scale(1)';
  });
  
  startBtn.addEventListener('mouseenter', () => {
    startBtn.style.transform = 'scale(1.05)';
    startBtn.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.6)';
  });
  
  startBtn.addEventListener('mouseleave', () => {
    startBtn.style.transform = 'scale(1)';
    startBtn.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
  });
  
  return card;
}

// Get appropriate icon for task category
function getTaskIcon(category) {
  const iconMap = {
    'Social Media': 'share-alt',
    'YouTube': 'youtube',
    'App Install': 'mobile-alt',
    'Survey': 'clipboard-list',
    'Website Visit': 'globe'
  };
  return iconMap[category] || 'tasks';
}

// Handle task like/unlike
async function handleTaskLike(taskId) {
  try {
    const taskData = await getData(`TASKS/${taskId}`);
    const userLiked = taskData?.likesData?.[currentUser.uid] === true;
    
    if (userLiked) {
      const currentLikes = parseInt(taskData.likes) || 0;
      await setData(`TASKS/${taskId}/likes`, Math.max(0, currentLikes - 1));
      await setData(`TASKS/${taskId}/likesData/${currentUser.uid}`, false);
      showToast('Removed from favorites', 'info');
    } else {
      const currentLikes = parseInt(taskData.likes) || 0;
      await setData(`TASKS/${taskId}/likes`, currentLikes + 1);
      await setData(`TASKS/${taskId}/likesData/${currentUser.uid}`, true);
      showToast('Added to favorites! ❤️', 'success');
    }
    
    await loadTasks();
  } catch (error) {
    console.error('Like error:', error);
    showToast('Error updating like', 'error');
  }
}

// Show no tasks message
function showNoTasksMessage() {
  const tasksContainer = document.getElementById('tasksContainer');
  if (!tasksContainer) return;
  
  tasksContainer.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; color: var(--text-color);">
      <div style="width: 80px; height: 80px; background: var(--accent-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: white; font-size: 32px;">
        <i class="fas fa-tasks"></i>
      </div>
      <p style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">No Active Tasks</p>
      <p style="font-size: 14px; opacity: 0.7; max-width: 300px; margin: 0 auto;">New earning opportunities coming soon! Stay tuned.</p>
    </div>
  `;
}

// Setup menu interactions
function setupMenu() {
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

// Notification permission functions (same as before)
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
      
      await updateData(`USERS/${currentUser.uid}/notifications`, {
        enabled: true,
        permission: 'granted',
        enabledAt: Date.now()
      });
      
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

if ('Notification' in window && Notification.permission === 'granted') {
  updateNotificationUI('granted');
}

// PWA Install functionality (same as before)
let deferredPrompt;
const pwaInstallBanner = document.getElementById('pwaInstallBanner');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
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
