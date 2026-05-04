import { SolanaWalletProvider } from '@/components/WalletProvider';
import { AppShell } from '@/components/AppShell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletProvider>
      <AppShell>{children}</AppShell>
    </SolanaWalletProvider>
  );
}
