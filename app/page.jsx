import entities from "../data/entities.json";
export default function Home(){
  return (
    <div className="card">
      <div className="sectionTitle">Choisis une entité</div>
      <div className="grid">
        {entities.entities.map(e => (
          <a className="entity" href={`/entity/${e.id}`} key={e.id}>
            <img src={e.logo} alt={e.name} />
            <div>
              <div className="name">{e.name}</div>
              <div className="domain">{e.domain}</div>
            </div>
          </a>
        ))}
      </div>
      <div className="note"><span className="pill">Démo Vercel</span> — sur Vercel, les archives sont temporaires (disque éphémère). Pour la production, on branche un stockage.</div>
    </div>
  );
}
