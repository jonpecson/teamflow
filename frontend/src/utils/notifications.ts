let permissionGranted = false;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  permissionGranted = result === 'granted';
  return permissionGranted;
}

export function showNotification(title: string, body: string, onClick?: () => void) {
  if (!permissionGranted || document.hasFocus()) return; // Don't notify if app is focused

  const notification = new Notification(title, {
    body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    silent: false,
  });

  if (onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }

  // Auto-close after 5 seconds
  setTimeout(() => notification.close(), 5000);
}

export function notifyMessage(username: string, content: string, channelName: string) {
  showNotification(
    `${username} in #${channelName}`,
    content.length > 100 ? content.slice(0, 100) + '...' : content,
  );
}

export function notifyCallStarted(caller: string, channelName: string) {
  const isDm = channelName.startsWith('dm-');
  showNotification(
    isDm ? `${caller} is calling you` : `${caller} started a huddle`,
    isDm ? 'Direct message' : `#${channelName}`,
  );
}

export function notifyCallJoined(username: string, channelName: string) {
  const isDm = channelName.startsWith('dm-');
  if (isDm) return; // Don't notify join for 1:1 calls
  showNotification(
    `${username} joined the huddle`,
    `#${channelName}`,
  );
}
