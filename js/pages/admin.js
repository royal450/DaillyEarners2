
// Admin Panel Logic with Firebase UID-based Authentication
import { auth } from '../shared/firebase-config.js';
import { getData, setData, updateData, deleteData, pushData, updateBalance, runDbTransaction, getServerTimestamp } from '../shared/db.js';
import { formatCurrency, formatDate, formatDateTime, showToast, showConfirm, showLoading, hideLoading, generateId } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';
import { notifyAdminAction } from '../shared/notifications.js';

let currentUser = null;
let currentView = 'users';

// Password-based admin authentication
const ADMIN_PASSWORD = '848592';  // Admin panel password

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  await checkAdminAccess();
});

async function checkAdminAccess() {
  // Wait for Firebase Auth to initialize
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe();
      
      if (!user) {
        // User not logged in
        await Swal.fire({
          icon: 'error',
          title: 'Authentication Required',
          text: 'Please sign in first to access the admin panel',
          confirmButtonColor: '#6366f1'
        });
        window.location.href = 'index.html';
        resolve(false);
        return;
      }
      
      // Show password prompt for admin access
      const result = await Swal.fire({
        title: 'Admin Login',
        html: '<input type="password" id="adminPassword" class="swal2-input" placeholder="Enter Admin Password" autocomplete="off">',
        confirmButtonText: 'Login',
        confirmButtonColor: '#6366f1',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        preConfirm: () => {
          const password = document.getElementById('adminPassword').value;
          if (!password) {
            Swal.showValidationMessage('Password is required');
            return false;
          }
          if (password !== ADMIN_PASSWORD) {
            Swal.showValidationMessage('Incorrect password');
            return false;
          }
          return true;
        }
      });

      if (result.isConfirmed) {
        currentUser = user;
        document.body.style.visibility = 'visible';
        await initAdminPanel();
        resolve(true);
      } else {
        window.location.href = 'dashboard.html';
        resolve(false);
      }
    });
  });
}

async function initAdminPanel() {
  await setupThemeToggle();
  setupNavigation();
  loadView('users');
}

async function setupThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const icon = themeToggle?.querySelector('i');
  
  // Load theme immediately
  const savedTheme = localStorage.getItem('cashbyking_theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  document.body.style.visibility = 'visible';
  
  if (icon) {
    icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.body.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', newTheme);
      localStorage.setItem('cashbyking_theme', newTheme);
      if (icon) {
        icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
      }
    });
  }
}

function setupNavigation() {
  const tabs = document.querySelectorAll('.tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.tab;
      loadView(view);
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(view).classList.add('active');
    });
  });
}

async function loadView(view) {
  currentView = view;
  
  switch(view) {
    case 'users':
      await loadUsersView();
      break;
    case 'tasks':
      await loadTasksView();
      break;
    case 'pending':
      await loadPendingTasksView();
      break;
    case 'withdrawals':
      await loadWithdrawalsView();
      break;
    case 'transactions':
      await loadTransactionsView();
      break;
    case 'pwa':
      await loadPWAView();
      break;
  }
}

