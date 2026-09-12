'use client';

import { apiFetch } from './api-client';

export type PushState = 'unsupported' | 'denied' | 'granted' | 'prompt' | 'insecure';

export function getPushState(): PushState {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  if (!window.isSecureContext) return 'insecure';
  return Notification.permission === 'default' ? 'prompt' : (Notification.permission as PushState);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return reg;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (getPushState() === 'unsupported') return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/** Ask for permission (only call this after the user has set a rule — see Launch Checklist), subscribe, and register it. */
export async function subscribeToPush(vapidPublicKey: string): Promise<'granted' | 'denied'> {
  if (!vapidPublicKey) throw new Error('Push notifications are not configured on this deployment yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = await registration();
  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));
  const json = subscription.toJSON();
  await apiFetch('/api/push/subscribe', {
    method: 'POST',
    json: {
      endpoint: json.endpoint,
      keys: json.keys,
      user_agent: navigator.userAgent.slice(0, 512),
    },
  });
  return 'granted';
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await apiFetch('/api/push/subscribe', { method: 'DELETE', json: { endpoint } });
}
