// payments.js — Flutterwave integration for Mobile Money payments (MTN MoMo / Airtel Money).
// Set FLUTTERWAVE_SECRET_KEY in .env to go live. Without it, runs in sandbox/simulation mode
// so the full payment flow (UI, DB records, status updates) can still be demoed.
const axios = require('axios');
const db = require('./db');

const FLW_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || '';
const hasLiveKey = Boolean(FLW_SECRET_KEY && FLW_SECRET_KEY.length > 10);
const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

const PRICES_UGX = {
  per_question: 5000,
  subscription: 30000,
  document: 25000,
};

/**
 * Initiates a Mobile Money charge via Flutterwave.
 * Returns a payment record + (if live) a redirect link for the user to complete payment.
 */
async function initiateMoMoPayment({ userId, conversationId, type, phone, email }) {
  const amountUgx = PRICES_UGX[type] || PRICES_UGX.per_question;

  const payment = await db.createPayment({
    userId,
    conversationId,
    amountUgx,
    type,
    provider: 'flutterwave',
    status: 'pending',
  });

  if (!hasLiveKey) {
    // Simulation mode — auto-mark as success after creation so the demo flow completes.
    // This is clearly labeled; swap in real keys for production.
    await db.updatePaymentStatus(payment.id, 'success');
    return {
      payment: { ...payment, status: 'success' },
      live: false,
      redirectUrl: null,
      message: 'SIMULATION MODE — no FLUTTERWAVE_SECRET_KEY set. Payment auto-marked as successful for demo purposes.',
    };
  }

  try {
    const response = await axios.post(
      `${FLW_BASE_URL}/payments`,
      {
        tx_ref: payment.id,
        amount: amountUgx,
        currency: 'UGX',
        redirect_url: process.env.PAYMENT_REDIRECT_URL || 'https://example.com/payment-complete',
        customer: { email: email || `${phone}@mshauri.app`, phonenumber: phone },
        payment_options: 'mobilemoneyuganda',
        customizations: { title: 'Mshauri', description: `Payment for ${type.replace('_', ' ')}` },
      },
      {
        headers: {
          Authorization: `Bearer ${FLW_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      payment,
      live: true,
      redirectUrl: response.data?.data?.link || null,
      message: 'Redirect user to complete Mobile Money payment.',
    };
  } catch (err) {
    await db.updatePaymentStatus(payment.id, 'failed');
    const message = err.response?.data?.message || err.message;
    return { payment: { ...payment, status: 'failed' }, live: true, redirectUrl: null, message };
  }
}

/**
 * Verifies a payment by transaction reference (called from webhook or polling).
 */
async function verifyPayment(txRef) {
  if (!hasLiveKey) {
    return { status: 'success', live: false };
  }
  try {
    const response = await axios.get(`${FLW_BASE_URL}/transactions/${txRef}/verify`, {
      headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
    });
    const status = response.data?.data?.status === 'successful' ? 'success' : 'failed';
    await db.updatePaymentStatus(txRef, status);
    return { status, live: true };
  } catch (err) {
    return { status: 'failed', live: true, error: err.message };
  }
}

module.exports = { initiateMoMoPayment, verifyPayment, PRICES_UGX, hasLiveKey };
