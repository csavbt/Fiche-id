import { NextResponse } from "next/server";
import { getToken, markTokenUsed } from "../../../lib/storage";
import { decryptAESGCM } from "../../../lib/crypto";

export const dynamic = "force-dynamic";

export async function POST(req){
  const form = await req.formData();
  const token = (form.get("token") || "").toString();
  const software = (form.get("software") || "").toString();
  if(!token || !software) return NextResponse.json({ error:"missing fields" }, { status:400 });

  const data = await getToken(token);
  if(!data) return NextResponse.json({ error:"invalid/expired" }, { status:404 });
  if(data.used) return NextResponse.json({ error:"token already used" }, { status:410 });

  const cred = data.credentials?.[software];
  if(!cred) return NextResponse.json({ error:"credential not found" }, { status:404 });

  await markTokenUsed(token);

  const password = decryptAESGCM(cred.password_encrypted);
  const html = `
  <html><head><meta charset="utf-8"/><title>Mot de passe</title>
  <style>
    body{font-family:system-ui;max-width:720px;margin:40px auto;padding:0 16px}
    .card{border:1px solid #e5e7eb;border-radius:16px;padding:16px}
    code{font-size:18px;padding:10px 12px;border:1px solid #ddd;border-radius:10px;display:inline-block}
    .muted{color:#6b7280}
  </style>
  </head><body>
    <div class="card">
      <h2>Mot de passe — ${software}</h2>
      <p class="muted">Identifiant : <b>${data.login}</b></p>
      <p>Voici votre mot de passe (affiché une seule fois) :</p>
      <p><code>${password}</code></p>
      <p class="muted">Fermez cette page après sauvegarde.</p>
    </div>
  </body></html>`;
  return new NextResponse(html, { status:200, headers:{ "Content-Type":"text/html; charset=utf-8" } });
}
