export function DownloadPage() {
  return (
    <main className="download-page">
      <section className="download-card">
        <div className="download-content">
          <p className="download-eyebrow">FINAL-YEAR STUDENT PROJECT</p>
          <h1>Math Rush <span>3D</span></h1>
          <p className="download-intro">Choose arithmetic gates, grow your crowd and race toward the final challenge. Download the Android build or play directly in your mobile browser.</p>

          <div className="download-actions">
            <a className="download-button download-primary" href="/downloads/MathRush3D-v1.2.0.apk" download>Download for Android</a>
            <a className="download-button download-secondary" href="/">Play in browser</a>
          </div>

          <div className="download-details">
            <p><strong>Version:</strong> 1.2.0</p>
            <p><strong>File size:</strong> approximately 4.5 MB</p>
            <p><strong>Platform:</strong> Android APK. iPhone and iPad users should select Play in browser.</p>
            <p>This is a student-project build distributed outside the Google Play Store.</p>
          </div>

          <p className="download-install"><strong>Android installation:</strong> After downloading, open the APK. Your phone may ask you to allow installation from your browser or Files app. Only continue if you downloaded it from this official Math Rush 3D page.</p>
          <p className="download-checksum">SHA-256: 7D06F0B7693A89CAA377808D9050F05606C9211F577FB41095369C067F89234C</p>
        </div>

        <aside className="download-qr-panel">
          <div className="download-qr-frame">
            <img src="/download/mathrush3d-download-qr.png" alt="QR code for the Math Rush 3D mobile download page" />
          </div>
          <h2>Scan to open on mobile</h2>
          <p>The QR code opens this download page, so future Android builds can use the same address.</p>
        </aside>
      </section>
    </main>
  )
}
