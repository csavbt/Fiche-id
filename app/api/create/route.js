import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import sanitize from "sanitize-filename";
import PDFDocument from "pdfkit";

import entities from "../../../data/entities.json";
import support from "../../../data/support.json";

const AES_KEY_B64 = (process.env.AES_KEY_BASE64 || "").trim();
const AES_KEY = AES_KEY_B64 ? Buffer.from(AES_KEY_B64, "base64") : null;

function stripAccents(str){ return (str||"").normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
function normalizeName(str){ return stripAccents(str).toLowerCase().replace(/[^a-z0-9]+/g,"").trim(); }
function makeLogin(pattern, firstName, lastName){
  const f=normalizeName(firstName), l=normalizeName(lastName);
  if(pattern==="prenom.nom") return `${f}.${l}`;
  return `${(f[0]||"x")}.${l}`;
}
function randomPassword(len=18){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*_-+=?";
  const bytes=crypto.randomBytes(len);
  let out=""; for(let i=0;i<len;i++) out += chars[bytes[i]%chars.length];
  return out;
}
function encryptAESGCM(plaintext){
  if(!AES_KEY) return { error:"AES key missing" };
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm", AES_KEY, iv);
  const enc=Buffer.concat([cipher.update(plaintext,"utf8"), cipher.final()]);
  const tag=cipher.getAuthTag();
  return { alg:"aes-256-gcm", iv:iv.toString("base64"), tag:tag.toString("base64"), data:enc.toString("base64") };
}
function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }

function computeArchivePath(entityId, firstName, lastName){
  const year = new Date().getFullYear().toString();
  const entFolder = sanitize(entityId.toUpperCase());
  const personFolder = sanitize(`${normalizeName(lastName).toUpperCase()}_${stripAccents(firstName).trim()}`) || "SANS_NOM";
  return path.join("/tmp","FIP_ARCHIVES",entFolder,year,personFolder);
}

function drawFooter(doc){
  doc.moveDown(1.2);
  doc.fontSize(9).fillColor("#444");
  doc.text(`Support : ${support.support_email} — Tél Support : ${support.support_phone}`);
  (support.technicians||[]).forEach(t => doc.text(`Technicien : ${t.name} — Tél : ${t.phone}`));
  doc.text(`Responsable SI : ${support.manager.name} — Tél ${support.manager.phone} — Mail : ${support.manager.email}`);
  doc.fillColor("#000");
}

function generatePdf2Pages({ outPath, entity, fiche }){
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:"A4",margin:50});
    const stream=fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.fontSize(18).text("FICHE D’IDENTIFICATION UTILISATEUR",{align:"center"});
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor("#555").text(`${entity.name} — ${entity.domain}`,{align:"center"});
    doc.fillColor("#000").moveDown(1);

    doc.fontSize(13).text("Identité",{underline:true});
    doc.moveDown(0.4);
    doc.fontSize(11);
    doc.text(`Nom / Prénom : ${fiche.fullName}`);
    doc.text(`Fonction : ${fiche.role}`);
    if(fiche.service) doc.text(`Service : ${fiche.service}`);
    if(fiche.startDate) doc.text(`Date d’arrivée : ${fiche.startDate}`);
    if(fiche.endDate) doc.text(`Date de départ : ${fiche.endDate}`);
    if(fiche.phoneExt) doc.text(`Téléphone / Poste : ${fiche.phoneExt}`);
    doc.text(`Identifiant : ${fiche.login}`);
    doc.text(`Email : ${fiche.email}`);

    doc.moveDown(0.8);
    doc.fontSize(13).text("Logiciels attribués",{underline:true});
    doc.moveDown(0.3);
    doc.fontSize(11);
    if((fiche.softwares||[]).length===0) doc.text("—");
    (fiche.softwares||[]).forEach(s=>doc.text(`• ${s} (login: ${fiche.login})`));

    doc.moveDown(0.8);
    doc.fontSize(13).text("Signature email (modèle)",{underline:true});
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#222");
    doc.text(`${entity.name}`);
    doc.text(`${fiche.firstName} ${fiche.lastName} — ${fiche.role}${fiche.service ? " — "+fiche.service : ""}`);
    if(fiche.phoneExt) doc.text(`${fiche.phoneExt}`);
    doc.text(`${fiche.email}`);
    doc.text(`${entity.address}${entity.phone ? " — "+entity.phone : ""}`);
    doc.fillColor("#000");

    drawFooter(doc);

    doc.addPage();
    doc.fontSize(18).text("BON DE RÉCEPTION DU MATÉRIEL",{align:"center"});
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor("#555").text(`${fiche.fullName}`,{align:"center"});
    doc.fillColor("#000").moveDown(1);

    doc.fontSize(13).text("Matériel attribué",{underline:true});
    doc.moveDown(0.5);
    doc.fontSize(11);
    const items = fiche.materialItems || [];
    if(items.length===0) doc.text("—");
    items.forEach(it=>{
      const extra = it.name==="Téléphone portable"
        ? ` — IMEI: ${fiche.mobileImei||"—"} — N°: ${fiche.mobileNumber||"—"}`
        : " — N° de série (réservé SI): À compléter";
      doc.text(`• ${it.name} — Quantité: ${it.qty}${extra}`);
    });

    doc.moveDown(1);
    doc.fontSize(10).fillColor("#444").text("Je reconnais avoir reçu le matériel listé ci-dessus, en bon état de fonctionnement.");
    doc.fillColor("#000").moveDown(1);

    doc.fontSize(11).text("Signatures :",{underline:true});
    doc.moveDown(0.6);
    doc.text("Signature utilisateur : ____________________________    Date : ____________");
    doc.moveDown(0.6);
    doc.text("Signature technicien : ____________________________    Date : ____________");

    drawFooter(doc);

    doc.end();
    stream.on("finish",()=>resolve());
    stream.on("error",reject);
  });
}

