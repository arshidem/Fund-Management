import { requestPushPermission, isPushSupported } from '../utils/pushUtils';

class PushService {
  constructor() {
    this.swRegistration = null;
    this.isSubscribed = false;
  }

  // Initialize push notifications
  async initialize() {
    if (!isPushSupported()) {
      console.log('Push notifications not supported');
      return false;
    }

    try {
      // Register service worker
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered');

      // Check current subscription
      const subscription = await this.swRegistration.pushManager.getSubscription();
      this.isSubscribed = !(subscription === null);

      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  // Subscribe to push notifications
  async subscribe() {
    if (!this.swRegistration) {
      throw new Error('Service Worker not initialized');
    }

    try {
      // Request permission
      const permission = await requestPushPermission();
      if (permission !== 'granted') {
        throw new Error('Push permission denied');
      }

      // Subscribe to push
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(process.env.VITE_APP_VAPID_PUBLIC_KEY)
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      this.isSubscribed = true;
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe() {
    if (!this.swRegistration) {
      return;
    }

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await this.removeSubscriptionFromServer(subscription);
        this.isSubscribed = false;
      }
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
    }
  }

  // Send subscription to backend
  async sendSubscriptionToServer(subscription) {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        subscription,
        userAgent: navigator.userAgent,
        os: this.getOS(),
        browser: this.getBrowser()
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save subscription');
    }
  }

  // Remove subscription from backend
  async removeSubscriptionFromServer(subscription) {
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint
      })
    });
  }

  // Utility function to convert VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  getOS() {
    const userAgent = navigator.userAgent;
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Mac/.test(userAgent)) return 'MacOS';
    if (/Linux/.test(userAgent)) return 'Linux';
    if (/Android/.test(userAgent)) return 'Android';
    if (/iOS|iPhone|iPad|iPod/.test(userAgent)) return 'iOS';
    return 'Unknown';
  }

  getBrowser() {
    const userAgent = navigator.userAgent;
    if (/Edg/.test(userAgent)) return 'Edge';
    if (/Chrome/.test(userAgent)) return 'Chrome';
    if (/Firefox/.test(userAgent)) return 'Firefox';
    if (/Safari/.test(userAgent)) return 'Safari';
    return 'Unknown';
  }
}

export default new PushService();