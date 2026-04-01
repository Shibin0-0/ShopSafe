const webpush = require('web-push');
const PushSubscription = require('../models/pushSubscription');
const Settings = require('../models/settings');
const Product = require('../models/product');
const nodemailer = require('nodemailer');

// ── VAPID Public Key ──────────────────────────────────────────────────────────
exports.getVapidPublicKey = (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

// ── Subscribe ─────────────────────────────────────────────────────────────────
exports.subscribe = async (req, res) => {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        return res.status(400).json({ message: 'Invalid subscription object' });
    }

    try {
        await PushSubscription.findOneAndUpdate(
            { endpoint },
            { endpoint, keys },
            { upsert: true, new: true }
        );
        res.status(201).json({ message: 'Subscription saved' });
    } catch (err) {
        console.error('[Push] Subscribe error:', err.message);
        res.status(500).json({ message: err.message });
    }
};

// ── Unsubscribe ───────────────────────────────────────────────────────────────
exports.unsubscribe = async (req, res) => {
    const { endpoint } = req.body;
    try {
        await PushSubscription.findOneAndDelete({ endpoint });
        res.json({ message: 'Unsubscribed successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── Internal: send push to all subscribers ────────────────────────────────────
exports.broadcastPush = async (payload) => {
    const subscriptions = await PushSubscription.find();
    if (!subscriptions.length) return;

    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@shopsafe.app',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );

    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const results = await Promise.allSettled(
        subscriptions.map(sub =>
            webpush.sendNotification(
                { endpoint: sub.endpoint, keys: sub.keys },
                payloadStr
            ).catch(async err => {
                // Remove stale/expired subscriptions (HTTP 410)
                if (err.statusCode === 410) {
                    await PushSubscription.findOneAndDelete({ endpoint: sub.endpoint });
                }
                throw err;
            })
        )
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`[Push] Sent: ${results.length - failed}/${results.length}`);
};

// ── Test Push (immediate, triggered via API) ──────────────────────────────────
exports.sendTestPush = async (req, res) => {
    try {
        // Find expiring / expired items for the notification payload
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const soon = new Date(today);
        soon.setDate(soon.getDate() + 7);

        const products = await Product.find();
        const expired = products.filter(p => new Date(p.expiryDate) < today);
        const expiring = products.filter(p => {
            const d = new Date(p.expiryDate);
            return d >= today && d <= soon;
        });

        const total = expired.length + expiring.length;
        if (total === 0) {
            return res.json({ message: 'No expiring items – nothing to notify about.' });
        }

        const lines = [];
        expired.slice(0, 3).forEach(p => lines.push(`❌ ${p.name} — EXPIRED`));
        expiring.slice(0, 3).forEach(p => {
            const days = Math.ceil((new Date(p.expiryDate) - today) / 86400000);
            lines.push(`⚠️ ${p.name} — expires in ${days} day${days !== 1 ? 's' : ''}`);
        });
        const more = total > 6 ? ` (+${total - 6} more)` : '';

        const payload = {
            title: `⚠️ ShopSafe: ${total} Product${total !== 1 ? 's' : ''} Need Attention`,
            body: lines.join('\n') + more,
            icon: '/icon.png',
            badge: '/icon.png',
            url: '/'
        };

        await exports.broadcastPush(payload);
        res.json({ message: `Push notification sent to all subscribers (${total} items).` });
    } catch (err) {
        console.error('[Push] Test push error:', err.message);
        res.status(500).json({ message: err.message });
    }
};

// ── Save Settings (email addresses) ──────────────────────────────────────────
exports.saveSettings = async (req, res) => {
    try {
        const { websiteEmail, userEmail } = req.body;
        await Settings.findOneAndUpdate(
            {},
            { websiteEmail: websiteEmail || '', userEmail: userEmail || '', updatedAt: new Date() },
            { upsert: true }
        );
        res.json({ message: 'Settings saved' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── Get Settings ──────────────────────────────────────────────────────────────
exports.getSettings = async (req, res) => {
    try {
        const s = await Settings.findOne({});
        res.json(s || { websiteEmail: '', userEmail: '' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
