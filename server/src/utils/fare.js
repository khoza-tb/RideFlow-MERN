const BASE_FARE = 25;
const RATE_PER_KM = 25;
const NIGHT_HOUR = 21;

export function calculateFare(distanceKm, durationMin = 0, bookedAt = new Date()) {
  const km = Number(distanceKm);
  const minutes = Number(durationMin);

  if (!Number.isFinite(km) || km < 0) {
    throw new Error("Invalid distance.");
  }

  const baseFare = BASE_FARE;
  const distanceFare = km * RATE_PER_KM;
  const normalFare = baseFare + distanceFare;

  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Africa/Johannesburg",
    }).format(new Date(bookedAt))
  );

  const nightMultiplier = hour >= NIGHT_HOUR ? 2 : 1;

  const fare = normalFare * nightMultiplier;

  return {
    baseFare: Number(baseFare.toFixed(2)),
    ratePerKm: Number(RATE_PER_KM.toFixed(2)),
    distanceFare: Number(distanceFare.toFixed(2)),
    normalFare: Number(normalFare.toFixed(2)),
    nightMultiplier,
    fare: Number(fare.toFixed(2)),
    durationMin: Number.isFinite(minutes) ? minutes : 0,
    isNightRate: nightMultiplier === 2,
  };
}