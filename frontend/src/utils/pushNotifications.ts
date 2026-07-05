// Push Notification Manager
export class PushNotificationManager {
    private registration: ServiceWorkerRegistration | null = null;

    async initialize(): Promise<boolean> {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push notifications not supported');
            return false;
        }

        try {
            // Register service worker
            this.registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });

            console.log('Service Worker registered:', this.registration);

            // Wait for activation
            await navigator.serviceWorker.ready;

            return true;
        } catch (error) {
            console.error('SW registration failed:', error);
            return false;
        }
    }

    async requestPermission(): Promise<NotificationPermission> {
        if (!('Notification' in window)) {
            throw new Error('Notifications not supported');
        }

        const permission = await Notification.requestPermission();
        console.log('Notification permission:', permission);
        return permission;
    }

    async subscribe(vapidPublicKey: string): Promise<PushSubscription | null> {
        if (!this.registration) {
            throw new Error('Service Worker not registered');
        }

        try {
            // Check existing subscription
            let subscription = await this.registration.pushManager.getSubscription();

            if (!subscription) {
                // Create new subscription
                subscription = await this.registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey) as any
                });

                console.log('New push subscription created');
            }

            return subscription;
        } catch (error) {
            console.error('Failed to subscribe:', error);
            return null;
        }
    }

    async unsubscribe(): Promise<boolean> {
        if (!this.registration) {
            return false;
        }

        try {
            const subscription = await this.registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                console.log('Unsubscribed from push notifications');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            return false;
        }
    }

    async getSubscription(): Promise<PushSubscription | null> {
        if (!this.registration) {
            return null;
        }

        return await this.registration.pushManager.getSubscription();
    }

    private urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async testNotification(): Promise<void> {
        if (!this.registration) {
            throw new Error('Service Worker not registered');
        }

        const options: any = { // Cast to any to allow 'vibrate' if TS definitions are outdated
            body: 'Push notifications are working!',
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            vibrate: [200, 100, 200]
        };

        await this.registration.showNotification('Semester Test', options);
    }
}

// Export singleton instance
export const pushManager = new PushNotificationManager();

