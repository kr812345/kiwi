'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Settings() {
  const [serverUrl, setServerUrl] = useState('');
  const [apiToken, setApiToken] = useState('');

  useEffect(() => {
    setServerUrl(localStorage.getItem('kiwi_server_url') || '');
    setApiToken(localStorage.getItem('kiwi_api_token') || '');
  }, []);

  const saveSettings = () => {
    localStorage.setItem('kiwi_server_url', serverUrl);
    localStorage.setItem('kiwi_api_token', apiToken);
    alert('Settings saved!');
  };
  return (
    <div className="page-container" style={{ padding: '16px', paddingBottom: '32px' }}>
      <header style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', position: 'relative' }}>
        <Link href="/profile" style={{ position: 'absolute', left: 0, color: 'var(--text)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </Link>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', width: '100%', textAlign: 'center' }}>Settings</h2>
      </header>

      
      {/* Connection */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Connection</h3>
        
        <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--surface-border)', overflow: 'hidden', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Server URL</label>
            <input 
              type="text" 
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://127.0.0.1:8080"
              style={{ width: '100%', padding: '12px', background: 'var(--background)', border: '1px solid var(--surface-border)', borderRadius: '8px', color: 'var(--text)', fontSize: '15px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>API Token</label>
            <input 
              type="password" 
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="kiwi_secret_token_dev"
              style={{ width: '100%', padding: '12px', background: 'var(--background)', border: '1px solid var(--surface-border)', borderRadius: '8px', color: 'var(--text)', fontSize: '15px' }}
            />
          </div>
          <button className="btn-primary" onClick={saveSettings} style={{ padding: '12px', marginTop: '8px' }}>Save Settings</button>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--surface-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg style={{ color: 'var(--text-muted)' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              <span style={{ fontSize: '15px' }}>Notifications</span>
            </div>
            <div style={{ width: '44px', height: '24px', background: 'var(--primary)', borderRadius: '12px', position: 'relative' }}>
              <div style={{ width: '20px', height: '20px', background: '#000', borderRadius: '50%', position: 'absolute', top: '2px', right: '2px' }}></div>
            </div>
          </div>
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
