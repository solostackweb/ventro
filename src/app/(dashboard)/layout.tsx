import { createServerClient, getProfile } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MobileBottomNav } from '@/components/layout/Header';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/dashboard');
  }

  const profile = await getProfile(user.id);

  return (
    <div className="min-h-screen bg-ink-950 lg:pl-[236px]">
      <Header user={{ email: user.email!, entitlement: profile?.entitlement || 'preview' }} />
      <main className="app-main min-h-screen">{children}</main>
      <MobileBottomNav user={{ entitlement: profile?.entitlement || 'preview' }} />
    </div>
  );
}
