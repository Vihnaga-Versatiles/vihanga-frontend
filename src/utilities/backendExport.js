import axios from "axios";
import { saveAs } from "file-saver";
import { appURL } from "utilities";
import { getItemFromLocalStorage } from "utilities/getLocalStorageItem";

const getAuthHeaders = () => {
  try {
    const rawUser = window.localStorage.getItem("user");
    if (!rawUser) return {};
    const parsed = JSON.parse(rawUser);
    if (parsed?.token) {
      return { Authorization: `Bearer ${parsed.token}` };
    }
  } catch {
    // ignore
  }
  return {};
};

const formatToExtension = (format) => {
  const f = (format || "csv").toLowerCase();
  if (f === "excel" || f === "xlsx") return "xlsx";
  return "csv";
};

export const normalizeExportId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value._id || value.id || value.companyId || "").trim();
  }
  return String(value).replace(/^"|"$/g, "").trim();
};

export const sanitizeExportParams = (params = {}) => {
  const cleaned = { ...params };
  if (cleaned.companyId != null) cleaned.companyId = normalizeExportId(cleaned.companyId);
  if (cleaned.currentUserId != null) cleaned.currentUserId = normalizeExportId(cleaned.currentUserId);
  if (cleaned.userId != null) cleaned.userId = normalizeExportId(cleaned.userId);
  if (cleaned.empId != null) cleaned.empId = normalizeExportId(cleaned.empId);
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined || cleaned[key] === null || cleaned[key] === "") {
      delete cleaned[key];
    }
  });
  return cleaned;
};

/**
 * Download export file from backend export API.
 * @param {object} options
 * @param {string} options.module - leaves | tasks | time-entries | objectives
 * @param {object} options.params - query params (filters)
 * @param {string} options.format - csv | excel | xlsx
 * @param {string} [options.pathSuffix] - e.g. `/userId/companyId` for tasks
 * @param {string} [options.filename] - download filename without extension
 */
const parseBlobError = async (blob) => {
  try {
    const text = await blob.text();
    const json = JSON.parse(text);
    return json?.message || text;
  } catch {
    return "Export failed";
  }
};

export const downloadBackendExport = async ({
  module,
  params = {},
  format = "csv",
  pathSuffix = "",
  filename,
}) => {
  const ext = formatToExtension(format);
  const apiFormat = ext === "xlsx" ? "xlsx" : "csv";
  const url = `${appURL}/exports/${module}${pathSuffix}`;

  try {
    const response = await axios.get(url, {
      params: sanitizeExportParams({ ...params, format: apiFormat }),
      responseType: "blob",
      headers: getAuthHeaders(),
    });

    const contentType = response.headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      const message = await parseBlobError(response.data);
      throw new Error(message);
    }

    const blob = new Blob([response.data], {
      type:
        ext === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv;charset=utf-8;",
    });

    const defaultName = `${module}-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
    saveAs(blob, filename ? `${filename}.${ext}` : defaultName);
    return response;
  } catch (err) {
    if (err.response?.data instanceof Blob) {
      const message = await parseBlobError(err.response.data);
      throw new Error(message);
    }
    throw err;
  }
};

export const buildLeaveExportParams = ({
  companyId,
  currentUserId,
  type,
  search,
  startDate,
  endDate,
  status,
  viewMode,
  empId,
  viewType,
  userRole,
}) => {
  const params = sanitizeExportParams({
    companyId,
    currentUserId: normalizeExportId(currentUserId),
    type: type || "me",
    search: search || undefined,
    startDate,
    endDate,
  });

  if (status && status !== "all") {
    params.status = status;
  }

  const isEmployee = userRole === "Employee";
  const isManager = ["Manager", "Line Manager"].includes(userRole);
  const isHR = ["HR Admin", "HR Manager"].includes(userRole);
  const isSuperAdmin = userRole === "Super Admin";

  let effectiveViewMode = viewMode;
  if (viewMode === "auto") {
    if (isEmployee) effectiveViewMode = "employee";
    else if (isManager) effectiveViewMode = "manager";
    else if (isHR || isSuperAdmin) effectiveViewMode = "admin";
    else effectiveViewMode = "employee";
  }

  if (effectiveViewMode === "employee") {
    params.empId = normalizeExportId(empId || currentUserId);
  } else if (effectiveViewMode === "manager") {
    params.viewType = viewType || "pending-approvals";
    params.type = type || "myteam";
  } else if (effectiveViewMode === "admin") {
    params.viewType = viewType || "all-leaves";
    params.type = "mycompany";
  }

  return sanitizeExportParams(params);
};

export const getExportUserContext = () => {
  const user = getItemFromLocalStorage("user");
  const companyId = normalizeExportId(getItemFromLocalStorage("companyId"));
  return {
    user,
    companyId,
    currentUserId: normalizeExportId(user?._id),
    userRole: user?.employmentInformation?.role,
  };
};
