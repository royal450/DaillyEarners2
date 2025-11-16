// Task Detail Page Logic - Fixed for Your HTML Structure
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
    console.log('🚀 Task Detail Page Loading...');
    
    taskId = getQueryParam('id');
    console.log('📌 Task ID from URL:', taskId);

    if (!taskId) {
        showToast('Invalid task ID', 'error');
        redirectTo('dashboard.html');
        return;
    }

    try {
        currentUser = await initAuthGuard(onUserAuthenticated);
    } catch (error) {
        console.error('❌ Auth guard error:', error);
        showToast('Authentication failed', 'error');
        redirectTo('index.html');
    }
});

async function onUserAuthenticated(user) {
    console.log('✅ User authenticated:', user.uid);
    currentUser = user;
    document.body.style.visibility = 'visible';

    await loadTaskDetails();
    setupTaskActions();
}

// Load task details
async function loadTaskDetails() {
    console.log('🔄 Loading task details...');
    
    try {
        currentTask = await getData(`TASKS/${taskId}`);
        console.log('📦 Raw task data:', currentTask);

        if (!currentTask) {
            console.error('❌ Task not found in database');
            showToast('Task not found', 'error');
            redirectTo('dashboard.html');
            return;
        }

        displayTaskDetails();
        await checkTaskStatus();

    } catch (error) {
        console.error('❌ Error loading task:', error);
        showToast('Error loading task details', 'error');
    }
}

// Display task details - FIXED FOR YOUR HTML STRUCTURE
function displayTaskDetails() {
    console.log('🎯 Displaying task details for your HTML...');

    // Get elements with EXACT IDs from your HTML
    const taskTitle = document.getElementById('taskTitle');
    const taskReward = document.getElementById('taskReward');
    const taskDescription = document.getElementById('taskDescription');
    const taskInstruction = document.getElementById('taskInstruction');
    const stepsContainer = document.getElementById('stepsContainer');
    const timerWarning = document.getElementById('timerWarning');
    const timerSeconds = document.getElementById('timerSeconds');

    // Debug: Check which elements are found
    console.log('📝 HTML Elements found:', {
        taskTitle: !!taskTitle,
        taskReward: !!taskReward,
        taskDescription: !!taskDescription,
        taskInstruction: !!taskInstruction,
        stepsContainer: !!stepsContainer,
        timerWarning: !!timerWarning
    });

    // 1. TITLE
    if (taskTitle) {
        const title = currentTask.title || currentTask.taskTitle || currentTask.name || 'Untitled Task';
        taskTitle.textContent = title;
        console.log('📌 Title set:', title);
    }

    // 2. REWARD/PRICE - Your HTML uses "taskReward"
    if (taskReward) {
        let priceValue = 0;
        
        if (currentTask.price !== undefined && currentTask.price !== null) {
            priceValue = currentTask.price;
        } else if (currentTask.amount !== undefined && currentTask.amount !== null) {
            priceValue = currentTask.amount;
        } else if (currentTask.reward !== undefined && currentTask.reward !== null) {
            priceValue = currentTask.reward;
        }
        
        priceValue = Number(priceValue) || 0;
        taskReward.textContent = priceValue;
        console.log('💰 Reward set:', priceValue);
    }

    // 3. DESCRIPTION
    if (taskDescription) {
        const description = currentTask.description || 
                           currentTask.desc || 
                           currentTask.taskDescription || 
                           'No description available.';
        
        taskDescription.textContent = description;
        console.log('📝 Description set');
    }

    // 4. INSTRUCTIONS - Your HTML uses "taskInstruction"
    if (taskInstruction) {
        const instructions = currentTask.instructions || 
                           currentTask.importantInstructions || 
                           currentTask.note ||
                           'Complete all steps carefully and honestly. Your submission will be reviewed by admin.';
        
        taskInstruction.textContent = instructions;
        console.log('📋 Instructions set');
    }

    // 5. STEPS CONTAINER - Your HTML uses "stepsContainer"
    if (stepsContainer) {
        const steps = currentTask.steps || currentTask.instructions || [];
        
        if (Array.isArray(steps) && steps.length > 0) {
            console.log('📝 Processing steps array:', steps.length, 'steps');
            
            stepsContainer.innerHTML = steps.map((step, index) => {
                let stepText = '';
                
                if (typeof step === 'string') {
                    stepText = step;
                } else if (typeof step === 'object' && step !== null) {
                    stepText = step.text || step.step || step.description || step.title || `Step ${index + 1}`;
                } else {
                    stepText = `Step ${index + 1}`;
                }
                
                return `
                    <div class="step-item">
                        <div class="step-number">${index + 1}</div>
                        <div class="step-content">
                            <div class="step-text">${stepText}</div>
                        </div>
                    </div>
                `;
            }).join('');
            
            console.log('✅ Steps rendered successfully');
        } else {
            // No steps available
            stepsContainer.innerHTML = `
                <div class="step-item">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <div class="step-text">Visit the task URL and complete all requirements</div>
                    </div>
                </div>
                <div class="step-item">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <div class="step-text">Follow all instructions carefully</div>
                    </div>
                </div>
                <div class="step-item">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <div class="step-text">Click "Submit Task" when completed</div>
                    </div>
                </div>
            `;
            console.log('📝 Default steps rendered');
        }
    }

    // 6. TIMER WARNING - If task has time limit
    if (timerWarning && timerSeconds) {
        const timeLimit = currentTask.timeLimit || currentTask.duration || 0;
        
        if (timeLimit > 0) {
            timerWarning.style.display = 'flex';
            timerSeconds.textContent = timeLimit;
            console.log('⏰ Time limit set:', timeLimit, 'seconds');
        } else {
            timerWarning.style.display = 'none';
        }
    }

    console.log('✅ Task display completed for your HTML structure');
}

