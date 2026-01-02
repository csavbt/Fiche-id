import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sanitize from "sanitize-filename";
import PDFDocument from "pdfkit";

import entities from "../../../data/entities.json";
import support from "../../../data/support.json";

import { encryptAESGCM, randomPassword, makeToken } from "../../../lib/crypto";
import { saveToken } from "../../../lib/storage";
import { sendMail } from "../../../lib/mailer";

export const dynamic = "force-dynamic";

function stripAccents(str){ return (str||"").normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
function normalizeName(str){ return stripAccents(str).toLowerCase().replace(/[^a-z0-9]+/g,"").trim(); }
function makeLogin(pattern, firstName, lastName){
  const f=normalizeName(firstName), l=normalizeName(lastName);
  if(pattern==="prenom.nom") return `${f}.${l}`;
  return `${(f[0]||"x")}.${l}`;
}
function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }

function computeArchivePath(entityId, firstName, lastName){
  const year = new Date().getFullYear().toString();
  const entFolder = sanitize(entityId.toUpperCase());
  const personFolder = sanitize(`${normalizeName(lastName).toUpperCase()}_${stripAccents(firstName).trim()}`) || "SANS_NOM";
  return path.join("/tmp","FIP_ARCHIVES",entFolder,year,personFolder);
}

function drawFooter(doc){
  doc.moveDown(1.0);
  doc.fontSize(9).fillColor("#4b5563");
  doc.text(`Support : ${support.support_email} — Tél Support : ${support.support_phone}`);
  (support.technicians||[]).forEach(t => doc.text(`Technicien : ${t.name} — Tél : ${t.phone}`));
  doc.text(`Responsable SI : ${support.manager.name} — Tél ${support.manager.phone} — Mail : ${support.manager.email}`);
  doc.fillColor("#111827");
}

function drawHeaderBand(doc, subtitle){
  const topY = 40;
  doc.save();
  doc.rect(40, topY, 515, 70).fill("#0b1220");
  doc.fillColor("#e5e7eb").fontSize(18).text("FICHE D’IDENTIFICATION", 55, topY+18, { width: 460 });
  doc.fillColor("#9ca3af").fontSize(11).text(subtitle, 55, topY+45, { width: 460 });
  doc.restore();
  doc.moveDown(4.2);
  doc.fillColor("#111827");
}

function box(doc, title, lines){
  doc.save();
  const x = 40, w = 515;
  const y = doc.y;
  const h = 18 + lines.length*14 + 14;
  doc.roundedRect(x, y, w, h, 10).stroke("#d1d5db");
  doc.fillColor("#111827").fontSize(12).text(title, x+12, y+10);
  let yy = y + 28;
  doc.fillColor("#374151").fontSize(10);
  for(const line of lines){
    doc.text(line, x+12, yy, { width: w-24 });
    yy += 14;
  }
  doc.restore();
  doc.moveDown(h/14 + 0.6);
}

