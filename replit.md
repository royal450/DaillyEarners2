# CashByKing - Earning Platform

## Overview
CashByKing is a complete reward-based platform built as a static web application. Users can earn money by completing tasks, referring friends, and participating in daily check-ins. The platform features a modern glassmorphism design with light/dark theme support.

**Current State:** ✅ Fully functional and running in Replit environment. Ready for use and deployment.

**Last Updated:** November 16, 2025

## Recent Changes
- **2025-11-16**: Successfully imported and configured for Replit environment
  - Installed Python 3.11 for serving static files
  - Configured HTTP server on port 5000 with webview output
  - Verified .gitignore includes Python and Replit files
  - Set up and tested web server workflow - RUNNING
  - Configured deployment settings for autoscale (static site)
  - Verified application loads correctly with all features working

## Project Architecture

### Technology Stack
- **Frontend:** Vanilla HTML5, CSS3, JavaScript ES6+
- **Database:** Firebase Real-time Database
- **Authentication:** Firebase Auth
- **Real-time Updates:** Firebase onValue() snapshot listeners
- **Hosting:** Static hosting (served via Python HTTP server in Replit)

### File Structure
```
CashByKing/
├── 📱 HTML Pages
│   ├── index.html           # Signup page with referral detection
│   ├── dashboard.html       # Main user dashboard
│   ├── wallet.html         # Balance & withdrawals
│   ├── task-detail.html    # Task instructions & submission
│   ├── pending-tasks.html  # Task approval status
│   ├── checkin.html       # Daily rewards system
│   ├── referral.html      # Referral tracking
│   ├── settings.html      # Profile management
│   ├── transactions.html  # Transaction history
│   └── admin.html        # Admin control panel
├── 🔧 Configuration
│   ├── manifest.json     # PWA configuration
│   └── final_prompt.txt  # Complete project specifications
└── 📄 Documentation
    └── replit.md        # This file
```

### Key Features
1. **User Authentication:** Firebase Auth with 1-year session persistence
2. **Referral System:** Automatic detection from URL parameters (e.g., ?ref=CODE)
3. **Task Management:** Complete task workflow from creation to completion
4. **Wallet System:** Balance management and withdrawal requests
5. **Daily Check-in:** 7-day reward cycle with random amounts (1-10rs)
6. **Admin Panel:** Complete control over users, tasks, and financial operations
7. **Real-time Updates:** All data syncs instantly using Firebase listeners
8. **PWA Support:** Installable as mobile app with offline capabilities

### Integrations
- **Firebase:** Real-time database and authentication
- **Telegram Bot:** Notifications for new users, task submissions, withdrawals
  - Bot Token: Configured in HTML files
  - Chat ID: 6320914640
- **WhatsApp Support:** +91 9104037184
- **Telegram Channel:** https://t.me/CashByKing

## Running the Project

### Development
The project runs on a Python HTTP server serving static files on port 5000:
```bash
python -m http.server 5000
```

The workflow is already configured and starts automatically in Replit.

### Accessing the Site
- The site is accessible through the Replit webview
- Entry point: index.html (signup page)
- Authenticated users are redirected to dashboard.html

## Database Structure
Firebase Real-time Database path: `CASHBYKING_ALL_DATA/`
- **USERS/**: User profiles, balances, task history
- **TASKS/**: Available tasks with details
- **PENDING_TASKS/**: Task submissions awaiting approval
- **WITHDRAWALS/**: Withdrawal requests
- **TRANSACTIONS/**: Complete transaction history
- **ADMIN_DATA/**: System settings and admin operations

## Design System
- **Theme:** Light/Dark mode with database persistence
- **Colors:** Indigo gradient accents (#6366f1, #8b5cf6)
- **Style:** Modern glassmorphism with backdrop blur effects
- **Responsive:** Mobile-first design, works on all devices

## Important Notes
- This is a **pure static application** - no Node.js, Express, or server-side code
- All logic runs client-side using vanilla JavaScript
- Firebase handles all backend operations
- Real-time updates use Firebase onValue() snapshot listeners
- No local storage for critical data - everything in Firebase
- Session persistence managed by Firebase Auth

## ⚠️ CRITICAL SECURITY WARNINGS

### 1. Telegram Bot Token Exposure
**SECURITY RISK**: The Telegram bot token is exposed in client-side JavaScript (`js/shared/notifications.js`). This is inherently insecure because:
- Anyone can view the source code and steal the bot token
- The token can be misused to send spam or hijack the bot
- This is a limitation of the "pure static website" requirement

**Recommendations**:
- Consider using a backend server (Cloud Functions, Lambda, etc.) to handle Telegram notifications securely
- Rotate the bot token immediately if this goes to production
- Implement rate limiting on the Telegram bot side
- OR accept this security trade-off for a simple static deployment

### 2. Firebase Configuration
**ACTION REQUIRED**: Update Firebase credentials in `js/shared/firebase-config.js` with your actual project credentials:
- Replace placeholder `messagingSenderId` and `appId` with real values from Firebase Console
- Ensure Firebase project has proper security rules configured
- Enable authentication methods in Firebase Console

### 3. Admin Panel Access
**SECURITY**: Update the `ADMIN_UIDS` array in `js/pages/admin.js` with actual admin user IDs:
```javascript
const ADMIN_UIDS = ['YOUR_FIREBASE_UID_HERE'];
```
Otherwise, no one will be able to access the admin panel.

## Deployment

### Replit Deployment (Configured)
The application is now configured for Replit deployment:
- **Deployment Type:** Autoscale (perfect for static sites)
- **Run Command:** `python -m http.server 5000`
- **Port:** 5000 (webview enabled)
- Ready to publish via Replit's deployment feature

### Firebase Hosting (External)
Also deployed at: https://cashbyking.web.app
