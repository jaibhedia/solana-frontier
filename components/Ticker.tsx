const items = [
  'Settlement, witnessed',
  'Oracle attestation v2',
  'No custody · no screenshots',
  'Escrow releases on proof',
  'Built for any protocol that needs verified fiat',
  'Neutral · permissionless · verifiable',
  'Twelve currencies live',
  'One on-chain call',
];

const loop = [...items, ...items];

export default function Ticker() {
  return (
    <div className="ticker">
      <div className="ticker-track">
        {loop.map((t, i) => (
          <span key={i}><span className="pip"></span>{t}</span>
        ))}
      </div>
    </div>
  );
}
