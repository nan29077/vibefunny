import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, PageHeader, Field, Input, Select, Table, Th, Td, StatusBadge, EmptyState, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { SOCIAL_PLATFORM_LABELS, SOCIAL_PLATFORM_COLORS, ALL_SOCIAL_PLATFORMS } from "@/lib/schema";
import { addSocialAction, deleteSocialAction } from "@/lib/actions/social-actions";
import { addYoutubeChannelAction, deleteYoutubeChannelAction } from "@/lib/actions/commerce-actions";

export const dynamic = "force-dynamic";

export default function CreatorSocialPage() {
  const user = requireRole("creator");
  const db = getDb();
  const accounts = db.social_accounts.filter((s) => s.creator_id === user.id);
  const channels = db.creator_youtube_channels.filter((c) => c.creator_id === user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="SNS 계정 관리" description="배포용 SNS 계정과 숏폼 커머스 운영용 YouTube 채널을 등록하세요." />

      <Card className="border-brand-yellow/40 bg-brand-yellow/5">
        <p className="text-sm text-gray-700">
          🔒 보안을 위해 <b>SNS 비밀번호는 절대 수집하지 않습니다.</b> 채널 URL, 계정명, 플랫폼, 인증 상태만 저장됩니다.
        </p>
      </Card>

      {/* ── 배포용 SNS 계정 ───────────────────────────────────────────── */}
      <Card>
        <h2 className="mb-1 text-base font-bold">배포용 SNS 계정</h2>
        <p className="mb-3 text-sm text-gray-500">캠페인 영상을 배포하는 계정입니다. (YouTube · Instagram · TikTok · Facebook)</p>
        <form action={addSocialAction} className="grid items-end gap-3 sm:grid-cols-4">
          <Field label="플랫폼">
            <Select name="platform" defaultValue="youtube">
              {ALL_SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>{SOCIAL_PLATFORM_LABELS[p]}</option>
              ))}
            </Select>
          </Field>
          <Field label="계정명">
            <Input name="account_name" placeholder="@channel" required />
          </Field>
          <Field label="채널 URL">
            <Input name="channel_url" placeholder="https://..." required />
          </Field>
          <Field label="팔로워 수">
            <Input type="number" name="follower_count" min={0} defaultValue={0} />
          </Field>
          <SubmitButton size="sm">추가</SubmitButton>
        </form>
      </Card>

      {accounts.length === 0 ? (
        <EmptyState title="등록된 배포용 SNS 계정이 없습니다" />
      ) : (
        <Table>
          <thead>
            <tr><Th>플랫폼</Th><Th>계정명</Th><Th>채널</Th><Th>팔로워</Th><Th>인증</Th><Th></Th></tr>
          </thead>
          <tbody>
            {accounts.map((s) => (
              <tr key={s.id}>
                <Td>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{
                      color: SOCIAL_PLATFORM_COLORS[s.platform].color,
                      background: SOCIAL_PLATFORM_COLORS[s.platform].bg,
                    }}
                  >
                    {SOCIAL_PLATFORM_LABELS[s.platform]}
                  </span>
                </Td>
                <Td>{s.account_name}</Td>
                <Td><a href={s.channel_url} target="_blank" rel="noreferrer" className="text-brand-purple underline">바로가기</a></Td>
                <Td>{s.follower_count.toLocaleString("ko-KR")}</Td>
                <Td><StatusBadge status={s.verified_status} /></Td>
                <Td>
                  <form action={deleteSocialAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <SubmitButton size="sm" variant="danger">삭제</SubmitButton>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* ── 숏폼 커머스 운영용 YouTube ─────────────────────────────────── */}
      <Card className="border-brand-purple/30 bg-gradient-to-br from-brand-purple/5 to-brand-pink/5">
        <div className="mb-1 flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ color: SOCIAL_PLATFORM_COLORS.youtube.color, background: SOCIAL_PLATFORM_COLORS.youtube.bg }}
          >
            YouTube
          </span>
          <h2 className="text-base font-bold">숏폼 운영 채널 (쇼츠 커머스용)</h2>
        </div>
        <p className="mb-3 text-sm text-gray-600">
          위 배포용 계정과 <b>별개</b>로, 본인이 직접 운영하며 <b>쇼츠 커머스</b>를 진행할 YouTube 채널을 등록합니다.
          여기 등록한 채널은 <a href="/creator/shorts-commerce" className="font-semibold text-brand-purple underline">쇼츠 커머스</a>에서 사용됩니다.
        </p>
        <form action={addYoutubeChannelAction} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="채널명">
            <Input name="channel_name" placeholder="예: 영구의 꿀템방" required />
          </Field>
          <Field label="채널 URL">
            <Input name="channel_url" placeholder="https://youtube.com/@..." required />
          </Field>
          <Field label="핸들(@)">
            <Input name="channel_handle" placeholder="@honeytem" />
          </Field>
          <Field label="구독자 수">
            <Input type="number" name="subscriber_count" min={0} defaultValue={0} />
          </Field>
          <Field label="채널 주제/소개" className="sm:col-span-2 lg:col-span-4">
            <Input name="description" placeholder="예: 뷰티·생활 꿀템 리뷰 채널" />
          </Field>
          <SubmitButton size="sm">운영 채널 등록</SubmitButton>
        </form>
      </Card>

      {channels.length === 0 ? (
        <EmptyState title="등록된 숏폼 운영 채널이 없습니다" description="쇼츠 커머스를 운영할 YouTube 채널을 등록하세요." />
      ) : (
        <Table>
          <thead>
            <tr><Th>채널명</Th><Th>핸들</Th><Th>채널</Th><Th>구독자</Th><Th>주제</Th><Th>인증</Th><Th></Th></tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.id}>
                <Td className="font-semibold text-gray-900">{c.channel_name}</Td>
                <Td className="text-gray-500">{c.channel_handle ?? "-"}</Td>
                <Td><a href={c.channel_url} target="_blank" rel="noreferrer" className="text-brand-purple underline">바로가기</a></Td>
                <Td>{c.subscriber_count.toLocaleString("ko-KR")}</Td>
                <Td className="max-w-[200px] truncate text-gray-500">{c.description ?? "-"}</Td>
                <Td><StatusBadge status={c.verified_status} /></Td>
                <Td>
                  <form action={deleteYoutubeChannelAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton size="sm" variant="danger">삭제</SubmitButton>
                  </form>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <div>
        <LinkButton href="/creator/shorts-commerce" variant="outline" size="sm">쇼츠 커머스로 이동 →</LinkButton>
      </div>
    </div>
  );
}
