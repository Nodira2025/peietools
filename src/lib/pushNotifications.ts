/**
 * Helper para notificaciones nativas en segundo plano / barra de notificaciones del sistema
 * (Windows, macOS, Android, iOS con PWA instalada).
 */

export interface NativeNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  onClickUrl?: string;
  silent?: boolean;
}

/**
 * Verifica si el navegador/dispositivo soporta notificaciones nativas.
 */
export function checkNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Obtiene el estado del permiso actual ('granted', 'denied', 'default').
 */
export function getNotificationPermissionState(): NotificationPermission {
  if (!checkNotificationSupport()) return 'denied';
  return Notification.permission;
}

/**
 * Solicita permisos al usuario para emitir notificaciones nativas en el sistema.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!checkNotificationSupport()) return 'denied';

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error solicitando permisos de notificación:', error);
    return 'denied';
  }
}

/**
 * Emite un sonido de alerta suave utilizando Web Audio API (no requiere archivos externos).
 */
export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Frecuencia doble bip agradable (880Hz -> 1320Hz)
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Ignorar si el usuario no ha interactuado aún con el audio
  }
}

/**
 * Muestra una notificación en la barra del dispositivo (Celular o PC).
 */
export async function showNativeNotification(
  title: string,
  options: NativeNotificationOptions = {}
): Promise<boolean> {
  if (!checkNotificationSupport()) return false;

  if (Notification.permission !== 'granted') {
    return false;
  }

  const iconUrl = options.icon || '/pwa-192x192.png';
  const soundDisabled = options.silent ?? false;

  if (!soundDisabled) {
    playNotificationSound();
  }

  // Si hay Service Worker activo (típico en PWA), preferimos el Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: options.body || '',
          icon: iconUrl,
          badge: options.badge || iconUrl,
          tag: options.tag || 'peie-notification',
          data: {
            url: options.onClickUrl || '/notificaciones',
            ...options.data,
          },
        });
        return true;
      }
    } catch (e) {
      console.warn('Fallback a Notification API estándar:', e);
    }
  }

  // Fallback con API Estándar de Notificación del Navegador
  try {
    const notification = new Notification(title, {
      body: options.body,
      icon: iconUrl,
      tag: options.tag,
      data: options.data,
    });

    notification.onclick = function (event) {
      event.preventDefault();
      window.focus();
      if (options.onClickUrl) {
        window.location.href = options.onClickUrl;
      }
      notification.close();
    };

    return true;
  } catch (e) {
    console.error('Error al mostrar notificación nativa:', e);
    return false;
  }
}
