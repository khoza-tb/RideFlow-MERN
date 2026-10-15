
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

// ==================================================
// CUSTOM MAP ICONS
// ==================================================

const pin = (
  background,
  emoji = "",
  size = 34
) =>
  L.divIcon({
    className: "rideflow-map-pin",

    html: `
      <div
        style="
          width:${size}px;
          height:${size}px;
          border-radius:50%;
          background:${background};
          border:3px solid #ffffff;
          box-shadow:0 4px 15px rgba(0,0,0,0.28);
          display:grid;
          place-items:center;
          font-size:16px;
          line-height:1;
        "
      >
        ${emoji}
      </div>
    `,

    iconSize: [
      size,
      size,
    ],

    iconAnchor: [
      size / 2,
      size / 2,
    ],

    popupAnchor: [
      0,
      -(size / 2),
    ],
  });

// Pickup marker
const pickupIcon = pin(
  "#00c878",
  "●"
);

// Destination marker
const destinationIcon = pin(
  "#111827",
  "◆"
);

// Driver marker
const carIcon = pin(
  "#b8f35a",
  "🚗",
  40
);

// Passenger marker
const passengerIcon = pin(
  "#2563eb",
  "●",
  36
);

// ==================================================
// COORDINATE VALIDATION
// ==================================================

function isValidCoordinate(
  location
) {
  if (!location) {
    return false;
  }

  const lat =
    Number(location.lat);

  const lng =
    Number(location.lng);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// ==================================================
// CONVERT LOCATION TO LEAFLET FORMAT
// ==================================================

function toLatLng(
  location
) {
  if (
    !isValidCoordinate(
      location
    )
  ) {
    return null;
  }

  return [
    Number(location.lat),
    Number(location.lng),
  ];
}

// ==================================================
// LOCATION NAME
// ==================================================

function getLocationName(
  location,
  fallback
) {
  if (!location) {
    return fallback;
  }

  if (
    typeof location ===
    "string"
  ) {
    return location;
  }

  return (
    location.name ||
    location.address ||
    location.label ||
    location.display_name ||
    fallback
  );
}

// ==================================================
// MAP AUTO FIT
// ==================================================

function FitMap({
  points,
}) {
  const map = useMap();

  useEffect(() => {
    if (
      !map ||
      !points ||
      points.length === 0
    ) {
      return;
    }

    // -----------------------------------------------
    // One point
    // -----------------------------------------------

    if (points.length === 1) {
      map.flyTo(
        points[0],
        15,
        {
          duration: 0.7,
        }
      );

      return;
    }

    // -----------------------------------------------
    // Multiple points
    // -----------------------------------------------

    const bounds =
      L.latLngBounds(
        points
      );

    if (!bounds.isValid()) {
      return;
    }

    map.fitBounds(
      bounds,
      {
        padding: [
          60,
          60,
        ],
        maxZoom: 15,
        animate: true,
      }
    );
  }, [
    map,
    points,
  ]);

  return null;
}

// ==================================================
// DRIVER FOLLOW COMPONENT
// ==================================================
//
// When the driver sends a new GPS position,
// this component moves the map toward the driver.
//
// We intentionally do not constantly zoom the map.
// This keeps the passenger's map usable.
//
// ==================================================

function FollowDriver({
  driverLocation,
  enabled = true,
}) {
  const map = useMap();

  useEffect(() => {
    if (
      !enabled ||
      !isValidCoordinate(
        driverLocation
      )
    ) {
      return;
    }

    const position =
      toLatLng(
        driverLocation
      );

    if (!position) {
      return;
    }

    // Only move the map if the driver is
    // reasonably close to the current view.
    //
    // This prevents the map from becoming
    // uncomfortable if the passenger manually
    // moves the map.

    const currentCenter =
      map.getCenter();

    const distance =
      map.distance(
        currentCenter,
        position
      );

    // If driver is outside approximately
    // 5km of current center, bring map back.
    if (distance > 5000) {
      map.flyTo(
        position,
        Math.max(
          map.getZoom(),
          14
        ),
        {
          duration: 0.8,
        }
      );
    }
  }, [
    map,
    driverLocation?.lat,
    driverLocation?.lng,
    enabled,
  ]);

  return null;
}

// ==================================================
// PASSENGER FOLLOW COMPONENT
// ==================================================

function FollowPassenger({
  passengerLocation,
}) {
  const map = useMap();

  useEffect(() => {
    if (
      !isValidCoordinate(
        passengerLocation
      )
    ) {
      return;
    }

    // Only use passenger location to
    // center the map when there is no
    // active driver location.

    if (
      isValidCoordinate(
        passengerLocation
      )
    ) {
      // Do not constantly move the map while
      // the passenger is manually browsing it.
      //
      // The marker will still update.
    }
  }, [
    map,
    passengerLocation?.lat,
    passengerLocation?.lng,
  ]);

  return null;
}

// ==================================================
// MAP RESIZE
// ==================================================

function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    const resize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    resize();

    window.addEventListener(
      "resize",
      resize
    );

    return () => {
      window.removeEventListener(
        "resize",
        resize
      );
    };
  }, [map]);

  return null;
}

