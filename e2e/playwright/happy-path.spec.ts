import { expect, test, type Locator, type Page } from '@playwright/test';

/** Stack screens stay mounted, so always target the visible instance. */
const tid = (page: Page, id: string): Locator =>
  page.locator(`[data-testid="${id}"]:visible`).last();

async function step(page: Page, heading: string) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}

async function onboard(page: Page, username: string) {
  await page.goto('/');
  await tid(page, 'continue-email').click();
  await step(page, "what's your email?");
  await tid(page, 'email-input').fill(`${username}@example.com`);
  await tid(page, 'send-code').click();
  await step(page, 'check your inbox');
  await tid(page, 'otp-0').fill('123456');
  await step(page, 'pick your username');
  await tid(page, 'username-input').fill(username);
  await expect(page.getByText(`@${username} is available`)).toBeVisible();
  await tid(page, 'onboarding-next').click();
  await step(page, 'set up your profile');
  await tid(page, 'onboarding-next').click();
  await step(page, 'what are you into?');
  await tid(page, 'interest-memecoins').click();
  await tid(page, 'onboarding-next').click();
  await step(page, 'where are you trading from?');
  await page.getByText('Indonesia', { exact: true }).click();
  await tid(page, 'birth-year-input').fill('1995');
  await tid(page, 'onboarding-next').click();
  await step(page, 'Before you trade');
  await tid(page, 'risk-checkbox').scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 4000);
  await tid(page, 'risk-checkbox').click();
  await tid(page, 'risk-continue').click();
  await step(page, 'follow some legends');
  await tid(page, 'follow-top5').click();
  await page.waitForTimeout(1500);
  await tid(page, 'onboarding-finish').click();
  await expect(page.getByText('legends are buying 🔥')).toBeVisible();
}

test('onboarding → follow → buy $HOPE → profile → thesis → language', async ({ page }) => {
  const username = `e2e_${Date.now().toString(36)}`;
  await onboard(page, username);

  // Buy $25 of $HOPE (retry once on simulated network failures).
  await page.goto('/asset/HOPE');
  await expect(tid(page, 'asset-price')).toBeVisible();
  for (let attempt = 0; attempt < 3; attempt++) {
    await tid(page, 'asset-buy').click();
    await tid(page, 'chip-25').click();
    await expect(tid(page, 'quote-breakdown')).toBeVisible();
    await tid(page, 'order-confirm').click();
    const outcome = await Promise.race([
      tid(page, 'order-success')
        .waitFor()
        .then(() => 'ok'),
      tid(page, 'order-failure')
        .waitFor()
        .then(() => 'fail'),
    ]);
    if (outcome === 'ok') break;
    await page.keyboard.press('Escape');
  }
  await expect(page.getByText('order filled')).toBeVisible();
  await tid(page, 'order-done').click();

  // Trade appears on own profile.
  await page.goto('/profile');
  await expect(tid(page, 'profile-trades').getByText('HOPE')).toBeVisible();

  // Post a thesis and see it in the theses tab.
  await page.goto('/thesis/new?asset=fam');
  const entryText = await page.getByText(/entry \(current price\)/).textContent();
  const entry = Number((entryText ?? '').replace(/[^0-9.]/g, ''));
  await tid(page, 'thesis-target').fill((entry * 1.5).toFixed(6));
  await tid(page, 'thesis-invalidation').fill((entry * 0.8).toFixed(6));
  await tid(page, 'thesis-body').fill('fam season is loading. community keeps growing every week.');
  await tid(page, 'thesis-preview').click();
  await tid(page, 'thesis-publish').click();
  await expect(page.getByText('thesis', { exact: true }).first()).toBeVisible();
  await page.goto('/');
  await tid(page, 'segment-theses').click();
  await expect(page.getByText(`@${username}`).first()).toBeVisible();

  // Switch to Bahasa Indonesia.
  await page.goto('/settings/language');
  await tid(page, 'language-id').click();
  await page.goto('/');
  await expect(page.getByText('para legend lagi beli 🔥')).toBeVisible();
  await expect(tid(page, 'segment-following')).toHaveText('diikuti');
});

test('perps: open a 3× long with TP/SL, then close it', async ({ page }) => {
  await onboard(page, `perp_${Date.now().toString(36)}`);
  await page.goto('/perps/sol-perp');
  const mark = Number(((await tid(page, 'perp-mark').textContent()) ?? '').replace(/[^0-9.]/g, ''));
  await tid(page, 'perp-margin').fill('100');
  await tid(page, 'tick-3').click();
  await tid(page, 'perp-tp').fill((mark * 1.2).toFixed(2));
  await tid(page, 'perp-sl').fill((mark * 0.9).toFixed(2));
  await expect(tid(page, 'perp-liq')).not.toHaveText('—');
  // Mock execution fails ~3% of the time by design; retry until one position opens.
  for (let attempt = 0; attempt < 3; attempt++) {
    await tid(page, 'perp-open').click();
    const opened = await tid(page, 'position-SOL-PERP')
      .waitFor({ state: 'visible', timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (opened) break;
  }
  await expect(tid(page, 'position-SOL-PERP')).toBeVisible();
  await tid(page, 'close-100').click();
  await expect(page.locator('[data-testid="position-SOL-PERP"]:visible')).toHaveCount(0);
});

test('high leverage requires acknowledgement', async ({ page }) => {
  await onboard(page, `lev_${Date.now().toString(36)}`);
  await page.goto('/perps/btc-perp');
  await tid(page, 'tick-20').click();
  await expect(tid(page, 'high-leverage-warning')).toBeVisible();
  await expect(tid(page, 'perp-open')).toBeDisabled();
  await tid(page, 'high-leverage-ack').click();
  await expect(tid(page, 'perp-open')).toBeEnabled();
});
