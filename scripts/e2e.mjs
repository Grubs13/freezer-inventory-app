import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { chromium, devices } from 'playwright';

const APP = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const MAIL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const SHOTS = process.env.SHOTS_DIR;
const run = Date.now().toString(36);
const owner = `owner-${run}@test.dev`;
const member = `member-${run}@test.dev`;
const stranger = `stranger-${run}@test.dev`;

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Stands in for the browser's speech service: "hears" whatever window.__say holds.
const fakeSpeech = () => {
  window.__say = '';
  const Fake = class {
    start() {
      setTimeout(() => {
        const results = [Object.assign([{ transcript: window.__say }], { isFinal: true })];
        this.onresult?.({ results });
        this.onend?.();
      }, 200);
    }
    stop() {}
    abort() {}
  };
  for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
    Object.defineProperty(window, name, { value: Fake, configurable: true, writable: true });
  }
};

async function latestMail(to, since, subject = /./) {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages = [] } = await res.json();
    const fresh = messages.filter((m) => new Date(m.Created).getTime() >= since && subject.test(m.Subject));
    if (fresh.length) return (await fetch(`${MAIL}/api/v1/message/${fresh[0].ID}`)).json();
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no email for ${to}`);
}

async function phone(browser, options = {}) {
  const context = await browser.newContext({ ...devices['iPhone 13'], ...options });
  await context.addInitScript(fakeSpeech);
  return context.newPage();
}

async function acceptInviteLink(browser, email, since) {
  const mail = await latestMail(email, since);
  const link = mail.HTML.match(/href="([^"]+auth\/confirm[^"]+)"/)[1].replaceAll('&amp;', '&');
  const page = await phone(browser);
  await page.goto(link.replace(/^https?:\/\/[^/]+/, APP));
  await page.waitForURL((u) => !u.pathname.startsWith('/login') && !u.pathname.startsWith('/auth'));
  return page;
}

async function signIn(browser, email, options) {
  const page = await phone(browser, options);
  await page.goto(APP);
  await page.waitForURL(/\/login/);
  const since = Date.now() - 1000;
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  const mail = await latestMail(email, since, /sign-in code/);
  const code = mail.HTML.match(/<strong>(\d{6})<\/strong>/)[1];
  await page.getByLabel(/Code sent to/).fill(code);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  return page;
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Tap the voice button, "say" the sentence, and wait for the review. */
async function say(page, sentence) {
  await page.evaluate((s) => (window.__say = s), sentence);
  await page.getByRole('button', { name: 'Add or remove by voice' }).click();
  await page.getByRole('dialog', { name: 'Voice input' }).getByText(/Review changes|In this freezer/).waitFor().catch(async (e) => {
    await shot(page, 'failed-say');
    throw e;
  });
}

const sheet = (page) => page.getByRole('dialog');
const row = (page, name) => page.getByTestId('item-row').filter({ has: page.getByText(name, { exact: true }) });
const amountOf = (page, name) => row(page, name).locator('.fb-stepper__val');
const toast = (page) => page.getByRole('status').filter({ hasText: /./ }).locator('.fb-toast__text');

const browser = await chromium.launch();
try {
  const ownerInvitedAt = Date.now() - 1000;
  assert.equal((await admin.auth.admin.inviteUserByEmail(owner)).error, null, 'admin can invite the first owner');

  const blocked = await phone(browser);
  await blocked.goto(`${APP}/login`);
  await blocked.getByLabel('Email').fill(`nobody-${run}@test.dev`);
  await blocked.getByRole('button', { name: 'Email me a code' }).click();
  await blocked.getByText('No account for this email yet').waitFor();
  await shot(blocked, '0-sign-in');
  console.log('ok  uninvited emails cannot sign in');

  const me = await acceptInviteLink(browser, owner, ownerInvitedAt);
  await me.getByLabel('Household name').fill('Home');
  await me.getByRole('button', { name: 'Create household' }).click();
  await me.waitForURL(/\/h\/[^/]+$/);
  const home = me.url();
  await me.getByText('Your freezer’s empty.').waitFor();
  console.log('ok  owner opens the invite link and creates a household');

  await say(me, 'add two packs of ground turkey, a pack of chicken thighs, 3 frozen pizzas and 1.5 pounds of venison');
  assert.equal(await me.getByTestId('draft').count(), 4, 'four lines to review');
  await sheet(me).getByText('New item · Poultry').first().waitFor();
  await shot(me, '2-voice-review');
  await me.getByRole('button', { name: 'Save 4 changes' }).click();
  await sheet(me).waitFor({ state: 'detached' });
  assert.equal(await toast(me).textContent(), 'Saved 4 changes');
  assert.equal(await amountOf(me, 'Ground turkey').textContent(), '2');
  assert.equal(await amountOf(me, 'Frozen pizzas').textContent(), '3');
  assert.equal(await amountOf(me, 'Venison').textContent(), '1.5 lb');
  console.log('ok  one spoken sentence adds four items through listen, review and save');

  await me.getByRole('tab', { name: /^Poultry/ }).click();
  assert.equal(await me.getByTestId('item-row').count(), 2, 'poultry filter shows turkey and thighs only');
  await me.getByRole('tab', { name: /^All/ }).click();
  console.log('ok  category chips filter the list');

  await say(me, 'took out a frozen pizza and we ate a pack of ground turkey');
  await sheet(me).getByText(/^From the oldest pack \(added [A-Z][a-z]{2} \d{1,2}\) · 1 left$/).waitFor();
  await me.getByRole('button', { name: 'Save 2 changes' }).click();
  await sheet(me).waitFor({ state: 'detached' });
  assert.equal(await amountOf(me, 'Frozen pizzas').textContent(), '2');
  assert.equal(await amountOf(me, 'Ground turkey').textContent(), '1');
  console.log('ok  spoken removals lower the counts');

  await row(me, 'Chicken thighs').getByRole('button', { name: 'Remove the last one' }).click();
  await row(me, 'Chicken thighs').waitFor({ state: 'detached' });
  assert.match(await toast(me).textContent(), /Removed 1 pack of Chicken thighs/);
  await me.getByRole('button', { name: 'Undo' }).click();
  await row(me, 'Chicken thighs').waitFor();
  assert.equal(await amountOf(me, 'Chicken thighs').textContent(), '1');
  console.log('ok  removing the last one shows a trash icon, and Undo brings it back');

  await me.getByRole('button', { name: 'Add item' }).click();
  const add = sheet(me);
  await add.getByLabel('Name').fill('Ground turkey');
  await add.getByLabel('Unit').selectOption('pack');
  await add.getByLabel('Category').selectOption('poultry');
  await add.getByLabel('Date added').fill('2026-10-02');
  await add.getByRole('button', { name: 'Done' }).click();
  await add.getByText(/matched existing item/).waitFor();
  await me.getByRole('button', { name: 'Save 1 change' }).click();
  await add.waitFor({ state: 'detached' });
  assert.equal(await amountOf(me, 'Ground turkey').textContent(), '2');
  console.log('ok  Add item backfills an older pack of an existing item');

  await me.getByRole('link', { name: 'Open Ground turkey' }).click();
  await me.waitForURL(/\/item\//);
  const lots = me.getByTestId('lot');
  assert.equal(await lots.count(), 2, 'two packs listed');
  assert.match(await lots.first().textContent(), /Added Oct 2.*Use first/);
  await shot(me, '3-item-detail');
  await lots.nth(1).getByRole('button', { name: 'Remove the last one' }).click();
  await me.getByTestId('lot').nth(1).waitFor({ state: 'detached' });
  assert.match(await lots.first().textContent(), /Added Oct 2/, 'the older pack is the one left');
  await me.getByRole('button', { name: 'Add a pack' }).click();
  await me.getByTestId('lot').nth(1).waitFor();
  await me.getByText('Removed 1 pack').first().waitFor();
  console.log('ok  item detail lists packs oldest first, steps one pack, and shows history');

  await me.goto(home);
  await say(me, 'how much ground turkey do we have');
  assert.match(await sheet(me).textContent(), /Ground turkey.*2 packs/);
  await me.getByRole('button', { name: 'Done' }).click();
  console.log('ok  a spoken question is answered without changing anything');

  await row(me, 'Venison').getByRole('button', { name: 'Remove one' }).click();
  await row(me, 'Venison').getByRole('button', { name: 'Remove the last one' }).click();
  await row(me, 'Venison').waitFor({ state: 'detached' });
  await shot(me, '1-inventory');
  console.log('ok  minus takes the last half pound and the item leaves the list');

  await me.goto(`${home}/settings`);
  const memberInvitedAt = Date.now() - 1000;
  await me.getByLabel('Invite someone').fill(member);
  await me.getByRole('button', { name: 'Send invite' }).click();
  await me.getByText(`Invite sent to ${member}.`).waitFor();
  await shot(me, '4-settings');
  console.log('ok  owner invites a member by email');

  const them = await acceptInviteLink(browser, member, memberInvitedAt);
  await them.waitForURL(home);
  assert.equal(await amountOf(them, 'Frozen pizzas').textContent(), '2');
  await them.goto(`${home}/settings`);
  assert.equal(await them.getByLabel('Invite someone').count(), 0, 'members do not see the invite form');
  await them.goto(home);
  console.log('ok  invited member joins and sees the same freezer');

  await me.goto(home);
  await say(me, 'put in two bags of peas');
  await me.getByRole('button', { name: 'Save 1 change' }).click();
  await amountOf(them, 'Peas').waitFor({ timeout: 10000 });
  console.log('ok  member screen updates live when the owner adds food');

  const strangerInvitedAt = Date.now() - 1000;
  assert.equal((await admin.auth.admin.inviteUserByEmail(stranger)).error, null);
  const outsider = await acceptInviteLink(browser, stranger, strangerInvitedAt);
  await outsider.getByLabel('Household name').fill('Friend house');
  await outsider.getByRole('button', { name: 'Create household' }).click();
  await outsider.waitForURL(/\/h\//);
  assert.equal((await outsider.goto(home)).status(), 404, 'stranger gets not found for another household');
  await outsider.goto(`${home}/activity`);
  assert.equal(await outsider.getByText(/Ground turkey/).count(), 0, 'stranger sees no activity from another household');
  console.log('ok  a different household cannot open yours');

  await me.goto(`${home}/activity`);
  await me.getByText(/by voice/).first().waitFor();
  await shot(me, '5-activity');
  console.log('ok  activity log shows who changed what, and what was spoken');

  const desk = await signIn(browser, owner, { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 }, isMobile: false, hasTouch: false });
  await desk.waitForURL(home);
  await desk.getByRole('complementary', { name: 'Sidebar' }).getByText('Frostbox').waitFor();
  await desk.getByRole('button', { name: 'Show packs of Ground turkey' }).click();
  await desk.getByText('Pack 2').waitFor();
  await shot(desk, '6-desktop');
  console.log('ok  desktop shows the sidebar and the table with expandable packs (signed in by emailed code)');

  const night = await phone(browser, { colorScheme: 'dark' });
  await night.context().addCookies(await me.context().cookies());
  await night.goto(home);
  await row(night, 'Frozen pizzas').waitFor();
  const bg = await night.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(bg, 'rgb(11, 15, 20)', 'dark theme uses the dark bg token');
  await shot(night, '7-dark');
  console.log('ok  dark theme follows the device setting');

  console.log('\nall end-to-end checks passed');
} finally {
  await browser.close();
}
