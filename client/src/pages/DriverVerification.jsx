import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Clock3,
  FileCheck,
  FileText,
  IdCard,
  ShieldCheck,
  Upload,
  User,
  XCircle,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function DriverVerification() {
  const navigate = useNavigate();

  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  const [files, setFiles] = useState({
    idDocument: null,
    driverLicense: null,
    vehicleRegistration: null,
    vehicleProof: null,
  });

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // =========================================================
  // LOAD DRIVER PROFILE
  // =========================================================

  const loadDriver = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/drivers/profile"
      );

      const driverData =
        response.data?.driver ||
        response.data ||
        null;

      console.log(
        "DRIVER VERIFICATION RESPONSE:",
        response.data
      );

      console.log(
        "DRIVER DOCUMENTS:",
        {
          idDocument:
            driverData?.idDocument || "",
          licenseDocument:
            driverData?.licenseDocument || "",
          driverLicense:
            driverData?.driverLicense || "",
          vehicleRegistration:
            driverData?.vehicleRegistration || "",
          vehicleProof:
            driverData?.vehicleProof || "",
        }
      );

      setDriver(driverData);
    } catch (err) {
      console.error(
        "VERIFICATION LOAD ERROR:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Unable to load verification information."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriver();
  }, []);

  // =========================================================
  // FILE SELECTION
  // =========================================================

  const handleFileChange = (
    field,
    file
  ) => {
    setFiles((previous) => ({
      ...previous,
      [field]: file,
    }));

    setMessage("");
    setError("");
  };

  // =========================================================
  // DOCUMENT DATA
  // =========================================================

  const documentData =
    driver?.documents ||
    driver?.verificationDocuments ||
    {};

  // =========================================================
  // DOCUMENT CHECKER
  // =========================================================

  const hasDocument = (...values) => {
    return values.some((value) => {
      if (!value) {
        return false;
      }

      if (typeof value === "string") {
        return value.trim().length > 0;
      }

      if (typeof value === "object") {
        return Object.keys(value).length > 0;
      }

      return Boolean(value);
    });
  };

  // =========================================================
  // DOCUMENT STATUS
  // =========================================================

  const documentStatus = useMemo(() => {
    const result = {
      // -----------------------------------------------------
      // ID DOCUMENT
      // -----------------------------------------------------

      idDocument: hasDocument(
        driver?.idDocument,
        driver?.identityDocument,

        documentData?.idDocument,
        documentData?.identityDocument
      ),

      // -----------------------------------------------------
      // DRIVER LICENCE
      // -----------------------------------------------------

      driverLicense: hasDocument(
        driver?.licenseDocument,
        driver?.driverLicense,
        driver?.license,

        documentData?.licenseDocument,
        documentData?.driverLicense,
        documentData?.license,
        documentData?.driverLicenseDocument
      ),

      // -----------------------------------------------------
      // VEHICLE REGISTRATION
      // -----------------------------------------------------

      vehicleRegistration: hasDocument(
        driver?.vehicleRegistration,
        driver?.vehicleRegistrationDocument,
        driver?.registrationDocument,

        documentData?.vehicleRegistration,
        documentData?.vehicleRegistrationDocument,
        documentData?.registration,
        documentData?.registrationDocument
      ),

      // -----------------------------------------------------
      // VEHICLE PROOF
      // -----------------------------------------------------

      vehicleProof: hasDocument(
        driver?.vehicleProof,
        driver?.vehicleProofDocument,
        driver?.proofOfVehicle,

        documentData?.vehicleProof,
        documentData?.vehicleProofDocument,
        documentData?.proofOfVehicle
      ),
    };

    console.log(
      "NORMALIZED DOCUMENT STATUS:",
      result
    );

    return result;
  }, [
    driver,
    documentData,
  ]);

  // =========================================================
  // DOCUMENT COUNTS
  // =========================================================

  const totalDocuments = 4;

  const existingDocuments =
    Object.values(documentStatus).filter(
      Boolean
    ).length;

  const selectedDocuments =
    Object.values(files).filter(
      Boolean
    ).length;

  const documentProgress = Math.min(
    100,
    Math.round(
      (existingDocuments /
        totalDocuments) *
        100
    )
  );

  // =========================================================
  // UPLOAD DOCUMENTS
  // =========================================================

  const handleUpload = async () => {
    setMessage("");
    setError("");

    const selectedFiles =
      Object.values(files);

    if (
      selectedFiles.every(
        (file) => !file
      )
    ) {
      setError(
        "Please select at least one document."
      );
      return;
    }

    try {
      setUploading(true);

      const formData =
        new FormData();

      // -----------------------------------------------------
      // ID
      // -----------------------------------------------------

      if (files.idDocument) {
        formData.append(
          "idDocument",
          files.idDocument
        );
      }

      // -----------------------------------------------------
      // DRIVER LICENCE
      // -----------------------------------------------------

      if (files.driverLicense) {
        formData.append(
          "driverLicense",
          files.driverLicense
        );
      }

      // -----------------------------------------------------
      // VEHICLE REGISTRATION
      // -----------------------------------------------------

      if (
        files.vehicleRegistration
      ) {
        formData.append(
          "vehicleRegistration",
          files.vehicleRegistration
        );
      }

      // -----------------------------------------------------
      // VEHICLE PROOF
      // -----------------------------------------------------

      if (files.vehicleProof) {
        formData.append(
          "vehicleProof",
          files.vehicleProof
        );
      }

      // -----------------------------------------------------
      // DEBUG
      // -----------------------------------------------------

      console.log(
        "UPLOADING DOCUMENTS:"
      );

      for (
        const [key, value]
        of formData.entries()
      ) {
        console.log(
          key,
          value?.name ||
            value
        );
      }

      // -----------------------------------------------------
      // SEND TO SERVER
      // -----------------------------------------------------

      const response =
        await api.patch(
          "/drivers/verification",
          formData
        );

      console.log(
        "VERIFICATION UPLOAD RESPONSE:",
        response.data
      );

      setMessage(
        response.data?.message ||
          "Verification documents submitted successfully."
      );

      // Clear selected files
      setFiles({
        idDocument: null,
        driverLicense: null,
        vehicleRegistration: null,
        vehicleProof: null,
      });

      // Get fresh data from MongoDB
      await loadDriver();

    } catch (err) {
      console.error(
        "VERIFICATION UPLOAD ERROR:",
        err
      );

      console.error(
        "SERVER RESPONSE:",
        err?.response?.data
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to upload verification documents."
      );
    } finally {
      setUploading(false);
    }
  };

  // =========================================================
  // APPLICATION STATUS
  // =========================================================

  const applicationStatus =
    driver?.applicationStatus ||
    "pending";

  const status = useMemo(() => {
    if (
      applicationStatus ===
      "approved"
    ) {
      return {
        label: "Approved",
        icon: CheckCircle2,
        className: "approved",
        description:
          "Your driver application has been approved. You can now go online and receive ride requests.",
      };
    }

    if (
      applicationStatus ===
      "rejected"
    ) {
      return {
        label: "Rejected",
        icon: XCircle,
        className: "rejected",
        description:
          "Your application requires attention. Please review your documents and submit updated information.",
      };
    }

    return {
      label: "Pending Review",
      icon: Clock3,
      className: "pending",
      description:
        "Your documents are waiting for review by the RideFlow administration team.",
    };
  }, [
    applicationStatus,
  ]);

  const StatusIcon =
    status.icon;

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="verificationPage">

        <div className="verificationLoading">

          <div className="verificationSpinner" />

          <p>
            Loading verification information...
          </p>

        </div>

      </div>
    );
  }

  // =========================================================
  // MAIN PAGE
  // =========================================================

  return (
    <div className="verificationPage">

      <div className="verificationContainer">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="verificationPageHeader">

          <div>

            <button
              type="button"
              className="verificationBack"
              onClick={() =>
                navigate("/driver")
              }
            >
              <ArrowLeft size={16} />

              Back to Dashboard
            </button>

            <div className="verificationTitleRow">

              <div className="verificationTitleIcon">

                <ShieldCheck size={23} />

              </div>

              <div>

                <h1>
                  Driver Verification
                </h1>

                <p>
                  Manage your documents and driver
                  verification status.
                </p>

              </div>

            </div>

          </div>

          <div
            className={`verificationStatusBadge ${status.className}`}
          >

            <StatusIcon size={16} />

            {status.label}

          </div>

        </div>

        {/* ===================================================
            SUCCESS MESSAGE
        =================================================== */}

        {message && (
          <div className="verificationMessage success">

            <CheckCircle2 size={19} />

            <div>

              <strong>
                Success
              </strong>

              <span>
                {message}
              </span>

            </div>

          </div>
        )}

        {/* ===================================================
            ERROR MESSAGE
        =================================================== */}

        {error && (
          <div className="verificationMessage error">

            <XCircle size={19} />

            <div>

              <strong>
                Upload Error
              </strong>

              <span>
                {error}
              </span>

            </div>

          </div>
        )}

        {/* ===================================================
            SUMMARY CARDS
        =================================================== */}

        <div className="verificationSummaryGrid">

          <SummaryCard
            icon={FileCheck}
            label="Documents"
            value={`${existingDocuments}/${totalDocuments}`}
            type="blue"
          />

          <SummaryCard
            icon={ShieldCheck}
            label="Completion"
            value={`${documentProgress}%`}
            type="purple"
          />

          <SummaryCard
            icon={Clock3}
            label="Application"
            value={status.label}
            type="yellow"
          />

          <SummaryCard
            icon={Car}
            label="Vehicle"
            value={
              driver?.registration ||
              "Not set"
            }
            type="green"
          />

        </div>

        {/* ===================================================
            APPLICATION STATUS
        =================================================== */}

        <section className="verificationPanel">

          <div className="verificationPanelHeader">

            <div>

              <h2>
                Application Status
              </h2>

              <p>
                Current status of your RideFlow
                driver application.
              </p>

            </div>

            <div
              className={`smallStatus ${status.className}`}
            >

              <StatusIcon size={15} />

              {status.label}

            </div>

          </div>

          <div
            className={`applicationStatusBox ${status.className}`}
          >

            <div className="applicationStatusIcon">

              <StatusIcon size={23} />

            </div>

            <div>

              <h3>

                {applicationStatus ===
                "approved"
                  ? "Your application is approved"
                  : applicationStatus ===
                    "rejected"
                  ? "Your application was rejected"
                  : "Your application is under review"}

              </h3>

              <p>
                {status.description}
              </p>

            </div>

          </div>

          {/* PROGRESS */}

          <div className="verificationProgress">

            <div className="progressTop">

              <span>
                Document completion
              </span>

              <strong>
                {documentProgress}%
              </strong>

            </div>

            <div className="progressBar">

              <div
                className="progressBarFill"
                style={{
                  width: `${documentProgress}%`,
                }}
              />

            </div>

            <div className="progressBottom">

              <span>
                Verification documents
              </span>

              <span>
                {existingDocuments} of{" "}
                {totalDocuments} uploaded
              </span>

            </div>

          </div>

        </section>

        {/* ===================================================
            REQUIRED DOCUMENTS
        =================================================== */}

        <section className="verificationPanel">

          <div className="verificationPanelHeader">

            <div>

              <h2>
                Required Documents
              </h2>

              <p>
                Upload clear copies of all required
                driver and vehicle documents.
              </p>

            </div>

            <div className="fileFormatBadge">

              <FileText size={14} />

              PDF / JPG / PNG

            </div>

          </div>

          <div className="verificationDocuments">

            {/* =================================================
                ID DOCUMENT
            ================================================= */}

            <DocumentUpload
              icon={IdCard}
              title="South African ID"
              description="Clear copy of your South African ID."
              file={
                files.idDocument
              }
              existingFile={
                documentStatus.idDocument
              }
              onChange={(file) =>
                handleFileChange(
                  "idDocument",
                  file
                )
              }
            />

            {/* =================================================
                DRIVER LICENCE
            ================================================= */}

            <DocumentUpload
              icon={FileCheck}
              title="Driver's Licence"
              description="Your valid South African driver's licence."
              file={
                files.driverLicense
              }
              existingFile={
                documentStatus.driverLicense
              }
              onChange={(file) =>
                handleFileChange(
                  "driverLicense",
                  file
                )
              }
            />

            {/* =================================================
                VEHICLE REGISTRATION
            ================================================= */}

            <DocumentUpload
              icon={Car}
              title="Vehicle Registration"
              description="Your vehicle registration document."
              file={
                files.vehicleRegistration
              }
              existingFile={
                documentStatus.vehicleRegistration
              }
              onChange={(file) =>
                handleFileChange(
                  "vehicleRegistration",
                  file
                )
              }
            />

            {/* =================================================
                VEHICLE PROOF
            ================================================= */}

            <DocumentUpload
              icon={FileText}
              title="Vehicle Proof"
              description="Proof of ownership or authorised use."
              file={
                files.vehicleProof
              }
              existingFile={
                documentStatus.vehicleProof
              }
              onChange={(file) =>
                handleFileChange(
                  "vehicleProof",
                  file
                )
              }
            />

          </div>

        </section>

        {/* ===================================================
            SUBMIT DOCUMENTS
        =================================================== */}

        <section className="verificationSubmit">

          <div className="submitInfo">

            <div className="submitIcon">

              <Upload size={20} />

            </div>

            <div>

              <h3>
                Submit Documents
              </h3>

              <p>
                Once you have selected your documents,
                submit them for RideFlow administration
                review.
              </p>

              {selectedDocuments > 0 && (
                <div className="selectedDocuments">

                  <CheckCircle2 size={14} />

                  {selectedDocuments}{" "}
                  {selectedDocuments === 1
                    ? "document"
                    : "documents"}{" "}
                  selected

                </div>
              )}

            </div>

          </div>

          <button
            type="button"
            className="submitDocumentsButton"
            onClick={handleUpload}
            disabled={uploading}
          >

            <Upload size={17} />

            {uploading
              ? "Uploading..."
              : "Submit Documents"}

          </button>

        </section>

        {/* ===================================================
            DRIVER INFORMATION
        =================================================== */}

        <section className="verificationPanel">

          <div className="verificationPanelHeader">

            <div>

              <h2>
                Driver Information
              </h2>

              <p>
                Your information currently stored
                in the RideFlow driver profile.
              </p>

            </div>

            <User
              size={19}
              className="panelMutedIcon"
            />

          </div>

          <div className="driverInfoGrid">

            <Info
              label="Driver"
              value={
                driver?.user?.name ||
                driver?.name ||
                "—"
              }
            />

            <Info
              label="Vehicle Make"
              value={
                driver?.vehicleMake ||
                "—"
              }
            />

            <Info
              label="Vehicle Model"
              value={
                driver?.vehicleModel ||
                "—"
              }
            />

            <Info
              label="Vehicle Colour"
              value={
                driver?.vehicleColor ||
                "—"
              }
            />

            <Info
              label="Registration"
              value={
                driver?.registration ||
                "—"
              }
            />

            <Info
              label="Licence Number"
              value={
                driver?.licenseNumber ||
                "—"
              }
            />

          </div>

        </section>

        {/* ===================================================
            SECURITY NOTICE
        =================================================== */}

        <div className="verificationNotice">

          <ShieldCheck size={19} />

          <div>

            <strong>
              Document Security
            </strong>

            <p>
              Your verification documents are used
              only for RideFlow driver verification
              and administration purposes.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}

