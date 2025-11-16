// Task Detail Page Logic
import { auth } from '../shared/firebase-config.js';
import { getData, pushData, updateData, getServerTimestamp, runDbTransaction } from '../shared/db.js';
import { formatCurrency, showToast, showConfirm, getQueryParam, redirectTo, showLoading, hideLoading } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';
import { notifyTaskSubmission } from '../shared/notifications.js';

let currentUser = null;
let currentTask = null;
let taskId = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  taskId = getQueryParam('id');

  if (!taskId) {
    showToast('Invalid task ID', 'error');
    redirectTo('dashboard.html');
    return;
  }

  currentUser = await initAuthGuard(onUserAuthenticated);
});

async function onUserAuthenticated(user) {
  currentUser = user;
  document.body.style.visibility = 'visible';

  await loadTaskDetails();
  setupTaskActions();
}

// Load task details
async function loadTaskDetails() {
  currentTask = await getData(`TASKS/${taskId}`);

  if (!currentTask) {
    showToast('Task not found', 'error');
    redirectTo('dashboard.html');
    return;
  }

  displayTaskDetails();
  await checkTaskStatus();
}

// Display task details
function displayTaskDetails() {
  document.getElementById('taskTitle').textContent = currentTask.title || 'Task';
  document.getElementById('taskReward').textContent = formatCurrency(currentTask.price || 0); // Use formatCurrency for price
  document.getElementById('taskDescription').textContent = currentTask.description || '';

  // Display steps
  const stepsContainer = document.getElementById('stepsContainer');
  if (currentTask.steps && Array.isArray(currentTask.steps)) {
    stepsContainer.innerHTML = currentTask.steps.map((step, index) => `
      <div class="step-item">
        <div class="step-number">${index + 1}</div>
        <div class="step-content">
          <div class="step-text">${step}</div>
        </div>
      </div>
    `).join('');
  } else {
    // Fallback steps if none are provided
    stepsContainer.innerHTML = `
      <div class="step-item">
        <div class="step-number">1</div>
        <div class="step-content">
          <div class="step-text">Visit the task link and complete the required action</div>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number">2</div>
        <div class="step-content">
          <div class="step-text">Take screenshot as proof (if required)</div>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number">3</div>
        <div class="step-content">
          <div class="step-text">Click Submit Task button below</div>
        </div>
      </div>
    `;
  }

  // Display instructions
  const instructionElement = document.getElementById('taskInstruction');
  if (currentTask.instructions) {
    instructionElement.textContent = currentTask.instructions;
  } else {
    instructionElement.textContent = 'Complete all steps honestly. Fake submissions will be rejected and may result in account suspension.';
  }

  // Display timer warning if exists
  if (currentTask.timeLimit) {
    const timerWarning = document.getElementById('timerWarning');
    const timerSeconds = document.getElementById('timerSeconds');
    timerWarning.style.display = 'flex';
    timerSeconds.textContent = currentTask.timeLimit;
  } else {
    // Hide timer warning if no time limit
    const timerWarning = document.getElementById('timerWarning');
    if (timerWarning) timerWarning.style.display = 'none';
  }

  // Update likes count if element exists
  const taskLikes = document.getElementById('taskLikes');
  if (taskLikes) {
    taskLikes.textContent = currentTask.likes || 0;
  }

  // Show/hide thumbnail if it exists
  const taskThumbnail = document.getElementById('taskThumbnail');
  if (taskThumbnail) {
    if (currentTask.thumbnail) {
      taskThumbnail.src = currentTask.thumbnail;
      taskThumbnail.style.display = 'block';
    } else {
      taskThumbnail.style.display = 'none';
    }
  }
}

// Check task status for current user
async function checkTaskStatus() {
  const userData = await getData(`USERS/${currentUser.uid}`); // Fetch user data for more checks if needed
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
  const submitBtn = document.getElementById('submitTaskBtn');
  const visitBtn = document.getElementById('visitTaskBtn'); // Assuming visitBtn exists
  const likeBtn = document.getElementById('likeTaskBtn'); // Assuming likeBtn exists

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Task Completed';
    submitBtn.style.background = '#22c55e';
  }

  if (visitBtn) {
    visitBtn.disabled = true;
  }

  if (likeBtn) {
    likeBtn.disabled = true; // Disable like button if task is completed
  }
}

