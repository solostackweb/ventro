import { Header } from '@/components/layout/Header';
import { MobileBottomNav } from '@/components/layout/Header';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header user={null} />
      <main className="flex-1">{children}</main>
      <MobileBottomNav user={null} />
    </div>
  );
}