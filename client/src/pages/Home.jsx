
import { Link } from "react-router-dom";

import {
  ArrowRight,
  Car,
  MapPin,
  ShieldCheck,
  Star,
  Clock3,
  Navigation,
  Users,
  Smartphone,
} from "lucide-react";


export default function Home() {
  return (
    <main>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="hero2">

        <div className="heroCopy">

          <div className="eyebrow">
            <span>●</span> SOUTH AFRICAN RIDE-HAILING PLATFORM
          </div>

          <h1>
            Move freely.
            <br />
            <em>Ride confidently.</em>
          </h1>

          <p>
            Book a ride, track your driver live on the map,
            manage your journeys and stay connected from
            pickup to destination.
          </p>

          <div className="heroActions">

            <Link
              className="btn primary"
              to="/get-started"
            >
              Get Started
              <ArrowRight size={18} />
            </Link>

            <Link
              className="btn ghost"
              to="/about"
            >
              How it works
            </Link>

          </div>


          {/* TRUST FEATURES */}

          <div className="trust">

            <span>
              <ShieldCheck size={17} />
              Driver verification
            </span>

            <span>
              <Navigation size={17} />
              Live tracking
            </span>

            <span>
              <Clock3 size={17} />
              2× after 21:00
            </span>

          </div>

        </div>


        {/* ===================================================
            MAP PREVIEW
        =================================================== */}

        <div className="heroMapCard">

          <RideFlowMapPreview />

          <div className="mapBadge">

            <span className="liveDot" />

            <span>
              Live driver network
            </span>

            <b>
              South Africa
            </b>

          </div>

        </div>

      </section>


      {/* =====================================================
          PLATFORM FEATURES
      ===================================================== */}

      <section className="quick">

        <div>

          <small>
            BUILT FOR EVERY JOURNEY
          </small>

          <h2>
            Everything you need in one ride.
          </h2>

          <p className="sectionIntro">
            From booking to tracking and ride history,
            RideFlow brings the essential parts of
            ride-hailing into one platform.
          </p>

        </div>


        <div className="quickGrid">

          <Feature
            icon={<MapPin />}
            title="Simple booking"
            text="Choose your pickup and destination and see your estimated fare before confirming your ride."
          />

          <Feature
            icon={<Car />}
            title="Live driver tracking"
            text="Once your ride is accepted, follow your driver's location as they move toward your pickup."
          />

          <Feature
            icon={<ShieldCheck />}
            title="Verified drivers"
            text="Driver applications include identity and licence documents for administrator review."
          />

          <Feature
            icon={<Star />}
            title="Ride history"
            text="Access your active, completed and cancelled journeys from your passenger dashboard."
          />

        </div>

      </section>


      {/* =====================================================
          HOW IT WORKS
      ===================================================== */}

      <section className="howSection">

        <div className="howHeader">

          <div>
            <div className="eyebrow">
              HOW RIDEFLOW WORKS
            </div>

            <h2>
              From request to destination.
            </h2>
          </div>

          <p>
            A straightforward experience for passengers,
            drivers and the people managing the platform.
          </p>

        </div>


        <div className="howGrid">

          <Step
            number="01"
            icon={<Smartphone />}
            title="Request a ride"
            text="Enter your pickup and destination, review the fare estimate and request your ride."
          />

          <Step
            number="02"
            icon={<Car />}
            title="Get connected"
            text="An approved driver can accept the ride and begin travelling toward your pickup."
          />

          <Step
            number="03"
            icon={<Navigation />}
            title="Track the journey"
            text="Follow the driver's location and ride progress directly from your dashboard."
          />

          <Step
            number="04"
            icon={<MapPin />}
            title="Arrive safely"
            text="Complete the journey, review your trip history and rate the experience."
          />

        </div>

      </section>


      {/* =====================================================
          PASSENGERS / DRIVERS / ADMIN
      ===================================================== */}

      <section className="rolesSection">

        <div className="rolesIntro">

          <div className="eyebrow">
            ONE PLATFORM
          </div>

          <h2>
            Designed around the whole ride.
          </h2>

          <p>
            RideFlow connects passengers, drivers and
            administrators through one coordinated platform.
          </p>

        </div>


        <div className="rolesGrid">

          <RoleCard
            icon={<Users />}
            title="Passengers"
            text="Book rides, see fare estimates, follow drivers live, manage active trips and review ride history."
          />

          <RoleCard
            icon={<Car />}
            title="Drivers"
            text="Apply with your documents, manage availability, accept rides, update your location and track earnings."
          />

          <RoleCard
            icon={<ShieldCheck />}
            title="Administrators"
            text="Monitor drivers, review applications, manage users, oversee rides and keep an eye on platform activity."
          />

        </div>

      </section>


      {/* =====================================================
          DARK PLATFORM SECTION
      ===================================================== */}

      <section className="darkSection">

        <div>

          <div className="eyebrow light">
            FOR PASSENGERS & DRIVERS
          </div>

          <h2>
            A smarter way to move across South Africa.
          </h2>

          <p>
            RideFlow connects passengers, drivers and
            administrators with real-time ride operations,
            live location tracking and a central management
            experience.
          </p>

          <Link
            className="btn lightBtn"
            to="/get-started"
          >
            Start with RideFlow
            <ArrowRight size={18} />
          </Link>

        </div>


        <div className="numbers">

          <div>
            <b>24/7</b>
            <span>platform access</span>
          </div>

          <div>
            <b>2×</b>
            <span>fare after 21:00</span>
          </div>

          <div>
            <b>Live</b>
            <span>driver location</span>
          </div>

        </div>

      </section>


      {/* =====================================================
          FINAL CTA
      ===================================================== */}

      <section className="finalCta">

        <div>

          <div className="eyebrow">
            READY TO MOVE?
          </div>

          <h2>
            Your next journey starts here.
          </h2>

          <p>
            Create your RideFlow account and experience
            a connected ride-hailing platform.
          </p>

        </div>

        <Link
          className="btn primary"
          to="/get-started"
        >
          Get Started
          <ArrowRight size={18} />
        </Link>

      </section>

    </main>
  );
}


