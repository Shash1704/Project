import { createServer } from 'node:http';

/** Tiny HTTP endpoint so the worker can run as a (free) web service and be kept warm by pings. */
export function startHealthServer(): void {
  const port = Number(process.env.PORT);
  if (!port) return;
  createServer((req, res) => {
    res.writeHead(req.url === '/healthz' ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: req.url === '/healthz',
        service: 'worker',
        uptime: Math.round(process.uptime()),
      }),
    );
  }).listen(port, () => console.log(`[worker] health on :${port}`));
}
