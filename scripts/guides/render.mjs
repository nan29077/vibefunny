// VIBEFUNNY 서비스 소개서(크리에이터·광고주) HTML → PDF 렌더러
//
// 실행: 저장소 루트에서  node scripts/guides/render.mjs
// 입력: scripts/guides/creator-guide.html, scripts/guides/advertiser-guide.html
// 출력: public/vibefunny-guide-creator.pdf, public/vibefunny-guide-advertiser.pdf (덮어씀)
// 요구: playwright + chromium, 시스템 폰트 "Noto Sans CJK KR", "Noto Color Emoji"
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

const jobs = [
  ['creator-guide.html', 'public/vibefunny-guide-creator.pdf'],
  ['advertiser-guide.html', 'public/vibefunny-guide-advertiser.pdf'],
];

const browser = await chromium.launch();
try {
  for (const [src, out] of jobs) {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(here, src)).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const outPath = path.join(root, out);
    await page.pdf({ path: outPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
    await page.close();
    console.log('wrote', path.relative(root, outPath));
  }
} finally {
  await browser.close();
}
