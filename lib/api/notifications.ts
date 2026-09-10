import { http } from './http';
import { fromApi, toApi } from './case';
import { rowsOf, safeRead } from './util';
import { AppNotification, NotificationPreference } from '@/types';

function normalize(row: any): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title || (row.payload && (row.payload.project || row.payload.title)) || 'Notification',
    body: row.body,
    payload: row.payload || {},
    readAt: row.readAt ?? row.read_at ?? null,
    createdAt: row.createdAt || row.created_at || '',
  };
}

export async function getNotifications(unreadOnly = false): Promise<AppNotification[]> {
  return safeRead(async () => {
    const res = await http.get(`/notifications${unreadOnly ? '?unread=true' : ''}`);
    return rowsOf<any>(res.data).map(normalize);
  }, [], 'notifications.list');
}

export async function markNotificationRead(id: string) {
  const res = await http.patch(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllNotificationsRead() {
  const res = await http.patch('/notifications/read-all');
  return res.data;
}

export async function getNotificationPreferences(): Promise<NotificationPreference[]> {
  return safeRead(async () => {
    const res = await http.get('/notification-preferences');
    return rowsOf<NotificationPreference>(res.data);
  }, [], 'notifications.prefs');
}

export async function updateNotificationPreferences(prefs: NotificationPreference[]) {
  const res = await http.put('/notification-preferences', toApi(prefs));
  return res.data;
}

export async function sendTestNotification(type: string) {
  const res = await http.post('/notifications/test', toApi({ type }));
  return fromApi(res.data);
}

// Back-compat alias
export const markNotificationAsRead = markNotificationRead;