async function loadUsersView() {
  const allUsers = await getData('USERS');
  const container = document.getElementById('usersContainer');
  const analyticsContainer = document.getElementById('analyticsContainer');
  
  if (!allUsers) {
    container.innerHTML = '<p>No users found</p>';
    return;
  }
  
  const users = Object.entries(allUsers).map(([uid, data]) => ({ uid, ...data }));
  
  // Analytics
  const totalUsers = users.length;
  const verifiedUsers = users.filter(u => u.personalInfo?.verified).length;
  const totalBalance = users.reduce((sum, u) => sum + (u.financialInfo?.balance || 0), 0);
  const totalEarned = users.reduce((sum, u) => sum + (u.financialInfo?.totalEarned || 0), 0);
  
  analyticsContainer.innerHTML = `
    <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 12px;">
      <div style="font-size: 32px; font-weight: 800; margin-bottom: 5px;">${totalUsers}</div>
      <div style="font-size: 14px; opacity: 0.9;">Total Users</div>
    </div>
    <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 12px;">
      <div style="font-size: 32px; font-weight: 800; margin-bottom: 5px;">${verifiedUsers}</div>
      <div style="font-size: 14px; opacity: 0.9;">Verified Users</div>
    </div>
    <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 12px;">
      <div style="font-size: 32px; font-weight: 800; margin-bottom: 5px;">${formatCurrency(totalBalance)}</div>
      <div style="font-size: 14px; opacity: 0.9;">Total Balance</div>
    </div>
    <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 12px;">
      <div style="font-size: 32px; font-weight: 800; margin-bottom: 5px;">${formatCurrency(totalEarned)}</div>
      <div style="font-size: 14px; opacity: 0.9;">Total Earned</div>
    </div>
  `;
  
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Balance</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(user => `
          <tr>
            <td>${user.personalInfo?.name || 'User'}</td>
            <td>${user.personalInfo?.email || 'N/A'}</td>
            <td>${formatCurrency(user.financialInfo?.balance || 0)}</td>
            <td>${user.personalInfo?.verified ? '<span style="color: #22c55e;">✓ Verified</span>' : '<span style="color: #ef4444;">New</span>'}</td>
            <td>
              <button class="btn btn-success" onclick="window.verifyUser('${user.uid}')">${user.personalInfo?.verified ? 'Unverify' : 'Verify'}</button>
              <button class="btn btn-primary" onclick="window.adjustBalance('${user.uid}')">Balance</button>
              <button class="btn btn-danger" onclick="window.deleteUser('${user.uid}')">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  window.verifyUser = verifyUser;
  window.adjustBalance = adjustBalancePrompt;
  window.deleteUser = deleteUserPrompt;
}

async function verifyUser(uid) {
  const userData = await getData(`USERS/${uid}`);
  const currentStatus = userData?.personalInfo?.verified || false;
  
  await updateData(`USERS/${uid}/personalInfo`, { verified: !currentStatus });
  showToast(`User ${currentStatus ? 'unverified' : 'verified'}!`, 'success');
  loadView('users');
}

async function adjustBalancePrompt(uid) {
  const { value: amount } = await Swal.fire({
    title: 'Adjust Balance',
    input: 'number',
    inputLabel: 'Amount (use negative for deduction)',
    inputPlaceholder: '100',
    showCancelButton: true
  });
  
  if (amount) {
    await updateBalance(uid, parseFloat(amount), 'Admin adjustment');
    showToast('Balance adjusted!', 'success');
    loadView('users');
  }
}

async function deleteUserPrompt(uid) {
  const confirmed = await showConfirm('Delete User', 'Are you sure?');
  if (confirmed) {
    await deleteData(`USERS/${uid}`);
    showToast('User deleted!', 'success');
    loadView('users');
  }
}

async function loadTasksView() {
  const allTasks = await getData('TASKS');
  const container = document.getElementById('tasksContainer');
  
  if (!allTasks) {
    container.innerHTML = '<p>No tasks found</p>';
    return;
  }
  
  const tasks = Object.entries(allTasks).map(([id, task]) => ({ id, ...task }));
  
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Price</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${tasks.map(task => `
          <tr>
            <td>${task.title || 'Task'}</td>
            <td>${formatCurrency(task.price || 0)}</td>
            <td>${task.status || 'inactive'}</td>
            <td>
              <button class="btn btn-warning" onclick="window.toggleTask('${task.id}')">${task.status === 'active' ? 'Deactivate' : 'Activate'}</button>
              <button class="btn btn-danger" onclick="window.deleteTask('${task.id}')">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  window.toggleTask = toggleTask;
  window.deleteTask = deleteTask;
}

window.showAddTaskModal = async function() {
  const { value: formValues } = await Swal.fire({
    title: 'Create New Task',
    html: `
      <div style="text-align: left;">
        <input id="taskTitle" class="swal2-input" placeholder="Task Title *" style="margin: 5px 0;">
        <textarea id="taskDesc" class="swal2-input" placeholder="Description *" style="margin: 5px 0; height: 60px;"></textarea>
        <input id="taskPrice" class="swal2-input" type="number" placeholder="Price (₹) *" style="margin: 5px 0;">
        <input id="taskUrl" class="swal2-input" placeholder="Task URL *" style="margin: 5px 0;">
        <input id="taskThumbnail" class="swal2-input" placeholder="Thumbnail URL (optional)" style="margin: 5px 0;">
        <textarea id="taskSteps" class="swal2-input" placeholder="Steps (one per line)" style="margin: 5px 0; height: 80px;"></textarea>
        <textarea id="taskInstructions" class="swal2-input" placeholder="Important Instructions" style="margin: 5px 0; height: 60px;"></textarea>
        <input id="taskTimeLimit" class="swal2-input" type="number" placeholder="Time Limit (seconds, optional)" style="margin: 5px 0;">
      </div>
    `,
    confirmButtonText: 'Create Task',
    confirmButtonColor: '#6366f1',
    cancelButtonText: 'Cancel',
    showCancelButton: true,
    focusConfirm: false,
    preConfirm: () => {
      const title = document.getElementById('taskTitle').value.trim();
      const description = document.getElementById('taskDesc').value.trim();
      const price = document.getElementById('taskPrice').value;
      const url = document.getElementById('taskUrl').value.trim();
      const thumbnail = document.getElementById('taskThumbnail').value.trim();
      const stepsText = document.getElementById('taskSteps').value;
      const instructions = document.getElementById('taskInstructions').value.trim();
      const timeLimit = document.getElementById('taskTimeLimit').value;
      
      if (!title || !description || !price || !url) {
        Swal.showValidationMessage('Please fill all required fields');
        return false;
      }
      
      if (parseFloat(price) <= 0) {
        Swal.showValidationMessage('Price must be greater than 0');
        return false;
      }
      
      const steps = stepsText ? stepsText.split('\n').filter(s => s.trim()).map(s => s.trim()) : [];
      
      return {
        title,
        description,
        price: parseFloat(price),
        url,
        thumbnail: thumbnail || null,
        steps,
        instructions: instructions || 'Complete all steps honestly.',
        timeLimit: timeLimit ? parseInt(timeLimit) : null
      };
    }
  });
  
  if (formValues) {
    try {
      const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await setData(`TASKS/${taskId}`, {
        ...formValues,
        status: 'active',
        likes: 0,
        likesData: {},
        completedBy: [],
        createdAt: Date.now(),
        likedByCount: Math.floor(Math.random() * 400) + 100,
        lootedByCount: Math.floor(Math.random() * 150) + 50
      });
      
      await Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Task created successfully',
        confirmButtonColor: '#6366f1'
      });
      
      loadView('tasks');
    } catch (error) {
      console.error('Error creating task:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to create task: ' + error.message,
        confirmButtonColor: '#ef4444'
      });
    }
  }
};

