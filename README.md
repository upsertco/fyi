# fyi

A very primitive URL shortener using Cloudflare Workers, KV, and Hono.

## Deploy your own

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/upsertco/fyi)

Clicking the button clones this repo into your own Git account, provisions a KV
namespace for the short links, wires up automatic deploys (Workers Builds), and
publishes the worker to a free `*.workers.dev` subdomain — no config edits
required.

Once it's live, redirects work immediately. The **create** endpoint stays locked
(returns `401`) until you set an `AUTH_KEY` — see [After deploying](#after-deploying).

## Usage

Create a short link (`AUTH_KEY` required):

```bash
curl -X POST https://<your-worker>.workers.dev \
  -H "Authorization: Bearer $AUTH_KEY" \
  -H "Content-Type: application/json" \
  -d '{"longUrl": "https://example.com/some/very/long/path"}'
```

Response:

```json
{
  "code": "aB3xZq",
  "url": "https://<your-worker>.workers.dev/aB3xZq"
}
```

Visiting the returned `url` issues a `302` redirect to the original long URL.

## After deploying

The create endpoint is guarded by a bearer token (`AUTH_KEY`). Generate one and
set it as a production secret:

```bash
# Generates an AUTH_KEY into .dev.vars for local dev and prints the command
# to add the production secret.
./scripts/create_token.sh

# Add the production secret to your deployed worker:
npx wrangler secret put AUTH_KEY
```

Keep the token somewhere safe — it isn't stored anywhere retrievable. If you lose
it, generate a new one and update any integrations using the old token.

## Local development

```bash
npm i          # install dependencies
npm run dev    # start wrangler dev on http://localhost:3000
npm test       # run the test suite
```

Wrangler's local KV support uses SQLite under the hood, so you can exercise the
same bindings locally that you use in production without running a separate KV
store.

If you change bindings in `wrangler.toml`, regenerate the TypeScript types:

```bash
npm run cf-typegen
```

## Manual deploy (without the button)

1. Create a KV namespace and paste the returned id into `wrangler.toml` under
   `kv_namespaces`:

   ```bash
   npx wrangler kv namespace create URLS
   ```

2. Set the auth token (see [After deploying](#after-deploying)).

3. Deploy:

   ```bash
   npm run deploy
   ```

## Custom domain (optional)

To serve from your own short domain instead of `*.workers.dev`, add the domain
to your Cloudflare account, then uncomment and edit the `routes` line in
`wrangler.toml`:

```toml
routes = [{ pattern = "example.com", custom_domain = true }]
```

The created short URLs automatically use whatever host the request came in on, so
no other change is needed.

## Features

- Simple endpoints to create and access short links.
- Uses nanoid to generate URL-friendly short codes.
- Uses Hono's built-in JSX support to render error pages for missing links.
- Tailwind CSS for styling error pages.
- Growing test suite.
- Under 10ms CPU compute, so it runs comfortably on a free account.

## Extra

You can use this with a tool like [Dropshare](https://dropshare.app) to create
shortlinks and also share screenshots and videos. Follow the [setup
guide](https://support.dropshare.app/hc/en-us/articles/201268771-How-to-set-up-a-custom-URL-shortener)
to use their landing pages, or use the route to query the image and serve it from
the worker directly.
