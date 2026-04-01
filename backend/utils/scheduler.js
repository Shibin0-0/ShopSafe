/**
 * ShopSafe Daily Expiry Scheduler
 * Runs every day at 08:00 AM — sends Web Push notifications AND an email
 * to every subscriber / configured user email.
 */
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Product = require('../models/product');
const Settings = require('../models/settings');
const { broadcastPush } = require('../controllers/notificationController');

function getDiffDays(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((new Date(expiryDate) - today) / (1000 * 60 * 60 * 24));
}

async function runExpiryCheck() {
    console.log('[Scheduler] Running daily expiry check...');

    try {
        const products = await Product.find();
        const expired = products.filter(p => getDiffDays(p.expiryDate) < 0);
        const expiring = products.filter(p => {
            const d = getDiffDays(p.expiryDate);
            return d >= 0 && d <= 7;
        });

        const total = expired.length + expiring.length;
        console.log(`[Scheduler] Found ${expired.length} expired, ${expiring.length} expiring soon.`);

        if (total === 0) {
            console.log('[Scheduler] Inventory is healthy – no alerts needed.');
            return;
        }

        // ── 1. Web Push Notification ──────────────────────────────────────────
        const lines = [];
        expired.slice(0, 4).forEach(p => lines.push(`❌ ${p.name} — EXPIRED`));
        expiring.slice(0, 4).forEach(p => {
            const days = getDiffDays(p.expiryDate);
            lines.push(`⚠️ ${p.name} — expires in ${days} day${days !== 1 ? 's' : ''}`);
        });
        const more = total > 8 ? ` (+${total - 8} more)` : '';

        const pushPayload = {
            title: `⚠️ ShopSafe Alert — ${total} Product${total !== 1 ? 's' : ''} Need Attention`,
            body: lines.join('\n') + more,
            icon: '/icon.png',
            badge: '/icon.png',
            url: '/'
        };

        await broadcastPush(pushPayload);

        // ── 2. Email Alert ────────────────────────────────────────────────────
        const settings = await Settings.findOne({});
        const fromEmail = (settings && settings.websiteEmail) || process.env.EMAIL_USER;
        const toEmail = settings && settings.userEmail;

        if (!toEmail || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn('[Scheduler] Email skipped: EMAIL_USER / EMAIL_PASS not set or no recipient email.');
            return;
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const expiredList = expired.map(p =>
            `• ${p.name}${p.category ? ' (' + p.category + ')' : ''} — Expired on ${new Date(p.expiryDate).toLocaleDateString()}`
        ).join('\n');

        const expiringSoonList = expiring.map(p => {
            const days = getDiffDays(p.expiryDate);
            return `• ${p.name}${p.category ? ' (' + p.category + ')' : ''} — Expires in ${days} day${days !== 1 ? 's' : ''} (${new Date(p.expiryDate).toLocaleDateString()})`;
        }).join('\n');

        let body = `Hello,\n\nThis is your daily automated ShopSafe inventory alert.\n\n`;

        if (expired.length > 0) {
            body += `🚨 EXPIRED PRODUCTS (${expired.length}):\n${expiredList}\n\n`;
        }
        if (expiring.length > 0) {
            body += `⚠️  EXPIRING WITHIN 7 DAYS (${expiring.length}):\n${expiringSoonList}\n\n`;
        }

        body += `Please log into your ShopSafe dashboard to take action.\n\nBest regards,\nShopSafe Automated Alerts`;

        const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #7c3aed; margin: 0; font-size: 24px;">🛡️ ShopSafe</h1>
                <p style="color: #6b7280; margin: 4px 0 0;">Daily Inventory Alert</p>
            </div>

            ${expired.length > 0 ? `
            <div style="background: #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <h2 style="color: #dc2626; margin: 0 0 12px; font-size: 16px;">🚨 Expired Products (${expired.length})</h2>
                ${expired.map(p => `
                <div style="display: flex; align-items: center; margin-bottom: 8px; background: white; padding: 10px 12px; border-radius: 6px;">
                    <span style="font-weight: 600; color: #111;">${p.name}</span>
                    <span style="margin-left: auto; color: #dc2626; font-size: 13px;">Expired ${new Date(p.expiryDate).toLocaleDateString()}</span>
                </div>`).join('')}
            </div>` : ''}

            ${expiring.length > 0 ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <h2 style="color: #d97706; margin: 0 0 12px; font-size: 16px;">⚠️ Expiring Within 7 Days (${expiring.length})</h2>
                ${expiring.map(p => {
            const days = getDiffDays(p.expiryDate);
            return `
                <div style="display: flex; align-items: center; margin-bottom: 8px; background: white; padding: 10px 12px; border-radius: 6px;">
                    <span style="font-weight: 600; color: #111;">${p.name}</span>
                    <span style="margin-left: auto; color: #d97706; font-size: 13px;">${days} day${days !== 1 ? 's' : ''} left</span>
                </div>`;
        }).join('')}
            </div>` : ''}

            <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 24px;">
                This is an automated message from ShopSafe. Please do not reply.
            </p>
        </div>`;

        await transporter.sendMail({
            from: `ShopSafe Alerts <${fromEmail}>`,
            to: toEmail,
            subject: `⚠️ ShopSafe Daily Alert — ${total} Product${total !== 1 ? 's' : ''} Need Attention`,
            text: body,
            html: htmlBody
        });

        console.log(`[Scheduler] Email sent to ${toEmail}`);

    } catch (err) {
        console.error('[Scheduler] Error during expiry check:', err.message);
    }
}

// ── Schedule: every day at 08:21 PM ──────────────────────────────────────────
cron.schedule('21 20 * * *', runExpiryCheck, {
    timezone: 'Asia/Kolkata'  // Change to your timezone if needed
});

console.log('[Scheduler] Daily expiry alerts scheduled at 08:21 PM (Asia/Kolkata).');

// Export for manual trigger (e.g. from a test API route)
module.exports = { runExpiryCheck };
