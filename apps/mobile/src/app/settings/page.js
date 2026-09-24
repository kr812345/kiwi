'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Settings() {
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState('');
  const [apiToken, setApiToken] = useState('');

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [pushSubJson, setPushSubJson] = useState('');

  useEffect(() => {
    setServerUrl(localStorage.getItem('kiwi_server_url') || '');
    setApiToken(localStorage.getItem('kiwi_api_token') || '');

    // Check notification status on load
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('kiwi_server_url', serverUrl);
    localStorage.setItem('kiwi_api_token', apiToken);
    alert('Settings saved!');
  };

  const handleNotificationToggle = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications.');
      return;
    }

    if (Notification.permission === 'granted') {
      testLocalNotification();
      subscribeToPush();
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
      if (permission === 'granted') {
        testLocalNotification();
        subscribeToPush();
      }
    } else {
      alert('Notifications are blocked by your browser settings. Please enable them in Brave settings.');
    }
  };

  const subscribeToPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BCZuVPRs8LQgzEp0hX2DF77sLnMJvkbYAwlADS5aJ0BJo6duVgntIh1oVmZJni9jeqKDqWVpiyFdExTKzmns7fk'
      });
      setPushSubJson(JSON.stringify(sub, null, 2));
    } catch (err) {
      console.error('Failed to subscribe:', err);
    }
  };

  const testLocalNotification = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        registration.showNotification('Kiwi', {
          body: 'oyi krishna missing you, your kiwi.',
          icon: '/icon-192.png',
          vibrate: [200, 100, 200],
        });
      } catch (err) {
        console.error('Service Worker registration failed:', err);
      }
    } else {
      new Notification('Kiwi', { body: 'oyi krishna missing you, your kiwi.' });
    }
  };

  return (
    <div className="page-container" style={{ padding: '16px', paddingBottom: '32px' }}>
      <header style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', position: 'relative' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', position: 'absolute', left: 0, color: 'var(--text)', cursor: 'pointer', padding: 0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', width: '100%', textAlign: 'center' }}>Settings</h2>
      </header>

      {/* Connection */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Connection</h3>
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--surface-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Server URL</label>
            <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="https://api.kiwi.itskrishna.live" style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--background)', color: 'var(--text)' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>API Token</label>
            <input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder="Secret Token" style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--background)', color: 'var(--text)' }} />
          </div>
          <button onClick={saveSettings} style={{ background: 'var(--primary)', color: '#000', padding: '10px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px' }}>Save Connection</button>
        </div>
      </div>

      {/* Appearance */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Appearance</h3>
        
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--primary)', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <svg style={{ color: 'var(--primary)' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <span style={{ fontSize: '12px', fontWeight: '500' }}>Dark</span>
          </div>
          <div style={{ flex: 1, background: 'var(--background)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <svg style={{ color: 'var(--text-muted)' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>Light</span>
          </div>
          <div style={{ flex: 1, background: 'var(--background)', border: '1px solid var(--surface-border)', borderRadius: '12px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <svg style={{ color: 'var(--text-muted)' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-muted)' }}>System</span>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--surface-border)' }}>
            <span style={{ fontSize: '15px' }}>Accent Color</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary)' }}></div>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Kiwi Green</span>
              <svg style={{ color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
            <span style={{ fontSize: '15px' }}>Use Compact Mode</span>
            <div style={{ width: '44px', height: '24px', background: 'var(--surface-border)', borderRadius: '12px', position: 'relative' }}>
              <div style={{ width: '20px', height: '20px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: '2px' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* App */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>App</h3>
        
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg style={{ color: 'var(--text-muted)' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span style={{ fontSize: '15px' }}>Install as PWA</span>
            </div>
            <svg style={{ color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div onClick={handleNotificationToggle} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg style={{ color: 'var(--text-muted)' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              <span style={{ fontSize: '15px' }}>Notifications {notificationsEnabled ? '(Test)' : ''}</span>
            </div>
            <div style={{ width: '44px', height: '24px', background: notificationsEnabled ? 'var(--primary)' : 'var(--surface-border)', borderRadius: '12px', position: 'relative', transition: 'background 0.3s' }}>
              <div style={{ width: '20px', height: '20px', background: notificationsEnabled ? '#000' : '#fff', borderRadius: '50%', position: 'absolute', top: '2px', right: notificationsEnabled ? '2px' : 'auto', left: notificationsEnabled ? 'auto' : '2px', transition: 'all 0.3s' }}></div>
            </div>
          </div>
          {pushSubJson && (
            <div style={{ padding: '16px', borderBottom: '1px solid var(--surface-border)' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Push Subscription Data (Copy to test-push.js):</p>
              <textarea 
                readOnly 
                value={pushSubJson}
                style={{ width: '100%', height: '100px', background: 'var(--background)', color: 'var(--text)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '8px', fontSize: '11px', fontFamily: 'monospace' }}
              />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg style={{ color: 'var(--text-muted)' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span style={{ fontSize: '15px' }}>Auto clear old chats</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>30 days</span>
              <svg style={{ color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>About</h3>
        
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg style={{ color: 'var(--text-muted)' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <span style={{ fontSize: '15px' }}>Version</span>
            </div>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>v0.1.0</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg style={{ color: 'var(--text-muted)' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <span style={{ fontSize: '15px' }}>Synapse OS Stream</span>
            </div>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
          </div>
        </div>
      </div>

    </div>
  );
}
