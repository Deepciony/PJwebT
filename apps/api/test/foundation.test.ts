import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { query } from '../src/db';

describe('foundation', () => {
  it('health reports the database is reachable', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: true });
  });

  it('serves an OpenAPI 3.1 document that includes the health endpoint', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.paths['/api/v1/health'].get.summary).toBeTruthy();
    // code samples in the docs need a full URL, so the document names the server it came from
    expect(res.body.servers[0].url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it('serves the Scalar API reference page', async () => {
    const res = await request(app).get('/docs');
    expect(res.status).toBe(200);
    expect(res.text).toContain('/openapi.json');
    expect(res.text).toContain('/docs/scalar.js'); // self-hosted, works without internet
    const script = await request(app).get('/docs/scalar.js');
    expect(script.status).toBe(200);
    expect(script.headers['content-type']).toContain('javascript');
  });

  it('does not force https, so the production build also works over plain http on a LAN demo', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });

  it('unknown API routes return the standard error shape', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('serves the built web app, with client-side routes falling back to index.html', async () => {
    const home = await request(app).get('/');
    expect(home.status).toBe(200);
    expect(home.text).toContain('id="root"');
    const deepLink = await request(app).get('/courts/3').set('Accept', 'text/html');
    expect(deepLink.status).toBe(200);
    expect(deepLink.text).toContain('id="root"');
    // uptime monitors check pages with HEAD
    expect((await request(app).head('/')).status).toBe(200);
    expect((await request(app).head('/courts/3').set('Accept', 'text/html')).status).toBe(200);
    const asset = await request(app).get('/assets/app-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');
  });

  it('does not answer missing uploads or API paths with the web app', async () => {
    expect((await request(app).get('/uploads/avatars/missing.png')).status).toBe(404);
    expect((await request(app).get('/api/v1/missing').set('Accept', 'text/html')).body.error.code).toBe('NOT_FOUND');
  });

  it('migration created the no-overlap exclusion constraint', async () => {
    const rows = await query(`SELECT conname FROM pg_constraint WHERE conname = 'no_overlap'`);
    expect(rows).toHaveLength(1);
  });
});
