export const dynamic = "force-dynamic";

async function fetchToken(token) {
  const base = process.env.PUBLIC_BASE_URL || "";
  const res = await fetch(`${base}/api/token?token=${encodeURIComponent(token)}`, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

export default async function AccessPage({ searchParams }){
  const token = searchParams?.token || "";
  if(!token) return (
    <div className="card">
      <div className="sectionTitle">Accès aux identifiants</div>
      <div className="muted">Lien invalide (token manquant).</div>
    </div>
  );
  const data = await fetchToken(token);
  if(!data) return (
    <div className="card">
      <div className="sectionTitle">Accès aux identifiants</div>
      <div className="muted">Lien invalide ou expiré.</div>
    </div>
  );

  return (
    <div className="card">
      <div className="sectionTitle">Accès aux identifiants</div>
      <div className="muted">Bonjour <b>{data.fullName}</b> — vos identifiants sont disponibles pendant <b>24h</b>.</div>

      <div style={{marginTop:12}} className="muted">
        Identifiant global : <b>{data.login}</b><br/>
        Email : <b>{data.email}</b>
      </div>

      <div className="sectionTitle">Logiciels</div>
      <div className="checks">
        {data.softwares.map((s) => (
          <form key={s} method="post" action="/api/reveal" style={{margin:0}}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="software" value={s} />
            <div className="check" style={{justifyContent:"space-between"}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span>{s}</span>
                <span className="pill">login: {data.login}</span>
              </div>
              <button className="btn btnPrimary" type="submit">Afficher le mot de passe</button>
            </div>
          </form>
        ))}
      </div>

      <div className="note">
        ⚠️ Pour votre sécurité, chaque mot de passe ne s’affiche qu’une seule fois. Pensez à le sauvegarder.
      </div>

      {data.storageMode === "memory" && (
        <div className="note">
          ⚠️ Mode démo : stockage temporaire. Pour une fiabilité totale, activer Vercel KV / Upstash Redis.
        </div>
      )}
    </div>
  );
}
