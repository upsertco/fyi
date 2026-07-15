// test/index.spec.ts
import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, vi, it, expect, afterEach } from 'vitest';
import app from '../src/index';

type Payload = {
  code: string;
  url: string;
};

vi.mock('nanoid', () => {
  return {
    // customAlphabet(alphabet, size) returns a generator function; return a
    // fixed short code so assertions are deterministic.
    customAlphabet: vi.fn(() => vi.fn(() => 'ABC123')),
  };
});

describe('ajd-fyi worker', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });
  it.skip('redirect a GET request on the apex', async () => {
    const res = await app.request('/', {}, env);
    expect(res.status).toBe(301);
    expect(res.statusText).toBe('Moved Permanently');
  });

  describe('ajd-fyi create link endpoint', () => {
    it('should respond with respond with 200 and shortlink', async () => {
      const response = await SELF.fetch('https://ajd.fyi', {
        method: 'POST',
        body: JSON.stringify({ longUrl: 'https://google.com' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.AUTH_KEY}`,
        },
      });
      const data: Payload = await response.json();
      expect(response.status).toBe(200);
      expect(data.code).toBe('ABC123');
      // The base is derived from the request host, so a POST to https://ajd.fyi
      // yields a short URL on that same origin.
      expect(data.url).toBe('https://ajd.fyi/ABC123');
    });

    it('should respond with error 400 with a bad longUrl', async () => {
      // Sending a request without the expected body shouldn't match...
      const response = await SELF.fetch('https://ajd.fyi', {
        method: 'POST',
        body: JSON.stringify({ longUrl: 'h/google' }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.AUTH_KEY}`,
        },
      });
      expect(response.status).toBe(400);
    });
  });

  describe('ajd-fyi get a link from the kv store', () => {
    // Get the current list stored in a KV namespace
    beforeEach(async () => {
      await env.URLS.put('IuLJ8g', 'https://cloudflare.com');
      await env.URLS.put('AliK2f', 'https://apple.com');
      await env.URLS.put('jxZ49f', 'https://hono.dev');
    });

    it('gets a gets a short link and redirects to cloudflare', async () => {
      const response = await SELF.fetch('https://ajd.fyi/IuLJ8g');
      expect(response.redirected).toBeTruthy();
      expect(response.url).toBe('https://cloudflare.com/');
    });

    it('gets a gets a short link and redirects to apple', async () => {
      const response = await SELF.fetch('https://ajd.fyi/AliK2f');
      expect(response.redirected).toBeTruthy();
      expect(response.url).toBe('https://apple.com/');
    });

    it('gets a gets a short link and redirects to hono.dev', async () => {
      const response = await SELF.fetch('https://ajd.fyi/jxZ49f');
      expect(response.redirected).toBeTruthy();
      expect(response.url).toBe('https://hono.dev/');
    });
  });

  describe('ajd-fyi delete endpoint Link', () => {
    it.skip('deletes a link from the kv store');
  });
});
