import { useAppContext } from '../context/AppContext';

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

export const subscribeUser = async (swRegistration, backendUrl, token, vapidPublicKey) => {
  try {
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    await fetch(`${backendUrl}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subscription,
        userAgent: navigator.userAgent,
        os: navigator.platform,
        browser: navigator.appVersion,
      }),
    });

    console.log('✅ Push subscription saved');
  } catch (err) {
    console.error('Push subscription failed:', err);
  }
};
