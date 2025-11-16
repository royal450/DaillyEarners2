// Pending Tasks Page Logic
import { auth } from '../shared/firebase-config.js';
import { getData } from '../shared/db.js';
import { formatCurrency, formatDateTime } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';

let currentUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  currentUser = await initAuthGuard(onUserAuthenticated);
});

async function onUserAuthenticated(user) {
  currentUser = user;
  document.body.style.visibility = 'visible';

  await loadPendingTasks();
  await initThemeToggle(); // Initialize theme toggle
}

// Load pending tasks
async function loadPendingTasks() {
  const allPendingTasks = await getData('PENDING_TASKS');

  if (!allPendingTasks) {
    showNoPendingTasks();
    return;
  }

  // Filter user's pending tasks
  const userPendingTasks = Object.entries(allPendingTasks)
    .filter(([_, task]) => task.userId === currentUser.uid)
    .map(([id, task]) => ({ id, ...task }))
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));

  if (userPendingTasks.length === 0) {
    showNoPendingTasks();
    return;
  }

  displayPendingTasks(userPendingTasks);
}

// Display pending tasks
function displayPendingTasks(tasks) {
  const container = document.getElementById('pendingContainer');
  if (!container) return;

  container.innerHTML = tasks.map(task => `
    <div style="padding: 16px; background: var(--card-bg); border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div style="flex: 1;">
          <div style="font-size: 15px; font-weight: 700; color: var(--text-color); margin-bottom: 4px;">${task.taskTitle || 'Task'}</div>
          <div style="font-size: 12px; color: var(--text-color); opacity: 0.7;">
            <i class="fas fa-clock"></i> ${formatDateTime(task.submittedAt)}
          </div>
        </div>
        <div style="padding: 4px 12px; border-radius: 12px; background: ${getStatusColor(task.status)}; color: white; font-size: 11px; font-weight: 600;">
          ${task.status.toUpperCase()}
        </div>
      </div>
      ${task.adminFeedback ? `
        <div style="padding: 12px; background: ${task.status === 'approved' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; border-radius: 8px; border: 1px solid ${task.status === 'approved' ? '#22c55e' : '#ef4444'}; margin-top: 8px;">
          <div style="font-size: 11px; font-weight: 600; color: var(--text-color); opacity: 0.7; margin-bottom: 4px;">Admin Feedback:</div>
          <div style="font-size: 13px; color: var(--text-color);">${task.adminFeedback}</div>
        </div>
      ` : ''}
    </div>
  `).join('');
}

// Get status color
function getStatusColor(status) {
  switch(status) {
    case 'approved': return '#22c55e';
    case 'rejected': return '#ef4444';
    default: return '#f59e0b';
  }
}

// Show no pending tasks message
function showNoPendingTasks() {
  const container = document.getElementById('pendingContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--text-color); opacity: 0.5;">
      <i class="fas fa-clock" style="font-size: 48px; margin-bottom: 16px;"></i>
      <p>No pending tasks</p>
      <p style="font-size: 13px; margin-top: 8px;">Complete tasks to see them here!</p>
    </div>
  `;
}

// Theme Toggle Initialization
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