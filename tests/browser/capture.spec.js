import { expect, test } from '@playwright/test';

test.skip(!process.env.CAPTURE, 'Screenshot capture runs only with CAPTURE=1');

const shots = [
  ['tellus', 1440, 900], ['aurelia', 1440, 900], ['cinder', 1440, 900],
  ['boreas', 1440, 900], ['sirocco', 1440, 900], ['thalassa', 1440, 900],
];

for (const [preset, width, height] of shots) {
  test(`capture ${preset}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-renderer', 'ready');
    await page.locator(`[data-preset="${preset}"]`).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `docs/${preset}.png` });
  });
}

test('capture mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'ready');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'docs/mobile.png' });
});
