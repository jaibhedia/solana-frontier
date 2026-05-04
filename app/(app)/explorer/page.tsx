import { ExplorerTable } from '@/components/ExplorerTable';

export default function ExplorerPage() {
  return (
    <div className="page-stack">
      <div>
        <h1 className="page-title">Trade Explorer</h1>
        <p className="page-sub">
          All uWu trades on Solana Devnet. Look up any trade by ID or filter by status.
        </p>
      </div>
      <ExplorerTable />
    </div>
  );
}