async function toggleTask(taskId) {
  const task = await getData(`TASKS/${taskId}`);
  const newStatus = task.status === 'active' ? 'inactive' : 'active';
  await updateData(`TASKS/${taskId}`, { status: newStatus });
  showToast(`Task ${newStatus}!`, 'success');
  loadView('tasks');
}

async function deleteTask(taskId) {
  const confirmed = await showConfirm('Delete Task', 'Are you sure?');
  if (confirmed) {
    await deleteData(`TASKS/${taskId}`);
    showToast('Task deleted!', 'success');
    loadView('tasks');
  }
}

async function loadPendingTasksView() {
  const allPending = await getData('PENDING_TASKS');
  const container = document.getElementById('pendingContainer');
  
  if (!allPending) {
    container.innerHTML = '<p>No pending tasks</p>';
    return;
  }
  
  const pending = Object.entries(allPending)
    .filter(([_, task]) => task.status === 'pending')
    .map(([id, task]) => ({ id, ...task }))
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  
  if (pending.length === 0) {
    container.innerHTML = '<p>No pending tasks</p>';
    return;
  }
  
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Task</th>
          <th>User Details</th>
          <th>Submitted</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${await Promise.all(pending.map(async task => {
          const userData = await getData(`USERS/${task.userId}`);
          const taskData = await getData(`TASKS/${task.taskId}`);
          return `
            <tr>
              <td>
                <strong>${task.taskTitle || 'Task'}</strong><br>
                <small style="opacity: 0.7;">Price: ${formatCurrency(taskData?.price || 0)}</small>
              </td>
              <td>
                <strong>${userData?.personalInfo?.name || 'User'}</strong><br>
                <small style="opacity: 0.7;">${userData?.personalInfo?.email || 'N/A'}</small><br>
                <small style="opacity: 0.7;">${userData?.personalInfo?.phone || 'N/A'}</small>
              </td>
              <td>${formatDateTime(task.submittedAt)}</td>
              <td>
                <button class="btn btn-success" onclick="window.approveTask('${task.id}', '${task.userId}', '${task.taskId}', ${taskData?.price || 0})">Approve</button>
                <button class="btn btn-danger" onclick="window.rejectTask('${task.id}', '${task.userId}')">Reject</button>
              </td>
            </tr>
          `;
        }))}
      </tbody>
    </table>
  `;
  
  window.approveTask = approveTask;
  window.rejectTask = rejectTask;
}

async function approveTask(submissionId, userId, taskId, price) {
  try {
    // Credit balance
    await runDbTransaction(`USERS/${userId}/financialInfo/balance`, (current) => (current || 0) + price);
    await runDbTransaction(`USERS/${userId}/financialInfo/totalEarned`, (current) => (current || 0) + price);
    
    // Update submission
    await updateData(`PENDING_TASKS/${submissionId}`, { 
      status: 'approved', 
      adminFeedback: 'APPROVED BY ADMIN',
      reviewedAt: Date.now()
    });
    
    // Update task history
    await runDbTransaction(`USERS/${userId}/taskHistory/pending`, (current) => Math.max(0, (current || 0) - 1));
    await runDbTransaction(`USERS/${userId}/taskHistory/completed`, (current) => (current || 0) + 1);
    
    // Add to completedBy
    await runDbTransaction(`TASKS/${taskId}/completedBy`, (current) => {
      const list = current || [];
      if (!list.includes(userId)) {
        list.push(userId);
      }
      return list;
    });
    
    // Create transaction
    const txnId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    await setData(`TRANSACTIONS/${txnId}`, {
      userId: userId,
      type: 'credit',
      amount: price,
      reason: `Task completion: ${taskId}`,
      timestamp: Date.now()
    });
    
    // Check referral bonus
    const userData = await getData(`USERS/${userId}`);
    const completedBefore = (userData?.taskHistory?.completed || 1) - 1;
    
    if (completedBefore === 0 && userData?.personalInfo?.referrerId) {
      await runDbTransaction(`USERS/${userData.personalInfo.referrerId}/financialInfo/balance`, (current) => (current || 0) + 10);
      const refTxnId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await setData(`TRANSACTIONS/${refTxnId}`, {
        userId: userData.personalInfo.referrerId,
        type: 'credit',
        amount: 10,
        reason: 'Referral first task bonus',
        timestamp: Date.now()
      });
    }
    
    await Swal.fire({
      icon: 'success',
      title: 'Approved',
      text: 'Task approved and user credited ₹' + price,
      confirmButtonColor: '#6366f1'
    });
    
    loadView('pending');
  } catch (error) {
    console.error('Error:', error);
    await Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to approve: ' + error.message,
      confirmButtonColor: '#ef4444'
    });
  }
}

async function rejectTask(submissionId, userId) {
  const { value: reason } = await Swal.fire({
    title: 'Rejection Reason',
    input: 'text',
    inputPlaceholder: 'Enter reason',
    showCancelButton: true,
    confirmButtonColor: '#ef4444'
  });
  
  if (reason) {
    try {
      await updateData(`PENDING_TASKS/${submissionId}`, { 
        status: 'rejected', 
        adminFeedback: reason, 
        reviewedAt: Date.now()
      });
      
      await runDbTransaction(`USERS/${userId}/taskHistory/pending`, (current) => Math.max(0, (current || 0) - 1));
      await runDbTransaction(`USERS/${userId}/taskHistory/rejected`, (current) => (current || 0) + 1);
      
      await Swal.fire({
        icon: 'success',
        title: 'Rejected',
        text: 'Task submission rejected',
        confirmButtonColor: '#6366f1'
      });
      
      loadView('pending');
    } catch (error) {
      console.error('Error:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to reject: ' + error.message,
        confirmButtonColor: '#ef4444'
      });
    }
  }
}

async function loadWithdrawalsView() {
  const allWithdrawals = await getData('WITHDRAWALS');
  const container = document.getElementById('withdrawalsContainer');
  
  if (!allWithdrawals) {
    container.innerHTML = '<p>No withdrawals</p>';
    return;
  }
  
  const withdrawals = Object.entries(allWithdrawals)
    .filter(([_, w]) => w.status === 'pending')
    .map(([id, w]) => ({ id, ...w }));
  
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Amount</th>
          <th>Method</th>
          <th>Details</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${await Promise.all(withdrawals.map(async w => {
          const userData = await getData(`USERS/${w.userId}`);
          return `
            <tr>
              <td>${userData?.personalInfo?.name || 'User'}</td>
              <td>${formatCurrency(w.amount)}</td>
              <td>${w.method}</td>
              <td>${JSON.stringify(w.details)}</td>
              <td>
                <button class="btn btn-success" onclick="window.approveWithdrawal('${w.id}', '${w.userId}', ${w.amount})">Approve</button>
                <button class="btn btn-danger" onclick="window.rejectWithdrawal('${w.id}', '${w.userId}')">Reject</button>
              </td>
            </tr>
          `;
        }))}
      </tbody>
    </table>
  `;
  
  window.approveWithdrawal = approveWithdrawal;
  window.rejectWithdrawal = rejectWithdrawal;
}

