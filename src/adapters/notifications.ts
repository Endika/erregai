export async function ensureNotifyPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export function notify(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body })
}
