import { urlBase64ToUint8Array } from '../utils/pushUtils';
import { useAppContext } from '../context/AppContext';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const subscribeUserToPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return null;
  }

  const { token } = useAppContext(); // Get token from context
  if (!token) return null;

  try {
    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const userAgent = navigator.userAgent;
    const os = navigator.platform;
    const browser = getBrowserName(userAgent);

    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription, userAgent, os, browser }),
    });

    if (!res.ok) throw new Error('Failed to save subscription');

    console.log('✅ Push subscription successful');
    return subscription;
  } catch (err) {
    console.error('Push subscription error:', err);
    return null;
  }
};

function getBrowserName(userAgent) {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Unknown';
}

export const unsubscribeUserFromPush = async () => {
  const { token } = useAppContext();
  if (!token) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();

      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      console.log('✅ Unsubscribed from push notifications');
    }
  } catch (err) {
    console.error('Push unsubscribe error:', err);
  }
};
