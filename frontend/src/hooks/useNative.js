/**
 * useNative.js — Capacitor native bridge hooks
 *
 * All hooks gracefully degrade on web (they simply no-op or return null).
 * On Android/iOS they call real native APIs via Capacitor plugins.
 *
 * Usage:
 *   const { isNative, networkStatus, addPushListener } = useNative();
 */
import { useEffect, useState, useCallback } from 'react';

// Safely import Capacitor — only available in native builds
let Capacitor, Network, Haptics, Camera, CameraResultType, CameraSource, StatusBar, Style;

try {
  ({ Capacitor } = require('@capacitor/core'));
  ({ Network } = require('@capacitor/network'));
  ({ Haptics } = require('@capacitor/haptics'));
  ({ Camera, CameraResultType, CameraSource } = require('@capacitor/camera'));
  ({ StatusBar, Style } = require('@capacitor/status-bar'));
} catch {
  // Running in a browser environment without Capacitor — all APIs will be no-ops
  Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' };
}

// ── Is this running inside the Capacitor native shell? ───────────────────────
export const isNative = Capacitor?.isNativePlatform?.() ?? false;
export const platform = Capacitor?.getPlatform?.() ?? 'web'; // 'android' | 'ios' | 'web'

// ── Network status hook ──────────────────────────────────────────────────────
export function useNetworkStatus() {
  const [online, setOnline] = useState(true);
  const [connectionType, setConnectionType] = useState('unknown');

  useEffect(() => {
    if (!isNative || !Network) return;

    let listener;
    (async () => {
      try {
        const status = await Network.getStatus();
        setOnline(status.connected);
        setConnectionType(status.connectionType);

        listener = await Network.addListener('networkStatusChange', (s) => {
          setOnline(s.connected);
          setConnectionType(s.connectionType);
        });
      } catch {}
    })();

    return () => { listener?.remove?.(); };
  }, []);

  // Web fallback — use navigator.onLine
  useEffect(() => {
    if (isNative) return;
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return { online, connectionType };
}

// ── Push Notifications ───────────────────────────────────────────────────────
export function usePushNotifications({ onNotification, onToken } = {}) {
  const [token, setToken] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('unknown');

  const requestPermission = useCallback(async () => {
    if (!isNative || !PushNotifications) return false;
    try {
      const perm = await PushNotifications.requestPermissions();
      setPermissionStatus(perm.receive);
      if (perm.receive === 'granted') {
        await PushNotifications.register();
        return true;
      }
      return false;
    } catch { return false; }
  }, []);

  useEffect(() => {
    if (!isNative || !PushNotifications) return;
    const listeners = [];

    (async () => {
      const perm = await PushNotifications.checkPermissions().catch(() => ({ receive: 'unknown' }));
      setPermissionStatus(perm.receive);
    })();

    listeners.push(
      PushNotifications.addListener('registration', (t) => {
        setToken(t.value);
        onToken?.(t.value);
      }),
      PushNotifications.addListener('pushNotificationReceived', (n) => {
        onNotification?.(n);
      }),
      PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
        onNotification?.(a.notification);
      }),
    );

    return () => { listeners.forEach((l) => l.then?.((r) => r.remove())); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { token, permissionStatus, requestPermission };
}

// ── Haptic feedback ──────────────────────────────────────────────────────────
export function useHaptics() {
  const impact = useCallback(async (style = 'MEDIUM') => {
    if (!isNative || !Haptics) return;
    try { await Haptics.impact({ style }); } catch {}
  }, []);

  const notification = useCallback(async (type = 'SUCCESS') => {
    if (!isNative || !Haptics) return;
    try { await Haptics.notification({ type }); } catch {}
  }, []);

  const vibrate = useCallback(async () => {
    if (!isNative || !Haptics) return;
    try { await Haptics.vibrate(); } catch {}
  }, []);

  return { impact, notification, vibrate };
}

// ── Camera ───────────────────────────────────────────────────────────────────
export function useCamera() {
  const takePhoto = useCallback(async () => {
    if (!isNative || !Camera) return null;
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });
      return photo.dataUrl; // base64 data URL
    } catch { return null; }
  }, []);

  const pickFromGallery = useCallback(async () => {
    if (!isNative || !Camera) return null;
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });
      return photo.dataUrl;
    } catch { return null; }
  }, []);

  return { takePhoto, pickFromGallery };
}

// ── Status bar colour ─────────────────────────────────────────────────────────
export function useStatusBar() {
  const setColor = useCallback(async (color = '#4f46e5', isDark = true) => {
    if (!isNative || !StatusBar) return;
    try {
      await StatusBar.setBackgroundColor({ color });
      await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    } catch {}
  }, []);

  return { setColor };
}

// ── Offline banner helper ─────────────────────────────────────────────────────
export function OfflineBanner() {
  const { online } = useNetworkStatus();
  if (online) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      background: '#ef4444', color: '#fff',
      textAlign: 'center', padding: '6px 12px',
      fontSize: '12px', fontWeight: 700,
      zIndex: 9999, letterSpacing: '0.05em',
    }}>
      ⚠️ No internet connection — some data may be outdated
    </div>
  );
}
