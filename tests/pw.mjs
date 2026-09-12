// Playwright from node_modules when installed (CI), otherwise the machine-wide install used in this workspace.
export const { chromium, devices } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
