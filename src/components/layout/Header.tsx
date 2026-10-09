'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Bell, Bookmark, BriefcaseBusiness, Building2, FileText, GraduationCap, Home, Menu, MessageSquare, Newspaper, Search, Settings, SlidersHorizontal, Users, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { cn } from '@/lib/utils/helpers';
import { Button } from '@/components/ui/Button';

const PRIMARY_ITEMS = [
  { href: '/dashboard', label: 'Today', icon: Home },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/investments', label: 'Investments', icon: BriefcaseBusiness },
  { href: '/investors', label: 'VC Engine', icon: Users },
  { href: '/yc', label: 'YC Engine', icon: GraduationCap },
  { href: '/theses', label: 'Theses', icon: SlidersHorizontal },
  { href: '/patterns', label: 'Patterns', icon: BarChart3 },
];

const WORKSPACE_ITEMS = [
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/saved', label: 'Saved research', icon: Bookmark },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/community', label: 'Community', icon: MessageSquare },
  { href: '/settings', label: 'Settings & access', icon: Settings },
];

const PUBLIC_ITEMS = [{ href: '/', label: 'Home' }, { href: '/news', label: 'News' }, { href: '/investors', label: 'VCs' }, { href: '/yc', label: 'YC' }, { href: '/pricing', label: 'Access' }];

function Brand() {
  return <Link href="/dashboard" className="brand-lockup" aria-label="Ventro dashboard"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span><strong>VENTRO</strong><small>Intelligence for what comes next</small></span></Link>;
}

function NavGroup({ items, pathname, onNavigate }: { items: typeof PRIMARY_ITEMS; pathname: string; onNavigate?: () => void }) {
  return <nav className="space-y-1" aria-label="Product navigation">{items.map(item => {
    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
    return <Link key={item.href} href={item.href} onClick={onNavigate} className={cn('side-nav-link', active && 'side-nav-link-active')} aria-current={active ? 'page' : undefined}><item.icon className="h-[18px] w-[18px]" /><span>{item.label}</span></Link>;
  })}</nav>;
}

function SidebarContent({ user, pathname, onNavigate }: { user: { email: string; entitlement: string }; pathname: string; onNavigate?: () => void }) {
  return <div className="flex h-full flex-col"><div className="px-5 py-6"><Brand /></div><div className="flex-1 overflow-y-auto px-3 pb-6"><NavGroup items={PRIMARY_ITEMS} pathname={pathname} onNavigate={onNavigate} /><div className="mx-3 my-5 border-t border-white/10" /><p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/70">Workspace</p><NavGroup items={WORKSPACE_ITEMS} pathname={pathname} onNavigate={onNavigate} /></div><div className="border-t border-white/10 p-4"><Link href="/settings?tab=access" onClick={onNavigate} className="block rounded-sm border border-white/10 bg-white/[0.04] p-3 hover:bg-white/[0.07]"><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-medium text-slate-100">{user.email.split('@')[0]}</span><span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">{user.entitlement === 'student_trial' ? 'Trial' : user.entitlement === 'subscribed' ? 'Pro' : 'Preview'}</span></div><p className="mt-1 text-xs text-slate-400">Manage profile and access</p></Link><a href="/api/auth/signout" className="mt-2 block min-h-11 px-3 py-3 text-xs font-medium text-slate-400 hover:text-white">Sign out</a></div></div>;
}

function WorkspaceBar({ user }: { user: { email: string; entitlement: string } }) {
  return <div className="app-workspace-bar hidden lg:flex"><AppSearch /><div className="ml-auto flex items-center gap-1"><Link href="/saved" className="workspace-icon-link" aria-label="Saved research"><Bookmark className="h-[18px] w-[18px]" /></Link><Link href="/alerts" className="workspace-icon-link" aria-label="Alerts"><Bell className="h-[18px] w-[18px]" /></Link><div className="workspace-account"><span>{user.email.split('@')[0]}</span><small>{user.entitlement === 'student_trial' ? '20-day trial' : user.entitlement === 'subscribed' ? 'Subscribed' : 'Preview access'}</small></div></div></div>;
}

export function Header({ user }: { user: { email: string; entitlement: string } | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (!user) return <header className="sticky top-0 z-40 border-b border-rule bg-research/95 backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"><Link href="/" className="text-lg font-black tracking-[0.14em] text-ink-950">VENTRO</Link><nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">{PUBLIC_ITEMS.map(item => <Link key={item.href} href={item.href} className={cn('text-sm font-medium text-ink-600 hover:text-ink-950', pathname === item.href && 'text-cyan-700')}>{item.label}</Link>)}</nav><div className="flex items-center gap-2"><Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link><Link href="/signup"><Button size="sm">Start research</Button></Link></div></div></header>;

  return <>
    <aside className="app-sidebar hidden lg:block"><SidebarContent user={user} pathname={pathname} /></aside>
    <WorkspaceBar user={user} />
    <header className="mobile-app-header lg:hidden"><Brand /><button className="icon-button border-white/15 text-white" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button></header>
    {open && <div className="fixed inset-0 z-[70] bg-ink-950/60 lg:hidden"><button className="absolute inset-0" onClick={() => setOpen(false)} aria-label="Close navigation" /><aside className="relative h-full w-[min(88vw,330px)] bg-ink-950 shadow-2xl"><button className="icon-button absolute right-3 top-4 border-white/15 text-white" onClick={() => setOpen(false)} aria-label="Close navigation"><X className="h-5 w-5" /></button><SidebarContent user={user} pathname={pathname} onNavigate={() => setOpen(false)} /></aside></div>}
  </>;
}

export function MobileBottomNav({ user }: { user: { entitlement: string } | null }) {
  const pathname = usePathname();
  if (!user) return null;
  const items = [PRIMARY_ITEMS[0], PRIMARY_ITEMS[1], PRIMARY_ITEMS[2], PRIMARY_ITEMS[4], WORKSPACE_ITEMS[4]];
  return <nav className="mobile-bottom-nav lg:hidden" aria-label="Bottom navigation">{items.map(item => { const active = pathname === item.href; return <Link key={item.href} href={item.href} className={cn('mobile-nav-link', active && 'text-cyan-700')} aria-current={active ? 'page' : undefined}><item.icon className="h-5 w-5" /><span>{item.label.replace(' Engine', '')}</span></Link>; })}</nav>;
}

export function AppSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (value) router.push(`/news?search=${encodeURIComponent(value)}`);
  };
  return <form className="app-search" role="search" onSubmit={submit}><Search className="h-4 w-4" /><label className="sr-only" htmlFor="workspace-search">Search Ventro</label><input id="workspace-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search investors, companies, themes, rounds" /><kbd>Enter</kbd></form>;
}