/* ===========================================================
   FEATURE CARD
=========================================================== */

function Feature({
  icon,
  title,
  text,
}) {
  return (
    <article className="featureCard">

      <div className="iconBox">
        {icon}
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>

    </article>
  );
}


/* ===========================================================
   HOW IT WORKS STEP
=========================================================== */

function Step({
  number,
  icon,
  title,
  text,
}) {
  return (
    <article className="stepCard">

      <div className="stepTop">

        <span className="stepNumber">
          {number}
        </span>

        <div className="stepIcon">
          {icon}
        </div>

      </div>

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>

    </article>
  );
}


/* ===========================================================
   ROLE CARD
=========================================================== */

function RoleCard({
  icon,
  title,
  text,
}) {
  return (
    <article className="roleCard">

      <div className="roleIcon">
        {icon}
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>

      <ArrowRight
        className="roleArrow"
        size={20}
      />

    </article>
  );
}


/* ===========================================================
   MAP PREVIEW
=========================================================== */

function RideFlowMapPreview() {
  return (
    <div className="fakeMap">

      {/* South Africa visual */}

      <div className="saOutline">
        SA
      </div>


      {/* Roads */}

      <div className="mapRoad r1" />
      <div className="mapRoad r2" />


      {/* Route */}

      <div className="routeLine" />


      {/* Driver markers */}

      <div className="carDot cA">
        🚗
      </div>

      <div className="carDot cB">
        🚗
      </div>


      {/* Cities */}

      <div className="cityTag pta">
        Pretoria
      </div>

      <div className="cityTag jhb">
        Johannesburg
      </div>

      <div className="cityTag dbn">
        Durban
      </div>

    </div>
  );
}

