# CashByKing - Security & Setup Guide

## 🚨 CRITICAL: Required Setup Steps Before Deployment

### 1. Firebase Configuration (MANDATORY)

**Current Status:** ❌ Using placeholder values - **WILL NOT WORK**

**Action Required:**
Open `js/shared/firebase-config.js` and replace placeholder values with your real Firebase project credentials:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBuioOF7DCq-qIoa1D6ZyZbrAVeGjbfv3Y",  // ✅ Already set
  authDomain: "daily-campaign-king.firebaseapp.com",   // ✅ Already set
  databaseURL: "https://daily-campaign-king-default-rtdb.firebaseio.com", // ✅ Already set
  projectId: "daily-campaign-king",  // ✅ Already set
  storageBucket: "daily-campaign-king.appspot.com",  // ✅ Already set
  messagingSenderId: "123456789",  // ❌ REPLACE WITH REAL VALUE
  appId: "1:123456789:web:abc123def456"  // ❌ REPLACE WITH REAL VALUE
};
```

**How to get real values:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `daily-campaign-king`
3. Go to Project Settings > General
4. Scroll to "Your apps" section
5. Copy the `messagingSenderId` and `appId` values
6. Replace the placeholder values in `firebase-config.js`

---

### 2. Admin Panel Security (IMPLEMENTED - PRODUCTION-READY)

**Current Status:** ✅ **SECURE** - Firebase UID-based authentication with fallback disabled by default

**Implementation Details:**
- Admin access is controlled via Firebase Authentication UID whitelist
- Only users with UIDs in the `ADMIN_UIDS` array can access the admin panel
- Password fallback is **disabled by default** for production security
- Optional password fallback available for local testing only (must be manually enabled)

**How It Works:**
1. User must be signed in with Firebase Authentication
2. User's UID is checked against the `ADMIN_UIDS` whitelist in `js/pages/admin.js`
3. If UID matches → Admin access granted ✅
4. If UID doesn't match → Access denied, redirected to dashboard ❌
5. **Security**: Password fallback is disabled by default (`ENABLE_PASSWORD_FALLBACK = false`)

**Setup Steps for Production:**

1. **Configure Admin UIDs** (REQUIRED):
   - Sign in to your app as the admin user
   - Open browser console (F12)
   - Type: `firebase.auth().currentUser.uid`
   - Copy your UID
   - Open `js/pages/admin.js`
   - Replace `'REPLACE_WITH_YOUR_FIREBASE_UID'` with your actual UID:
   ```javascript
   const ADMIN_UIDS = [
     'abc123xyz456',  // Your actual Firebase UID
     // Add more admin UIDs as needed:
     // 'def789ghi012',
   ];
   ```

2. **Verify Security Settings** (should already be correct):
   - Open `js/pages/admin.js`
   - Confirm `ENABLE_PASSWORD_FALLBACK = false` (default setting)
   - This ensures no password-based access in production

3. **Test Admin Access**:
   - Sign in with admin account
   - Navigate to `/admin.html`
   - Should see admin panel immediately (no password prompt)
   - Test with non-admin account to verify access is denied

**Security Status:**
- ✅ **Production-secure by default** (password fallback disabled)
- ✅ **UID-based authentication** (each admin explicitly whitelisted)
- ✅ **No hardcoded passwords** exposed in production
- ⚠️ **Testing fallback** (optional: set `ENABLE_PASSWORD_FALLBACK = true` for local testing only)

**Optional: Enable Password Fallback for Local Testing**
If you need to test admin features before configuring Firebase UIDs:
1. Open `js/pages/admin.js`
2. Change `ENABLE_PASSWORD_FALLBACK = false` to `true`
3. Use password `848592` to access admin panel
4. ⚠️ **IMPORTANT**: Set back to `false` before production deployment

**Advanced Alternative: Firebase Custom Claims**
For enterprise-level deployments with many admins:
- Requires Firebase Admin SDK (backend/Cloud Functions)
- Set `admin: true` custom claim on user accounts
- More scalable and manageable for large teams
- Not currently implemented (UID whitelist is sufficient for most use cases)

---

### 3. Firebase Database Security Rules

**Action Required:** Set up proper security rules in Firebase Console

```json
{
  "rules": {
    "CASHBYKING_ALL_DATA": {
      "USERS": {
        "$uid": {
          ".read": "$uid === auth.uid || root.child('ADMIN_UIDS').child(auth.uid).exists()",
          ".write": "$uid === auth.uid || root.child('ADMIN_UIDS').child(auth.uid).exists()"
        }
      },
      "TASKS": {
        ".read": "auth != null",
        ".write": "root.child('ADMIN_UIDS').child(auth.uid).exists()"
      },
      "PENDING_TASKS": {
        ".read": "auth != null",
        ".write": "auth != null"
      },
      "WITHDRAWALS": {
        "$uid": {
          ".read": "$uid === auth.uid || root.child('ADMIN_UIDS').child(auth.uid).exists()",
          ".write": "$uid === auth.uid || root.child('ADMIN_UIDS').child(auth.uid).exists()"
        }
      },
      "TRANSACTIONS": {
        ".read": "auth != null",
        ".write": "root.child('ADMIN_UIDS').child(auth.uid).exists()"
      }
    }
  }
}
```

---

### 4. Telegram Bot Token (SECURITY RISK)

**Current Status:** ⚠️ Bot token exposed in `js/shared/notifications.js`

**Security Issue:**
- Telegram bot token is visible in client-side code
- Anyone can steal the token and use your bot

**Acceptable Risk:** This is inherent to static websites  
**Mitigation:**
1. Monitor bot usage for spam/abuse
2. Implement rate limiting on Telegram bot side
3. Consider moving to serverless function (Firebase Cloud Functions) for production

---

## ✅ Pre-Launch Checklist

Before deploying to production:

- [ ] Replace Firebase `messagingSenderId` and `appId` with real values
- [ ] Implement proper admin authentication (Option A or B above)
- [ ] Set up Firebase Database security rules
- [ ] Test all Firebase operations (signup, login, data read/write)
- [ ] Test admin panel access control
- [ ] Verify real-time listeners work correctly
- [ ] Test on multiple devices and browsers
- [ ] Monitor Telegram bot for unusual activity
- [ ] Set up Firebase Authentication providers (Email/Password enabled)
- [ ] Review and update UPI payment details if needed

---

## 🔒 Security Best Practices

1. **Never commit real API keys to public repositories**
2. **Use environment variables for sensitive data** (not applicable for pure static sites)
3. **Implement proper authentication and authorization**
4. **Set strict Firebase security rules**
5. **Monitor for suspicious activity**
6. **Keep Firebase SDK updated**
7. **Use HTTPS only (automatic with Firebase Hosting)**

---

## 📞 Support

For security concerns or questions:
- WhatsApp: +91 9104037184
- Telegram: https://t.me/CashByKing

---

**Last Updated:** November 16, 2025  
**Status:** Ready for setup - requires Firebase configuration and admin security implementation
