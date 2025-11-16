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
  checkTaskStatus();
}

// Display task details
function displayTaskDetails() {
  const taskTitle = document.getElementById('taskTitle');
  const taskPrice = document.getElementById('taskPrice');
  const taskDescription = document.getElementById('taskDescription');
  const taskThumbnail = document.getElementById('taskThumbnail');
  const taskInstructions = document.getElementById('taskInstructions');
  const taskLikes = document.getElementById('taskLikes');

  if (taskTitle) {
    taskTitle.textContent = currentTask.title || 'Task';
  }

  if (taskPrice) {
    taskPrice.textContent = formatCurrency(currentTask.price || 0);
  }

  if (taskDescription) {
    taskDescription.textContent = currentTask.description || '';
  }

  if (taskThumbnail && currentTask.thumbnail) {
    taskThumbnail.src = currentTask.thumbnail;
    taskThumbnail.style.display = 'block';
  }

  if (taskInstructions && currentTask.instructions) {
    if (Array.isArray(currentTask.instructions)) {
      taskInstructions.innerHTML = currentTask.instructions.map((inst, i) => `
        <div style="display: flex; gap: 12px; margin-bottom: 16px; padding: 16px; background: var(--icon-bg); border-radius: 12px; border: 1px solid var(--border-color);">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-gradient); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">${i + 1}</div>
          <div style="flex: 1; line-height: 1.6; color: var(--text-color);">${inst}</div>
        </div>
      `).join('');
    } else {
      taskInstructions.textContent = currentTask.instructions;
    }
  }

  if (taskLikes) {
    taskLikes.textContent = currentTask.likes || 0;
  }
}

// Check task status for current user
async function checkTaskStatus() {
  const userData = await getData(`USERS/${currentUser.uid}`);
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
  const visitBtn = document.getElementById('visitTaskBtn');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Task Completed';
    submitBtn.style.background = '#22c55e';
  }

  if (visitBtn) {
    visitBtn.disabled = true;
  }
}

// Show pending status
function showPendingStatus() {
  const submitBtn = document.getElementById('submitTaskBtn');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-clock"></i> Under Review';
    submitBtn.style.background = '#f59e0b';
  }
}

// Show available status
function showAvailableStatus() {
  const submitBtn = document.getElementById('submitTaskBtn');
  const visitBtn = document.getElementById('visitTaskBtn');

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit for Review';
  }

  if (visitBtn) {
    visitBtn.disabled = false;
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
    // Check if already liked
    const userData = await getData(`USERS/${currentUser.uid}`);
    const likedTasks = userData.likedTasks || [];

    if (likedTasks.includes(taskId)) {
      showToast('You already liked this task', 'info');
      return;
    }

    // Add like
    await runDbTransaction(`TASKS/${taskId}/likes`, (current) => {
      return (current || 0) + 1;
    });

    // Update user liked tasks
    likedTasks.push(taskId);
    await updateData(`USERS/${currentUser.uid}`, { likedTasks });

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