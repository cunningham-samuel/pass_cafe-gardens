// /functions/api/get-bookings.js
// Replaces your Render backend. Runs on Cloudflare's Workers runtime.

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const userid = url.searchParams.get('userid');

    // 1) Basic input checks
    if (!userid || !/^\d+$/.test(userid)) {
      return json({ error: 'Missing or invalid userid' }, 400);
    }

    // 2) (Optional but recommended) verify Nexudus-signed custom page request.
    // Nexudus can append an HMAC-SHA256 signature to custom-page URLs using your shared secret.
    // We accept ?h=<hex> or ?signature=<hex>. If present, we validate it.
    const sigParam = url.searchParams.has('h')
      ? 'h'
      : (url.searchParams.has('signature') ? 'signature' : null);

    if (sigParam && env.NEXUDUS_SHARED_SECRET) {
      const provided = String(url.searchParams.get(sigParam)).toLowerCase();

      // Recompute HMAC over the FULL URL *without* the signature parameter.
      const unsigned = new URL(request.url);
      unsigned.searchParams.delete(sigParam);

      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw", enc.encode(env.NEXUDUS_SHARED_SECRET),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(unsigned.toString()));
      const expected = [...new Uint8Array(sigBytes)].map(b => b.toString(16).padStart(2, '0')).join('');

      if (expected.toLowerCase() !== provided) {
        return json({ error: 'Invalid signature' }, 403);
      }
    }

    // 3) Call Nexudus (REST API) with Basic auth, like your Node server did.
    const auth = "Basic " + btoa(`${env.NEXUDUS_API_USERNAME}:${env.NEXUDUS_API_PASSWORD}`);

    // 3a) Look up coworker by the Nexudus User Id
    const coworkerUrl =
      `https://spaces.nexudus.com/api/spaces/coworkers?Coworker_User=${encodeURIComponent(userid)}`;

    const cwRes = await fetch(coworkerUrl, {
      headers: { Authorization: auth, Accept: "application/json" }
    }); // Workers use fetch natively. :contentReference[oaicite:3]{index=3}

    if (!cwRes.ok) return json({ error: 'Coworker lookup failed', status: cwRes.status }, 502);
    const cwData = await cwRes.json(); // Nexudus search endpoints return { Records: [...] } :contentReference[oaicite:4]{index=4}
    const coworker = Array.isArray(cwData?.Records) && cwData.Records[0];
    if (!coworker) return json({ bookings: [] });

    // Dedicated desk check (matches your server.js logic)
    const tariff = String(coworker.CoworkerContractTariffNames || '');
    if (tariff.toLowerCase().includes('dedicated')) {
      return json({ dedicatedDesk: true }); // keep key name consistent with your front end
    }

    // 3b) Get today's bookings for that coworker
    const now = new Date();
    const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
    const end   = new Date(now); end.setUTCHours(23, 59, 59, 999);
    const iso = d => d.toISOString().split('.')[0] + 'Z';

    const bookingsUrl =
      `https://spaces.nexudus.com/api/spaces/bookings?` +
      `Booking_Coworker=${encodeURIComponent(coworker.Id)}` +
      `&from_Booking_FromTime=${encodeURIComponent(iso(start))}` +
      `&to_Booking_ToTime=${encodeURIComponent(iso(end))}` +
      `&status=Confirmed`;

    const bRes = await fetch(bookingsUrl, {
      headers: { Authorization: auth, Accept: "application/json" }
    });
    if (!bRes.ok) return json({ error: 'Bookings fetch failed', status: bRes.status }, 502);

    const bData = await bRes.json(); // { Records: [...] } for bookings too :contentReference[oaicite:5]{index=5}
    const bookings = Array.isArray(bData?.Records) ? bData.Records : [];

    return json({ bookings, dedicatedDesk: false });
  } catch (err) {
    return json({ error: 'Server error', detail: String(err).slice(0, 400) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

