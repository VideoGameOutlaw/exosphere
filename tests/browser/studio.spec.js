import { expect, test } from '@playwright/test';

async function open(page, path = '/') {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'ready');
}

const brightness = (pixel) => pixel[0] + pixel[1] + pixel[2];

test('the shader draws a lit planet against a dark sky', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  const { planet, corner } = await page.evaluate(() => {
    const { renderer } = window.exosphere;
    const aspect = renderer.canvas.width / renderer.canvas.height;
    const x = 0.5 + (renderer.center[0] + 0.2) / (2 * aspect);
    const y = 0.5 + (renderer.center[1] + 0.1) / 2;
    return { planet: window.exosphere.sample(x, y), corner: window.exosphere.sample(0.995, 0.995) };
  });
  expect(brightness(planet)).toBeGreaterThan(60);
  expect(brightness(corner)).toBeLessThan(60);
  expect(errors).toEqual([]);
});

test('catalogue, sliders and type switch drive the world', async ({ page }) => {
  await open(page);
  await page.locator('[data-preset="aurelia"]').click();
  await expect(page.locator('#world-name')).toHaveText('Aurelia');
  await expect(page.locator('#klass')).toHaveText('Gas giant');
  await expect(page.locator('#slider-sea')).toBeDisabled();
  await page.locator('#type-rock').click();
  await expect(page.locator('#slider-sea')).toBeEnabled();
  await page.locator('#slider-sea').fill('0.9');
  expect((await page.evaluate(() => window.exosphere.getState())).settings.sea).toBe(0.9);
  await expect(page.locator('#klass')).toHaveText('Ocean world');
});

test('discovering replaces the world and keyboard shortcuts work', async ({ page }) => {
  await open(page);
  await page.locator('#discover').click();
  const first = await page.evaluate(() => window.exosphere.getState());
  expect(first.settings.preset).toBeNull();
  await expect(page.locator('#world-name')).toHaveText(first.survey.name);
  await page.locator('#sky').click({ position: { x: 20, y: 300 } });
  await page.keyboard.press('n');
  const second = await page.evaluate(() => window.exosphere.getState());
  expect(second.settings.seed).not.toBe(first.settings.seed);
  await page.keyboard.press('Space');
  expect((await page.evaluate(() => window.exosphere.getState())).playing).toBe(false);
  await page.keyboard.press('2');
  await expect(page.locator('#world-name')).toHaveText('Sirocco');
});

test('a shared link rebuilds the same world after a fresh load', async ({ page }) => {
  await open(page);
  await page.locator('#discover').click();
  await page.locator('#slider-rings').fill('0.7');
  await page.locator('#share').click();
  const before = await page.evaluate(() => window.exosphere.getState().settings);
  const url = page.url();
  expect(url).toContain('#world=');
  await page.goto('about:blank');
  await open(page, url);
  expect(await page.evaluate(() => window.exosphere.getState().settings)).toEqual(before);
});

test('PNG export downloads a real image', async ({ page }) => {
  await open(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-png').click()]);
  expect(download.suggestedFilename()).toMatch(/^exosphere-tellus-.*\.png$/);
});

test('mobile layout keeps controls inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.locator('#panel')).toHaveAttribute('data-open', 'false');
  await page.locator('#panel-toggle').click();
  await expect(page.locator('#panel')).toHaveAttribute('data-open', 'true');
  await page.waitForTimeout(500);
  const box = await page.locator('#panel').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('#build-credit')).toContainText('Claude Fable 5.2');
});
