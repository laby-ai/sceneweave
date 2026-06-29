import { createServer } from 'http';
import next from 'next';

const dev = process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '5000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function parseRequestUrl(reqUrl: string, baseUrl: string): NonNullable<Parameters<typeof handle>[2]> {
  const url = new URL(reqUrl, baseUrl);
  const query: Record<string, string | string[]> = {};
  url.searchParams.forEach((value, key) => {
    const existing = query[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (existing) {
      query[key] = [existing, value];
    } else {
      query[key] = value;
    }
  });
  const path = `${url.pathname}${url.search}`;

  return {
    href: path,
    protocol: null,
    slashes: null,
    auth: null,
    host: null,
    port: null,
    hostname: null,
    hash: url.hash || null,
    search: url.search || null,
    query,
    pathname: url.pathname,
    path,
  };
}

// ARK direct Volcano access: inject default BYOK headers when client didn't provide them.
const ARK_KEY = (process.env.ARK_IMAGE_API_KEY || process.env.ARK_API_KEY || '').trim();
const ARK_BASE = (process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3').replace('/api/plan/v3', '/api/v3').trim();
const ARK_MODEL = (process.env.ARK_AGENT_MODEL || 'doubao-seed-1-6-250615').trim();
const ARK_IMG = (process.env.ARK_IMAGE_MODEL || 'doubao-seedream-5-0-260128').trim();
const ARK_VID = (process.env.ARK_VIDEO_MODEL || 'doubao-seedance-1-5-pro-251215').trim();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      // Inject default ARK BYOK headers for direct Volcano access (not agentplan).
      if (ARK_KEY && !req.headers['x-yh-api-key']) {
        req.headers['x-yh-provider'] = 'ark-plan';
        req.headers['x-yh-api-base'] = ARK_BASE;
        req.headers['x-yh-api-key'] = ARK_KEY;
        req.headers['x-yh-model'] = ARK_MODEL;
        req.headers['x-yh-image-model'] = ARK_IMG;
        req.headers['x-yh-video-model'] = ARK_VID;
      }
      const parsedUrl = parseRequestUrl(req.url || '/', `http://${req.headers.host || `${hostname}:${port}`}`);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });
  server.once('error', err => {
    console.error(err);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : process.env.COZE_PROJECT_ENV
      }`,
    );
  });
});
