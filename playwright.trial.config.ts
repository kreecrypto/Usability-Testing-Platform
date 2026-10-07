import { defineConfig } from '@playwright/test';

const baseURL=process.env.UTP_UI_QA_BASE_URL || 'http://127.0.0.1:3033';
const target=new URL(baseURL);
const local=target.protocol==='http:' && ['127.0.0.1','localhost'].includes(target.hostname);
const preview=target.protocol==='https:' && /^usability-testing-platform-[a-z0-9]+\.vercel\.app$/.test(target.hostname);
if ((!local && !preview) || target.username || target.password || target.pathname!=='/' || target.search || target.hash) throw new Error('UI QA target must be explicit localhost or UTP Preview; Production is prohibited');
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: 'test-results/trial',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: { baseURL, viewport: { width: 1280, height: 800 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: local ? { command: `npm run start -- -p ${target.port || '80'}`, url: `${baseURL}/trial`, reuseExistingServer: false, timeout: 60_000 } : undefined,
});
