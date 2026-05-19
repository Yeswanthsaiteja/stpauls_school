/**
 * api.js
 * Axios client for the FastAPI slim backend.
 * Used for: Razorpay payments, WhatsApp/SMS, AI insights, PDF generation, finance reports.
 * All Firestore CRUD is handled directly from the frontend via firebase/ services.
 */
import axios from 'axios';
import { auth, isFirebaseConfigured } from '../lib/firebase';

const BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Firebase ID token to every request
API.interceptors.request.use(async (config) => {
  if (isFirebaseConfigured && auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      console.warn('Could not get Firebase token', e);
    }
  }
  return config;
});

// ─── OTP (unauthenticated — user is not yet logged in) ───────────────────────
// Uses a separate axios instance with NO auth interceptor.
const OTP_API = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export const otpAPI = {
  sendOTP: (phone) => OTP_API.post('/api/notify/send-otp', { phone }),
  verifyOTP: (phone, otp) => OTP_API.post('/api/notify/verify-otp', { phone, otp }),
};

// ─── AI Insights ─────────────────────────────────────────────────────────────
export const aiAPI = {
  getInsights: (payload) => API.post('/api/ai/insights', payload),
  getCertificateText: (payload) => API.post('/api/ai/certificate-text', payload),
};

// ─── Finance Reports (aggregated by FastAPI reading Firestore) ────────────────
export const reportsAPI = {
  getFeeSummary: (params) => API.get('/api/reports/fee-summary', { params }),
  getLedger: (params) => API.get('/api/reports/ledger', { params }),
  exportCsv: (collection, params) => API.get(`/api/reports/export/${collection}`, { params, responseType: 'blob' }),
};

// ─── Razorpay Payments ────────────────────────────────────────────────────────
export const paymentsAPI = {
  createOrder: (payload) => API.post('/api/payments/create-order', payload),
  verifyPayment: (payload) => API.post('/api/payments/verify', payload),
};

// ─── WhatsApp / SMS Notifications ────────────────────────────────────────────
export const notifyAPI = {
  sendWhatsApp: (payload) => API.post('/api/notify/whatsapp', payload),
  sendSMS: (payload) => API.post('/api/notify/sms', payload),
  sendBulk: (payload) => API.post('/api/notify/bulk', payload),
  sendFeeReminder: (studentId, txnId) =>
    API.post('/api/notify/fee-reminder', { studentId, txnId }),
  sendAttendanceAlert: (studentName, parentPhone, date, status) =>
    API.post('/api/notify/attendance-alert', { studentName, parentPhone, date, status }),
};

// ─── PDF Generation ───────────────────────────────────────────────────────────
export const pdfAPI = {
  getReceipt: (txnId) =>
    API.get(`/api/pdf/receipt/${txnId}`, { responseType: 'blob' }),
  getCertificate: (payload) =>
    API.post('/api/pdf/certificate', payload, { responseType: 'blob' }),
};

// ─── RFID ─────────────────────────────────────────────────────────────────────
export const rfidAPI = {
  getLog: (params) => API.get('/api/rfid/log', { params }),
};

export default API;
