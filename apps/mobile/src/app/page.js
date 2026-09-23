'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Splash() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert('To install the app, please use your browser\'s "Add to Home Screen" feature.');
    }
  };
  return (
    <div className="page-container splash-container" style={{ alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ 
          width: '120px', 
          height: '120px', 
          border: '2px solid var(--primary)', 
          borderRadius: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 30px var(--primary-glow)',
          marginBottom: '24px'
        }}>
          <span style={{ fontSize: '48px', color: 'var(--text)', fontWeight: 'bold' }}>^_^</span>
        </div>
        
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '16px', color: '#fff' }}>Kiwi</h1>
        
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '18px', maxWidth: '280px', lineHeight: '1.5' }}>
          Your AI buddy for code, ideas and random talks.
        </p>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '32px' }}>
        <Link href="/chat" style={{ textDecoration: 'none' }}>
          <button className="btn-primary">
            Continue 
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
        </Link>
        
        {!isStandalone && (
          <button className="btn-outline" onClick={handleInstallClick}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Install App
          </button>
        )}
      </div>
      
    </div>
  );
}
