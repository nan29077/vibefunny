import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth";
import { tx } from "@/lib/db";
import { cancelCampaign } from "@/lib/campaign-workflow";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = authorizeApi("advertiser", "admin");
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;
  const result = tx((db) => cancelCampaign(db, user, params.id));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body, { status: 200 });
}
