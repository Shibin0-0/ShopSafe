const express = require('express');
const router = express.Router();
const {
    getVapidPublicKey,
    subscribe,
    unsubscribe,
    sendTestPush,
    saveSettings,
    getSettings
} = require('../controllers/notificationController');

// VAPID public key for frontend subscription
router.get('/vapid-public-key', getVapidPublicKey);

// Push subscription management
router.post('/subscribe', subscribe);
router.delete('/unsubscribe', unsubscribe);

// Trigger an immediate test notification (also used by cron manually)
router.post('/test', sendTestPush);

// Email settings persistence (so cron can read them)
router.post('/settings', saveSettings);
router.get('/settings', getSettings);

module.exports = router;
