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

async function acceptInviteLink(browser, email, since) {
  const mail = await latestMail(email, since);
  const link = mail.HTML.match(/href="([^"]+auth\/confirm[^"]+)"/)[1].replaceAll('&amp;', '&');
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  await page.goto(link.replace(/^https?:\/\/[^/]+/, APP));
  await page.waitForURL((u) => !u.pathname.startsWith('/login') && !u.pathname.startsWith('/auth'));
  return page;
}

async function signIn(browser, email) {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
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
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
}

async function command(page, text) {
  await page.getByRole('textbox', { name: 'Command' }).fill(text);
  await page.getByRole('button', { name: 'Go' }).click();
  await page.getByRole('dialog', { name: 'Check before saving' }).waitFor();
}

const amountOf = (page, name) => page.getByRole('listitem').filter({ hasText: name }).getByTestId('amount');

const browser = await chromium.launch();
try {
  const ownerInvitedAt = Date.now() - 1000;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(owner);
  assert.equal(inviteError, null, 'admin can invite the first owner');

  const blocked = await (await browser.newContext()).newPage();
  await blocked.goto(`${APP}/login`);
  await blocked.getByLabel('Email').fill(`nobody-${run}@test.dev`);
  await blocked.getByRole('button', { name: 'Email me a code' }).click();
  await blocked.getByText('No account for this email yet').waitFor();
  console.log('ok  uninvited emails cannot sign in');

  const ownerPage = await acceptInviteLink(browser, owner, ownerInvitedAt);
  await ownerPage.getByLabel('Household name').fill('Home');
  await ownerPage.getByRole('button', { name: 'Create' }).click();
  await ownerPage.waitForURL(/\/h\//);
  const householdUrl = ownerPage.url();
  await ownerPage.getByText('This freezer is empty.').waitFor();
  console.log('ok  owner opens the invite link and creates a household');

  await command(ownerPage, 'add two packs of ground turkey, a pack of chicken thighs, 3 frozen pizzas and 1.5 pounds of venison');
  const drafts = ownerPage.getByTestId('draft');
  assert.equal(await drafts.count(), 4, 'four lines to review');
  await shot(ownerPage, '2-review-add');
  await ownerPage.getByRole('button', { name: 'Save 4' }).click();
  await ownerPage.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await amountOf(ownerPage, 'Ground turkey').textContent(), '2 packs');
  assert.equal(await amountOf(ownerPage, 'Frozen pizza').textContent(), '3');
  assert.equal(await amountOf(ownerPage, 'Venison').textContent(), '1.5 lb');
  await shot(ownerPage, '1-inventory');
  console.log('ok  one spoken sentence adds four items with packs, counts and weight');

  await ownerPage.getByRole('button', { name: /^Poultry/ }).click();
  assert.equal(await ownerPage.getByTestId('amount').count(), 2, 'poultry filter shows turkey and thighs only');
  await ownerPage.getByRole('button', { name: /^All/ }).click();
  console.log('ok  category filter narrows the list');

  await command(ownerPage, 'took out a frozen pizza and we ate a pack of ground turkey');
  await shot(ownerPage, '3-review-remove');
  await ownerPage.getByRole('button', { name: 'Save 2' }).click();
  await ownerPage.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await amountOf(ownerPage, 'Frozen pizza').textContent(), '2');
  assert.equal(await amountOf(ownerPage, 'Ground turkey').textContent(), '1 pack');
  console.log('ok  spoken removals lower the counts');

  await ownerPage.getByRole('button', { name: 'Remove one Venison' }).click();
  await ownerPage.getByRole('button', { name: 'Remove one Venison' }).click();
  await amountOf(ownerPage, 'Venison').waitFor({ state: 'detached' });
  console.log('ok  minus buttons take the last half pound and the item leaves the list');

  await ownerPage.goto(`${householdUrl}/settings`);
  const memberInvitedAt = Date.now() - 1000;
  await ownerPage.getByLabel('Invite someone').fill(member);
  await ownerPage.getByRole('button', { name: 'Send invite' }).click();
  await ownerPage.getByText(`Invite sent to ${member}.`).waitFor();
  await shot(ownerPage, '4-settings');
  console.log('ok  owner invites a member by email');

  const memberPage = await acceptInviteLink(browser, member, memberInvitedAt);
  await memberPage.waitForURL(householdUrl);
  assert.equal(await amountOf(memberPage, 'Frozen pizza').textContent(), '2');
  await memberPage.goto(`${householdUrl}/settings`);
  assert.equal(await memberPage.getByLabel('Invite someone').count(), 0, 'members do not see the invite form');
  await memberPage.goto(householdUrl);
  console.log('ok  invited member joins and sees the same freezer');

  await ownerPage.goto(householdUrl);
  await command(ownerPage, 'add a bag of peas');
  await ownerPage.getByRole('button', { name: 'Save' }).click();
  await amountOf(memberPage, 'Peas').waitFor({ timeout: 10000 });
  console.log('ok  member screen updates live when the owner adds food');

  const strangerInvitedAt = Date.now() - 1000;
  const { error: strangerInvite } = await admin.auth.admin.inviteUserByEmail(stranger);
  assert.equal(strangerInvite, null);
  const strangerPage = await acceptInviteLink(browser, stranger, strangerInvitedAt);
  await strangerPage.getByLabel('Household name').fill('Friend house');
  await strangerPage.getByRole('button', { name: 'Create' }).click();
  await strangerPage.waitForURL(/\/h\//);
  const res = await strangerPage.goto(householdUrl);
  assert.equal(res.status(), 404, 'stranger gets not found for another household');
  await strangerPage.goto(`${householdUrl}/activity`);
  assert.equal(await strangerPage.getByText('Ground turkey').count(), 0, 'stranger sees no activity from another household');
  console.log('ok  a different household cannot open yours');

  await ownerPage.goto(`${householdUrl}/activity`);
  await ownerPage.getByText('Ground turkey').first().waitFor();
  assert.ok((await ownerPage.getByText(/^You ·/).count()) >= 8, 'every change is logged with who made it');
  await shot(ownerPage, '5-activity');
  console.log('ok  activity log shows who changed what');

  const laptop = await signIn(browser, owner);
  await laptop.waitForURL(/\/\?all=1|\/h\//);
  console.log('ok  owner signs in on a second device with an emailed code');
  console.log('\nall end-to-end checks passed');
} finally {
  await browser.close();
}
