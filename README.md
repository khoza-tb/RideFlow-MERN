# RideFlow

A full MERN South African ride-hailing demo with passenger, driver and admin experiences.

## Included

- Home, About and Get Started landing pages
- Passenger and driver registration
- Driver ID + driver's licence uploads
- Admin driver application review
- Secure login/logout
- Forgot-password and time-limited reset flow
- South African OpenStreetMap/Leaflet maps
- Pickup/destination geocoding limited to South Africa
- Upfront fare calculation
- 2× fare at/after 21:00 Africa/Johannesburg
- Automatic nearest approved online driver assignment
- Driver online/offline mode
- Live driver browser geolocation
- Passenger live driver tracking
- Admin live driver map
- Admin fleet, users, rides, applications and revenue views
- Ride lifecycle and cancellation
- Passenger driver ratings
- Cash/card selection (card processor integration is left as the next payment-provider step)
- Socket.IO real-time events

## Run

### Server

```bash
cd server
npm install
copy .env.example .env
npm run seed:admin
npm run dev
```

Configure `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

### Client

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

### Uploads

Development driver documents are stored in `server/uploads`. For production, replace this local storage layer with private object storage such as S3/Cloudinary and use signed/private URLs.

### Password reset

In development, the forgot-password endpoint returns a reset URL so the flow can be tested without an email provider. The server also logs the link. For production, connect the reset URL to an email provider and do not expose `devResetUrl`.

### Maps

The app uses OpenStreetMap tiles and Nominatim search for South African locations. Follow the public service's usage policy for production traffic.
