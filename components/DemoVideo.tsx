export default function DemoVideo() {
  return (
    <section className="section" style={{ paddingTop: 80, paddingBottom: 80, textAlign: 'center' }}>
      <div className="wrap">
        <p style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 16 }}>
          Demo
        </p>
        <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, marginBottom: 40 }}>
          See it in action.
        </h2>
        <div style={{ position: 'relative', maxWidth: 800, margin: '0 auto', aspectRatio: '16/9' }}>
          <iframe
            src="https://www.youtube.com/embed/6ORTv1ppqIg?si=0CB6tY72AkTkKrZi"
            title="uWu Protocol Demo"
            frameBorder={0}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 12 }}
          />
        </div>
      </div>
    </section>
  );
}
