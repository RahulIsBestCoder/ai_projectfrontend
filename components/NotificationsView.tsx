'use client';

import React, { useEffect, useState } from 'react';
import {
  Bell,
  Loader2,
  CheckCheck,
  ShieldAlert,
  CalendarX,
  RefreshCcwDot,
  Flag,
  FileText,
  AtSign,
  UserPlus,
} from 'lucide-react';
import { AppNotification, NotificationPreference } from '@/types';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreferences,
  sendTestNotification,
} from '@/lib/api';

const TYPE_ICON: Record<string, React.ElementType> = {
  risk_alert: ShieldAlert,
  deadline_slip: CalendarX,
  sync_failed: RefreshCcwDot,
  sprint_closeout: Flag,
  report_ready: FileText,
  mention: AtSign,
  assignment: UserPlus,
};

export const NotificationsView: React.FC<{ onToast: (m: string) => void }> = ({ onToast }) => {
  const [tab, setTab] = useState<'feed' | 'prefs'>('feed');
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);

  const load = () => getNotifications().then(setItems);

  useEffect(() => {
    load();
    getNotificationPreferences().then(setPrefs);
  }, []);

  const markOne = async (id: string) => {
    try {
      await markNotificationRead(id);
      setItems((prev) =>
        prev ? prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) : prev
      );
    } catch (err: any) {
      onToast(err?.msg || 'Failed to mark read');
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsRead();
      onToast('All notifications marked read');
      load();
    } catch (err: any) {
      onToast(err?.msg || 'Failed to mark all read');
    }
  };

  const togglePref = (eventType: string, key: 'inApp' | 'email') => {
    setPrefs((prev) => prev.map((p) => (p.eventType === eventType ? { ...p, [key]: !p[key] } : p)));
  };

  const savePrefs = async () => {
    try {
      await updateNotificationPreferences(prefs);
      onToast('Notification preferences saved');
    } catch (err: any) {
      onToast(err?.msg || 'Failed to save preferences');
    }
  };

  const test = async (type: string) => {
    try {
      await sendTestNotification(type);
      onToast(`Test "${type}" queued`);
      if (tab === 'feed') load();
    } catch (err: any) {
      onToast(err?.msg || 'Test notification endpoint unavailable');
    }
  };

  const unread = items?.filter((n) => !n.readAt).length || 0;

  return (
    <div className="space-y-5">
      <div className="p-5 bg-white border-2 border-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-indigo-700 text-xs font-black uppercase tracking-widest">
          <Bell className="w-4 h-4" />
          <span>Notifications {unread > 0 && <span className="text-rose-600">• {unread} unread</span>}</span>
        </div>
        <div className="flex gap-2">
          {(['feed', 'prefs'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border ${
                tab === t ? 'bg-slate-900 text-white border-black' : 'bg-white text-slate-600 border-slate-300'
              }`}
            >
              {t === 'feed' ? 'Feed' : 'Preferences'}
            </button>
          ))}
          {tab === 'feed' && (
            <button
              onClick={markAll}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider border border-slate-300"
            >
              <CheckCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {tab === 'feed' ? (
        items === null ? (
          <div className="p-10 bg-white border border-slate-300 flex items-center justify-center text-slate-500 text-xs font-mono uppercase tracking-widest">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <div className="bg-white border border-slate-300">
            {items.map((n) => {
              const Icon = TYPE_ICON[n.type] || Bell;
              return (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-slate-100 last:border-0 flex items-start gap-3 ${
                    n.readAt ? 'opacity-60' : ''
                  }`}
                >
                  <div className="w-8 h-8 bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{n.title}</span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {n.body && <p className="text-[11px] text-slate-600 font-mono mt-0.5">{n.body}</p>}
                    <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">{n.type}</span>
                  </div>
                  {!n.readAt && (
                    <button
                      onClick={() => markOne(n.id)}
                      className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              );
            })}
            {!items.length && (
              <div className="p-8 text-center text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Nothing here yet
              </div>
            )}
          </div>
        )
      ) : (
        <div className="bg-white border border-slate-300">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 border-b border-slate-300 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span>Event type</span>
            <span>In-app</span>
            <span>Email</span>
            <span>Test</span>
          </div>
          {prefs.map((p) => (
            <div
              key={p.eventType}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-slate-100 last:border-0"
            >
              <span className="text-xs font-mono text-slate-800">{p.eventType}</span>
              <Toggle on={p.inApp} onClick={() => togglePref(p.eventType, 'inApp')} />
              <Toggle on={p.email} onClick={() => togglePref(p.eventType, 'email')} />
              <button
                onClick={() => test(p.eventType)}
                className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider"
              >
                Send
              </button>
            </div>
          ))}
          <div className="p-4">
            <button
              onClick={savePrefs}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-widest border border-black"
            >
              Save preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Toggle: React.FC<{ on: boolean; onClick: () => void }> = ({ on, onClick }) => (
  <button
    onClick={onClick}
    className={`w-10 h-5 border flex items-center px-0.5 transition ${
      on ? 'bg-indigo-600 border-indigo-700 justify-end' : 'bg-slate-200 border-slate-300 justify-start'
    }`}
  >
    <span className="w-4 h-4 bg-white block" />
  </button>
);
