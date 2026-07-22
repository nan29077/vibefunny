export const PROFILE_AVATARS = [
  "관리자1.png", "관리자4.png", "브랜드사2.png", "브랜드사4.png", "브랜드사6.png",
  "여성 구매회원1.png", "여성 구매회원2.png", "여성 구매회원3.png", "여성 구매회원4.png", "여성 구매회원5.png",
  "여성 구매회원6.png", "여성 구매회원7.png", "여성 구매회원8.png", "여성 구매회원9.png", "여성 구매회원10.png",
  "여성 구매회원11.png", "여성 구매회원12.png", "여성 구매회원13.png", "중간 관리자4.png", "중간 관리자5.png",
] as const;

const directory = encodeURIComponent("회원프로필 캐릭터");

export function profileAvatarUrl(filename: string): string {
  return `/${directory}/${encodeURIComponent(filename)}`;
}

export function randomProfileAvatar(): string {
  const filename = PROFILE_AVATARS[Math.floor(Math.random() * PROFILE_AVATARS.length)];
  return profileAvatarUrl(filename);
}

export function profileAvatarForSeed(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return profileAvatarUrl(PROFILE_AVATARS[hash % PROFILE_AVATARS.length]);
}
