import { AuthGuard } from '@/components/auth/auth-guard';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto py-6 px-4">{children}</main>
      </div>
    </AuthGuard>
  );
}
