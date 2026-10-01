import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { funnyBalance } from "@/lib/funny";
import { aiShortsAccess } from "@/lib/ai/settings";
import { capabilityStatus, ttsVoices } from "@/lib/ai/engine";
import { projectView } from "@/lib/ai/projects";
import { CAMERA_MOVES, SHORTS_TEMPLATES, TONES } from "@/lib/ai/prompts";
import { ShortsEditor } from "@/components/ai-shorts/shorts-editor";

export const dynamic = "force-dynamic";

export default function ShortsEditorPage({ params }: { params: { id: string } }) {
  const user = requireRole("creator");
  const db = getDb();
  const project = (db.shorts_projects ?? []).find((p) => p.id === params.id && p.user_id === user.id);
  if (!project) notFound();
  return (
    <ShortsEditor
      initial={{
        ...projectView(db, project),
        wallet: funnyBalance(db, user.id),
        access: aiShortsAccess(db, user),
        capabilities: capabilityStatus(db),
      }}
      templates={SHORTS_TEMPLATES.map(({ id, label }) => ({ id, label }))}
      tones={TONES}
      cameraMoves={CAMERA_MOVES}
      voices={ttsVoices(db)}
    />
  );
}
