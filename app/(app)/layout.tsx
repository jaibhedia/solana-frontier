import { SolanaWalletProvider } from '@/components/WalletProvider';
import { AppShell } from '@/components/AppShell';
import { UserPrefsProvider } from '@/contexts/UserPrefsContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletProvider>
      <UserPrefsProvider>
        <AppShell>{children}</AppShell>
      </UserPrefsProvider>
    </SolanaWalletProvider>
  );
}
