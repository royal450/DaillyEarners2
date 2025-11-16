// Settings Page Logic
import { auth } from '../shared/firebase-config.js';
import { signOut, deleteUser } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getData, updateData, deleteData } from '../shared/db.js';
import { showToast, showConfirm, redirectTo, showLoading, hideLoading } from '../shared/utils.js';
import { initAuthGuard } from '../shared/auth-guard.js';

let currentUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
  currentUser = await initAuthGuard(onUserAuthenticated);
});

async function onUserAuthenticated(user) {
  currentUser = user;
  document.body.style.visibility = 'visible';

  await loadUserSettings();
  setupSettingsForm();
  await initThemeToggle(); // Changed from setupThemeToggle to initThemeToggle
  setupAccountActions();
}

// Load user settings
async function loadUserSettings() {
  const userData = await getData(`USERS/${currentUser.uid}`);

  if (!userData) return;

  // Populate form fields
  const nameInput = document.getElementById('userName');
  const emailInput = document.getElementById('userEmail');
  const phoneInput = document.getElementById('userPhone');
  const profilePicInput = document.getElementById('profilePicUrl');

  if (nameInput) {
    nameInput.value = userData.personalInfo?.name || '';
  }

  if (emailInput) {
    emailInput.value = userData.personalInfo?.email || '';
    emailInput.disabled = true; // Email cannot be changed
  }

  if (phoneInput) {
    phoneInput.value = userData.personalInfo?.phone || '';
  }

  if (profilePicInput) {
    profilePicInput.value = userData.personalInfo?.profilePic || '';
  }

  // Set theme
  const theme = userData.theme || 'light';
  const body = document.body;
  body.setAttribute('data-theme', theme);

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.checked = theme === 'dark';
  }
}

// Setup settings form
function setupSettingsForm() {
  const form = document.getElementById('settingsForm');
  if (!form) return;

  form.addEventListener('submit', handleSettingsUpdate);
}

// Handle settings update
async function handleSettingsUpdate(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const name = document.getElementById('userName').value.trim();
  const phone = document.getElementById('userPhone').value.trim();
  const profilePic = document.getElementById('profilePicUrl').value.trim();

  if (!name) {
    showToast('Name is required', 'error');
    return;
  }

  showLoading(submitBtn, 'Saving...');

  try {
    await updateData(`USERS/${currentUser.uid}/personalInfo`, {
      name,
      phone,
      profilePic
    });

    showToast('Settings updated successfully!', 'success');
  } catch (error) {
    console.error('Update error:', error);
    showToast('Error updating settings', 'error');
  } finally {
    hideLoading(submitBtn);
  }
}

// Setup theme toggle
// Changed function name to initThemeToggle to match the call in onUserAuthenticated
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

// Setup account actions
function setupAccountActions() {
  const logoutBtn = document.getElementById('logoutBtn');
  const deleteBtn = document.getElementById('deleteAccountBtn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', handleDeleteAccount);
  }
}

// Handle logout
async function handleLogout() {
  const confirmed = await showConfirm(
    'Logout',
    'Are you sure you want to logout?',
    'Logout',
    'Cancel'
  );

  if (!confirmed) return;

  try {
    await signOut(auth);
    showToast('Logged out successfully', 'success');
    redirectTo('index.html');
  } catch (error) {
    console.error('Logout error:', error);
    showToast('Error logging out', 'error');
  }
}

// Handle account deletion
async function handleDeleteAccount() {
  const confirmed1 = await showConfirm(
    'Delete Account',
    'This action is PERMANENT and cannot be undone. All your data will be lost. Are you sure?',
    'Yes, Delete',
    'Cancel'
  );

  if (!confirmed1) return;

  const confirmed2 = await showConfirm(
    'Final Confirmation',
    'This is your last chance. Really delete your account forever?',
    'Delete Forever',
    'Keep Account'
  );

  if (!confirmed2) return;

  try {
    // Delete user data from database
    await deleteData(`USERS/${currentUser.uid}`);
    await deleteData(`CHECKINS/${currentUser.uid}`);

    // Delete Firebase auth account
    await deleteUser(auth.currentUser);

    showToast('Account deleted successfully', 'success');
    redirectTo('index.html');
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Error deleting account. Please contact support.', 'error');
  }
}