// ==================================================
// LIVE DRIVER PULSE
// ==================================================

function DriverPulse({
  location,
}) {
  const position =
    toLatLng(location);

  if (!position) {
    return null;
  }

  return (
    <Circle
      center={position}
      radius={70}
      pathOptions={{
        color: "#b8f35a",
        fillColor:
          "#b8f35a",
        fillOpacity: 0.15,
        weight: 2,
      }}
    />
  );
}

// ==================================================
// PASSENGER GPS ACCURACY CIRCLE
// ==================================================

function PassengerAccuracy({
  location,
}) {
  const position =
    toLatLng(location);

  if (!position) {
    return null;
  }

  const accuracy =
    Number(
      location.accuracy
    );

  if (
    !Number.isFinite(
      accuracy
    ) ||
    accuracy <= 0
  ) {
    return null;
  }

  return (
    <Circle
      center={position}
      radius={Math.min(
        accuracy,
        150
      )}
      pathOptions={{
        color: "#2563eb",
        fillColor:
          "#2563eb",
        fillOpacity: 0.08,
        weight: 1,
      }}
    />
  );
}

// ==================================================
// RIDE MAP
// ==================================================

export default function RideMap({
  pickup,
  destination,
  driverLocation,
  passengerLocation,
  drivers = [],

  height = "500px",
}) {
  // =================================================
  // SOUTH AFRICA DEFAULT CENTER
  // =================================================

  const center = [
    -30.5595,
    22.9375,
  ];

  // =================================================
  // CONVERT LOCATIONS
  // =================================================

  const pickupPoint =
    toLatLng(
      pickup
    );

  const destinationPoint =
    toLatLng(
      destination
    );

  const bookedDriverPoint =
    toLatLng(
      driverLocation
    );

  const passengerPoint =
    toLatLng(
      passengerLocation
    );

  // =================================================
  // FOCUS POINTS
  // =================================================
  //
  // Passenger GPS is intentionally not included
  // when there is an active driver because the
  // passenger should primarily follow the ride.
  //
  // =================================================

  const focusPoints = [
    pickupPoint,
    destinationPoint,
    bookedDriverPoint,
  ].filter(Boolean);

  // If there is no ride route yet,
  // use passenger's current GPS.
  if (
    focusPoints.length === 0 &&
    passengerPoint
  ) {
    focusPoints.push(
      passengerPoint
    );
  }

  // =================================================
  // NEARBY DRIVERS
  // =================================================

  const validDrivers =
    Array.isArray(drivers)
      ? drivers.filter(
          (driver) =>
            driver &&
            isValidCoordinate(
              driver.location
            )
        )
      : [];

  // =================================================
  // HEIGHT
  // =================================================

  const mapHeight =
    typeof height ===
    "number"
      ? `${height}px`
      : height ||
        "500px";

  // =================================================
  // RENDER
  // =================================================

  return (
    <div
      className="mapWrap"
      style={{
        width: "100%",
        height:
          mapHeight,
        minHeight:
          mapHeight,
        position:
          "relative",
        overflow:
          "hidden",
      }}
    >
      <MapContainer
        center={center}
        zoom={5}
        scrollWheelZoom={true}
        className="mapCanvas"
        style={{
          width: "100%",
          height: "100%",
          minHeight:
            "100%",
        }}
      >
        {/* ======================================== */}
        {/* OPEN STREET MAP */}
        {/* ======================================== */}

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* ======================================== */}
        {/* AUTOMATIC MAP POSITION */}
        {/* ======================================== */}

        <FitMap
          points={
            focusPoints
          }
        />

        {/* ======================================== */}
        {/* LIVE DRIVER FOLLOW */}
        {/* ======================================== */}

        <FollowDriver
          driverLocation={
            driverLocation
          }
          enabled={
            Boolean(
              driverLocation
            )
          }
        />

        {/* ======================================== */}
        {/* PASSENGER LOCATION */}
        {/* ======================================== */}

        <FollowPassenger
          passengerLocation={
            passengerLocation
          }
        />

        {/* ======================================== */}
        {/* RESIZE */}
        {/* ======================================== */}

        <ResizeMap />

        {/* ======================================== */}
        {/* PASSENGER LIVE GPS */}
        {/* ======================================== */}

        {passengerPoint && (
          <>
            <PassengerAccuracy
              location={
                passengerLocation
              }
            />

            <Marker
              position={
                passengerPoint
              }
              icon={
                passengerIcon
              }
            >
              <Popup>
                <div className="rideMapPopup">

                  <strong>
                    Your location
                  </strong>

                  <br />

                  <span>
                    Live GPS location
                  </span>

                  {Number.isFinite(
                    Number(
                      passengerLocation?.accuracy
                    )
                  ) && (
                    <>
                      <br />

                      <span>
                        Accuracy: ±
                        {Math.round(
                          Number(
                            passengerLocation.accuracy
                          )
                        )}
                        m
                      </span>
                    </>
                  )}

                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* ======================================== */}
        {/* PICKUP */}
        {/* ======================================== */}

        {pickupPoint && (
          <Marker
            position={
              pickupPoint
            }
            icon={
              pickupIcon
            }
          >
            <Popup>

              <div className="rideMapPopup">

                <strong>
                  Pickup
                </strong>

                <br />

                <span>
                  {getLocationName(
                    pickup,
                    "Pickup location"
                  )}
                </span>

              </div>

            </Popup>
          </Marker>
        )}

        {/* ======================================== */}
        {/* DESTINATION */}
        {/* ======================================== */}

        {destinationPoint && (
          <Marker
            position={
              destinationPoint
            }
            icon={
              destinationIcon
            }
          >
            <Popup>

              <div className="rideMapPopup">

                <strong>
                  Destination
                </strong>

                <br />

                <span>
                  {getLocationName(
                    destination,
                    "Destination"
                  )}
                </span>

              </div>

            </Popup>
          </Marker>
        )}

        {/* ======================================== */}
        {/* BOOKED DRIVER */}
        {/* ======================================== */}

        {bookedDriverPoint && (
          <>
            {/* DRIVER PULSE */}

            <DriverPulse
              location={
                driverLocation
              }
            />

            <Marker
              position={
                bookedDriverPoint
              }
              icon={
                carIcon
              }
            >
              <Popup>

                <div className="rideMapPopup">

                  <strong>
                    Your booked driver
                  </strong>

                  <br />

                  <span>
                    Driver location is
                    updating...
                  </span>

                  {driverLocation
                    ?.updatedAt && (
                    <>
                      <br />

                      <small>
                        Updated{" "}
                        {new Date(
                          driverLocation.updatedAt
                        ).toLocaleTimeString()}
                      </small>
                    </>
                  )}

                </div>

              </Popup>
            </Marker>
          </>
        )}

        {/* ======================================== */}
        {/* NEARBY DRIVERS */}
        {/* ======================================== */}

        {validDrivers.map(
          (driver) => {
            const driverPoint =
              toLatLng(
                driver.location
              );

            if (
              !driverPoint
            ) {
              return null;
            }

            const driverId =
              driver._id ||
              driver.id ||
              `driver-${driverPoint[0]}-${driverPoint[1]}`;

            const driverName =
              driver.user?.name ||
              driver.name ||
              "Driver";

            return (
              <Marker
                key={
                  driverId
                }
                position={
                  driverPoint
                }
                icon={
                  carIcon
                }
              >
                <Popup>

                  <div className="rideMapPopup">

                    <strong>
                      {
                        driverName
                      }
                    </strong>

                    <br />

                    <span>
                      {driver.online
                        ? "ONLINE"
                        : "OFFLINE"}
                    </span>

                    {driver.vehicleMake && (
                      <>
                        <br />

                        <span>
                          {
                            driver.vehicleMake
                          }{" "}
                          {
                            driver.vehicleModel ||
                            ""
                          }
                        </span>
                      </>
                    )}

                    {driver.registration && (
                      <>
                        <br />

                        <span>
                          {
                            driver.registration
                          }
                        </span>
                      </>
                    )}

                  </div>

                </Popup>
              </Marker>
            );
          }
        )}

        {/* ======================================== */}
        {/* PICKUP → DESTINATION */}
        {/* ======================================== */}

        {pickupPoint &&
          destinationPoint && (
            <Polyline
              positions={[
                pickupPoint,
                destinationPoint,
              ]}
              pathOptions={{
                color:
                  "#111827",
                weight: 5,
                opacity: 0.85,
                dashArray:
                  "9 9",
              }}
            />
          )}

        {/* ======================================== */}
        {/* DRIVER → PICKUP */}
        {/* ======================================== */}

        {bookedDriverPoint &&
          pickupPoint && (
            <Polyline
              positions={[
                bookedDriverPoint,
                pickupPoint,
              ]}
              pathOptions={{
                color:
                  "#00a86b",
                weight: 4,
                opacity: 0.9,
              }}
            />
          )}

        {/* ======================================== */}
        {/* PASSENGER → DRIVER */}
        {/* ======================================== */}

        {passengerPoint &&
          bookedDriverPoint && (
            <Polyline
              positions={[
                passengerPoint,
                bookedDriverPoint,
              ]}
              pathOptions={{
                color:
                  "#2563eb",
                weight: 3,
                opacity: 0.65,
                dashArray:
                  "6 8",
              }}
            />
          )}
      </MapContainer>

      {/* ========================================== */}
      {/* LIVE LOCATION BADGE */}
      {/* ========================================== */}

      {bookedDriverPoint && (
        <div
          style={{
            position:
              "absolute",
            top: "14px",
            left: "14px",
            zIndex: 1000,
            background:
              "rgba(17,24,39,0.92)",
            color:
              "#ffffff",
            padding:
              "9px 12px",
            borderRadius:
              "12px",
            fontSize:
              "12px",
            fontWeight:
              600,
            display:
              "flex",
            alignItems:
              "center",
            gap: "7px",
            boxShadow:
              "0 5px 18px rgba(0,0,0,0.2)",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius:
                "50%",
              background:
                "#b8f35a",
              boxShadow:
                "0 0 0 4px rgba(184,243,90,0.15)",
            }}
          />

          Driver location updating
        </div>
      )}

      {/* ========================================== */}
      {/* PASSENGER LOCATION BADGE */}
      {/* ========================================== */}

      {passengerPoint && (
        <div
          style={{
            position:
              "absolute",
            bottom: "14px",
            left: "14px",
            zIndex: 1000,
            background:
              "rgba(255,255,255,0.95)",
            color:
              "#111827",
            padding:
              "8px 11px",
            borderRadius:
              "10px",
            fontSize:
              "11px",
            fontWeight:
              600,
            display:
              "flex",
            alignItems:
              "center",
            gap: "7px",
            boxShadow:
              "0 5px 18px rgba(0,0,0,0.16)",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius:
                "50%",
              background:
                "#2563eb",
            }}
          />

          Your live location
        </div>
      )}
    </div>
  );
}
