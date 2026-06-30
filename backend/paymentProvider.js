// paymentProvider.js — picks which payment backend to use without touching server.js or
// the frontend. Controlled by PAYMENT_PROVIDER in .env:
//
//   PAYMENT_PROVIDER=momo          → direct MTN MoMo Collections API (backend/momo.js)
//   PAYMENT_PROVIDER=flutterwave   → Flutterwave aggregator (backend/payments.js)
//   (unset / anything else)        → defaults to flutterwave's module, which itself falls back
//                                     to simulation mode if no Flutterwave key is set either.
//
// Either module independently runs in simulation mode if its own credentials are missing, so
// you can leave PAYMENT_PROVIDER unset and demo the whole app with zero payment setup.

const provider = (process.env.PAYMENT_PROVIDER || 'flutterwave').toLowerCase();

let initiateMoMoPayment, hasLiveKey, PRICES_UGX, providerName;

if (provider === 'momo') {
  const momo = require('./momo');
  initiateMoMoPayment = momo.initiateMoMoPayment;
  hasLiveKey = momo.hasLiveKey;
  PRICES_UGX = momo.PRICES_UGX;
  providerName = 'mtn_momo_direct';
} else {
  const flutterwave = require('./payments');
  initiateMoMoPayment = flutterwave.initiateMoMoPayment;
  hasLiveKey = flutterwave.hasLiveKey;
  PRICES_UGX = flutterwave.PRICES_UGX;
  providerName = 'flutterwave';
}

module.exports = { initiateMoMoPayment, hasLiveKey, PRICES_UGX, providerName };
