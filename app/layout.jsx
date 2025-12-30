import "./globals.css";
export const metadata = { title: "Fiche Identification Pro", description: "Création de fiche + PDF" };
export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <div className="container">
          <header className="header">
            <div className="brand">Fiche Identification Pro <span className="badge">HÉBERGÉ</span></div>
            <div className="subtitle">Fiches utilisateurs • Matériel • PDF</div>
          </header>
          <main className="main">{children}</main>
          <footer className="footer">
            <div className="welcome">Bienvenue au sein de l’entreprise. Nous vous souhaitons une excellente intégration.</div>
            <div className="footerLogos" aria-label="Entités">
              <img src="/logos/cliniquecms.png" alt="CliniqueCMS" />
              <img src="/logos/groupe_cqfd_logo.jpg" alt="GroupeCQFD" />
              <img src="/logos/capesdole.png" alt="CAPES DOLE" />
              <img src="/logos/hadnbt.png" alt="HADNBT" />
              <img src="/logos/jardins de belost.png" alt="Jardins de Belost" />
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
