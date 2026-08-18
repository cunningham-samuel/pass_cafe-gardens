const CANONICAL_URL = 'https://pass-cafe-gardens.pages.dev/pass.html?userid={userid}';
const SETTING_NAME = 'MobileApp.CustomPage.Url';
const DEFAULT_BUSINESS_ID = '1420964965';
const SETTINGS_ENDPOINT = 'https://spaces.nexudus.com/api/sys/businesssettings';

export async function onRequestGet({ env }) {
  return handleRepair(env);
}

export async function onRequestPost({ env }) {
  return handleRepair(env);
}

async function handleRepair(env) {
  try {
    const result = await repairPassportUrl(env);
    return json(result, 200);
  } catch (err) {
    console.error('[repair-passport-url] error', err);
    return json(
      {
        ok: false,
        repaired: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      },
      500
    );
  }
}

async function repairPassportUrl(env) {
  if (!env.NEXUDUS_API_USERNAME || !env.NEXUDUS_API_PASSWORD) {
    throw new Error('Nexudus API credentials are not configured');
  }

  const auth =
    'Basic ' +
    btoa(`${env.NEXUDUS_API_USERNAME}:${env.NEXUDUS_API_PASSWORD}`);

  const headers = {
    Authorization: auth,
    Accept: 'application/json'
  };

  const businessId = String(env.NEXUDUS_BUSINESS_ID || DEFAULT_BUSINESS_ID);

  // Find the BusinessSetting record for the legacy Passport custom-page URL.
  const search = new URL(SETTINGS_ENDPOINT);
  search.searchParams.set('BusinessSetting_Business', businessId);
  search.searchParams.set('BusinessSetting_Name', SETTING_NAME);
  search.searchParams.set('size', '25');

  const listRes = await fetch(search.toString(), {
    headers,
    cache: 'no-store'
  });

  if (!listRes.ok) {
    throw new Error(`BusinessSetting search failed (${listRes.status})`);
  }

  const listData = await listRes.json();
  const records = Array.isArray(listData?.Records) ? listData.Records : [];

  const summary = records.find(record =>
    String(record?.Name || '').toLowerCase() === SETTING_NAME.toLowerCase() &&
    String(record?.BusinessId || '') === businessId
  ) || records.find(record =>
    String(record?.Name || '').toLowerCase() === SETTING_NAME.toLowerCase()
  );

  if (!summary?.Id) {
    throw new Error(`BusinessSetting not found: ${SETTING_NAME}`);
  }

  // Nexudus PUTs are full-record updates, so retrieve the complete record first.
  const fullRes = await fetch(`${SETTINGS_ENDPOINT}/${encodeURIComponent(summary.Id)}`, {
    headers,
    cache: 'no-store'
  });

  if (!fullRes.ok) {
    throw new Error(`BusinessSetting read failed (${fullRes.status})`);
  }

  const setting = await fullRes.json();
  const currentUrl = String(setting?.Value || '');

  if (currentUrl === CANONICAL_URL) {
    console.log('[repair-passport-url] URL already correct');
    return {
      ok: true,
      repaired: false,
      status: 'already-correct'
    };
  }

  const updatedSetting = {
    ...setting,
    Value: CANONICAL_URL
  };

  const putRes = await fetch(SETTINGS_ENDPOINT, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatedSetting)
  });

  const putText = await putRes.text();
  let putData = null;

  try {
    putData = putText ? JSON.parse(putText) : null;
  } catch {
    // Keep the raw response available for diagnostics below.
  }

  if (!putRes.ok || putData?.WasSuccessful === false) {
    const detail =
      putData?.Message ||
      putData?.Errors?.map(e => e?.Message).filter(Boolean).join('; ') ||
      putText ||
      `HTTP ${putRes.status}`;

    throw new Error(`BusinessSetting update failed: ${detail}`);
  }

  console.log('[repair-passport-url] restored canonical Passport URL');

  return {
    ok: true,
    repaired: true,
    status: 'repaired'
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
