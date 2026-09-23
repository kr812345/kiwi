'use client';
import KiwiMascot from '@/components/KiwiMascot';
import Link from 'next/link';

export default function Explore() {
  return (
    <div className="page-container" style={{ padding: '16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <KiwiMascot variant="icon" mood="happy" size={40} />
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Kiwi</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Explore ideas, prompts and more.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ background: 'var(--surface)', border: 'none', color: 'var(--text)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
        </div>
      </header>

      {/* Banner */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px', position: 'relative', overflow: 'hidden' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          <span style={{ color: '#fff' }}>✨ Ideas start</span><br/>
          <span className="text-primary">with a conversation.</span>
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '60%' }}>
          Ask Kiwi anything - code, ideas, clarifications or just random thoughts.
        </p>
        <Link href="/chat" style={{ textDecoration: 'none' }}>
          <button className="btn-primary" style={{ width: 'auto', padding: '12px 20px', fontSize: '14px' }}>
            Start Chat <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </Link>
      </div>

      {/* Try asking Kiwi */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Try asking Kiwi</h3>
          <span className="text-primary" style={{ fontSize: '14px' }}>See all →</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {['Help with coding', 'Brainstorm ideas', 'Learn something', 'Just talk'].map((item, i) => (
            <div key={i} className="kiwi-card" style={{ flexDirection: 'column', alignItems: 'flex-start', margin: 0, padding: '12px' }}>
              <div style={{ color: 'var(--primary)', marginBottom: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>{item}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>"Explain this..."</div>
            </div>
          ))}
        </div>
      </div>

      {/* Popular Topics */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Popular Topics</h3>
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
          {['Web Dev', 'AI / ML', 'DSA', 'Career', 'Product', 'Life'].map((topic, i) => (
            <div key={i} className="kiwi-card" style={{ flex: '0 0 auto', margin: 0, padding: '12px 16px', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>{topic}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
