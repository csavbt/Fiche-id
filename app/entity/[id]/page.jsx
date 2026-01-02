import entities from "../../../data/entities.json";
import catalog from "../../../data/catalog.json";
import support from "../../../data/support.json";

export default function EntityPage({ params }){
  const entity = entities.entities.find(e => e.id === params.id);
  if(!entity) return <div className="card">Entité introuvable.</div>;
  return (
    <div className="card">
      <div style={{display:"flex",gap:12,alignItems:"center"}}>
        <img src={entity.logo} alt={entity.name} style={{width:56,height:56,objectFit:"contain",borderRadius:12,border:"1px solid #233045",padding:8,background:"#0a0f16"}} />
        <div>
          <div className="sectionTitle" style={{margin:0}}>{entity.name}</div>
          <div className="muted" style={{fontSize:13}}>{entity.domain}</div>
        </div>
      </div>

      <form method="post" action="/api/create" style={{marginTop:14}}>
        <input type="hidden" name="entityId" value={entity.id} />

        <div className="row">
          <div><label>Prénom</label><input name="firstName" required /></div>
          <div><label>Nom</label><input name="lastName" required /></div>
        </div>

        <div className="row" style={{marginTop:12}}>
          <div><label>Fonction</label><input name="role" required /></div>
          <div><label>Service</label><input name="service" /></div>
        </div>

        <div className="row" style={{marginTop:12}}>
          <div><label>Date d’arrivée</label><input name="startDate" type="date" /></div>
          <div><label>Date de départ</label><input name="endDate" type="date" /></div>
        </div>

<div className="row" style={{marginTop:12}}>
  <div><label>Email utilisateur (si différent)</label><input name="userEmail" placeholder="prenom.nom@domaine..." /></div>
  <div className="muted" style={{alignSelf:"end"}}>CEGID : généralement Comptabilité / RH (selon besoin).</div>
</div>


        <div className="row" style={{marginTop:12}}>
          <div><label>Téléphone / Poste</label><input name="phoneExt" placeholder="ex: 8282 / 0590..." /></div>
          <div><label>Photo (URL optionnelle — démo)</label><input name="photoUrl" placeholder="https://..." /></div>
        </div>

        <div className="sectionTitle">Logiciels</div>
        <div className="checks">
          {catalog.softwares.map(s => (
            <label className="check" key={s}>
              <input type="checkbox" name="softwares" value={s} />
              <span>{s}</span>
            </label>
          ))}
        </div>

        <div className="row" style={{marginTop:10}}>
          <div><label>Logiciel “Autre” (si coché)</label><input name="softwareOther" placeholder="Nom du logiciel..." /></div>
          <div className="muted" style={{alignSelf:"end"}}>Les mots de passe ne sont pas affichés — ils sont stockés chiffrés.</div>
        </div>

        <div className="sectionTitle">Matériel (quantité)</div>
        <div className="checks">
          {catalog.materials.map(m => (
            <div className="check" key={m} style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:10}}>
              <input type="checkbox" name="materials" value={m} />
              <span>{m}</span>
              <input name={`qty_${m}`} type="number" min="1" defaultValue="1" style={{width:90}} />
            </div>
          ))}
        </div>

        <div className="row" style={{marginTop:10}}>
          <div><label>IMEI (obligatoire si téléphone)</label><input name="mobileImei" placeholder="14–16 chiffres" /></div>
          <div><label>N° téléphone attribué (obligatoire si téléphone)</label><input name="mobileNumber" placeholder="+590..." /></div>
        </div>

        <div className="sectionTitle">Support</div>
        <div className="muted">
          {support.support_email} — Tél Support : {support.support_phone}<br/>
          Technicien : {support.technicians?.[0]?.name} — {support.technicians?.[0]?.phone}<br/>
          Technicien : {support.technicians?.[1]?.name} — {support.technicians?.[1]?.phone}<br/>
          Responsable SI : {support.manager?.name} — {support.manager?.phone} — {support.manager?.email}
        </div>

        <div style={{marginTop:14,display:"flex",gap:10,flexWrap:"wrap"}}>
          <button className="btn btnPrimary" type="submit">Générer PDF</button>
          <a className="btn" href="/">Retour</a>
        </div>
      </form>
    </div>
  );
}