// Show pending status
function showPendingStatus() {
  const submitBtn = document.getElementById('submitTaskBtn');
  const visitBtn = document.getElementById('visitTaskBtn'); // Assuming visitBtn exists

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-clock"></i> Under Review';
    submitBtn.style.background = '#f59e0b';
  }

  if (visitBtn) {
    visitBtn.disabled = true; // Disable visit button while under review
  }
}

// Show available status
function showAvailableStatus() {
  const submitBtn = document.getElementById('submitTaskBtn');
  const visitBtn = document.getElementById('visitTaskBtn'); // Assuming visitBtn exists
  const likeBtn = document.getElementById('likeTaskBtn'); // Assuming likeBtn exists

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit for Review';
  }

  if (visitBtn) {
    visitBtn.disabled = false;
  }

  // Check if user has already liked the task to set like button state
  if (currentUser && currentTask && currentTask.likesData && currentTask.likesData[currentUser.uid]) {
    if (likeBtn) {
      likeBtn.disabled = true;
      likeBtn.innerHTML = '<i class="fas fa-heart"></i> Liked';
    }
  } else if (likeBtn) {
    likeBtn.disabled = false;
    likeBtn.innerHTML = '<i class="far fa-heart"></i> Like';
  }
}

// Setup task actions
function setupTaskActions() {
  const visitBtn = document.getElementById('visitTaskBtn');
  const submitBtn = document.getElementById('submitTaskBtn');
  const likeBtn = document.getElementById('likeTaskBtn');

  if (visitBtn) {
    visitBtn.addEventListener('click', () => {
      if (currentTask.url) {
        window.open(currentTask.url, '_blank');
      } else {
        showToast('Task link not available', 'error');
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', handleTaskSubmission);
  }

  if (likeBtn) {
    likeBtn.addEventListener('click', handleTaskLike);
  }
}

// Handle task submission
async function handleTaskSubmission() {
  const submitBtn = document.getElementById('submitTaskBtn');

  const confirmed = await showConfirm(
    'Submit Task',
    'Have you completed all the steps? Your submission will be reviewed by admin.',
    'Submit',
    'Cancel'
  );

  if (!confirmed) return;

  showLoading(submitBtn, 'Submitting...');

  try {
    // Create submission
    await pushData('PENDING_TASKS', {
      userId: currentUser.uid,
      taskId,
      taskTitle: currentTask.title,
      taskPrice: currentTask.price, // Include price in submission data if relevant
      status: 'pending',
      submittedAt: getServerTimestamp()
    });

    // Update user task history
    await runDbTransaction(`USERS/${currentUser.uid}/taskHistory/pending`, (current) => {
      return (current || 0) + 1;
    });

    // Send notification
    const userData = await getData(`USERS/${currentUser.uid}`);
    const userName = userData.personalInfo?.name || 'User';
    const userEmail = userData.personalInfo?.email || '';
    await notifyTaskSubmission(userName, userEmail, currentTask.title, taskId);

    showToast('Task submitted successfully! Wait for admin approval.', 'success');

    // Reload status
    await checkTaskStatus();

  } catch (error) {
    console.error('Submission error:', error);
    showToast('Error submitting task', 'error');
  } finally {
    hideLoading(submitBtn);
  }
}

// Handle task like
async function handleTaskLike() {
  const likeBtn = document.getElementById('likeTaskBtn');

  try {
    // Check if already liked using a more robust method if available
    // Assuming currentTask.likesData is an object where keys are user IDs
    if (currentTask.likesData && currentTask.likesData[currentUser.uid]) {
      showToast('You already liked this task', 'info');
      return;
    }

    // Add like to task
    await runDbTransaction(`TASKS/${taskId}/likes`, (current) => {
      return (current || 0) + 1;
    });

    // Update task likes data with user ID
    const likesDataUpdate = {};
    likesDataUpdate[currentUser.uid] = true; // Mark as liked
    await updateData(`TASKS/${taskId}/likesData`, likesDataUpdate);


    showToast('Task liked!', 'success');

    // Update UI
    const taskLikes = document.getElementById('taskLikes');
    if (taskLikes) {
      taskLikes.textContent = parseInt(taskLikes.textContent) + 1;
    }

    if (likeBtn) {
      likeBtn.disabled = true;
      likeBtn.innerHTML = '<i class="fas fa-heart"></i> Liked';
    }

  } catch (error) {
    console.error('Like error:', error);
    showToast('Error liking task', 'error');
  }
}