function generatePdfModern({ outPath, entity, fiche, accessLink }){
  return new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:"A4",margin:40});
    const stream=fs.createWriteStream(outPath);
    doc.pipe(stream);

    // PAGE 1
    drawHeaderBand(doc, `${entity.name} — ${entity.domain}`);

    box(doc, "Identité", [
      `Nom / Prénom : ${fiche.fullName}`,
      `Fonction : ${fiche.role}${fiche.service ? " — " + fiche.service : ""}`,
      fiche.startDate ? `Date d’arrivée : ${fiche.startDate}` : null,
      fiche.endDate ? `Date de départ : ${fiche.endDate}` : null,
      fiche.phoneExt ? `Téléphone / Poste : ${fiche.phoneExt}` : null,
      `Email : ${fiche.email}`,
    ].filter(Boolean));

    box(doc, "Accès sécurisé (24h)", [
      `Identifiant : ${fiche.login}`,
      `Lien sécurisé : ${accessLink}`,
      "Les mots de passe ne figurent pas dans ce document (sécurité)."
    ]);

    box(doc, "Logiciels attribués", (fiche.softwares||[]).length ? (fiche.softwares||[]).map(s => `• ${s}`) : ["—"]);

    box(doc, "Matériel attribué", (fiche.materialItems||[]).length ? (fiche.materialItems||[]).map(it => {
      if(it.name==="Téléphone portable"){
        return `• ${it.name} — Qté: ${it.qty} — IMEI: ${fiche.mobileImei || "—"} — N°: ${fiche.mobileNumber || "—"}`;
      }
      return `• ${it.name} — Qté: ${it.qty} — N° de série (réservé SI) : À compléter`;
    }) : ["—"]);

    doc.moveDown(0.2);
    doc.fillColor("#111827").fontSize(11).text("Signatures", { underline: true });
    doc.moveDown(0.6);
    doc.fontSize(10).text("Signature utilisateur : ____________________________    Date : ____________");
    doc.moveDown(0.6);
    doc.text("Signature service informatique : ___________________    Date : ____________");

    drawFooter(doc);

    // PAGE 2
    doc.addPage();
    drawHeaderBand(doc, "ACCÈS & IDENTIFIANTS (SÉCURISÉ)");

    box(doc, "Rappel sécurité", [
      "• Les mots de passe sont accessibles via le lien sécurisé.",
      "• Le lien expire automatiquement au bout de 24 heures.",
      "• Chaque mot de passe s’affiche une seule fois."
    ]);

    box(doc, "Vos identifiants", [
      `Nom / Prénom : ${fiche.fullName}`,
      `Identifiant : ${fiche.login}`,
      `Email : ${fiche.email}`,
      `Lien : ${accessLink}`
    ]);

    doc.moveDown(0.2);
    doc.fillColor("#111827").fontSize(12).text("Logiciels", { underline: true });
    doc.moveDown(0.6);

    const startY = doc.y;
    const height = ((fiche.softwares||[]).length || 1) * 18 + 28;
    doc.roundedRect(40, startY-8, 515, height, 10).stroke("#d1d5db");

    doc.fillColor("#6b7280").fontSize(10).text("Logiciel", 55, startY, { width: 260 });
    doc.text("Identifiant", 335, startY, { width: 200 });

    let yy = startY + 16;
    doc.fillColor("#111827").fontSize(10);
    if((fiche.softwares||[]).length===0){
      doc.text("—", 55, yy);
    } else {
      (fiche.softwares||[]).forEach(s=>{
        doc.text(s, 55, yy, { width: 260 });
        doc.text(fiche.login, 335, yy, { width: 200 });
        yy += 18;
      });
    }

    doc.moveDown(6);
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

    const token = makeToken();
    const base = (process.env.PUBLIC_BASE_URL || "").trim() || (new URL(req.url)).origin;
    const accessLink = `${base}/acces?token=${token}`;

    const fiche={
      entity_id:entityId, entity_name:entity.name, created_at:new Date().toISOString(),
      firstName,lastName,fullName:`${lastName.toUpperCase()} ${firstName}`,
      role,service,phoneExt,startDate,endDate,
      login,email,softwares,materialItems,mobileImei,mobileNumber,
      credentials, status:"DRAFT",
      accessLink
    };

    fs.writeFileSync(path.join(archivePath,"fiche.json"), JSON.stringify(fiche,null,2), "utf-8");

    const storageInfo = await saveToken(token, {
      fullName: fiche.fullName,
      login: fiche.login,
      email: fiche.email,
      softwares: fiche.softwares,
      credentials: fiche.credentials,
      storageMode: undefined
    }, 24*3600);

    const pdfPath=path.join(archivePath,"fiche_identification.pdf");
    await generatePdfModern({ outPath: pdfPath, entity, fiche, accessLink });

    const userEmail = (form.get("userEmail")||"").toString().trim() || fiche.email;
    const subject = `Vos accès — ${entity.name}`;
    const html = `
      <p>Bonjour <b>${firstName}</b>,</p>
      <p>Bienvenue au sein de <b>${entity.name}</b>.</p>
      <p>Voici votre lien sécurisé (valable <b>24h</b>) pour récupérer vos mots de passe :</p>
      <p><a href="${accessLink}">${accessLink}</a></p>
      <p>Le PDF récapitulatif est joint à ce message.</p>
      <p style="color:#6b7280;font-size:12px">Support : ${support.support_email} — ${support.support_phone}</p>
    `;

    const pdfBuffer = fs.readFileSync(pdfPath);
    const mailRes = await sendMail({
      to: userEmail,
      subject,
      html,
      attachments: [{ filename: `fiche_${entityId}_${lastName}_${firstName}.pdf`, content: pdfBuffer }]
    });

    const headers = {
      "Content-Type":"application/pdf",
      "Content-Disposition":`attachment; filename="fiche_${entityId}_${lastName}_${firstName}.pdf"`,
      "X-FIP-Mail": mailRes.ok ? "sent" : `not-sent:${mailRes.reason || "unknown"}`,
      "X-FIP-Storage": storageInfo.mode || "unknown"
    };
    return new NextResponse(pdfBuffer, { status:200, headers });
  } catch(e){
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status:500 });
  }
}
