let audioContext: AudioContext | null = null;

function tone(frequency: number, duration: number, type: OscillatorType = "sine"): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioContext ??= new Ctor();
    const ctx = audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch {
    /* audio is optional */
  }
}

export function playSuccessSound(enabled: boolean): void {
  if (!enabled) return;
  tone(880, 0.12);
  setTimeout(() => tone(1320, 0.16), 110);
}

export function playErrorSound(enabled: boolean): void {
  if (!enabled) return;
  tone(220, 0.25, "sawtooth");
}

export function playIncomingSound(enabled: boolean): void {
  if (!enabled) return;
  tone(660, 0.1);
  setTimeout(() => tone(990, 0.1), 90);
}

export function vibrate(enabled: boolean, pattern: number | number[] = 40): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* haptics are optional */
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function notify(enabled: boolean, title: string, body: string): void {
  if (!enabled || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icons/localsend-192.png", tag: title + body });
  } catch {
    /* notifications are optional */
  }
}
