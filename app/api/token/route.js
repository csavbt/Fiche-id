import { NextResponse } from "next/server";
import { getToken } from "../../../lib/storage";

export const dynamic = "force-dynamic";

export async function GET(req){
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").toString();
  if(!token) return NextResponse.json({ error:"token missing" }, { status:400 });

  const data = await getToken(token);
  if(!data) return NextResponse.json({ error:"not found" }, { status:404 });
  if(data.used) return NextResponse.json({ error:"expired" }, { status:410 });

  const safe = {
    fullName: data.fullName,
    login: data.login,
    email: data.email,
    softwares: data.softwares || [],
    storageMode: data.storageMode || "unknown"
  };
  return NextResponse.json(safe, { status:200 });
}
