'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/helpers';
import { Button } from '@/components/ui/Button';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'For You', icon: 'home' },
  { href: '/news', label: 'News', icon: 'newspaper' },
  { href: '/investments', label: 'Investments', icon: 'trending-up' },
  { href: '/companies', label: 'Companies', icon: 'building-2' },
  { href: '/investors', label: 'Investors', icon: 'users' },
  { href: '/yc', label: 'YC', icon: 'graduation-cap' },
  { href: '/patterns', label: 'Patterns', icon: 'bar-chart-2' },
  { href: '/saved', label: 'Saved', icon: 'bookmark' },
  { href: '/community', label: 'Community', icon: 'message-square' },
];

const PUBLIC_NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/news', label: 'News' },
  { href: '/companies', label: 'Companies' },
  { href: '/investors', label: 'Investors' },
  { href: '/yc', label: 'YC' },
  { href: '/pricing', label: 'Pricing' },
];

export function Header({ user }: { user: { email: string; entitlement: string } | null }) {
  const pathname = usePathname();
  const isAuthenticated = !!user;

  if (!isAuthenticated) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="text-xl font-bold text-text-primary" aria-label="Ventro Home">
              Ventro
            </Link>
            <div className="hidden md:flex md:items-center md:gap-6">
              {PUBLIC_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'text-accent-blue'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </nav>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-16 items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary" aria-label="Ventro Dashboard">
            Ventro
          </Link>
          
          <div className="hidden md:flex md:items-center md:gap-1 overflow-x-auto scrollbar-hide pb-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname === item.href
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block px-3 py-1.5 text-xs font-medium rounded-full bg-accent-purple/10 text-accent-purple">
              {user.entitlement === 'discount_card' ? '10-Day Access' : user.entitlement === 'subscribed' ? 'Pro' : 'Preview'}
            </div>
            <div className="relative">
              <Button variant="ghost" size="sm" className="gap-1">
                {user.email.split('@')[0]}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </Button>
              <div className="absolute right-0 mt-2 w-48 bg-bg-secondary border border-border-default rounded-lg shadow-lg py-1 hidden group-hover:block" role="menu">
                <Link href="/settings/profile" className="block px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary" role="menuitem">Profile</Link>
                <Link href="/settings/billing" className="block px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary" role="menuitem">Billing</Link>
                <Link href="/settings/personalization" className="block px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary" role="menuitem">Personalization</Link>
                <Link href="/settings/alerts" className="block px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary" role="menuitem">Alerts</Link>
                <hr className="my-1 border-border-default" />
                <a href="/api/auth/signout" className="block px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary" role="menuitem">Sign out</a>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

export function MobileBottomNav({ user }: { user: { entitlement: string } | null }) {
  const pathname = usePathname();
  const isAuthenticated = !!user;

  if (!isAuthenticated) return null;

  const items = [
    { href: '/dashboard', label: 'For You', icon: HomeIcon },
    { href: '/news', label: 'News', icon: NewspaperIcon },
    { href: '/saved', label: 'Saved', icon: BookmarkIcon },
    { href: '/community', label: 'Community', icon: MessageSquareIcon },
    { href: '/settings', label: 'Menu', icon: MenuIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-default bg-bg-primary/95 backdrop-blur-sm md:hidden" aria-label="Bottom navigation">
      <div className="grid grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 px-2 py-2 text-xs font-medium transition-colors',
              pathname === item.href
                ? 'text-accent-blue'
                : 'text-text-muted hover:text-text-primary'
            )}
            aria-current={pathname === item.href ? 'page' : undefined}
          >
            <item.icon className="w-5 h-5" aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
}
function NewspaperIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 00-2-2H9a2 2 0 00-2 2v9a2 2 0 002 2h2m-4-4h.01" /></svg>;
}
function BookmarkIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>;
}
function MessageSquareIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>;
}
function MenuIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
}