// =============================================================
// SUMMARY CARD
// =============================================================

function SummaryCard({
  icon: Icon,
  label,
  value,
  type,
}) {
  return (
    <div className="verificationSummaryCard">

      <div
        className={`summaryIcon ${type}`}
      >
        <Icon size={19} />
      </div>

      <div>

        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

      </div>

    </div>
  );
}

// =============================================================
// DOCUMENT UPLOAD COMPONENT
// =============================================================

function DocumentUpload({
  icon: Icon,
  title,
  description,
  file,
  existingFile,
  onChange,
}) {
  const hasNewFile =
    Boolean(file);

  const hasExistingFile =
    Boolean(existingFile);

  return (
    <div
      className={`verificationDocument ${
        hasNewFile
          ? "selected"
          : ""
      }`}
    >

      {/* DOCUMENT HEADER */}

      <div className="documentHeader">

        <div className="documentIcon">

          <Icon size={20} />

        </div>

        <div className="documentHeading">

          <h3>
            {title}
          </h3>

          {hasExistingFile && (
            <span className="documentExisting">

              <CheckCircle2 size={12} />

              On file

            </span>
          )}

        </div>

      </div>

      {/* DESCRIPTION */}

      <p className="documentDescription">

        {description}

      </p>

      {/* FILE INPUT */}

      <label className="documentDropzone">

        <div className="dropzoneIcon">

          <Upload size={20} />

        </div>

        <div className="dropzoneText">

          {hasNewFile ? (
            <>
              <strong>
                {file.name}
              </strong>

              <span>
                Click to replace document
              </span>
            </>
          ) : hasExistingFile ? (
            <>
              <strong>
                Document already uploaded
              </strong>

              <span>
                Click to upload replacement
              </span>
            </>
          ) : (
            <>
              <strong>
                Choose document
              </strong>

              <span>
                Click to browse your computer
              </span>
            </>
          )}

        </div>

        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(event) =>
            onChange(
              event.target.files?.[0] ||
                null
            )
          }
        />

      </label>

      {/* READY */}

      {hasNewFile && (
        <div className="documentReady">

          <CheckCircle2 size={14} />

          Ready to submit

        </div>
      )}

    </div>
  );
}

// =============================================================
// DRIVER INFO
// =============================================================

function Info({
  label,
  value,
}) {
  return (
    <div className="driverInfoItem">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}