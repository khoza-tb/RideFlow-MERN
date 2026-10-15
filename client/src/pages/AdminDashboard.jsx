import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Car,
  CheckCircle2,
  Clock3,
  FileText,
  LogOut,
  MapPin,
  MapPinned,
  MoreHorizontal,
  Navigation,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
  XCircle,
  Eye,
  Ban,
} from "lucide-react";

import api from "../services/api";
import socket from "../services/socket";
import { useAuth } from "../context/AuthContext";
import RideMap from "../components/RideMap";
import AdminAnalytics from "../components/AdminAnalytics";


export default function AdminDashboard() {
  const { logout } = useAuth();

  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [rides, setRides] = useState([]);

  const [tab, setTab] = useState("overview");

  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(false);

  // =====================================================
  // LOAD ADMIN DATA
  // =====================================================

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const [statsResponse, usersResponse, driversResponse, ridesResponse] =
        await Promise.all([
          api.get("/admin/stats"),
          api.get("/admin/users"),
          api.get("/admin/drivers"),
          api.get("/admin/rides"),
        ]);

      setStats(statsResponse.data?.stats || {});
      setUsers(usersResponse.data?.users || []);
      setDrivers(driversResponse.data?.drivers || []);
      setRides(ridesResponse.data?.rides || []);
    } catch (e) {
      console.error("ADMIN LOAD ERROR:", e);

      setError(e.response?.data?.message || "Unable to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // INITIAL LOAD + SOCKET EVENTS
  // =====================================================

  useEffect(() => {
    load();

    socket.emit("join:admin");

    const events = [
      "ride:created",
      "ride:accepted",
      "ride:status",
      "driver:location",
      "driver:presence",
      "driver:verification",
    ];

    events.forEach((event) => {
      socket.on(event, load);
    });

    const timer = setInterval(() => {
      load();
    }, 10000);

    return () => {
      clearInterval(timer);

      events.forEach((event) => {
        socket.off(event, load);
      });
    };
  }, []);

  // =====================================================
  // DRIVER REVIEW
  // =====================================================

  const review = async (id, status) => {
    try {
      setError("");

      const response = await api.patch(`/admin/drivers/${id}/status`, {
        status,
      });

      console.log("ADMIN DRIVER REVIEW:", response.data);

      await load();
    } catch (e) {
      console.error("ADMIN DRIVER REVIEW ERROR:", e);

      const message =
        e.response?.data?.message || "Unable to update application.";

      const documentCount = e.response?.data?.documentCount;

      if (status === "approved" && documentCount !== undefined) {
        setError(`${message} Documents uploaded: ${documentCount}/4.`);
      } else {
        setError(message);
      }
    }
  };

  // =====================================================
  // ACCOUNT DELETION (admin-only backend routes)
  // =====================================================

  const deleteAccount = async (type, id) => {
    try {
      setError("");
      const response = await api.delete(`/admin/${type}/${id}`);
      await load();
      return response.data;
    } catch (e) {
      const message =
        e.response?.data?.message ||
        `Unable to delete this ${type === "drivers" ? "driver" : "user"}.`;
      setError(message);
      throw e;
    }
  };

  const bulkDeleteAccounts = async (type, ids) => {
    try {
      setError("");
      const response = await api.delete(`/admin/${type}/bulk`, {
        data: { ids },
      });
      await load();
      return response.data;
    } catch (e) {
      const message =
        e.response?.data?.message || `Unable to bulk-delete ${type}.`;
      setError(message);
      throw e;
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      setError("");

      await logout();
    } catch (e) {
      console.error("Admin logout error:", e);

      setError("Unable to sign out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  // =====================================================
  // NAVIGATION
  // =====================================================

  const navigation = [
    { id: "overview", label: "Overview", icon: Activity },
    {
      id: "drivers",
      label: "Drivers",
      icon: Car,
      badge: Number(stats.pendingApprovals || 0),
    },
    { id: "users", label: "Users", icon: Users },
    { id: "rides", label: "Rides", icon: Navigation },
    { id: "map", label: "Live map", icon: MapPinned },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <main className="adminPage">
      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <aside className="adminSide">
        <div className="adminBrandWrap">
          <div className="brand adminBrand">
            <span className="brandLogo">
              <Car size={22} />
            </span>

            <span>
              Ride
              <span className="brandAccent">Flow</span>
            </span>
          </div>

          <div className="adminRoleBadge">
            <ShieldCheck size={14} />
            Administrator
          </div>
        </div>

        <div className="adminSectionLabel">OPERATIONS</div>

        <nav className="adminNav">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? "active" : ""}
                onClick={() => setTab(item.id)}
              >
                <Icon size={19} />

                <span>{item.label}</span>

                {item.badge > 0 && <b className="navBadge">{item.badge}</b>}
              </button>
            );
          })}
        </nav>

        {/* SIDEBAR STATUS */}

        <div className="adminSidebarStatus">
          <div className="statusPulse" />

          <div>
            <strong>System online</strong>

            <span>Monitoring RideFlow</span>
          </div>
        </div>

        {/* LOGOUT */}

        <div className="adminLogout">
          <div className="adminLogoutDivider" />

          <button
            type="button"
            className="adminSignOut"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut size={18} />

            <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
          </button>
        </div>
      </aside>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <section className="adminMain">
        {/* HEADER */}

        <header className="adminHeader">
          <div>
            <div className="eyebrow">RIDEFLOW CONTROL CENTER</div>

            <h1>
              {tab === "overview" && "Operations overview"}

              {tab === "drivers" && "Driver management"}

              {tab === "users" && "User management"}

              {tab === "rides" && "Ride management"}

              {tab === "map" && "Live fleet map"}

              {tab === "analytics" && "Advanced analytics"}
            </h1>

            <p>
              Monitor your platform, drivers, passengers and rides in real
              time.
            </p>
          </div>

          <div className="adminHeaderActions">
            <div className="liveIndicator">
              <span />
              Live
            </div>

            <button
              type="button"
              className="refreshButton"
              onClick={load}
              disabled={loading}
              title="Refresh dashboard"
            >
              <RefreshCw size={18} className={loading ? "spin" : ""} />
            </button>
          </div>
        </header>

        {/* ERROR */}

        {error && (
          <div className="adminAlert">
            <XCircle size={19} />

            <span>{error}</span>

            <button type="button" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}

        {/* CONTENT */}

        {tab === "overview" && (
          <Overview
            stats={stats}
            drivers={drivers}
            rides={rides}
            setTab={setTab}
          />
        )}

        {tab === "drivers" && (
          <Drivers
            drivers={drivers}
            review={review}
            onDelete={(id) => deleteAccount("drivers", id)}
            onBulkDelete={(ids) => bulkDeleteAccounts("drivers", ids)}
          />
        )}

        {tab === "users" && (
          <UsersTab
            users={users}
            onDelete={(id) => deleteAccount("users", id)}
            onBulkDelete={(ids) => bulkDeleteAccounts("users", ids)}
          />
        )}

        {tab === "rides" && <Rides rides={rides} />}

        {tab === "map" && <LiveMap drivers={drivers} />}

        {tab === "analytics" && (
          <AdminAnalytics
            stats={stats}
            users={users}
            drivers={drivers}
            rides={rides}
          />
        )}
      </section>
    </main>
  );
}

