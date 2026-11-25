import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from '../serverApp.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const rawUrl = req.url || '/';
  const parsed = new URL(rawUrl, 'http://localhost');
  const rewrittenRoute = parsed.searchParams.get('__nexora_route');
  if (rewrittenRoute) {
    parsed.searchParams.delete('__nexora_route');
    const normalizedPath = rewrittenRoute.startsWith('/')
      ? rewrittenRoute
      : `/${rewrittenRoute}`;
    const remainingQs = parsed.searchParams.toString();
    const targetUrl = remainingQs ? `${normalizedPath}?${remainingQs}` : normalizedPath;
    req.url = targetUrl;
    (req as IncomingMessage & { originalUrl?: string }).originalUrl = targetUrl;
  }
  return app(
    req as unknown as Parameters<typeof app>[0],
    res as unknown as Parameters<typeof app>[1]
  );
}
