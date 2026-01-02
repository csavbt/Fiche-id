import { NextResponse } from "next/server";
import sanitize from "sanitize-filename";

import entities from "../../../data/entities.json";
import support from "../../../data/support.json";

import { encryptAESGCM, randomPassword, makeToken } from "../../../lib/crypto";
import { saveToken } from "../../../lib/storage";
import { sendMail } from "../../../lib/mailer";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function stripAccents(str){ return (str||"").normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
function normalizeName(str){ return stripAccents(str).toLowerCase().replace(/[^a-z0-9]+/g,"").trim(); }
function makeLogin(pattern, firstName, lastName){
  const f=normalizeName(firstName), l=normalizeName(lastName);
  if(pattern==="prenom.nom") return `${f}.${l}`;
  return `${(f[0]||"x")}.${l}`;
}

function todayISO(){
  const d=new Date();
  const mm=String(d.getMonth()+1).padStart(2,"0");
  const dd=String(d.getDate()).padStart(2,"0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function buildPdf({ entity, fiche, accessLink }){
  const pdfDoc = await PDFDocument.create();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const page2 = pdfDoc.addPage([595.28, 841.89]);

  const margin = 40;
  const width = 595.28;
  const height = 841.89;

  const dark = rgb(0.04, 0.07, 0.13);
  const text = rgb(0.07, 0.09, 0.11);
  const muted = rgb(0.35, 0.40, 0.45);
  const line = rgb(0.82, 0.84, 0.86);

  function header(page, subtitle){
    page.drawRectangle({ x: margin, y: height - margin - 70, width: width - margin*2, height: 70, color: dark });
    page.drawText("FICHE D’IDENTIFICATION", { x: margin+15, y: height - margin - 35, size: 18, font: helvBold, color: rgb(0.90,0.91,0.93) });
    page.drawText(subtitle, { x: margin+15, y: height - margin - 55, size: 11, font: helv, color: rgb(0.62,0.65,0.69) });
  }

  function box(page, yTop, title, lines){
    const boxW = width - margin*2;
    const lineH = 14;
    const innerTop = yTop - 24;
    const contentH = (lines.length * lineH) + 18;
    const boxH = 24 + contentH;
    const y = yTop - boxH;

    page.drawRectangle({ x: margin, y, width: boxW, height: boxH, borderColor: line, borderWidth: 1 });
    page.drawText(title, { x: margin+12, y: yTop-18, size: 12, font: helvBold, color: text });

    let yy = innerTop;
    lines.forEach((ln) => {
      page.drawText(ln, { x: margin+12, y: yy, size: 10, font: helv, color: muted, maxWidth: boxW-24 });
      yy -= lineH;
    });

    return y - 14;
  }

  function footer(page){
    const y = 55;
    page.drawText(`Support : ${support.support_email} — Tél Support : ${support.support_phone}`, { x: margin, y, size: 9, font: helv, color: muted });
    let yy = y - 12;
    (support.technicians||[]).forEach(t=>{
      page.drawText(`Technicien : ${t.name} — Tél : ${t.phone}`, { x: margin, y: yy, size: 9, font: helv, color: muted });
      yy -= 12;
    });
    page.drawText(`Responsable SI : ${support.manager.name} — Tél ${support.manager.phone} — Mail : ${support.manager.email}`, { x: margin, y: yy, size: 9, font: helv, color: muted });
  }

  // PAGE 1
  header(page1, `${entity.name} — ${entity.domain}`);
  let y = height - margin - 85;

  y = box(page1, y, "Identité", [
    `Nom / Prénom : ${fiche.fullName}`,
    `Fonction : ${fiche.role}${fiche.service ? " — " + fiche.service : ""}`,
    fiche.startDate ? `Date d’arrivée : ${fiche.startDate}` : `Date d’arrivée : ${todayISO()}`,
    fiche.endDate ? `Date de départ : ${fiche.endDate}` : null,
    fiche.phoneExt ? `Téléphone / Poste : ${fiche.phoneExt}` : null,
    `Email : ${fiche.email}`,
  ].filter(Boolean));

  y = box(page1, y, "Accès sécurisé (24h)", [
    `Identifiant : ${fiche.login}`,
    `Lien sécurisé : ${accessLink}`,
    `Les mots de passe ne figurent pas dans ce document (sécurité).`
  ]);

  y = box(page1, y, "Logiciels attribués", (fiche.softwares||[]).length ? (fiche.softwares||[]).map(s=>`• ${s}`) : ["—"]);

  const matLines = (fiche.materialItems||[]).length ? (fiche.materialItems||[]).map(it=>{
    if(it.name==="Téléphone portable"){
      return `• ${it.name} — Qté: ${it.qty} — IMEI: ${fiche.mobileImei || "—"} — N°: ${fiche.mobileNumber || "—"}`;
    }
    return `• ${it.name} — Qté: ${it.qty} — N° de série (réservé SI) : À compléter`;
  }) : ["—"];
  y = box(page1, y, "Matériel attribué", matLines);

  page1.drawText("Signatures", { x: margin, y: y, size: 11, font: helvBold, color: text });
  y -= 18;
  page1.drawText("Signature utilisateur : ____________________________    Date : ____________", { x: margin, y, size: 10, font: helv, color: text });
  y -= 18;
  page1.drawText("Signature service informatique : ___________________    Date : ____________", { x: margin, y, size: 10, font: helv, color: text });

  footer(page1);

  // PAGE 2
  header(page2, "ACCÈS & IDENTIFIANTS (SÉCURISÉ)");
  let y2 = height - margin - 85;

  y2 = box(page2, y2, "Rappel sécurité", [
    "• Les mots de passe sont accessibles via le lien sécurisé.",
    "• Le lien expire automatiquement au bout de 24 heures.",
    "• Chaque mot de passe s’affiche une seule fois."
  ]);

  y2 = box(page2, y2, "Vos identifiants", [
    `Nom / Prénom : ${fiche.fullName}`,
    `Identifiant : ${fiche.login}`,
    `Email : ${fiche.email}`,
    `Lien : ${accessLink}`
  ]);

  const tableTop = y2;
  const tableH = ((fiche.softwares||[]).length || 1) * 18 + 28;
  const boxW = width - margin*2;
  page2.drawRectangle({ x: margin, y: tableTop - tableH, width: boxW, height: tableH, borderColor: line, borderWidth: 1 });
  page2.drawText("Logiciel", { x: margin+12, y: tableTop - 18, size: 10, font: helvBold, color: muted });
  page2.drawText("Identifiant", { x: margin+300, y: tableTop - 18, size: 10, font: helvBold, color: muted });

  let rowY = tableTop - 36;
  if((fiche.softwares||[]).length===0){
    page2.drawText("—", { x: margin+12, y: rowY, size: 10, font: helv, color: text });
  } else {
    (fiche.softwares||[]).forEach(s=>{
      page2.drawText(s, { x: margin+12, y: rowY, size: 10, font: helv, color: text });
      page2.drawText(fiche.login, { x: margin+300, y: rowY, size: 10, font: helv, color: text });
      rowY -= 18;
    });
  }

  footer(page2);

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
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

    const storageInfo = await saveToken(token, {
      fullName: fiche.fullName,
      login: fiche.login,
      email: fiche.email,
      softwares: fiche.softwares,
      credentials: fiche.credentials
    }, 24*3600);

    const pdfBuffer = await buildPdf({ entity, fiche, accessLink });

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

    const mailRes = await sendMail({
      to: userEmail,
      subject,
      html,
      attachments: [{ filename: `fiche_${sanitize(entityId)}_${sanitize(lastName)}_${sanitize(firstName)}.pdf`, content: pdfBuffer }]
    });

    const headers = {
      "Content-Type":"application/pdf",
      "Content-Disposition":`attachment; filename="fiche_${sanitize(entityId)}_${sanitize(lastName)}_${sanitize(firstName)}.pdf"`,
      "X-FIP-Mail": mailRes.ok ? "sent" : `not-sent:${mailRes.reason || "unknown"}`,
      "X-FIP-Storage": storageInfo.mode || "unknown"
    };
    return new NextResponse(pdfBuffer, { status:200, headers });
  } catch(e){
    return NextResponse.json({ error: e?.message || "Erreur serveur" }, { status:500 });
  }
}
