export async function onRequestGet({ request }) {
  const url = new URL(request.url);

  const interestingHeaders = {};
  const allHeaderNames = [];

  for (const [name, value] of request.headers) {
    const lower = name.toLowerCase();
    allHeaderNames.push(name);

    if (
      lower.includes('auth') ||
      lower.includes('token') ||
      lower.includes('user') ||
      lower.includes('cookie') ||
      lower.includes('session') ||
      lower.includes('nexudus') ||
      lower.includes('passport')
    ) {
      interestingHeaders[name] = value ? `[present, ${value.length} chars]` : '[empty]';
    }
  }

  const query = {};
  for (const [key, value] of url.searchParams) {
    query[key] = value ? `[present, ${value.length} chars]` : '[empty]';
  }

  const diagnostic = {
    pathname: url.pathname,
    query,
    interestingHeaders,
    allHeaderNames
  };

  console.log('[passport-debug]', diagnostic);

  return new Response(
    JSON.stringify({
      ok: true,
      ...diagnostic
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    }
  );
}
