// momo.js — Direct MTN Mobile Money (MoMo) Collections API integration.
// No middleman/aggregator — talks straight to MTN's Open API.
// Docs: https://momodeveloper.mtn.com (sign up, subscribe to "Collections" product)
//
// Set these in .env to go live:
//   MOMO_SUBSCRIPTION_KEY   — from your MTN MoMo Developer Portal subscription
//   MOMO_API_USER           — UUID you generate via the sandbox/production provisioning API
//   MOMO_API_KEY            — generated alongside the API user
//   MOMO_TARGET_ENVIRONMENT — 'sandbox' while testing, 'mtnuganda' (or your country code) live
//   MOMO_CALLBACK_URL       — optional webhook MTN can POST payment status updates to
//
// Without these set, this module runs in the same offline/simulation mode as payments.js —
// every charge is created in the DB and auto-marked successful, clearly labeled, so the rest
// of the app (UI, paywall, document gating) is fully testable with zero setup.

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY || '';
const API_USER = process.env.MOMO_API_USER || '';
const API_KEY = process.env.MOMO_API_KEY || '';
const TARGET_ENV = process.env.MOMO_TARGET_ENVIRONMENT || 'sandbox';
const CALLBACK_URL = process.env.MOMO_CALLBACK_URL || '';

const hasLiveKey = Boolean(SUBSCRIPTION_KEY && API_USER && API_KEY);

const BASE_URL =
  TARGET_ENV === 'sandbox'
    ? 'https://sandbox.momodeveloper.mtn.com'
    : 'https://proxy.momoapi.mtn.com'; // swap for MTN's production host per your country

const PRICES_UGX = {
  per_question: 5000,
  subscription: 30000,
  document: 25000,
};

/**
 * Gets a short-lived OAuth access token from MTN, required before any Collections call.
 */
async function getAccessToken() {
  const credentials = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
  const response = await axios.post(
    `${BASE_URL}/collection/token/`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      },
    }
  );
  return response.data.access_token;
}

/**
 * Requests payment ("Request to Pay") from a customer's MTN MoMo wallet.
 * This triggers a USSD prompt on the customer's phone asking them to approve the charge.
 */
async function initiateMoMoPayment({ userId, conversationId, type, phone, payerMessage }) {
  const amountUgx = PRICES_UGX[type] || PRICES_UGX.per_question;
  const referenceId = uuidv4();

  const payment = await db.createPayment({
    userId,
    conversationId,
    amountUgx,
    type,
    provider: 'mtn_momo_direct',
    status: 'pending',
  });

  if (!hasLiveKey) {
    // Simulation mode — clearly labeled, auto-succeeds so the rest of the flow is testable.
    await db.updatePaymentStatus(payment.id, 'success');
    return {
      payment: { ...payment, status: 'success' },
      live: false,
      referenceId: null,
      message:
        'SIMULATION MODE — no MTN MoMo credentials set (MOMO_SUBSCRIPTION_KEY / MOMO_API_USER / MOMO_API_KEY). ' +
        'Payment auto-marked as successful for demo purposes.',
    };
  }

  try {
    const accessToken = await getAccessToken();
    const normalizedPhone = phone.replace(/^\+/, ''); // MTN expects no leading +

    await axios.post(
      `${BASE_URL}/collection/v1_0/requesttopay`,
      {
        amount: String(amountUgx),
        currency: 'UGX',
        externalId: payment.id,
        payer: { partyIdType: 'MSISDN', partyId: normalizedPhone },
        payerMessage: payerMessage || `Mshauri - ${type.replace('_', ' ')}`,
        payeeNote: `Payment for ${type}`,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': TARGET_ENV,
          'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
          'Content-Type': 'application/json',
          ...(CALLBACK_URL ? { 'X-Callback-Url': CALLBACK_URL } : {}),
        },
      }
    );

    // MTN responds 202 Accepted with no body — the actual result is async.
    // Store the referenceId so /momo/:referenceId/status can poll it later.
    await db.updatePaymentStatus(payment.id, 'pending');

    return {
      payment,
      live: true,
      referenceId,
      message: 'Payment request sent — customer will get a USSD prompt on their phone to approve.',
    };
  } catch (err) {
    await db.updatePaymentStatus(payment.id, 'failed');
    const message = err.response?.data?.message || err.message;
    return { payment: { ...payment, status: 'failed' }, live: true, referenceId: null, message };
  }
}

/**
 * Polls MTN for the current status of a Request to Pay by its referenceId.
 * Call this a few seconds after initiateMoMoPayment, or on a webhook if MOMO_CALLBACK_URL is set.
 */
async function checkPaymentStatus(referenceId, paymentId) {
  if (!hasLiveKey) {
    return { status: 'SUCCESSFUL', live: false };
  }

  try {
    const accessToken = await getAccessToken();
    const response = await axios.get(
      `${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Target-Environment': TARGET_ENV,
          'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
        },
      }
    );

    const mtnStatus = response.data.status; // PENDING | SUCCESSFUL | FAILED
    const mappedStatus = mtnStatus === 'SUCCESSFUL' ? 'success' : mtnStatus === 'FAILED' ? 'failed' : 'pending';

    if (paymentId && mappedStatus !== 'pending') {
      await db.updatePaymentStatus(paymentId, mappedStatus);
    }

    return { status: mtnStatus, live: true };
  } catch (err) {
    return { status: 'FAILED', live: true, error: err.message };
  }
}

module.exports = { initiateMoMoPayment, checkPaymentStatus, PRICES_UGX, hasLiveKey };