// Check task status for current user
async function checkTaskStatus() {
    console.log('🔍 Checking task status for user:', currentUser.uid);
    
    try {
        const userData = await getData(`USERS/${currentUser.uid}`);
        const completedTasks = currentTask.completedBy || [];

        console.log('✅ Completed tasks array:', completedTasks);

        // Check if already completed
        if (completedTasks.includes(currentUser.uid)) {
            console.log('🎯 Task already completed by user');
            showCompletedStatus();
            return;
        }

        // Check if pending in PENDING_TASKS
        const allPendingTasks = await getData('PENDING_TASKS');
        
        if (allPendingTasks && typeof allPendingTasks === 'object') {
            const pendingEntries = Object.entries(allPendingTasks);
            
            const userPending = pendingEntries.find(([key, submission]) => {
                return submission.userId === currentUser.uid && 
                       submission.taskId === taskId && 
                       submission.status === 'pending';
            });

            if (userPending) {
                console.log('⏳ Task pending review');
                showPendingStatus();
                return;
            }
        }

        // Task available
        console.log('📝 Task available for submission');
        showAvailableStatus();
        
    } catch (error) {
        console.error('❌ Error checking task status:', error);
        showAvailableStatus();
    }
}

// Show completed status
function showCompletedStatus() {
    console.log('🟢 Showing completed status');
    
    const submitBtn = document.getElementById('submitBtn');
    const visitBtn = document.getElementById('visitBtn');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Task Completed';
        submitBtn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.style.opacity = '0.8';
    }

    if (visitBtn) {
        visitBtn.disabled = true;
        visitBtn.style.cursor = 'not-allowed';
        visitBtn.style.opacity = '0.6';
    }
}

// Show pending status
function showPendingStatus() {
    console.log('🟡 Showing pending status');
    
    const submitBtn = document.getElementById('submitBtn');
    const visitBtn = document.getElementById('visitBtn');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-clock"></i> Under Review';
        submitBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.style.opacity = '0.8';
    }

    if (visitBtn) {
        visitBtn.disabled = false;
    }
}

// Show available status
function showAvailableStatus() {
    console.log('🔵 Showing available status');
    
    const submitBtn = document.getElementById('submitBtn');
    const visitBtn = document.getElementById('visitBtn');

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Task';
        submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        submitBtn.style.cursor = 'pointer';
        submitBtn.style.opacity = '1';
    }

    if (visitBtn) {
        visitBtn.disabled = false;
        visitBtn.style.cursor = 'pointer';
        visitBtn.style.opacity = '1';
    }
}

