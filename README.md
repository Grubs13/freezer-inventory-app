# Freezer

A shared inventory for a deep freeze. Use it from any phone or computer, and add or take out food by voice.

- Households hold one or more freezers. An owner invites people as members or owners.
- People see only the households they belong to. The database enforces this, not just the app.
- Say or type "add two packs of ground turkey and 1.5 pounds of venison" or "took out a frozen pizza". The app shows what it understood, and you confirm before anything changes.
- Browse by category (meat, poultry, seafood, frozen meals, vegetables, fruit, bread and baked goods, desserts, other).
- Each batch keeps the date it went in. Taking food out uses the oldest batch first.

## Stack

| Part | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, Tailwind CSS 4, installable as a home-screen app |
| Data and sign-in | Supabase: Postgres with row level security, email codes, realtime updates |
| Voice | The browser's speech recognition where available, or the phone keyboard's microphone. A local rules parser (`src/lib/parse.ts`) turns the words into actions. There is no AI service and no API key. |
| Hosting | Vercel (app) and Supabase (database), both on free tiers |

## How the data fits together

```
households ─┬─ memberships (user, role: owner | member)
            ├─ invites (email, role)
            └─ freezers ── items (name, category, unit) ─┬─ lots (quantity, frozen_on)
                                                         └─ movements (+/- quantity, who, when)
```

The quantity of an item is the sum of its lots. Every change also writes a movement, which feeds the Activity page. All writes go through `apply_actions` in `supabase/migrations/20261114000000_init.sql`. It runs as the signed-in user, so the access rules apply to it too.

## Run it locally

You need Node 20 or later and Docker.

```sh
npm install
npx supabase start          # starts Postgres, auth, realtime and a mail catcher
cp .env.example .env.local  # fill in the keys printed by `npx supabase status`
npm run dev
```

Sign-up is invite only, so create the first user yourself:

1. Run `node --env-file=.env.local scripts/invite.mjs you@example.com`.
2. Open the mail catcher at http://127.0.0.1:54324 and click the invite link.

### Tests

| Command | What it checks |
|---|---|
| `npm test` | The voice parser, against real phrasing |
| `npm run db:test` | Database access rules. Three users, and a stranger cannot read or change another household. |
| `npm run e2e` | The whole app in a phone-sized browser: invites, voice commands, categories, live sync between two phones, and household isolation. Needs `npm run build && npm start` running first. |

## Deploy

1. **Create a Supabase project** at supabase.com. Then link it and push the schema:
   ```sh
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
2. **Configure Supabase Auth** in the dashboard:
   - Turn off **Allow new users to sign up**. This makes the app invite only.
   - Set **Site URL** to your Vercel address, for example `https://freezer.vercel.app`.
   - Under **Email Templates**, paste `supabase/templates/invite.html` into *Invite user* and `supabase/templates/magic_link.html` into *Magic Link*. The magic link template is what puts the 6-digit code in the email.
   - Under **SMTP Settings**, connect an email provider. Supabase's built-in sender allows only a few emails an hour and is meant for testing. [Resend](https://resend.com) has a free tier that is plenty for a household.
3. **Deploy to Vercel.** Import the GitHub repository and set the three variables from `.env.example` with your project's values. These are under Project Settings, API Keys.
4. **Invite yourself.** In Supabase, go to Authentication, Users, Invite user. Open the email, tap the link, and create your household.

The free Supabase tier pauses a project after about a week with no activity. Regular use keeps it awake. If it does pause, restore it from the dashboard.

## Install on a phone

- **iPhone:** open the site in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open the site in Chrome, open the menu, then **Install app**.

Sign in with your email. The app emails a 6-digit code, which you type into the app itself. A link would open in the browser instead of the installed app.

## Voice

The microphone button uses the browser's speech recognition. It works well in Chrome on Android and desktop. On iPhone it varies, especially from the home-screen app. When there is no mic button, tap the microphone on the keyboard and speak into the command box instead. Either way, the same parser reads the words and you confirm before anything saves.
