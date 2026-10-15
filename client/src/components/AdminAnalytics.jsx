import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Download,
  FileWarning,
  ShieldAlert,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

const money = (value) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(value) || 0);

const dateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const csvValue = (value) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

function downloadCsv(filename, rows) {
  if (!rows.length) {
    window.alert("There is no data to export.");
    return;
  }

  const csv = rows
    .map((row) => row.map(csvValue).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getRideDate(ride) {
  return dateValue(ride.createdAt || ride.updatedAt);
}

function getFare(ride) {
  return Number(ride.fare ?? ride.totalFare ?? 0) || 0;
}

function getCommissionAmount(ride) {
  // Only count explicitly stored commission amounts.
  return Number(
    ride.platformCommissionAmount ??
      ride.commissionAmount ??
      ride.commission?.amount ??
      0
  ) || 0;
}

function getDocumentExpiryDates(driver) {
  const sources = [
    driver,
    driver.documents,
    driver.documents?.idDocument,
    driver.documents?.licenseDocument,
    driver.documents?.vehicleRegistration,
    driver.documents?.vehicleProof,
  ].filter(Boolean);

  const expiryKeys = [
    "expiryDate",
    "expiresAt",
    "expirationDate",
    "expiry",
    "validUntil",
    "licenseExpiry",
    "licenceExpiry",
    "licenseExpiryDate",
    "licenceExpiryDate",
    "documentExpiry",
  ];

  const results = [];

  for (const source of sources) {
    for (const key of expiryKeys) {
      const parsed = dateValue(source[key]);

      if (parsed) {
        results.push({
          label: key,
          date: parsed,
        });
      }
    }
  }

  return results;
}

function startOfWeek(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function periodStart(period, now = new Date()) {
  const start = new Date(now);

  if (period === "day") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    return startOfWeek(start);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return start;
}

function formatShortDate(date) {
  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
  });
}

function formatPeriodLabel(period) {
  if (period === "day") return "Today";
  if (period === "week") return "This week";
  return "This month";
}

function MetricCard({ icon: Icon, label, value, detail, tone = "blue" }) {
  return (
    <article className={`analyticsMetric analyticsMetric-${tone}`}>
      <div className="analyticsMetricIcon">
        <Icon size={20} />
      </div>
      <span className="analyticsMetricLabel">{label}</span>
      <strong className="analyticsMetricValue">{value}</strong>
      <span className="analyticsMetricDetail">{detail}</span>
    </article>
  );
}

function Panel({ title, description, action, children }) {
  return (
    <section className="analyticsPanel">
      <div className="analyticsPanelHeader">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function AdminAnalytics({
  stats = {},
  users = [],
  drivers = [],
  rides = [],
}) {
  const [period, setPeriod] = useState("day");
  const [exporting, setExporting] = useState(false);

  const now = new Date();
  const start = periodStart(period, now);

  const periodRides = useMemo(
    () =>
      rides.filter((ride) => {
        const date = getRideDate(ride);
        return date && date >= start && date <= now;
      }),
    [rides, period, start.getTime()]
  );

  const completedRides = periodRides.filter(
    (ride) => ride.status === "completed"
  );

  const cancelledRides = periodRides.filter(
    (ride) => ride.status === "cancelled"
  );

  const disputedRides = periodRides.filter(
    (ride) =>
      ride.status === "disputed" ||
      ride.disputeStatus === "open" ||
      ride.disputeStatus === "pending" ||
      ride.dispute?.status === "open" ||
      ride.dispute?.status === "pending"
  );

  const grossRevenue = completedRides.reduce(
    (total, ride) => total + getFare(ride),
    0
  );

  const recordedCommission = completedRides.reduce(
    (total, ride) => total + getCommissionAmount(ride),
    0
  );

  const commissionIsAvailable =
    completedRides.some(
      (ride) =>
        ride.platformCommissionAmount != null ||
        ride.commissionAmount != null ||
        ride.commission?.amount != null
    ) ||
    stats.commissionRevenue != null ||
    stats.totalCommission != null ||
    stats.platformCommission != null;

  const commissionTotal = completedRides.length
    ? recordedCommission ||
      Number(
        stats.commissionRevenue ??
          stats.totalCommission ??
          stats.platformCommission ??
          0
      )
    : 0;

  const onlineDrivers = drivers.filter(
    (driver) =>
      driver.online === true &&
      driver.applicationStatus === "approved"
  ).length;

  const pendingApprovals = drivers.filter(
    (driver) => driver.applicationStatus === "pending"
  ).length;

  const expiringDocuments = drivers.flatMap((driver) =>
    getDocumentExpiryDates(driver)
      .filter(({ date }) => {
        const days = (date.getTime() - now.getTime()) / 86400000;
        return days >= 0 && days <= 30;
      })
      .map(({ label, date }) => ({
        driver: driver.user?.name || driver.user?.email || "Driver",
        label,
        date,
      }))
  );

  const passengerUsers = users.filter(
    (user) => !user.role || user.role === "passenger"
  );

  const newPassengers = passengerUsers.filter((user) => {
    const date = dateValue(user.createdAt);
    return date && date >= start && date <= now;
  }).length;

  const chartData = useMemo(() => {
    const buckets = [];

    if (period === "day") {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const end = new Date(date);
        end.setDate(end.getDate() + 1);

        buckets.push({
          key: date.toISOString().slice(0, 10),
          label: formatShortDate(date),
          start: date,
          end,
        });
      }
    } else if (period === "week") {
      const currentWeek = startOfWeek(now);

      for (let i = 7; i >= 0; i--) {
        const date = new Date(currentWeek);
        date.setDate(date.getDate() - i * 7);

        const end = new Date(date);
        end.setDate(end.getDate() + 7);

        buckets.push({
          key: date.toISOString().slice(0, 10),
          label: formatShortDate(date),
          start: date,
          end,
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

        buckets.push({
          key: `${date.getFullYear()}-${date.getMonth() + 1}`,
          label: date.toLocaleDateString("en-ZA", { month: "short" }),
          start: date,
          end,
        });
      }
    }

    return buckets.map((bucket) => {
      const revenue = rides
        .filter((ride) => {
          const date = getRideDate(ride);
          return (
            ride.status === "completed" &&
            date &&
            date >= bucket.start &&
            date < bucket.end
          );
        })
        .reduce((total, ride) => total + getFare(ride), 0);

      return { ...bucket, revenue };
    });
  }, [rides, period]);

  const maxChartRevenue = Math.max(
    1,
    ...chartData.map((item) => item.revenue)
  );

  const exportRides = () => {
    setExporting(true);

    try {
      const rows = [
        [
          "Ride ID",
          "Created At",
          "Status",
          "Passenger",
          "Driver",
          "Pickup",
          "Destination",
          "Fare ZAR",
          "Recorded Commission ZAR",
        ],
        ...periodRides.map((ride) => [
          ride._id,
          ride.createdAt,
          ride.status,
          ride.passenger?.name || ride.passenger?.email || "",
          ride.driver?.user?.name || ride.driver?.name || "",
          ride.pickup?.address || ride.pickup?.name || ride.pickup || "",
          ride.destination?.address ||
            ride.destination?.name ||
            ride.destination ||
            "",
          getFare(ride).toFixed(2),
          getCommissionAmount(ride).toFixed(2),
        ]),
      ];

      downloadCsv(
        `rideflow-rides-${period}-${new Date()
          .toISOString()
          .slice(0, 10)}.csv`,
        rows
      );
    } finally {
      setExporting(false);
    }
  };

  const exportCommission = () => {
    const rows = [
      [
        "Ride ID",
        "Completed At",
        "Fare ZAR",
        "Recorded Commission ZAR",
        "Driver",
      ],
      ...completedRides.map((ride) => [
        ride._id,
        ride.updatedAt || ride.createdAt || "",
        getFare(ride).toFixed(2),
        getCommissionAmount(ride).toFixed(2),
        ride.driver?.user?.name || ride.driver?.name || "",
      ]),
    ];

    downloadCsv(
      `rideflow-commission-${period}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`,
      rows
    );
  };

  const formatMoney = (value) => money(value);

  return (
    <div className="analyticsPage">
      <div className="analyticsIntro">
        <div>
          <div className="analyticsEyebrow">RIDEFLOW OPERATIONS</div>
          <h2>Advanced admin analytics</h2>
          <p>
            Monitor platform performance, ride outcomes, driver activity
            and financial records.
          </p>
        </div>

        <div className="analyticsPeriodControl" aria-label="Analytics period">
          {[
            ["day", "Daily"],
            ["week", "Weekly"],
            ["month", "Monthly"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={period === value ? "active" : ""}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="analyticsMetricGrid">
        <MetricCard
          icon={Wallet}
          label="Gross fare revenue"
          value={formatMoney(grossRevenue)}
          detail={`${formatPeriodLabel(period)} · completed rides`}
          tone="green"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Completed rides"
          value={completedRides.length}
          detail={`${periodRides.length} total rides in period`}
          tone="blue"
        />
        <MetricCard
          icon={XCircle}
          label="Cancelled rides"
          value={cancelledRides.length}
          detail={`${formatPeriodLabel(period)} · cancellations`}
          tone="orange"
        />
        <MetricCard
          icon={ShieldAlert}
          label="Disputed rides"
          value={disputedRides.length}
          detail="Dispute fields available in ride data"
          tone="red"
        />
        <MetricCard
          icon={CarFront}
          label="Active drivers"
          value={onlineDrivers}
          detail="Approved drivers currently online"
          tone="purple"
        />
        <MetricCard
          icon={Users}
          label="New passengers"
          value={newPassengers}
          detail={`${formatPeriodLabel(period)} · registrations`}
          tone="blue"
        />
      </div>

      <div className="analyticsMainGrid">
        <Panel
          title="Revenue trends"
          description={`Completed ride fares · ${period === "day" ? "last 7 days" : period === "week" ? "last 8 weeks" : "last 6 months"}`}
          action={
            <span className="analyticsPanelMeta">
              <TrendingUp size={15} /> ZAR
            </span>
          }
        >
          {chartData.every((item) => item.revenue === 0) ? (
            <div className="analyticsEmpty">
              No completed-ride fare revenue is available for this chart yet.
            </div>
          ) : (
            <div className="analyticsChart" role="img" aria-label="Gross fare revenue trend">
              {chartData.map((item) => (
                <div className="analyticsChartColumn" key={item.key}>
                  <span className="analyticsChartValue">
                    {item.revenue ? money(item.revenue) : "—"}
                  </span>
                  <div className="analyticsChartTrack">
                    <div
                      className="analyticsChartBar"
                      style={{
                        height: `${Math.max(
                          item.revenue > 0 ? 5 : 0,
                          (item.revenue / maxChartRevenue) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="analyticsChartLabel">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Commission report"
          description="Recorded platform commission for completed rides"
          action={
            <button
              type="button"
              className="analyticsExportButton"
              onClick={exportCommission}
            >
              <Download size={15} /> Export CSV
            </button>
          }
        >
          <div className="analyticsCommissionTotal">
            <span>Commission total</span>
            <strong>
              {commissionIsAvailable ? money(commissionTotal) : "Not configured"}
            </strong>
          </div>

          {!commissionIsAvailable && (
            <div className="analyticsNotice">
              <AlertTriangle size={17} />
              <span>
                Commission data is not exposed in the ride records currently
                loaded. Connect the actual commission field or payment ledger
                before reporting platform earnings.
              </span>
            </div>
          )}

          <div className="analyticsFinancialRow">
            <span>Completed rides</span>
            <strong>{completedRides.length}</strong>
          </div>
          <div className="analyticsFinancialRow">
            <span>Gross fares</span>
            <strong>{money(grossRevenue)}</strong>
          </div>
          <div className="analyticsFinancialRow">
            <span>Commission recorded</span>
            <strong>
              {commissionIsAvailable ? money(commissionTotal) : "Unavailable"}
            </strong>
          </div>
        </Panel>
      </div>

      <div className="analyticsMainGrid">
        <Panel
          title="Driver operations"
          description="Approval queue and document-expiry checks"
        >
          <div className="analyticsAlertRow">
            <div className="analyticsAlertIcon warning">
              <Clock3Icon />
            </div>
            <div>
              <strong>Pending driver approvals</strong>
              <span>Applications awaiting review</span>
            </div>
            <b>{pendingApprovals}</b>
          </div>

          <div className="analyticsAlertRow">
            <div className="analyticsAlertIcon danger">
              <FileWarning size={18} />
            </div>
            <div>
              <strong>Documents expiring in 30 days</strong>
              <span>Only documents with recognised expiry dates</span>
            </div>
            <b>{expiringDocuments.length}</b>
          </div>

          {expiringDocuments.length > 0 && (
            <div className="analyticsExpiryList">
              {expiringDocuments.slice(0, 8).map((item, index) => (
                <div key={`${item.driver}-${item.label}-${index}`}>
                  <span>{item.driver}</span>
                  <strong>
                    {item.label} · {formatShortDate(item.date)}
                  </strong>
                </div>
              ))}
            </div>
          )}

          {!expiringDocuments.length && (
            <div className="analyticsEmpty compact">
              No upcoming expiries were found in the currently available
              driver fields. Confirm that the Driver model stores document
              expiry dates to enable reliable alerts.
            </div>
          )}
        </Panel>

        <Panel
          title="Passenger growth"
          description={`${formatPeriodLabel(period)} registrations`}
          action={
            <span className="analyticsPanelMeta">
              <CalendarDays size={15} /> {passengerUsers.length} total passengers
            </span>
          }
        >
          <div className="analyticsGrowthNumber">{newPassengers}</div>
          <p className="analyticsGrowthCaption">
            New passenger accounts created during the selected period.
          </p>
          <div className="analyticsGrowthFooter">
            <Users size={17} />
            <span>
              {passengerUsers.length} passenger accounts currently returned
              by the admin users endpoint
            </span>
          </div>
        </Panel>
      </div>

      <Panel
        title="Ride operations breakdown"
        description={`Status counts for ${formatPeriodLabel(period).toLowerCase()}`}
        action={
          <button
            type="button"
            className="analyticsExportButton"
            onClick={exportRides}
            disabled={exporting}
          >
            <Download size={15} />
            {exporting ? "Preparing..." : "Export rides CSV"}
          </button>
        }
      >
        <div className="analyticsStatusGrid">
          {[
            ["Completed", completedRides.length, "completed"],
            ["Cancelled", cancelledRides.length, "cancelled"],
            [
              "Active",
              periodRides.filter((ride) =>
                ["searching", "accepted", "arriving", "arrived", "in_progress"].includes(
                  ride.status
                )
              ).length,
              "active",
            ],
            ["Disputed", disputedRides.length, "disputed"],
          ].map(([label, count, key]) => (
            <div className="analyticsStatusItem" key={key}>
              <span className={`analyticsStatusDot ${key}`} />
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>

        <p className="analyticsFootnote">
          Ride counts are based on the current rides endpoint and each ride's
          creation date. If you need period reports based on completion,
          cancellation or dispute timestamps, the backend should store and
          expose those event dates.
        </p>
      </Panel>

      <div className="analyticsMainGrid">
        <Panel
          title="Emergency reports"
          description="Safety incidents requiring administrator attention"
        >
          <div className="analyticsFeatureUnavailable">
            <ShieldAlert size={23} />
            <div>
              <strong>Emergency report feed not connected</strong>
              <p>
                Connect this panel to a protected emergency-report endpoint
                that returns incident time, ride, reporter, severity, status
                and resolution history.
              </p>
            </div>
          </div>
        </Panel>

        <Panel
          title="Admin audit logs"
          description="Trace important administrative actions"
        >
          <div className="analyticsFeatureUnavailable">
            <Activity size={23} />
            <div>
              <strong>Audit log feed not connected</strong>
              <p>
                A backend audit collection and protected endpoint are needed
                to record approvals, suspensions, deletions, exports and
                incident updates with the administrator and timestamp.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Clock3Icon() {
  return <Activity size={18} />;
}
