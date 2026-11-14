import type { NextRequest } from 'next/server';

// request.url can name a different host than the browser used (localhost vs 127.0.0.1),
// which would drop the session cookie on redirect.
export function sameHost(request: NextRequest, path: string): URL {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host;
  const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
  return new URL(path, `${proto}://${host}`);
}
