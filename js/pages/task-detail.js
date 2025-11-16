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

  // Check if the user has a referral code from the URL and apply it
  const referralCodeFromUrl = getQueryParam('ref');
  if (referralCodeFromUrl) {
    const referrerData = await getData(`USERS_BY_REFERRAL_CODE/${referralCodeFromUrl}`);
    if (referrerData && referrerData.userId) {
      await runDbTransaction(`USERS/${currentUser.uid}/personalInfo`, (current) => {
        return {
          ...(current || {}),
          referrerId: referrerData.userId,
          hasReceivedSignupBonus: false // Initialize signup bonus status
        };
      });
      // Apply signup bonus
      await updateBalance(currentUser.uid, 5, 'Signup bonus');
      await setData(`USERS/${currentUser.uid}/personalInfo/hasReceivedSignupBonus`, true);
      showToast('Yeah! You got 5rs instantly', 'success');
    }
  }
}

function onUserNotAuthenticated() {
  document.getElementById('authContainer').style.display = 'block';
  document.getElementById('taskDetailContainer').style.display = 'none';
  document.body.style.visibility = 'visible';
}

// Handle signup form submission
async function handleSignup(event) {
  event.preventDefault();
  showLoading('Creating account...');

  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const referralCodeInput = document.getElementById('referralCodeInput');
  const referralCode = referralCodeInput.value;

  try {
    // Attempt to create user with email and password
    const newUserCredential = await auth.createUserWithEmailAndPassword(email, password);
    const newUser = newUserCredential.user;

    // Get referrer's userId if referral code is provided
    let referrerUserId = null;
    if (referralCode) {
      const referrerData = await getData(`USERS_BY_REFERRAL_CODE/${referralCode}`);
      if (referrerData && referrerData.userId) {
        referrerUserId = referrerData.userId;
      } else {
        throw new Error('Invalid referral code.');
      }
    }

    // Create user profile in database
    await pushData('USERS', {
      uid: newUser.uid,
      email: newUser.email,
      createdAt: getServerTimestamp(),
      balance: 5, // Signup bonus
      personalInfo: {
        name: email.split('@')[0], // Default name
        referrerId: referrerUserId,
        hasReceivedSignupBonus: true,
        hasReceivedFirstTaskBonus: false // Initialize first task bonus status
      },
      referralCode: generateReferralCode(), // Generate unique referral code for the new user
      taskHistory: {
        pending: 0,
        completed: 0
      },
      transactions: [{
        amount: 5,
        description: 'Signup bonus',
        timestamp: getServerTimestamp()
      }]
    });

    // Update user's referral code lookup
    await setData(`USERS_BY_REFERRAL_CODE/${await getReferralCodeForUser(newUser.uid)}`, { userId: newUser.uid });


    // If referrer exists, update their referral count and earnings
    if (referrerUserId) {
      await runDbTransaction(`USERS/${referrerUserId}/referrals/count`, (current) => (current || 0) + 1);
      await runDbTransaction(`USERS/${referrerUserId}/referrals/earnings`, (current) => (current || 0) + 5); // Signup bonus for referrer
    }

    showToast('✅ Account created successfully! You got 5rs instantly.', 'success');
    hideLoading();
    // Automatically log in the user
    await auth.signInWithEmailAndPassword(email, password);
    currentUser = auth.currentUser;
    onUserAuthenticated(currentUser); // Manually call authenticated handler

  } catch (error) {
    console.error('Signup error:', error);
    showToast(`❌ ${error.message}`, 'error');
    hideLoading();
  }
}

// Generate a unique referral code for a user
function generateReferralCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

// Get referral code for a user (assuming it's stored in the user's profile)
async function getReferralCodeForUser(userId) {
  const userData = await getData(`USERS/${userId}`);
  return userData?.referralCode;
}

// Load task details
async function loadTaskDetails() {
  currentTask = await getData(`TASKS/${taskId}`);

  if (!currentTask) {
    showToast('Task not found', 'error');
    redirectTo('dashboard.html');
    return;
  }

  if (currentTask.status !== 'active') {
    showToast('This task is no longer active', 'warning');
    redirectTo('dashboard.html');
    return;
  }

  displayTaskDetails();
  await checkTaskStatus();
}

// Display task details
function displayTaskDetails() {
  document.getElementById('taskTitle').textContent = currentTask.title || 'Task';
  document.getElementById('taskReward').textContent = currentTask.price || 0;
  document.getElementById('taskDescription').textContent = currentTask.description || '';

  // Display steps
  const stepsContainer = document.getElementById('stepsContainer');
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

  // Display instructions
  const instructionElement = document.getElementById('taskInstruction');
  if (currentTask.instructions) {
    instructionElement.textContent = currentTask.instructions;
  } else {
    instructionElement.textContent = '⚠️ Complete all steps honestly. Fake submissions will be rejected and may result in account suspension.';
  }

  // Display timer warning if exists
  if (currentTask.timeLimit) {
    const timerWarning = document.getElementById('timerWarning');
    const timerSeconds = document.getElementById('timerSeconds');
    timerWarning.style.display = 'flex';
    timerSeconds.textContent = currentTask.timeLimit;
  } else {
    // Hide timer warning if no time limit and element exists
    const timerWarning = document.getElementById('timerWarning');
    if (timerWarning) timerWarning.style.display = 'none';
  }
}

// Check task status for current user
async function checkTaskStatus() {
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

    // Update user's task history
    await runDbTransaction(`USERS/${currentUser.uid}/taskHistory/pending`, (current) => Math.max((current || 0) - 1, 0));
    await runDbTransaction(`USERS/${currentUser.uid}/taskHistory/completed`, (current) => (current || 0) + 1);

    // Check if this is user's first completed task and give referrer bonus
    const userData = await getData(`USERS/${currentUser.uid}`);
    const completedTasks = userData?.taskHistory?.completed || 0;
    const referrerId = userData?.personalInfo?.referrerId;
    const hasReceivedFirstTaskBonus = userData?.personalInfo?.hasReceivedFirstTaskBonus;

    if (completedTasks === 1 && referrerId && !hasReceivedFirstTaskBonus) {
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