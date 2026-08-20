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

/**
 * Download export file from backend export API.
 * @param {object} options
 * @param {string} options.module - leaves | tasks | time-entries | objectives
 * @param {object} options.params - query params (filters)
 * @param {string} options.format - csv | excel | xlsx
 * @param {string} [options.pathSuffix] - e.g. `/userId/companyId` for tasks
 * @param {string} [options.filename] - download filename without extension
 */
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

  const response = await axios.get(url, {
    params: { ...params, format: apiFormat },
    responseType: "blob",
    headers: getAuthHeaders(),
  });

  const blob = new Blob([response.data], {
    type:
      ext === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv;charset=utf-8;",
  });

  const defaultName = `${module}-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
  saveAs(blob, filename ? `${filename}.${ext}` : defaultName);
  return response;
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
  const params = {
    companyId,
    currentUserId,
    type: type || "me",
    search: search || undefined,
    startDate,
    endDate,
  };

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
    params.empId = empId || currentUserId;
  } else if (effectiveViewMode === "manager") {
    params.viewType = viewType || "pending-approvals";
  } else if (effectiveViewMode === "admin") {
    params.viewType = viewType || "all-leaves";
  }

  return params;
};

export const getExportUserContext = () => {
  const user = getItemFromLocalStorage("user");
  const companyId = getItemFromLocalStorage("companyId");
  return {
    user,
    companyId,
    currentUserId: user?._id,
    userRole: user?.employmentInformation?.role,
  };
};
