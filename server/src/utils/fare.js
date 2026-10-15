
const BASE_FARE = 25;
const RATE_PER_KM = 10.62;
const NIGHT_MULTIPLIER = 2;

// Night pricing starts at 19:30 and ends at 05:00 SAST.
const NIGHT_START_MINUTES = 19 * 60 + 30;
const NIGHT_END_MINUTES = 5 * 60;

function roundMoney(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function getSouthAfricanMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(date));

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value
  );

  const minute = Number(
    parts.find((part) => part.type === "minute")?.value
  );

  return hour * 60 + minute;
}

export function calculateFare(
  distanceKm,
  durationMin = 0,
  bookedAt = new Date()
) {
  const km = Number(distanceKm);
  const minutes = Number(durationMin);

  if (!Number.isFinite(km) || km < 0) {
    throw new Error("Invalid distance.");
  }

  const localMinutes = getSouthAfricanMinutes(bookedAt);

  const isNightRate =
    localMinutes >= NIGHT_START_MINUTES ||
    localMinutes < NIGHT_END_MINUTES;

  const baseFare = BASE_FARE;
  const ratePerKm = RATE_PER_KM;
  const distanceFare = roundMoney(km * ratePerKm);
  const normalFare = roundMoney(baseFare + distanceFare);

  const nightMultiplier = isNightRate
    ? NIGHT_MULTIPLIER
    : 1;

  const fare = roundMoney(normalFare * nightMultiplier);

  return {
    baseFare,
    ratePerKm,
    distanceFare,
    normalFare,
    nightMultiplier,
    fare,
    durationMin: Number.isFinite(minutes) && minutes >= 0
      ? minutes
      : 0,
    isNightRate,
  };
}
