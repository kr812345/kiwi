'use client';
import KiwiMascot from '@/components/KiwiMascot';
import Link from 'next/link';

export default function Profile() {
  const menuItems = [
    { title: 'Account', subtitle: 'Manage your account details', icon: <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> },
    { title: 'Subscription', subtitle: 'Unlock more with Kiwi Pro', badge: 'Free', icon: <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg> },
    { title: 'Preferences', subtitle: 'Customize your experience', icon: <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg> },
    { title: 'Privacy & Data', subtitle: 'Your data, your control', icon: <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> },
    { title: 'Help & Support', subtitle: 'Get help or share feedback', icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> },
    { title: 'About', subtitle: 'Version v0.1.0 • Synapse OS Stream', icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> },
  ];

  return (
    <div className="page-container" style={{ padding: '16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <KiwiMascot variant="icon" mood="happy" size={40} />
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Kiwi</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Your AI buddy</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/settings" style={{ color: 'inherit' }}>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
          </Link>
        </div>
      </header>

      {/* User Info */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #2E7D32, #8be942)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <span style={{ fontSize: '32px', color: '#000', fontWeight: 'bold' }}>^_^</span>
          <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--surface)', borderRadius: '50%', padding: '4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>Krishna</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>@kr812345</p>
            </div>
            <button style={{ background: 'rgba(139, 233, 66, 0.1)', color: 'var(--primary)', border: '1px solid rgba(139, 233, 66, 0.2)', padding: '6px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: '600' }}>
              Edit Profile
            </button>
          </div>
          <p style={{ fontSize: '14px', marginBottom: '12px' }}>Building cool stuff. Talking to Kiwi. 🥝</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', background: 'var(--surface)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}>🎓 CS Student</span>
            <span style={{ fontSize: '12px', background: 'var(--surface)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}>&lt;/&gt; Builder</span>
            <span style={{ fontSize: '12px', background: 'var(--surface)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}>🍃 Lifelong Learner</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="kiwi-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg style={{ color: 'var(--primary)', marginBottom: '8px' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>124</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Conversations</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg style={{ color: 'var(--primary)', marginBottom: '8px' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>48</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Ideas explored</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg style={{ color: 'var(--primary)', marginBottom: '8px' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>27</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Prompts used</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg style={{ color: 'var(--primary)', marginBottom: '8px' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>12</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Days with Kiwi</span>
        </div>
      </div>

      {/* Quote Banner */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', position: 'relative' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Better questions.<br/>Brighter ideas.</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>— Kiwi</p>
        <div style={{ position: 'absolute', right: '16px', bottom: '16px' }}>
          <span style={{ fontSize: '48px', color: 'var(--primary)', fontWeight: 'bold' }}>^_^</span>
        </div>
      </div>

      {/* Menus */}
      <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--surface-border)', overflow: 'hidden', marginBottom: '24px' }}>
        {menuItems.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: idx !== menuItems.length - 1 ? '1px solid var(--surface-border)' : 'none', cursor: 'pointer' }}>
            <div style={{ color: 'var(--text-muted)', marginRight: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>
              {item.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '2px' }}>{item.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.subtitle}</div>
            </div>
            {item.badge && (
              <span style={{ background: 'var(--surface-hover)', border: '1px solid var(--surface-border)', padding: '2px 8px', borderRadius: '100px', fontSize: '12px', color: 'var(--text-muted)', marginRight: '12px' }}>
                {item.badge}
              </span>
            )}
            <svg style={{ color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--surface-border)', overflow: 'hidden', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px', cursor: 'pointer', color: '#ff4b4b' }}>
          <div style={{ marginRight: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </div>
          <div style={{ flex: 1, fontSize: '15px', fontWeight: '500' }}>Sign Out</div>
          <svg style={{ color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </div>

    </div>
  );
}
