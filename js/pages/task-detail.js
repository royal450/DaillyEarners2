
// Task Detail Page Logic
import { auth } from '../shared/firebase-config.js';
import { getData, pushData, updateData, getServerTimestamp, runDbTransaction, setData } from '../shared/db.js';
import { formatCurrency, showToast, showConfirm, getQueryParam, redirectTo, showLoading, hideLoading } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';
import { notifyTaskSubmission } from '../shared/notifications.js';

let currentUser = null;
let currentTask = null;
let taskId = null;

// Helper function to update user balance
async function updateBalance(userId, amount, description) {
  await runDbTransaction(`USERS/${userId}/balance`, (current) => (current || 0) + amount);
  await pushData(`USERS/${userId}/transactions`, {
    amount,
    description,
    timestamp: getServerTimestamp()
  });
}

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  taskId = getQueryParam('id');
  const referralCode = getQueryParam('ref');

  if (!taskId) {
    showToast('Invalid task ID', 'error');
    redirectTo('dashboard.html');
    return;
  }

  // Initialize auth guard, and if authenticated, load task details
  // If not authenticated, check for referral code and show signup form
  currentUser = await initAuthGuard(onUserAuthenticated, onUserNotAuthenticated);

  // If user is not authenticated and a referral code is present, populate signup form
  if (!currentUser && referralCode) {
    document.getElementById('referralCodeInput').value = referralCode;
    document.getElementById('referralCodeInput').disabled = true;
    document.getElementById('referralCodeField').style.display = 'block'; // Make referral code field visible
    document.getElementById('referralBonusMessage').style.display = 'block'; // Show bonus message
    document.getElementById('signupForm').style.display = 'block'; // Show signup form
    document.getElementById('loginForm').style.display = 'none'; // Hide login form
    document.getElementById('taskDetailContainer').style.display = 'none'; // Hide task details until logged in
    document.getElementById('authContainer').style.display = 'block'; // Show auth container

    // Set signup bonus message
    document.getElementById('signupBonusText').textContent = 'Yeah! You got 5rs instantly';

    // Add event listener for signup form submission
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
  } else if (!currentUser) {
    // If not authenticated and no referral code, show login form
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('taskDetailContainer').style.display = 'none';
    document.getElementById('authContainer').style.display = 'block';
  }
});

async function onUserAuthenticated(user) {
  currentUser = user;
  document.getElementById('authContainer').style.display = 'none';
  document.getElementById('taskDetailContainer').style.display = 'block';
  document.body.style.visibility = 'visible';

  await loadTaskDetails();
  setupTaskActions();
}

function onUserNotAuthenticated() {
  document.getElementById('authContainer').style.display = 'block';
  document.getElementById('taskDetailContainer').style.display = 'none';
  document.body.style.visibility = 'visible';
}

// Handle signup form submission
async function handleSignup(event) {
  event.preventDefault();
  showToast('Please use the signup page to create an account', 'info');
  setTimeout(() => {
    window.location.href = 'index.html?ref=' + (document.getElementById('referralCodeInput').value || '');
  }, 1500);
}

