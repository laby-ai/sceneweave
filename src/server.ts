import { createServer } from 'http';
import next from 'next';
import { observeRequest, runWithRequestObservationContext } from './lib/request-observability';
import { getOperationalObservabilityReadiness } from './lib/operational-observability';
import { PROMETHEUS_CONTENT_TYPE, serviceMetrics, trustedMetricsRequest } from './lib/service-metrics';

const dev = process.env.NODE_ENV !== 'production';
if (!dev && !getOperationalObservabilityReadiness().ready) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    service: 'huiying',
    event: 'observability_startup_blocked',
    errorType: 'ObservabilityIdentityHashUnavailable',
  }));
  process.exit(78);
}
const bindHost = process.env.BIND_HOST || (dev ? 'localhost' : '127.0.0.1');
const port = parseInt(process.env.PORT || '5000', 10);

// Create Next.js app
const app = next({ dev, hostname: bindHost, port });
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

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const observation = observeRequest(req, res);
    await runWithRequestObservationContext(observation.requestId, async () => {
      try {
        const requestPath = new URL(req.url || '/', `http://${req.headers.host || `${bindHost}:${port}`}`).pathname;
        if (requestPath === '/api/metrics' || requestPath === '/huiying/api/metrics') {
          if (!trustedMetricsRequest(req.socket.remoteAddress, req.headers['x-forwarded-for'], req.headers['x-real-ip'])) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'metrics_forbidden' }));
            return;
          }
          const body = serviceMetrics.render();
          res.statusCode = 200;
          res.setHeader('Content-Type', PROMETHEUS_CONTENT_TYPE);
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.end(body);
          return;
        }
        const parsedUrl = parseRequestUrl(req.url || '/', `http://${req.headers.host || `${bindHost}:${port}`}`);
        await handle(req, res, parsedUrl);
      } catch (err) {
        observation.logError(err);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    });
  });
  server.once('error', err => {
    console.error(err);
    process.exit(1);
  });
  server.listen(port, bindHost, () => {
    console.log(
      `> Server listening at http://${bindHost}:${port} as ${
        dev ? 'development' : 'production'
      }`,
    );
  });
});
