'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  // Define navigation items based on design reference
  const navItems = [
    { name: 'Home', path: '/home', icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    )},
    { name: 'History', path: '/history', icon: (
      <svg viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    )},
    { name: 'Explore', path: '/explore', icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    )},
    { name: 'Profile', path: '/profile', icon: (
      <svg viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    )},
  ];

  // Don't show bottom nav on splash or chat screen (optional, depends on design, but usually chat is full screen)
  // According to design refs, the bottom nav is visible on History, Explore, Profile, and maybe a Home dashboard.
  // Wait, the splash screen doesn't have it, but the main Chat doesn't have it either (it has an input bar).
  if (pathname === '/chat' || pathname === '/') {
    return null; 
  }

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
        return (
          <Link href={item.path} key={item.name} className={`nav-item ${isActive ? 'active' : ''}`}>
            {item.icon}
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
