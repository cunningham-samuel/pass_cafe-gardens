export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const coworkerid = url.searchParams.get('coworkerid');

    if (!coworkerid || !/^\d+$/.test(coworkerid)) {
      return json({ error: 'Missing or invalid coworkerid' }, 400);
    }

    const auth =
      'Basic ' +
      btoa(`${env.NEXUDUS_API_USERNAME}:${env.NEXUDUS_API_PASSWORD}`);

    const headers = {
      Authorization: auth,
      Accept: 'application/json'
    };

    console.log('[get-bookingsv5] coworkerid=', coworkerid);

    // Fetch the coworker directly by Coworker ID. This avoids the legacy
    // User ID -> Coworker ID lookup used by get-bookings.js.
    const coworkerUrl =
      `https://spaces.nexudus.com/api/spaces/coworkers/${encodeURIComponent(coworkerid)}`;

    const cwRes = await fetch(coworkerUrl, { headers });

    console.log('[get-bookingsv5] coworker status=', cwRes.status);

    if (!cwRes.ok) {
      return json(
        {
          error: 'Coworker lookup failed',
          status: cwRes.status
        },
        502
      );
    }

    const coworker = await cwRes.json();

    if (!coworker || String(coworker.Id) !== String(coworkerid)) {
      return json({
        bookings: [],
        dedicatedDesk: false
      });
    }

    // Preserve the existing dedicated-desk behaviour. Depending on the
    // representation returned by Nexudus, the plan names can be exposed
    // under either of these fields.
    const tariff = String(
      coworker.CoworkerContractTariffNames ||
      coworker.TariffNames ||
      ''
    );

    if (tariff.toLowerCase().includes('dedicated')) {
      return json({
        dedicatedDesk: true
      });
    }

    const now = new Date();

    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setUTCHours(23, 59, 59, 999);

    const iso = d =>
      d.toISOString().split('.')[0] + 'Z';

    const bookingsUrl =
      `https://spaces.nexudus.com/api/spaces/bookings?` +
      `Booking_Coworker=${encodeURIComponent(coworkerid)}` +
      `&from_Booking_FromTime=${encodeURIComponent(iso(start))}` +
      `&to_Booking_ToTime=${encodeURIComponent(iso(end))}` +
      `&status=Confirmed`;

    const bRes = await fetch(bookingsUrl, { headers });

    console.log('[get-bookingsv5] bookings status=', bRes.status);

    if (!bRes.ok) {
      return json(
        {
          error: 'Bookings fetch failed',
          status: bRes.status
        },
        502
      );
    }

    const bData = await bRes.json();

    const bookings = Array.isArray(bData?.Records)
      ? bData.Records
      : [];

    console.log('[get-bookingsv5] bookings count=', bookings.length);

    return json({
      bookings,
      dedicatedDesk: false
    });

  } catch (err) {
    console.log('[get-bookingsv5] error', err);

    return json(
      {
        error: 'Server error'
      },
      500
    );
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
