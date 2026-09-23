'use client';
import KiwiMascot from '@/components/KiwiMascot';
import Link from 'next/link';

export default function History() {
  const historyData = [
    { section: 'Today', items: [
      { id: 1, title: 'Random work ideas', subtitle: 'give me some work...', time: '9:41 AM' },
      { id: 2, title: 'Under development', subtitle: 'i am under development...', time: '9:20 AM' },
      { id: 3, title: 'System check', subtitle: 'yo! all systems operational...', time: '8:15 AM' },
    ]},
    { section: 'Yesterday', items: [
      { id: 4, title: 'Project ideas', subtitle: 'help me with a saas idea...', time: '11:32 PM' },
      { id: 5, title: 'DSA doubts', subtitle: 'explain binary search...', time: '5:18 PM' },
      { id: 6, title: 'Life talk', subtitle: 'i am feeling low...', time: '2:11 PM' },
    ]}
  ];

  return (
    <div className="page-container" style={{ padding: '16px' }}>
      <header style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Chat History</h2>
      </header>

      <div style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Search chats..." 
            style={{ 
              width: '100%', 
              background: 'var(--surface)', 
              border: '1px solid var(--surface-border)', 
              borderRadius: '100px', 
              padding: '12px 12px 12px 36px', 
              color: 'var(--text)',
              fontSize: '14px',
              outline: 'none'
            }} 
          />
        </div>
      </div>

      <div style={{ paddingBottom: '32px' }}>
        {historyData.map((group, idx) => (
          <div key={idx} style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: '500' }}>{group.section}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {group.items.map(item => (
                <div key={item.id} className="kiwi-card" style={{ padding: '12px 16px', margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '40px', height: '40px', border: '1px solid var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'var(--primary)', fontSize: '14px', fontWeight: 'bold' }}>^_^</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.subtitle}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <span style={{ fontSize: '12px' }}>{item.time}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
