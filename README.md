# Faster Loop

Website for [fasterloop.org](https://fasterloop.org), a meetup about what building software looks like when code is cheap. Hosted by [Tuist](https://tuist.dev).

It's a Cloudflare Worker. Static pages live in `public/`; the Worker in `src/` adds:

- `/speak` and `/host`: forms for talk proposals and venue offers, stored in a D1 database.
- `/mcp`: an MCP server with `propose_talk` and `offer_venue` tools, so people can submit through their coding agents. It writes to the same tables as the forms.
- `/meetups`: past meetups and recordings, rendered from `src/meetups.js`. Add an entry there after each meetup.

```sh
npm install
npm run dev      # applies migrations to a local database, then serves http://localhost:8787
```

Pushes to `main` deploy automatically through `.github/workflows/deploy.yml`: it applies database migrations, then deploys the Worker. It uses `CLOUDFLARE_API_TOKEN` from the `production` environment, which only `main` can use. The token is an account-owned Cloudflare token limited to Workers Scripts, D1 and Account Settings Read on the Tuist account, plus Workers Routes on fasterloop.org. It expires on 2027-11-25; create a new one with the same permissions and replace the secret before then. `npm run deploy` does the same from a machine logged in with `wrangler login`.

`wrangler.jsonc` attaches `fasterloop.org` and `www.fasterloop.org` as custom domains, so the zone must be on the same Cloudflare account.

## Submissions

Talk proposals and venue offers (from the forms or the MCP server) are stored unconfirmed, and the submitter gets an email with a confirmation link. They show up for organizers at `/admin` once confirmed. Each email address can submit at most 3 times an hour.

Confirmation emails are sent through Cloudflare Email Service from `hello@fasterloop.org`. To set it up, onboard fasterloop.org under **Compute > Email Service > Email Sending** in the dashboard. Sending to arbitrary addresses needs the Workers Paid plan. Locally, `wrangler dev` doesn't send email; it logs the message and writes its text under `.wrangler/tmp/email/`.

## Admin

`/admin` is for anyone with a `@tuist.dev` email. To set it up:

1. In Zero Trust, add a self-hosted Access application for `fasterloop.org/admin` with an Allow policy for the email domain `tuist.dev` and the one-time PIN login method.
2. Put the team domain (`https://<team>.cloudflareaccess.com`) and the application's AUD tag in `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `wrangler.jsonc`.

The Worker also verifies the Access token and the email domain itself, so `/admin` returns 403 until both are set.

You can also query the database directly:

```sh
npx wrangler d1 execute fasterloop --remote --command "SELECT * FROM talk_proposals ORDER BY created_at DESC"
```

The `source` column says whether a row came from the web form (`web`) or an agent (`mcp`).

To add a field, add it to `src/submissions.js` (which generates the forms, validation and MCP tool schemas) and add a migration in `migrations/`.
