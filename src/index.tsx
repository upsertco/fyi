/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 *
 */

import { Hono } from 'hono';
import { poweredBy } from 'hono/powered-by';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { createMiddleware } from 'hono/factory';
import { validator } from 'hono/validator';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { customAlphabet } from 'nanoid';
import { z } from 'zod';

import { ErrorPage } from './components';

const app = new Hono<{ Bindings: Env }>();

// Apply middleware to add logger and "Powered by Hono" header.
// Must be registered before the routes so it applies to them.
app.use('*', logger(), poweredBy());

// Restrict generated codes to the same character set the param regex accepts
// so every created code is retrievable (nanoid's default alphabet includes
// `-` and `_`, which the lookup route rejects).
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const generateCode = customAlphabet(ALPHABET, 6);

const payloadSchema = z.object({
  longUrl: z
    .string()
    .url('Invalid URL')
    .refine((u) => /^https?:\/\//i.test(u), 'URL must use http or https'),
});

const regex = /^[a-zA-Z0-9]{6}$/;
const paramSchema = z.object({
  // code: z.string().nanoid(), // https://github.com/colinhacks/zod/pull/4004
  code: z.string().regex(new RegExp(regex)),
});

// Constant-time string comparison to avoid leaking token information through
// response timing. Hashing both inputs to a fixed length first means the
// byte-wise comparison never short-circuits and never reveals length.
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  const aBytes = new Uint8Array(aHash);
  const bBytes = new Uint8Array(bHash);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

// Middleware to check the authentication header for POST requests
const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const expectedAuthHeader = `Bearer ${c.env.AUTH_KEY}`;

  if (!authHeader || !(await timingSafeEqual(authHeader, expectedAuthHeader))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// POST route to create a short URL (with authentication)
app.post(
  '/',
  authMiddleware,
  validator('json', (value, c) => {
    const parsed = payloadSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({ error: 'Invalid Url!' }, 400);
    }
    return parsed.data;
  }),
  async (c) => {
    const { longUrl } = c.req.valid('json');

    // Generate a random short code, regenerating on the rare collision so we
    // never overwrite an existing mapping.
    let shortCode = generateCode();
    while (await c.env.URLS.get(shortCode)) {
      shortCode = generateCode();
    }

    // Store the long URL with the short code as the key
    await c.env.URLS.put(shortCode, longUrl);

    // Derive the short-URL base from the incoming request so the response is
    // correct on any deployment — the free *.workers.dev subdomain or a custom
    // domain — with no configuration.
    const base = new URL(c.req.url).origin;

    return c.json({
      code: shortCode,
      url: `${base}/${shortCode}`,
    });
  },
);

// GET route to retrieve the long URL (no authentication required)
app.get(
  '/:code',
  validator('param', (value) => {
    const parsed = paramSchema.safeParse(value);
    if (!parsed.success) {
      throw new HTTPException(400, {
        message: 'Seems like an invalid shortcode.',
      });
    }
    return parsed.data;
  }),
  async (c) => {
    const { code } = c.req.valid('param');
    const longUrl = await c.env.URLS.get(code);

    if (!longUrl) {
      return c.notFound();
    }

    return c.redirect(longUrl, 302);
  },
);

app.notFound((c) => {
  return c.html(
    <ErrorPage title="404 Not Found" code="404">
      Sorry that url doesn&apos;t seem to exist.
    </ErrorPage>,
    404,
  );
});

app.onError((err, c) => {
  let statusCode: ContentfulStatusCode = 500;
  if (err instanceof HTTPException) {
    // Get the custom response
    const httpError = err.getResponse();
    statusCode = httpError.status as ContentfulStatusCode;
  }

  return c.html(
    <ErrorPage title={err.name} code={statusCode}>
      {err.message}
    </ErrorPage>,
    statusCode,
  );
});

export default app;