export async function POST(req){
  try{
    const form = await req.formData();
    const entityId = (form.get("entityId")||"").toString();
    const entity = entities.entities.find(e=>e.id===entityId);
    if(!entity) return NextResponse.json({error:"Entité introuvable"},{status:404});

    const firstName=(form.get("firstName")||"").toString().trim();
    const lastName=(form.get("lastName")||"").toString().trim();
    const role=(form.get("role")||"").toString().trim();
    const service=(form.get("service")||"").toString().trim();
    const phoneExt=(form.get("phoneExt")||"").toString().trim();
    const startDate=(form.get("startDate")||"").toString().trim();
    const endDate=(form.get("endDate")||"").toString().trim();

    const softwaresRaw=form.getAll("softwares").map(x=>x.toString());
    const softwareOther=(form.get("softwareOther")||"").toString().trim();
    let softwares = softwaresRaw.filter(Boolean);
    if(softwares.includes("Autre") && softwareOther){
      softwares = softwares.filter(s=>s!=="Autre").concat([`Autre: ${softwareOther}`]);
    }

    const materialsRaw=form.getAll("materials").map(x=>x.toString()).filter(Boolean);
    const mobileImei=(form.get("mobileImei")||"").toString().trim();
    const mobileNumber=(form.get("mobileNumber")||"").toString().trim();

    if(materialsRaw.includes("Téléphone portable")){
      if(!mobileImei || !/^[0-9]{14,16}$/.test(mobileImei)) return NextResponse.json({error:"IMEI obligatoire (14 à 16 chiffres) si Téléphone portable coché."},{status:400});
      if(!mobileNumber) return NextResponse.json({error:"N° de téléphone attribué obligatoire si Téléphone portable coché."},{status:400});
    }

    const login=makeLogin(entity.email_pattern, firstName, lastName);
    const email=`${login}@${entity.domain}`;

    const credentials={};
    for(const s of softwares){
      const pwd=randomPassword(18);
      credentials[s]={ login, password_encrypted: encryptAESGCM(pwd) };
    }

    const materialItems = materialsRaw.map(name=>{
      const qtyKey=`qty_${name}`;
      const qtyVal=parseInt((form.get(qtyKey)||"1").toString(),10);
      return { name, qty: (Number.isFinite(qtyVal)&&qtyVal>0)?qtyVal:1 };
    });

    const archivePath=computeArchivePath(entityId, firstName, lastName);
    ensureDir(archivePath);

    const fiche={
      entity_id:entityId, entity_name:entity.name, created_at:new Date().toISOString(),
      firstName,lastName,fullName:`${lastName.toUpperCase()} ${firstName}`,
      role,service,phoneExt,startDate,endDate,
      login,email,softwares,materialItems,mobileImei,mobileNumber,credentials,status:"DRAFT"
    };

    fs.writeFileSync(path.join(archivePath,"fiche.json"), JSON.stringify(fiche,null,2), "utf-8");
    const pdfPath=path.join(archivePath,"fiche_identification.pdf");
    await generatePdf2Pages({ outPath: pdfPath, entity, fiche });

    const pdfBuffer=fs.readFileSync(pdfPath);
    return new NextResponse(pdfBuffer, {
      status:200,
      headers:{
        "Content-Type":"application/pdf",
        "Content-Disposition":`attachment; filename="fiche_${entityId}_${lastName}_${firstName}.pdf"`
      }
    });
  } catch(e){
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status:500 });
  }
}
