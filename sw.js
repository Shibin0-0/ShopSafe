/**
 * ShopSafe Service Worker
 * Handles background push notifications from the Web Push API.
 */

// Listen for push events from the server
self.addEventListener('push', event => {
    let data = {
        title: '⚠️ ShopSafe Alert',
        body: 'You have expiring products in your inventory.',
        icon: '/icon.png',
        badge: '/icon.png',
        url: '/'
    };

    if (event.data) {
        try {
            const parsed = event.data.json();
            data = { ...data, ...parsed };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/icon.png',
        badge: data.badge || '/icon.png',
        vibrate: [200, 100, 200],
        tag: 'shopsafe-expiry-alert',   // Replaces previous alert of same tag
        renotify: true,                  // Always show even if tag already exists
        requireInteraction: true,        // Pin until user dismisses
        data: { url: data.url || '/' },
        actions: [
            { action: 'view', title: '📋 View Dashboard' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Focus existing tab if open
            for (const client of clientList) {
                if (client.url.includes('dashboard') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new tab
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Cache the app shell on install (optional, keeps things fast)
self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});
