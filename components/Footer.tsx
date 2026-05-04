export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <a href="#" className="brand" style={{ fontSize: 22 }}>
              <span className="seal"></span>
              <span>uWu Protocol</span>
            </a>
            <p className="tagline" style={{ marginTop: 16 }}>
              A neutral attestation layer for crypto&thinsp;↔&thinsp;fiat settlement. Made with care, from many timezones.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#">Explorer</a>
            <a href="#">Terminal</a>
            <a href="#">Dashboard</a>
            <a href="#">API</a>
          </div>
          <div>
            <h4>Learn</h4>
            <a href="#">Docs</a>
            <a href="#">Whitepaper</a>
            <a href="#">Security</a>
            <a href="#">Audits</a>
          </div>
          <div>
            <h4>Connect</h4>
            <a href="#">Twitter / X</a>
            <a href="#">GitHub</a>
            <a href="#">Discord</a>
            <a href="#">Mirror blog</a>
          </div>
        </div>

        <div className="jumbo">
          <span>u</span><span className="it">W</span><span>u</span>
        </div>

        <div className="footer-legal">
          <span>© 2026 uWu Protocol</span>
          <span>Crafted with ink + silicon · v0.9.2</span>
        </div>
      </div>
    </footer>
  );
}
