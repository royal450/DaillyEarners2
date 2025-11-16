// Telegram Notification System
const BOT_TOKEN = '8567617667:AAGa4n-yus8ZG5CsUJAL_jxzw8ER1I15JkQ';
const CHAT_ID = '6320914640';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

// Send Telegram notification
export async function sendTelegramNotification(message) {
  try {
    const response = await fetch(TELEGRAM_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      console.error('Failed to send Telegram notification');
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
  }
}

// Notify new user registration
export async function notifyNewUser(userData) {
  const message = `
🎉 <b>NEW USER REGISTERED</b> 🎉

👤 <b>Name:</b> ${userData.name}
📧 <b>Email:</b> ${userData.email}
📱 <b>Phone:</b> ${userData.phone}
🔗 <b>Referral Code:</b> ${userData.refCode}
${userData.uplineCode ? `👥 <b>Referred By:</b> ${userData.uplineCode}` : ''}
📅 <b>Joined:</b> ${new Date().toLocaleString('en-IN')}
  `.trim();
  
  await sendTelegramNotification(message);
}

// Notify task submission
export async function notifyTaskSubmission(userName, userEmail, taskTitle, taskId) {
  const message = `
🔔 <b>TASK SUBMITTED FOR REVIEW</b>

👤 <b>User Name:</b> ${userName}
📧 <b>Email:</b> ${userEmail}
📋 <b>Task Title:</b> ${taskTitle}
🆔 <b>Task ID:</b> ${taskId}
⏰ <b>Submitted At:</b> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

✅ Please review and approve/reject in admin panel
  `.trim();
  
  await sendTelegramNotification(message);
}

// Notify withdrawal request
export async function notifyWithdrawalRequest(userName, userEmail, amount, method, details) {
  const message = `
💰 <b>WITHDRAWAL REQUEST</b>

👤 <b>User:</b> ${userName}
📧 <b>Email:</b> ${userEmail}
💵 <b>Amount:</b> ₹${amount}
🏦 <b>Method:</b> ${method}
📝 <b>Details:</b> ${JSON.stringify(details)}
⏰ <b>Time:</b> ${new Date().toLocaleString('en-IN')}
  `.trim();
  
  await sendTelegramNotification(message);
}

// Notify admin action
export async function notifyAdminAction(action, details) {
  const message = `
⚡ <b>ADMIN ACTION</b>

🔧 <b>Action:</b> ${action}
📝 <b>Details:</b> ${details}
⏰ <b>Time:</b> ${new Date().toLocaleString('en-IN')}
  `.trim();
  
  await sendTelegramNotification(message);
}
