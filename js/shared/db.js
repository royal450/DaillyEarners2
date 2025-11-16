// Database Helper Utilities
import { database, DB_ROOT } from './firebase-config.js';
import { ref, set, get, update, remove, onValue, off, push, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Helper to get database reference
export function dbRef(path) {
  return ref(database, `${DB_ROOT}/${path}`);
}

// Read data once
export async function getData(path) {
  const snapshot = await get(dbRef(path));
  return snapshot.exists() ? snapshot.val() : null;
}

// Write data
export async function setData(path, data) {
  return await set(dbRef(path), data);
}

// Update data
export async function updateData(path, updates) {
  return await update(dbRef(path), updates);
}

// Delete data
export async function deleteData(path) {
  return await remove(dbRef(path));
}

// Push new data with auto-generated key
export async function pushData(path, data) {
  const newRef = push(dbRef(path));
  await set(newRef, data);
  return newRef.key;
}

// Subscribe to real-time updates
export function subscribe(path, callback) {
  const reference = dbRef(path);
  onValue(reference, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null, snapshot);
  });
  return reference;
}

// Unsubscribe from updates
export function unsubscribe(reference) {
  off(reference);
}

// Run transaction (for atomic updates like balance changes)
export async function runDbTransaction(path, updateFn) {
  return await runTransaction(dbRef(path), updateFn);
}

// Get server timestamp
export function getServerTimestamp() {
  return serverTimestamp();
}

// Generate unique ID
export function generateId() {
  return push(dbRef('temp')).key;
}

// Helper to update balance atomically
export async function updateBalance(userId, amount, reason) {
  const userBalancePath = `USERS/${userId}/financialInfo/balance`;
  const userEarnedPath = `USERS/${userId}/financialInfo/totalEarned`;
  
  await runDbTransaction(userBalancePath, (currentBalance) => {
    return (currentBalance || 0) + amount;
  });
  
  if (amount > 0) {
    await runDbTransaction(userEarnedPath, (currentEarned) => {
      return (currentEarned || 0) + amount;
    });
  }
  
  // Log transaction
  const transactionId = generateId();
  await setData(`TRANSACTIONS/${transactionId}`, {
    userId,
    type: amount > 0 ? 'credit' : 'debit',
    amount: Math.abs(amount),
    reason,
    timestamp: getServerTimestamp()
  });
  
  return true;
}