// Load task details
async function loadTaskDetails() {
  try {
    // Show loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'pageLoadingOverlay';
    loadingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    loadingOverlay.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 15px; text-align: center;">
        <i class="fas fa-spinner fa-spin" style="font-size: 40px; color: #6366f1; margin-bottom: 15px;"></i>
        <div style="font-size: 16px; font-weight: 600; color: #1f2937;">Loading task details...</div>
      </div>
    `;
    document.body.appendChild(loadingOverlay);

    console.log('Fetching task:', taskId);
    currentTask = await getData(`TASKS/${taskId}`);
    console.log('Task data:', currentTask);

    // Remove loading overlay
    if (loadingOverlay && loadingOverlay.parentNode) {
      loadingOverlay.remove();
    }

    if (!currentTask) {
      showToast('Task not found', 'error');
      setTimeout(() => redirectTo('dashboard.html'), 1500);
      return;
    }

    if (currentTask.status !== 'active') {
      showToast('This task is no longer active', 'warning');
      setTimeout(() => redirectTo('dashboard.html'), 1500);
      return;
    }

    // Display task details
    displayTaskDetails();
    
    // Check task status
    await checkTaskStatus();

  } catch (error) {
    console.error('Error loading task:', error);
    
    // Remove loading overlay on error
    const loadingOverlay = document.getElementById('pageLoadingOverlay');
    if (loadingOverlay && loadingOverlay.parentNode) {
      loadingOverlay.remove();
    }
    
    showToast('Failed to load task details. Please try again.', 'error');
    setTimeout(() => redirectTo('dashboard.html'), 1500);
  }
}

// Display task details
function displayTaskDetails() {
  // Hide any loading states
  const loadingElements = document.querySelectorAll('.loading-text, .loading-placeholder');
  loadingElements.forEach(el => {
    el.style.display = 'none';
  });

  // Show task reward (price)
  const taskRewardElement = document.getElementById('taskReward');
  if (taskRewardElement) {
    taskRewardElement.textContent = formatCurrency(currentTask.price || 0);
    taskRewardElement.style.display = 'block';
  }

  // Show task title
  const taskTitleElement = document.getElementById('taskTitle');
  if (taskTitleElement) {
    taskTitleElement.textContent = currentTask.title || 'Task';
    taskTitleElement.style.display = 'block';
  }

  // Show task description
  const taskDescElement = document.getElementById('taskDescription');
  if (taskDescElement) {
    taskDescElement.textContent = currentTask.description || 'Complete this task to earn rewards!';
    taskDescElement.style.display = 'block';
  }

  // Display steps
  const stepsContainer = document.getElementById('stepsContainer');
  if (stepsContainer) {
    if (currentTask.steps && Array.isArray(currentTask.steps) && currentTask.steps.length > 0) {
      stepsContainer.innerHTML = currentTask.steps.map((step, index) => `
        <div class="step-item">
          <div class="step-number">${index + 1}</div>
          <div class="step-content">
            <div class="step-text">${step}</div>
          </div>
        </div>
      `).join('');
    } else {
      stepsContainer.innerHTML = `
        <div class="step-item">
          <div class="step-number">1</div>
          <div class="step-content">
            <div class="step-text">Click "Visit Task" button to open the task link</div>
          </div>
        </div>
        <div class="step-item">
          <div class="step-number">2</div>
          <div class="step-content">
            <div class="step-text">Complete all the required actions on the website</div>
          </div>
        </div>
        <div class="step-item">
          <div class="step-number">3</div>
          <div class="step-content">
            <div class="step-text">Return here and click "Submit Task" button for review</div>
          </div>
        </div>
      `;
    }
    stepsContainer.style.display = 'block';
  }

  // Display instructions
  const instructionElement = document.getElementById('taskInstruction');
  if (instructionElement) {
    if (currentTask.instructions) {
      instructionElement.textContent = currentTask.instructions;
    } else {
      instructionElement.textContent = '⚠️ Complete all steps honestly. Fake submissions will be rejected and may result in account suspension.';
    }
    instructionElement.style.display = 'block';
  }

  // Display timer warning if exists
  const timerWarning = document.getElementById('timerWarning');
  const timerSeconds = document.getElementById('timerSeconds');
  if (currentTask.timeLimit && timerWarning && timerSeconds) {
    timerWarning.style.display = 'flex';
    timerSeconds.textContent = currentTask.timeLimit;
  } else if (timerWarning) {
    timerWarning.style.display = 'none';
  }
}

// Check task status for current user
async function checkTaskStatus() {
  try {
    const completedTasks = currentTask.completedBy || [];

    // Check if already completed
    if (completedTasks.includes(currentUser.uid)) {
      showCompletedStatus();
      return;
    }

    // Check if pending
    const allPendingTasks = await getData('PENDING_TASKS');
    if (allPendingTasks) {
      const userPending = Object.entries(allPendingTasks).find(
        ([_, submission]) => submission.userId === currentUser.uid && submission.taskId === taskId && submission.status === 'pending'
      );

      if (userPending) {
        showPendingStatus();
        return;
      }
    }

    // Task available
    showAvailableStatus();
  } catch (error) {
    console.error('Error checking task status:', error);
    showAvailableStatus();
  }
}

// Show completed status
function showCompletedStatus() {
  const submitBtn = document.getElementById('submitBtn');
  const visitBtn = document.getElementById('visitBtn');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Task Completed</span>';
    submitBtn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
  }

  if (visitBtn) {
    visitBtn.disabled = true;
    visitBtn.style.opacity = '0.5';
  }
}

// Show pending status
function showPendingStatus() {
  const submitBtn = document.getElementById('submitBtn');
  const visitBtn = document.getElementById('visitBtn');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-clock"></i><span>Under Review</span>';
    submitBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
  }

  if (visitBtn) {
    visitBtn.disabled = true;
    visitBtn.style.opacity = '0.5';
  }
}

// Show available status
function showAvailableStatus() {
  const submitBtn = document.getElementById('submitBtn');
  const visitBtn = document.getElementById('visitBtn');

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i><span>Submit Task</span>';
  }

  if (visitBtn) {
    visitBtn.disabled = false;
    visitBtn.style.opacity = '1';
  }
}

// Setup task actions
function setupTaskActions() {
  const visitBtn = document.getElementById('visitBtn');
  const submitBtn = document.getElementById('submitBtn');

  if (visitBtn) {
    visitBtn.addEventListener('click', handleVisitTask);
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', handleTaskSubmission);
  }
}

// Handle visit task - redirect to task URL
function handleVisitTask() {
  if (!currentTask.url) {
    showToast('Task URL not available', 'error');
    return;
  }

  // Open task URL in new tab
  window.open(currentTask.url, '_blank');
  showToast('Complete the task and return to submit', 'info');
}

// Handle task submission
async function handleTaskSubmission() {
  const submitBtn = document.getElementById('submitBtn');

  const confirmed = await showConfirm(
    'Submit Task for Review',
    'Have you completed all the steps? Your submission will be reviewed by admin.',
    'Yes, Submit',
    'Cancel'
  );

  if (!confirmed) return;

  const originalHTML = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Submitting...</span>';

  try {
    // Create submission
    await pushData('PENDING_TASKS', {
      userId: currentUser.uid,
      taskId,
      taskTitle: currentTask.title,
      taskPrice: currentTask.price,
      status: 'pending',
      submittedAt: getServerTimestamp()
    });

    // Update user's pending task count only
    await runDbTransaction(`USERS/${currentUser.uid}/taskHistory/pending`, (current) => (current || 0) + 1);

    // Check if this is user's first task submission and give referrer bonus
    const userData = await getData(`USERS/${currentUser.uid}`);
    const pendingTasks = userData?.taskHistory?.pending || 0;
    const completedTasks = userData?.taskHistory?.completed || 0;
    const totalTasks = pendingTasks + completedTasks;
    const referrerId = userData?.personalInfo?.referrerId;
    const hasReceivedFirstTaskBonus = userData?.personalInfo?.hasReceivedFirstTaskBonus;

    if (totalTasks === 1 && referrerId && !hasReceivedFirstTaskBonus) {
      // Give ₹10 first task completion bonus to referrer (only once)
      await updateBalance(referrerId, 10, 'Referral first task completion bonus');
      await runDbTransaction(`USERS/${referrerId}/referrals/earnings`, (current) => (current || 0) + 10);

      // Mark that first task bonus has been given
      await setData(`USERS/${currentUser.uid}/personalInfo/hasReceivedFirstTaskBonus`, true);
    }

    // Send notification to admin
    const userName = userData.personalInfo?.name || 'User';
    const userEmail = userData.personalInfo?.email || 'N/A';

    await notifyTaskSubmission(userName, userEmail, currentTask.title, taskId);

    showToast('✅ Task submitted! Wait for admin approval.', 'success');

    // Reload status
    await checkTaskStatus();

  } catch (error) {
    console.error('Submission error:', error);
    showToast('❌ Error submitting task. Please try again.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHTML;
  }
}