/* =========================================================
   OVERVIEW
   ========================================================= */

function Overview({ stats, drivers, rides, setTab }) {
  const onlineDrivers = drivers.filter((driver) => driver.online).length;

  const pendingDrivers = drivers.filter(
    (driver) => driver.applicationStatus === "pending"
  ).length;

  const completedRides = rides.filter(
    (ride) => ride.status === "completed"
  ).length;

  const activeRides = rides.filter((ride) =>
    ["searching", "accepted", "arriving", "in_progress"].includes(ride.status)
  ).length;

  const revenue = Number(stats.revenue || 0);

  return (
    <div className="overviewPage">
      {/* KPI CARDS */}

      <div className="adminStats">
        <StatCard
          icon={<Users />}
          label="Passengers"
          value={stats.users || usersFallback(stats, rides)}
          trend="Platform users"
          type="blue"
        />

        <StatCard
          icon={<Car />}
          label="Drivers"
          value={stats.drivers || drivers.length}
          trend={`${onlineDrivers} online now`}
          type="green"
        />

        <StatCard
          icon={<Activity />}
          label="Total rides"
          value={stats.rides || rides.length}
          trend={`${activeRides} active`}
          type="purple"
        />

        <StatCard
          icon={<Wallet />}
          label="Revenue"
          value={`R ${revenue.toFixed(2)}`}
          trend={`${completedRides} completed`}
          type="orange"
        />
      </div>

      {/* QUICK STATUS */}

      <div className="quickStats">
        <div className="quickStatItem">
          <div className="quickIcon green">
            <Activity size={18} />
          </div>

          <div>
            <span>Online drivers</span>

            <strong>{onlineDrivers}</strong>
          </div>

          <div className="quickLive">
            <span />
            Live
          </div>
        </div>

        <div className="quickStatItem">
          <div className="quickIcon orange">
            <Clock3 size={18} />
          </div>

          <div>
            <span>Pending approvals</span>

            <strong>{pendingDrivers}</strong>
          </div>

          {pendingDrivers > 0 && (
            <button type="button" onClick={() => setTab("drivers")}>
              Review
            </button>
          )}
        </div>

        <div className="quickStatItem">
          <div className="quickIcon blue">
            <Navigation size={18} />
          </div>

          <div>
            <span>Active rides</span>

            <strong>{activeRides}</strong>
          </div>

          <button type="button" onClick={() => setTab("rides")}>
            View
          </button>
        </div>
      </div>

      {/* TWO COLUMN CONTENT */}

      <div className="overviewGrid">
        {/* DRIVER ACTIVITY */}

        <section className="modernPanel">
          <PanelHeader
            eyebrow="LIVE FLEET"
            title="Driver activity"
            action="View all"
            onAction={() => setTab("drivers")}
          />

          <div className="fleetList">
            {drivers.slice(0, 6).map((driver) => (
              <div className="fleetItem" key={driver._id}>
                <div
                  className={`fleetAvatar ${driver.online ? "online" : ""}`}
                >
                  {getInitials(driver.user?.name || "Driver")}
                </div>

                <div className="fleetIdentity">
                  <strong>{driver.user?.name || "Unknown driver"}</strong>

                  <span>
                    {driver.vehicleMake || "Vehicle"} {driver.vehicleModel || ""}
                  </span>
                </div>

                <div className="fleetVehicle">
                  <span>{driver.registration || "No registration"}</span>

                  <small>
                    {formatStatus(driver.applicationStatus || "pending")}
                  </small>
                </div>

                <div
                  className={`fleetPresence ${
                    driver.online ? "online" : "offline"
                  }`}
                >
                  <span />

                  {driver.online ? "Online" : "Offline"}
                </div>
              </div>
            ))}

            {!drivers.length && (
              <EmptyState
                icon={<Car />}
                title="No drivers yet"
                text="Driver applications will appear here."
              />
            )}
          </div>
        </section>

        {/* RECENT RIDES */}

        <section className="modernPanel">
          <PanelHeader
            eyebrow="RIDE ACTIVITY"
            title="Recent rides"
            action="View all"
            onAction={() => setTab("rides")}
          />

          <div className="recentRideList">
            {rides.slice(0, 6).map((ride) => (
              <div className="recentRide" key={ride._id}>
                <div className="rideRouteIcon">
                  <Navigation size={17} />
                </div>

                <div className="rideSummary">
                  <strong>{ride.passenger?.name || "Passenger"}</strong>

                  <span>
                    {getLocationName(ride.pickup)}
                    {" → "}
                    {getLocationName(ride.destination)}
                  </span>
                </div>

                <div className="rideAmount">
                  <strong>R {Number(ride.fare || 0).toFixed(2)}</strong>

                  <StatusBadge status={ride.status} />
                </div>
              </div>
            ))}

            {!rides.length && (
              <EmptyState
                icon={<Navigation />}
                title="No rides yet"
                text="Ride activity will appear here."
              />
            )}
          </div>
        </section>
      </div>

      {/* =================================================
          ADMIN MAP PREVIEW
          IMPORTANT: THIS MAP HAS ITS OWN DIMENSIONS.
      ================================================== */}

      <section className="modernPanel mapPreviewPanel">
        <PanelHeader
          eyebrow="SOUTH AFRICA • LIVE"
          title="Driver network"
          action="Open live map"
          onAction={() => setTab("map")}
        />

        <div className="overviewMap">
          <RideMap
            drivers={drivers.filter(
              (driver) =>
                driver.online &&
                driver.location &&
                isValidLocation(driver.location)
            )}
            height="420px"
          />

          <div className="mapOverlayCard">
            <div className="mapOverlayIcon">
              <MapPin size={18} />
            </div>

            <div>
              <strong>{onlineDrivers} drivers online</strong>

              <span>Monitoring live fleet locations</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   DRIVERS
   ========================================================= */

function Drivers({ drivers = [], review, onDelete, onBulkDelete }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const toggleDriver = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const handleDeleteDriver = async (driver) => {
    const name = driver.user?.name || driver.user?.email || "this driver";
    if (
      !window.confirm(
        `Delete ${name} and the linked driver account? This cannot be undone. Drivers with active rides may be protected.`
      )
    )
      return;
    try {
      setDeleting(true);
      const result = await onDelete(driver._id);
      window.alert(result?.message || "Driver deleted successfully.");
      setSelectedIds((current) => current.filter((id) => id !== driver._id));
    } catch {
      // Parent displays the backend error in the dashboard alert.
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDeleteDrivers = async () => {
    const ids = selectedIds.filter((id) =>
      selectableDrivers.some((driver) => driver._id === id)
    );
    if (!ids.length) return;
    if (ids.length > 100) {
      window.alert("Select no more than 100 drivers at a time.");
      return;
    }
    if (
      !window.confirm(
        `Delete ${ids.length} selected driver account(s)? This cannot be undone. Drivers with active rides may be skipped.`
      )
    )
      return;
    try {
      setDeleting(true);
      const result = await onBulkDelete(ids);
      setSelectedIds([]);
      window.alert(
        `Bulk deletion finished. Deleted: ${
          result?.deletedCount ?? 0
        }. Skipped: ${result?.skippedCount ?? 0}.`
      );
    } catch {
      // Parent displays the backend error in the dashboard alert.
    } finally {
      setDeleting(false);
    }
  };

  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const text = `
        ${driver.user?.name || ""}
        ${driver.user?.email || ""}
        ${driver.registration || ""}
        ${driver.vehicleMake || ""}
        ${driver.vehicleModel || ""}
      `.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());

      let matchesFilter = true;

      if (filter === "online") {
        matchesFilter = driver.online === true;
      } else if (filter === "offline") {
        matchesFilter = driver.online !== true;
      } else if (filter !== "all") {
        matchesFilter = driver.applicationStatus === filter;
      }

      return matchesSearch && matchesFilter;
    });
  }, [drivers, search, filter]);

  const selectableDrivers = filteredDrivers.filter((driver) => driver._id);
  const allVisibleSelected =
    selectableDrivers.length > 0 &&
    selectableDrivers.every((driver) => selectedIds.includes(driver._id));

  const online = drivers.filter((driver) => driver.online).length;

  const pending = drivers.filter(
    (driver) => driver.applicationStatus === "pending"
  ).length;

  const approved = drivers.filter(
    (driver) => driver.applicationStatus === "approved"
  ).length;

  return (
    <div className="entityPage">
      <div className="entityStats">
        <EntityStat
          icon={<Car />}
          label="Total drivers"
          value={drivers.length}
          type="blue"
        />

        <EntityStat
          icon={<Activity />}
          label="Online now"
          value={online}
          type="green"
        />

        <EntityStat
          icon={<Clock3 />}
          label="Pending review"
          value={pending}
          type="orange"
        />

        <EntityStat
          icon={<CheckCircle2 />}
          label="Approved"
          value={approved}
          type="purple"
        />
      </div>

      <section className="modernPanel">
        <PanelHeader
          eyebrow="FLEET MANAGEMENT"
          title="Drivers"
          description="Manage your driver network, applications and verification."
        />

        <div className="entityToolbar">
          <div className="modernSearch">
            <Search size={18} />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver, vehicle or registration..."
            />

            {search && (
              <button type="button" onClick={() => setSearch("")}>
                ×
              </button>
            )}
          </div>

          <div className="filterGroup">
            {[
              ["all", "All"],
              ["online", "Online"],
              ["offline", "Offline"],
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["rejected", "Rejected"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "filterBtn active" : "filterBtn"}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="resultBar">
          <span>
            Showing <strong>{filteredDrivers.length}</strong> drivers
          </span>
        </div>

        <div className="accountBulkToolbar">
          <label className="accountSelectAll">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(event) => {
                const visibleIds = selectableDrivers.map(
                  (driver) => driver._id
                );
                setSelectedIds((current) =>
                  event.target.checked
                    ? [...new Set([...current, ...visibleIds])]
                    : current.filter((id) => !visibleIds.includes(id))
                );
              }}
              disabled={deleting || !selectableDrivers.length}
            />
            Select all visible
          </label>
          <span>{selectedIds.length} selected</span>
          <button
            type="button"
            className="deleteAccountButton"
            onClick={handleBulkDeleteDrivers}
            disabled={deleting || !selectedIds.length}
          >
            <Ban size={16} />
            {deleting ? "Deleting..." : "Delete selected"}
          </button>
        </div>

        <div className="driverGrid">
          {filteredDrivers.map((driver) => {
            const documentCount = getDriverDocumentCount(driver);

            const progress = Math.min((documentCount / 4) * 100, 100);

            return (
              <article className="modernDriverCard" key={driver._id}>
                <div className="driverCardHeader">
                  <label className="accountRowCheckbox" title="Select driver">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(driver._id)}
                      onChange={() => toggleDriver(driver._id)}
                      disabled={deleting}
                    />
                  </label>

                  <div className="driverIdentity">
                    <div className="driverAvatarLarge">
                      {getInitials(driver.user?.name || "Driver")}
                    </div>

                    <div>
                      <strong>{driver.user?.name || "Unknown driver"}</strong>

                      <span>{driver.user?.email || "No email"}</span>
                    </div>
                  </div>

                  <span
                    className={`onlineBadge ${
                      driver.online ? "online" : "offline"
                    }`}
                  >
                    <i />

                    {driver.online ? "Online" : "Offline"}
                  </span>
                </div>

                <div className="vehicleCard">
                  <div className="vehicleIcon">
                    <Car size={21} />
                  </div>

                  <div>
                    <strong>
                      {driver.vehicleMake || "Vehicle"}{" "}
                      {driver.vehicleModel || ""}
                    </strong>

                    <span>
                      {driver.vehicleColor || "Colour not provided"}
                      {" • "}
                      {driver.registration || "No registration"}
                    </span>
                  </div>
                </div>

                <div className="driverMeta">
                  <div>
                    <span>Application</span>

                    <StatusBadge
                      status={driver.applicationStatus || "pending"}
                    />
                  </div>

                  <div>
                    <span>Licence</span>

                    <strong>{driver.licenseNumber || "Not provided"}</strong>
                  </div>
                </div>

                <div className="documentProgress">
                  <div className="progressHeader">
                    <span>Verification</span>

                    <strong>{documentCount}/4</strong>
                  </div>

                  <div className="progressTrack">
                    <div style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="driverCardActions">
                  <button
                    type="button"
                    className="secondaryAction"
                    onClick={() => setSelected(driver)}
                  >
                    <Eye size={16} />
                    Details
                  </button>

                  {driver.applicationStatus !== "approved" && (
                    <button
                      type="button"
                      className="approveAction"
                      disabled={documentCount !== 4}
                      onClick={() => review(driver._id, "approved")}
                    >
                      <CheckCircle2 size={16} />
                      Approve
                    </button>
                  )}

                  {driver.applicationStatus === "approved" && (
                    <button
                      type="button"
                      className="suspendAction"
                      onClick={() => review(driver._id, "suspended")}
                    >
                      <Ban size={16} />
                      Suspend
                    </button>
                  )}

                  <button
                    type="button"
                    className="deleteAccountButton"
                    onClick={() => handleDeleteDriver(driver)}
                    disabled={deleting}
                    title="Delete driver and linked account"
                  >
                    <Ban size={16} />
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {!filteredDrivers.length && (
          <EmptyState
            icon={<Car />}
            title="No drivers found"
            text="Try changing your search or filter."
          />
        )}
      </section>

      {selected && (
        <DriverDetails
          driver={selected}
          onClose={() => setSelected(null)}
          review={review}
        />
      )}
    </div>
  );
}

/* =========================================================
   DRIVER DETAILS MODAL
   ========================================================= */

function DriverDetails({ driver, onClose, review }) {
  const documentCount = getDriverDocumentCount(driver);

  const documents = getDriverDocuments(driver);

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div
        className="driverDetailsModal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modalHeader">
          <div>
            <span className="eyebrow">DRIVER PROFILE</span>

            <h2>{driver.user?.name || "Unknown driver"}</h2>

            <p>Review driver information and verification documents.</p>
          </div>

          <button type="button" className="modalClose" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="driverDetailsProfile">
          <div className="driverAvatarXL">
            {getInitials(driver.user?.name || "Driver")}
          </div>

          <div>
            <strong>{driver.user?.name || "Unknown driver"}</strong>

            <span>{driver.user?.email || "No email"}</span>

            <span>{driver.user?.phone || "No phone"}</span>
          </div>

          <StatusBadge status={driver.applicationStatus || "pending"} />
        </div>

        <div className="detailsGrid">
          <DetailItem
            label="Vehicle"
            value={`${driver.vehicleMake || ""} ${driver.vehicleModel || ""}`}
          />

          <DetailItem
            label="Registration"
            value={driver.registration || "Not provided"}
          />

          <DetailItem
            label="Colour"
            value={driver.vehicleColor || "Not provided"}
          />

          <DetailItem
            label="Licence number"
            value={driver.licenseNumber || "Not provided"}
          />
        </div>

        <div className="modalDocuments">
          <div className="modalSectionTitle">
            <div>
              <strong>Verification documents</strong>

              <span>{documentCount}/4 uploaded</span>
            </div>
          </div>

          <div className="documentList">
            {documents.map((document) => (
              <a
                key={document.label}
                href={document.url || "#"}
                target={document.url ? "_blank" : undefined}
                rel="noreferrer"
                onClick={(event) => {
                  if (!document.url) {
                    event.preventDefault();
                  }
                }}
                className={
                  document.url
                    ? "documentItem uploaded"
                    : "documentItem missing"
                }
              >
                <FileText size={18} />

                <span>{document.label}</span>

                <strong>{document.url ? "View" : "Missing"}</strong>
              </a>
            ))}
          </div>
        </div>

        <div className="modalActions">
          {driver.applicationStatus !== "approved" && (
            <button
              type="button"
              className="approveAction large"
              disabled={documentCount !== 4}
              onClick={async () => {
                await review(driver._id, "approved");

                onClose();
              }}
            >
              <CheckCircle2 size={17} />
              Approve driver
            </button>
          )}

          {driver.applicationStatus !== "rejected" && (
            <button
              type="button"
              className="rejectAction large"
              onClick={async () => {
                await review(driver._id, "rejected");

                onClose();
              }}
            >
              <XCircle size={17} />
              Reject
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   USERS
   ========================================================= */

function UsersTab({ users = [], onDelete, onBulkDelete }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const toggleUser = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const handleDeleteUser = async (user) => {
    if (user.role === "admin") {
      window.alert("Admin accounts cannot be deleted from this screen.");
      return;
    }
    const name = user.name || user.email || "this user";
    if (
      !window.confirm(
        `Delete ${name}'s account? This cannot be undone. Accounts with active rides may be protected.`
      )
    )
      return;
    try {
      setDeleting(true);
      const result = await onDelete(user._id);
      window.alert(result?.message || "User deleted successfully.");
      setSelectedIds((current) => current.filter((id) => id !== user._id));
    } catch {
      // Parent displays the backend error in the dashboard alert.
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDeleteUsers = async () => {
    const ids = selectedIds.filter((id) =>
      selectableUsers.some((user) => user._id === id)
    );
    if (!ids.length) return;
    if (ids.length > 100) {
      window.alert("Select no more than 100 users at a time.");
      return;
    }
    if (
      !window.confirm(
        `Delete ${ids.length} selected user account(s)? Admin accounts are excluded. Accounts with active rides may be skipped.`
      )
    )
      return;
    try {
      setDeleting(true);
      const result = await onBulkDelete(ids);
      setSelectedIds([]);
      window.alert(
        `Bulk deletion finished. Deleted: ${
          result?.deletedCount ?? 0
        }. Skipped: ${result?.skippedCount ?? 0}.`
      );
    } catch {
      // Parent displays the backend error in the dashboard alert.
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const text = `
        ${user.name || ""}
        ${user.email || ""}
        ${user.phone || ""}
      `.toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());

    const matchesRole = role === "all" || user.role === role;

    return matchesSearch && matchesRole;
  });

  const selectableUsers = filteredUsers.filter(
    (user) => user._id && user.role !== "admin"
  );
  const allVisibleSelected =
    selectableUsers.length > 0 &&
    selectableUsers.every((user) => selectedIds.includes(user._id));

  const passengers = users.filter((user) => user.role === "passenger").length;

  const driverUsers = users.filter((user) => user.role === "driver").length;

  const admins = users.filter((user) => user.role === "admin").length;

  return (
    <div className="entityPage">
      <div className="entityStats">
        <EntityStat
          icon={<Users />}
          label="Total accounts"
          value={users.length}
          type="blue"
        />

        <EntityStat
          icon={<UserCheck />}
          label="Passengers"
          value={passengers}
          type="green"
        />

        <EntityStat
          icon={<Car />}
          label="Drivers"
          value={driverUsers}
          type="purple"
        />

        <EntityStat
          icon={<ShieldCheck />}
          label="Admins"
          value={admins}
          type="orange"
        />
      </div>

      <section className="modernPanel">
        <PanelHeader
          eyebrow="ACCOUNT MANAGEMENT"
          title="Users"
          description="View and monitor every RideFlow account."
        />

        <div className="entityToolbar">
          <div className="modernSearch">
            <Search size={18} />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email or phone..."
            />
          </div>

          <div className="filterGroup">
            {[
              ["all", "All"],
              ["passenger", "Passengers"],
              ["driver", "Drivers"],
              ["admin", "Admins"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={role === value ? "filterBtn active" : "filterBtn"}
                onClick={() => setRole(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="resultBar">
          <span>
            Showing <strong>{filteredUsers.length}</strong> accounts
          </span>
        </div>

        <div className="accountBulkToolbar">
          <label className="accountSelectAll">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(event) => {
                const visibleIds = selectableUsers.map((user) => user._id);
                setSelectedIds((current) =>
                  event.target.checked
                    ? [...new Set([...current, ...visibleIds])]
                    : current.filter((id) => !visibleIds.includes(id))
                );
              }}
              disabled={deleting || !selectableUsers.length}
            />
            Select all visible non-admins
          </label>
          <span>{selectedIds.length} selected</span>
          <button
            type="button"
            className="deleteAccountButton"
            onClick={handleBulkDeleteUsers}
            disabled={deleting || !selectedIds.length}
          >
            <Ban size={16} />
            {deleting ? "Deleting..." : "Delete selected"}
          </button>
        </div>

        <div className="userTable">
          <div className="userTableHeader">
            <span>Select</span>
            <span>User</span>
            <span>Contact</span>
            <span>Role</span>
            <span>Status</span>
            <span />
          </div>

          {filteredUsers.map((user) => (
            <div className="userTableRow" key={user._id}>
              <div className="accountRowCheckbox">
                <input
                  type="checkbox"
                  aria-label={`Select ${user.name || "user"}`}
                  checked={selectedIds.includes(user._id)}
                  onChange={() => toggleUser(user._id)}
                  disabled={deleting || user.role === "admin"}
                  title={
                    user.role === "admin"
                      ? "Admin accounts are protected"
                      : "Select user"
                  }
                />
              </div>

              <div className="tableUser">
                <div className="tableAvatar">
                  {getInitials(user.name || "User")}
                </div>

                <div>
                  <strong>{user.name || "Unknown user"}</strong>

                  <span>ID: {String(user._id || "").slice(-8)}</span>
                </div>
              </div>

              <div className="tableContact">
                <strong>{user.email || "No email"}</strong>

                <span>{user.phone || "No phone"}</span>
              </div>

              <div>
                <RoleBadge role={user.role || "passenger"} />
              </div>

              <div>
                <span className="accountStatus">
                  <i />
                  {formatStatus(
                    user.status || user.accountStatus || "active"
                  )}
                </span>
              </div>

              <button
                type="button"
                className="deleteAccountButton"
                title={
                  user.role === "admin"
                    ? "Admin accounts are protected"
                    : "Delete account"
                }
                onClick={() => handleDeleteUser(user)}
                disabled={deleting || user.role === "admin"}
              >
                <Ban size={16} />
                Delete
              </button>
            </div>
          ))}
        </div>

        {!filteredUsers.length && (
          <EmptyState
            icon={<Users />}
            title="No users found"
            text="Try changing your search or role filter."
          />
        )}
      </section>
    </div>
  );
}

/* =========================================================
   RIDES
   ========================================================= */

function Rides({ rides = [] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const active = rides.filter((ride) =>
    ["searching", "accepted", "arriving", "in_progress"].includes(ride.status)
  ).length;

  const completed = rides.filter((ride) => ride.status === "completed").length;

  const cancelled = rides.filter((ride) => ride.status === "cancelled").length;

  const filteredRides = rides.filter((ride) => {
    const text = `
        ${ride.passenger?.name || ""}
        ${ride.driver?.user?.name || ""}
        ${getLocationName(ride.pickup)}
        ${getLocationName(ride.destination)}
      `.toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());

    const matchesFilter = filter === "all" || ride.status === filter;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="entityPage">
      <div className="entityStats">
        <EntityStat
          icon={<Navigation />}
          label="Total rides"
          value={rides.length}
          type="blue"
        />

        <EntityStat
          icon={<Activity />}
          label="Active"
          value={active}
          type="green"
        />

        <EntityStat
          icon={<CheckCircle2 />}
          label="Completed"
          value={completed}
          type="purple"
        />

        <EntityStat
          icon={<XCircle />}
          label="Cancelled"
          value={cancelled}
          type="orange"
        />
      </div>

      <section className="modernPanel">
        <PanelHeader
          eyebrow="RIDE MONITOR"
          title="All rides"
          description="Monitor passenger journeys and ride activity."
        />

        <div className="entityToolbar">
          <div className="modernSearch">
            <Search size={18} />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search passenger, driver or route..."
            />
          </div>

          <div className="filterGroup">
            {[
              ["all", "All"],
              ["searching", "Searching"],
              ["accepted", "Accepted"],
              ["in_progress", "In progress"],
              ["completed", "Completed"],
              ["cancelled", "Cancelled"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "filterBtn active" : "filterBtn"}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="resultBar">
          <span>
            Showing <strong>{filteredRides.length}</strong> rides
          </span>
        </div>

        <div className="ridesList">
          {filteredRides.map((ride) => (
            <article className="rideCard" key={ride._id}>
              <div className="rideCardMain">
                <div className="rideId">
                  <div className="rideIcon">
                    <Navigation size={18} />
                  </div>

                  <div>
                    <strong>Ride #{String(ride._id || "").slice(-7)}</strong>

                    <span>{formatDate(ride.createdAt)}</span>
                  </div>
                </div>

                <StatusBadge status={ride.status} />
              </div>

              <div className="routeTimeline">
                <div className="timelinePoint pickup">
                  <span />
                </div>

                <div className="routeContent">
                  <span>PICKUP</span>

                  <strong>{getLocationName(ride.pickup)}</strong>
                </div>

                <div className="timelineLine" />

                <div className="timelinePoint destination">
                  <span />
                </div>

                <div className="routeContent">
                  <span>DESTINATION</span>

                  <strong>{getLocationName(ride.destination)}</strong>
                </div>
              </div>

              <div className="rideCardFooter">
                <div>
                  <span>Passenger</span>

                  <strong>{ride.passenger?.name || "Passenger"}</strong>
                </div>

                <div>
                  <span>Driver</span>

                  <strong>{ride.driver?.user?.name || "Unassigned"}</strong>
                </div>

                <div>
                  <span>Distance</span>

                  <strong>
                    {ride.distanceKm
                      ? `${Number(ride.distanceKm).toFixed(1)} km`
                      : "—"}
                  </strong>
                </div>

                <div className="rideFare">
                  <span>Fare</span>

                  <strong>R {Number(ride.fare || 0).toFixed(2)}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>

        {!filteredRides.length && (
          <EmptyState
            icon={<Navigation />}
            title="No rides found"
            text="There are no rides matching your current filters."
          />
        )}
      </section>
    </div>
  );
}

/* =========================================================
   LIVE MAP
   ========================================================= */

function LiveMap({ drivers = [] }) {
  const onlineDrivers = drivers.filter(
    (driver) =>
      driver.online && driver.location && isValidLocation(driver.location)
  );

  const offlineDrivers = drivers.filter((driver) => !driver.online);

  return (
    <div className="mapPage">
      <div className="mapStats">
        <div className="mapStatCard">
          <div className="mapStatIcon green">
            <Activity />
          </div>

          <div>
            <span>Online drivers</span>

            <strong>{onlineDrivers.length}</strong>
          </div>

          <small>Live</small>
        </div>

        <div className="mapStatCard">
          <div className="mapStatIcon blue">
            <Car />
          </div>

          <div>
            <span>Total fleet</span>

            <strong>{drivers.length}</strong>
          </div>
        </div>

        <div className="mapStatCard">
          <div className="mapStatIcon purple">
            <MapPin />
          </div>

          <div>
            <span>Tracking</span>

            <strong>{onlineDrivers.length}</strong>
          </div>
        </div>

        <div className="mapStatCard">
          <div className="mapStatIcon orange">
            <Clock3 />
          </div>

          <div>
            <span>Offline</span>

            <strong>{offlineDrivers.length}</strong>
          </div>
        </div>
      </div>

      <section className="modernPanel fullMapPanel">
        <div className="mapPanelHeader">
          <div>
            <div className="eyebrow">REAL-TIME FLEET</div>

            <h2>South Africa driver network</h2>

            <p>Track approved online drivers across the RideFlow network.</p>
          </div>

          <div className="mapLiveBadge">
            <span />
            Live tracking
          </div>
        </div>

        {/* =================================================
            IMPORTANT:
            The map has its own fixed 650px height.
            It does NOT affect DriverDashboard.
        ================================================== */}

        <div
          className="fullAdminMap"
          style={{
            height: "650px",
            minHeight: "650px",
          }}
        >
          <RideMap drivers={onlineDrivers} height="650px" />

          <div className="mapLegend">
            <div>
              <span className="legendDot green" />
              Online driver
            </div>

            <div>
              <span className="legendDot gray" />
              Offline
            </div>
          </div>

          <div className="mapDriverCounter">
            <div className="mapCounterIcon">
              <Car size={19} />
            </div>

            <div>
              <strong>{onlineDrivers.length}</strong>

              <span>drivers currently online</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   STAT CARD
   ========================================================= */

function StatCard({ icon, label, value, trend, type }) {
  return (
    <div className="modernStatCard">
      <div className="statCardTop">
        <div className={`statIcon ${type}`}>{icon}</div>

        <button
          type="button"
          className="statMenu"
          aria-label={`${label} options`}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <span className="statLabel">{label}</span>

      <strong className="statValue">{value}</strong>

      <div className="statTrend">
        <ArrowUpRight size={14} />

        <span>{trend}</span>
      </div>
    </div>
  );
}

/* =========================================================
   ENTITY STAT
   ========================================================= */

function EntityStat({ icon, label, value, type }) {
  return (
    <div className="entityStat">
      <div className={`entityStatIcon ${type}`}>{icon}</div>

      <div>
        <span>{label}</span>

        <strong>{value}</strong>
      </div>
    </div>
  );
}

/* =========================================================
   PANEL HEADER
   ========================================================= */

function PanelHeader({ eyebrow, title, description, action, onAction }) {
  return (
    <div className="panelHeader">
      <div>
        <div className="eyebrow">{eyebrow}</div>

        <h2>{title}</h2>

        {description && <p>{description}</p>}
      </div>

      {action && (
        <button type="button" className="panelAction" onClick={onAction}>
          {action}

          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}

/* =========================================================
   STATUS BADGE
   ========================================================= */

function StatusBadge({ status }) {
  const normalized = String(status || "unknown")
    .toLowerCase()
    .replaceAll(" ", "_");

  return (
    <span className={`statusBadge ${normalized}`}>
      <i />

      {formatStatus(status)}
    </span>
  );
}

/* =========================================================
   ROLE BADGE
   ========================================================= */

function RoleBadge({ role }) {
  return (
    <span className={`roleBadge ${role || "passenger"}`}>
      {formatStatus(role || "passenger")}
    </span>
  );
}

/* =========================================================
   DETAIL ITEM
   ========================================================= */

function DetailItem({ label, value }) {
  return (
    <div className="detailItem">
      <span>{label}</span>

      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
   ========================================================= */

function EmptyState({ icon, title, text }) {
  return (
    <div className="modernEmpty">
      <div className="emptyIcon">{icon}</div>

      <h3>{title}</h3>

      <p>{text}</p>
    </div>
  );
}

/* =========================================================
   DOCUMENT HELPERS
   ========================================================= */

function getDriverDocuments(driver) {
  const documents = driver.documents || {};

  const idDocument =
    documents.idDocument || driver.idDocument || driver.identityDocument || "";

  const licenseDocument =
    documents.licenseDocument ||
    driver.licenseDocument ||
    driver.driverLicense ||
    driver.license ||
    "";

  const vehicleRegistration =
    documents.vehicleRegistration ||
    driver.vehicleRegistration ||
    driver.registrationDocument ||
    "";

  const vehicleProof =
    documents.vehicleProof ||
    driver.vehicleProof ||
    driver.proofOfOwnership ||
    driver.vehicleOwnership ||
    "";

  return [
    {
      label: "Identity document",
      url: getDocumentUrl(idDocument),
    },
    {
      label: "Driver licence",
      url: getDocumentUrl(licenseDocument),
    },
    {
      label: "Vehicle registration",
      url: getDocumentUrl(vehicleRegistration),
    },
    {
      label: "Proof of vehicle ownership",
      url: getDocumentUrl(vehicleProof),
    },
  ];
}

function getDriverDocumentCount(driver) {
  return getDriverDocuments(driver).filter((document) => document.url).length;
}

function getDocumentUrl(documentPath) {
  if (!documentPath) {
    return "";
  }

  if (typeof documentPath === "object") {
    documentPath =
      documentPath.url || documentPath.path || documentPath.file || "";
  }

  if (typeof documentPath === "string" && documentPath.startsWith("http")) {
    return documentPath;
  }

  const backendUrl = "http://localhost:5000";

  if (typeof documentPath === "string" && documentPath.startsWith("/")) {
    return `${backendUrl}${documentPath}`;
  }

  return `${backendUrl}/${documentPath}`;
}

/* =========================================================
   LOCATION HELPERS
   ========================================================= */

function getLocationName(location) {
  if (!location) {
    return "Unknown location";
  }

  if (typeof location === "string") {
    return location;
  }

  return (
    location.name ||
    location.address ||
    location.label ||
    location.display_name ||
    "Location"
  );
}

function isValidLocation(location) {
  if (!location) {
    return false;
  }

  const lat = Number(location.lat);

  const lng = Number(location.lng);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(date) {
  if (!date) {
    return "Recently";
  }

  try {
    return new Date(date).toLocaleString("en-ZA", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Recently";
  }
}

/* =========================================================
   STATUS FORMAT
   ========================================================= */

function formatStatus(status) {
  if (!status) {
    return "Unknown";
  }

  return String(status)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* =========================================================
   INITIALS
   ========================================================= */

function getInitials(name) {
  if (!name) {
    return "U";
  }

  const words = String(name).trim().split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }

  return (
    words[0].charAt(0) + words[words.length - 1].charAt(0)
  ).toUpperCase();
}

/* =========================================================
   FALLBACK
   ========================================================= */

function usersFallback(stats, rides) {
  if (stats.users !== undefined) {
    return stats.users;
  }

  if (stats.passengers !== undefined) {
    return stats.passengers;
  }

  return 0;
}
