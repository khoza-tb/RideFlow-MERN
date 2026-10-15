
const NOMINATIM_URL =
  "https://nominatim.openstreetmap.org";

const SEARCH_DELAY = 900;

let lastRequestTime = 0;
let requestQueue = Promise.resolve();

/**
 * Wait before making another Nominatim request.
 *
 * Nominatim's public service should not be hit
 * with rapid-fire requests.
 */
function waitForRateLimit() {
  requestQueue = requestQueue.then(async () => {
    const now = Date.now();

    const elapsed =
      now - lastRequestTime;

    if (elapsed < SEARCH_DELAY) {
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          SEARCH_DELAY - elapsed
        )
      );
    }

    lastRequestTime = Date.now();
  });

  return requestQueue;
}

/**
 * Search for a South African:
 *
 * - place
 * - road
 * - suburb
 * - address
 * - landmark
 * - shopping centre
 * - city
 * - town
 * - business
 * - school
 * - hospital
 * - airport
 * - etc.
 */
export async function searchPlace(query) {
  const cleanQuery =
    String(query || "").trim();

  if (cleanQuery.length < 3) {
    return [];
  }

  try {
    await waitForRateLimit();

    const params =
      new URLSearchParams({
        format: "jsonv2",
        countrycodes: "za",
        limit: "5",
        addressdetails: "1",
        "accept-language": "en-ZA",
        q: cleanQuery,
      });

    const response =
      await fetch(
        `${NOMINATIM_URL}/search?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json",
            "Accept-Language":
              "en-ZA",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        `Location search failed: ${response.status}`
      );
    }

    const data =
      await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((place) => ({
        name:
          formatAddress(place),

        lat: Number(
          place.lat
        ),

        lng: Number(
          place.lon
        ),

        type:
          place.type ||
          place.class ||
          "location",

        osmId:
          place.osm_id,

        displayName:
          place.display_name,
      }))
      .filter(
        (place) =>
          Number.isFinite(
            place.lat
          ) &&
          Number.isFinite(
            place.lng
          )
      );
  } catch (error) {
    console.error(
      "LOCATION SEARCH ERROR:",
      error
    );

    return [];
  }
}

/**
 * Reverse geocode GPS coordinates.
 *
 * GPS:
 * -25.7479, 28.2293
 *
 * becomes something like:
 *
 * 12 Nelson Mandela Drive,
 * Pretoria, Gauteng
 */
export async function reverseGeocode(
  lat,
  lng
) {
  const latitude =
    Number(lat);

  const longitude =
    Number(lng);

  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {
    return null;
  }

  try {
    await waitForRateLimit();

    const params =
      new URLSearchParams({
        format: "jsonv2",
        addressdetails: "1",
        zoom: "18",
        lat: String(
          latitude
        ),
        lon: String(
          longitude
        ),
        "accept-language":
          "en-ZA",
      });

    const response =
      await fetch(
        `${NOMINATIM_URL}/reverse?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json",
            "Accept-Language":
              "en-ZA",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        `Reverse geocoding failed: ${response.status}`
      );
    }

    const place =
      await response.json();

    return {
      name:
        formatAddress(place),

      lat: latitude,

      lng: longitude,

      address:
        place.address || {},

      displayName:
        place.display_name ||
        "",

      type:
        place.type ||
        "location",
    };
  } catch (error) {
    console.error(
      "REVERSE GEOCODING ERROR:",
      error
    );

    return null;
  }
}

/**
 * Convert Nominatim's address response
 * into a clean RideFlow address.
 */
function formatAddress(place) {
  const address =
    place?.address || {};

  const parts = [];

  // -----------------------------------------
  // HOUSE NUMBER
  // -----------------------------------------

  if (
    address.house_number
  ) {
    parts.push(
      address.house_number
    );
  }

  // -----------------------------------------
  // ROAD
  // -----------------------------------------

  if (
    address.road
  ) {
    parts.push(
      address.road
    );
  }

  // -----------------------------------------
  // SUBURB
  // -----------------------------------------

  const suburb =
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.residential;

  if (suburb) {
    parts.push(suburb);
  }

  // -----------------------------------------
  // CITY / TOWN
  // -----------------------------------------

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.city_district;

  if (city) {
    parts.push(city);
  }

  // -----------------------------------------
  // PROVINCE
  // -----------------------------------------

  if (
    address.state
  ) {
    parts.push(
      address.state
    );
  }

  // -----------------------------------------
  // POSTCODE
  // -----------------------------------------

  if (
    address.postcode
  ) {
    parts.push(
      address.postcode
    );
  }

  // -----------------------------------------
  // FALLBACK
  // -----------------------------------------

  if (
    parts.length === 0
  ) {
    return (
      place?.display_name ||
      "Unknown location"
    );
  }

  return parts.join(
    ", "
  );
}

