export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const userid = url.searchParams.get('userid');

    if (!userid || !/^\d+$/.test(userid)) {
      return json({ error: 'Missing or invalid userid' }, 400);
    }

    const auth =
      "Basic " +
      btoa(`${env.NEXUDUS_API_USERNAME}:${env.NEXUDUS_API_PASSWORD}`);

    const coworkerUrl =
      `https://spaces.nexudus.com/api/spaces/coworkers?` +
      `Coworker_User=${encodeURIComponent(userid)}`;

    console.log('[get-bookings] userid=', userid);

    const cwRes = await fetch(coworkerUrl, {
      headers: {
        Authorization: auth,
        Accept: "application/json"
      }
    });

    console.log('[get-bookings] coworker status=', cwRes.status);

    if (!cwRes.ok) {
      console.log('[get-bookings] coworker lookup failed');
      return json(
        {
          error: 'Coworker lookup failed',
          status: cwRes.status
        },
        502
      );
    }

    const cwData = await cwRes.json();
    const records = Array.isArray(cwData?.Records)
      ? cwData.Records
      : [];

    console.log(
      '[get-bookings] coworker records=',
      records.length
    );

    const coworker = records[0];

    if (!coworker) {
      return json({
        bookings: [],
        dedicatedDesk: false
      });
    }

    const tariff = String(
      coworker.CoworkerContractTariffNames || ''
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
      `Booking_Coworker=${encodeURIComponent(coworker.Id)}` +
      `&from_Booking_FromTime=${encodeURIComponent(iso(start))}` +
      `&to_Booking_ToTime=${encodeURIComponent(iso(end))}` +
      `&status=Confirmed`;

    const bRes = await fetch(bookingsUrl, {
      headers: {
        Authorization: auth,
        Accept: "application/json"
      }
    });

    console.log(
      '[get-bookings] bookings status=',
      bRes.status
    );

    if (!bRes.ok) {
      console.log('[get-bookings] bookings fetch failed');

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

    console.log(
      '[get-bookings] bookings count=',
      bookings.length
    );

    return json({
      bookings,
      dedicatedDesk: false
    });

  } catch (err) {
    console.log('[get-bookings] error', err);

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
      "Content-Type": "application/json"
    }
  });
}
