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

// Display pending tasks with modern design
function displayPendingTasks(tasks) {
  const container = document.getElementById('pendingContainer');
  if (!container) return;

  container.innerHTML = tasks.map(task => {
    let statusColor = getStatusColor(task.status);
    let statusIcon = 'fa-clock';
    let statusText = task.status;
    let statusBg = 'rgba(245, 158, 11, 0.15)';
    let statusBorder = 'rgba(245, 158, 11, 0.3)';
    
    if (task.status === 'approved') {
      statusIcon = 'fa-check-circle';
      statusText = 'Approved';
      statusBg = 'rgba(34, 197, 94, 0.15)';
      statusBorder = 'rgba(34, 197, 94, 0.4)';
    } else if (task.status === 'rejected') {
      statusIcon = 'fa-times-circle';
      statusText = 'Rejected';
      statusBg = 'rgba(239, 68, 68, 0.15)';
      statusBorder = 'rgba(239, 68, 68, 0.4)';
    } else {
      statusIcon = 'fa-hourglass-half';
      statusText = 'Under Review';
      statusBg = 'rgba(245, 158, 11, 0.15)';
      statusBorder = 'rgba(245, 158, 11, 0.4)';
    }
    
    return `
      <div style="
        position: relative;
        padding: 20px;
        background: var(--card-bg);
        backdrop-filter: blur(20px);
        border-radius: 18px;
        border: 1.5px solid ${statusBorder};
        margin-bottom: 18px;
        overflow: hidden;
        transition: all 0.3s ease;
      " class="pending-task-card">
        <!-- Status Indicator Strip -->
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          width: 5px;
          height: 100%;
          background: ${statusColor};
        "></div>
        
        <!-- Content -->
        <div style="padding-left: 10px;">
          <!-- Header Row -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; gap: 12px;">
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 17px; font-weight: 800; color: var(--text-color); margin-bottom: 6px; line-height: 1.3;">
                ${task.taskTitle || 'Task Submission'}
              </div>
              <div style="font-size: 12px; color: var(--text-color); opacity: 0.65; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="display: flex; align-items: center; gap: 4px;">
                  <i class="fas fa-calendar-alt" style="font-size: 10px;"></i>
                  ${formatDateTime(task.submittedAt)}
                </span>
                ${task.taskPrice ? `
                  <span style="display: flex; align-items: center; gap: 4px; font-weight: 700; color: #10b981;">
                    <i class="fas fa-coins"></i>
                    ₹${task.taskPrice}
                  </span>
                ` : ''}
              </div>
            </div>
            
            <!-- Status Badge -->
            <div style="
              padding: 10px 18px;
              background: ${statusBg};
              border: 1.5px solid ${statusBorder};
              border-radius: 20px;
              display: flex;
              align-items: center;
              gap: 8px;
              flex-shrink: 0;
            ">
              <i class="fas ${statusIcon}" style="font-size: 14px; color: ${statusColor};"></i>
              <span style="font-size: 12px; font-weight: 800; color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.5px;">
                ${statusText}
              </span>
            </div>
          </div>
          
          <!-- Admin Feedback Section -->
          ${task.adminFeedback ? `
            <div style="
              position: relative;
              padding: 16px;
              background: ${task.status === 'approved' ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))' : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))'};
              border-radius: 12px;
              border: 1.5px solid ${task.status === 'approved' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'};
              margin-top: 12px;
            ">
              <div style="display: flex; align-items: start; gap: 12px;">
                <div style="
                  width: 40px;
                  height: 40px;
                  border-radius: 50%;
                  background: ${task.status === 'approved' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  flex-shrink: 0;
                ">
                  <i class="fas fa-${task.status === 'approved' ? 'user-shield' : 'exclamation-triangle'}" style="font-size: 18px; color: ${task.status === 'approved' ? '#22c55e' : '#ef4444'};"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 11px; font-weight: 800; color: var(--text-color); opacity: 0.75; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ${task.status === 'approved' ? '✅ Admin Approved' : '⚠️ Admin Response'}
                  </div>
                  <div style="font-size: 15px; font-weight: 700; color: var(--text-color); line-height: 1.5;">
                    ${task.adminFeedback}
                  </div>
                </div>
              </div>
            </div>
          ` : `
            <div style="
              padding: 14px;
              background: rgba(245, 158, 11, 0.1);
              border-radius: 10px;
              border: 1px dashed rgba(245, 158, 11, 0.3);
              text-align: center;
            ">
              <i class="fas fa-hourglass-half" style="font-size: 16px; color: #f59e0b; margin-right: 8px;"></i>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-color); opacity: 0.8;">
                Your submission is being reviewed by admin...
              </span>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
  
  // Add hover effects
  setTimeout(() => {
    document.querySelectorAll('.pending-task-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-6px) scale(1.01)';
        card.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.12)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0) scale(1)';
        card.style.boxShadow = 'none';
      });
    });
  }, 100);
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