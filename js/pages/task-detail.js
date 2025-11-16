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

    // Update user task history
    await runDbTransaction(`USERS/${currentUser.uid}/taskHistory/pending`, (current) => {
      return (current || 0) + 1;
    });

    // Send notification to admin
    const userData = await getData(`USERS/${currentUser.uid}`);
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