async function approveWithdrawal(withdrawalId, userId, amount) {
  try {
    const result = await Swal.fire({
      title: 'Approve Withdrawal',
      text: `Approve withdrawal of ₹${amount}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Approve',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b'
    });
    
    if (!result.isConfirmed) return;
    
    showLoading('Processing...');
    
    // Update withdrawal status
    const timestamp = Date.now();
    await updateData(`WITHDRAWALS/${withdrawalId}`, { 
      status: 'approved', 
      adminFeedback: 'Approved and processed',
      processedAt: timestamp,
      approvedBy: currentUser?.uid || 'admin'
    });
    
    // Create transaction record
    const txnId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    await setData(`TRANSACTIONS/${txnId}`, {
      userId: userId,
      type: 'debit',
      amount: amount,
      reason: 'Withdrawal Approved - Funds transferred',
      timestamp: timestamp,
      withdrawalId: withdrawalId
    });
    
    hideLoading();
    
    await Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Withdrawal approved successfully',
      confirmButtonColor: '#6366f1'
    });
    
    loadView('withdrawals');
  } catch (error) {
    hideLoading();
    console.error('Error approving withdrawal:', error);
    await Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to approve withdrawal: ' + error.message,
      confirmButtonColor: '#ef4444'
    });
  }
}

async function rejectWithdrawal(withdrawalId, userId) {
  const { value: reason } = await Swal.fire({
    title: 'Rejection Reason',
    input: 'text',
    inputPlaceholder: 'Enter reason',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    inputValidator: (value) => {
      if (!value) {
        return 'Please enter a reason';
      }
    }
  });
  
  if (reason) {
    try {
      showLoading('Processing...');
      
      const timestamp = Date.now();
      await updateData(`WITHDRAWALS/${withdrawalId}`, { 
        status: 'rejected', 
        adminReason: reason,
        adminFeedback: `Rejected: ${reason}`,
        processedAt: timestamp,
        rejectedBy: currentUser?.uid || 'admin'
      });
      
      const txnId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      await setData(`TRANSACTIONS/${txnId}`, {
        userId: userId,
        type: 'info',
        amount: 0,
        reason: `Withdrawal rejected: ${reason}`,
        timestamp: timestamp,
        withdrawalId: withdrawalId
      });
      
      hideLoading();
      
      await Swal.fire({
        icon: 'success',
        title: 'Rejected',
        text: 'Withdrawal request rejected',
        confirmButtonColor: '#6366f1'
      });
      
      loadView('withdrawals');
    } catch (error) {
      hideLoading();
      console.error('Error:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to reject: ' + error.message,
        confirmButtonColor: '#ef4444'
      });
    }
  }
}

async function loadTransactionsView() {
  const allTransactions = await getData('TRANSACTIONS');
  const container = document.getElementById('transactionsContainer');
  
  if (!allTransactions) {
    container.innerHTML = '<p>No transactions</p>';
    return;
  }
  
  const transactions = Object.entries(allTransactions)
    .map(([id, txn]) => ({ id, ...txn }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 50);
  
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Reason</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        ${await Promise.all(transactions.map(async txn => {
          const userData = await getData(`USERS/${txn.userId}`);
          return `
            <tr>
              <td>${userData?.personalInfo?.name || 'User'}</td>
              <td style="color: ${txn.type === 'credit' ? '#22c55e' : '#ef4444'};">${txn.type}</td>
              <td>${formatCurrency(txn.amount)}</td>
              <td>${txn.reason}</td>
              <td>${formatDateTime(txn.timestamp)}</td>
            </tr>
          `;
        }))}
      </tbody>
    </table>
  `;
}

async function loadPWAView() {
  const container = document.getElementById('pwaInstallsContainer');
  container.innerHTML = '<p>PWA analytics coming soon</p>';
}

window.showBulkBonusModal = async function() {
  const { value: formValues } = await Swal.fire({
    title: 'Bulk Bonus Distribution',
    html:
      '<input id="bonusAmount" class="swal2-input" type="number" placeholder="Amount (₹)" style="margin-bottom: 10px;">' +
      '<input id="bonusReason" class="swal2-input" placeholder="Reason for bonus (e.g., Festival Bonus, Thank You Bonus)" style="margin-bottom: 10px;">',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Distribute',
    confirmButtonColor: '#6366f1',
    preConfirm: () => {
      const amount = document.getElementById('bonusAmount').value;
      const reason = document.getElementById('bonusReason').value;
      
      if (!amount || parseFloat(amount) <= 0) {
        Swal.showValidationMessage('Please enter a valid amount');
        return false;
      }
      
      if (!reason || reason.trim() === '') {
        Swal.showValidationMessage('Please enter a reason for the bonus');
        return false;
      }
      
      return { amount: parseFloat(amount), reason: reason.trim() };
    }
  });
  
  if (formValues) {
    const confirmed = await Swal.fire({
      title: 'Confirm Bulk Bonus',
      text: `Give ₹${formValues.amount} to ALL users for: "${formValues.reason}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Distribute',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#64748b'
    });
    
    if (!confirmed.isConfirmed) return;
    
    Swal.fire({
      title: 'Distributing Bonus...',
      html: 'Please wait while we distribute bonus to all users',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    try {
      const allUsers = await getData('USERS');
      if (allUsers) {
        const timestamp = Date.now();
        let count = 0;
        
        for (const uid in allUsers) {
          // Add bonus to user balance
          await runDbTransaction(`USERS/${uid}/financialInfo/balance`, (current) => (current || 0) + formValues.amount);
          await runDbTransaction(`USERS/${uid}/financialInfo/totalEarned`, (current) => (current || 0) + formValues.amount);
          
          // Create transaction record
          const txnId = 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          await setData(`TRANSACTIONS/${txnId}`, {
            userId: uid,
            type: 'credit',
            amount: formValues.amount,
            reason: `🎁 Bulk Bonus: ${formValues.reason}`,
            timestamp: timestamp
          });
          
          count++;
        }
        
        await Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: `Bulk bonus of ₹${formValues.amount} distributed to ${count} users!`,
          confirmButtonColor: '#6366f1'
        });
        
        loadView('users');
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No users found',
          confirmButtonColor: '#ef4444'
        });
      }
    } catch (error) {
      console.error('Bulk bonus error:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error distributing bonus: ' + error.message,
        confirmButtonColor: '#ef4444'
      });
    }
  }
};