// Setup task actions
function setupTaskActions() {
    console.log('🔧 Setting up task actions...');
    
    const visitBtn = document.getElementById('visitBtn');
    const submitBtn = document.getElementById('submitBtn');

    console.log('🔧 Action buttons:', {
        visitBtn: !!visitBtn,
        submitBtn: !!submitBtn
    });

    if (visitBtn) {
        visitBtn.addEventListener('click', handleVisitTask);
        console.log('🔧 Visit button setup done');
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', handleTaskSubmission);
        console.log('🔧 Submit button setup done');
    }

    console.log('✅ Task actions setup completed');
}

// Handle visit task
function handleVisitTask() {
    const taskUrl = currentTask.url || currentTask.taskUrl || currentTask.link || '';
    
    console.log('🌐 Visit task clicked, URL:', taskUrl);
    
    if (taskUrl && (taskUrl.startsWith('http'))) {
        window.open(taskUrl, '_blank');
        console.log('🌐 URL opened in new tab');
        
        // Show message to user
        showToast('Task URL opened in new tab. Complete all steps!', 'info');
    } else {
        showToast('No valid URL available for this task', 'info');
        console.log('❌ No valid URL found');
    }
}

// Handle task submission
async function handleTaskSubmission() {
    console.log('🚀 Task submission initiated');
    
    const submitBtn = document.getElementById('submitBtn');

    const taskTitle = currentTask.title || currentTask.taskTitle || 'this task';
    const taskPrice = currentTask.price || currentTask.amount || 0;

    const confirmed = await showConfirm(
        'Submit Task',
        `Kya aapne "${taskTitle}" task complete kar liya hai? Aapko ₹${taskPrice} milenge admin approval ke baad.`,
        'Haan, Submit Karo',
        'Cancel'
    );

    if (!confirmed) {
        console.log('❌ Submission cancelled by user');
        return;
    }

    showLoading(submitBtn, 'Submitting...');

    try {
        console.log('📤 Creating task submission...');

        const submissionData = {
            userId: currentUser.uid,
            taskId: taskId,
            taskTitle: currentTask.title || currentTask.taskTitle || 'Unknown Task',
            taskPrice: currentTask.price || currentTask.amount || 0,
            status: 'pending',
            submittedAt: getServerTimestamp(),
            userEmail: currentUser.email,
            userName: currentUser.displayName || 'User'
        };

        console.log('📤 Submission data:', submissionData);
        
        await pushData('PENDING_TASKS', submissionData);

        // Update user task history
        await runDbTransaction(`USERS/${currentUser.uid}/taskHistory/pending`, (current) => {
            return (current || 0) + 1;
        });

        // Send notification
        const userData = await getData(`USERS/${currentUser.uid}`);
        const userName = userData?.personalInfo?.name || userData?.name || currentUser.displayName || 'User';
        const userEmail = userData?.personalInfo?.email || currentUser.email || '';
        
        await notifyTaskSubmission(userName, userEmail, currentTask.title || 'Task', taskId);

        showToast('Task submitted successfully! Admin approval ka wait karo.', 'success');
        console.log('✅ Task submission completed');

        // Update UI status
        await checkTaskStatus();

    } catch (error) {
        console.error('❌ Submission error:', error);
        showToast('Error submitting task: ' + error.message, 'error');
    } finally {
        hideLoading(submitBtn);
    }
}

// Add global debug function
window.debugTaskData = function() {
    console.log('🐛 === DEBUG TASK DATA ===');
    console.log('Task ID:', taskId);
    console.log('Current Task:', currentTask);
    console.log('Current User:', currentUser ? {
        uid: currentUser.uid,
        email: currentUser.email
    } : null);
    
    // Check HTML elements
    console.log('📝 HTML Elements Status:');
    console.log('   - taskTitle:', document.getElementById('taskTitle')?.textContent);
    console.log('   - taskReward:', document.getElementById('taskReward')?.textContent);
    console.log('   - taskDescription:', document.getElementById('taskDescription')?.textContent);
    console.log('   - taskInstruction:', document.getElementById('taskInstruction')?.textContent);
    console.log('   - stepsContainer children:', document.getElementById('stepsContainer')?.children.length);
    
    console.log('🐛 === END DEBUG ===');
};

console.log('✅ Task Detail Page JavaScript Loaded - Your HTML Structure Compatible');
console.log('💡 Use debugTaskData() to check current data');
