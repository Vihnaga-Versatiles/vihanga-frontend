import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  useTheme,
  useMediaQuery,
  IconButton,
  Chip,
  Avatar,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Grid,
  Paper,
} from "@mui/material";
import InfiniteScroll from "react-infinite-scroll-component";
import CustomTable from "../../../../components/CustomTable/index";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import BlockIcon from "@mui/icons-material/Block";
import MobileLeaveCard from "pages/vihanga/components/MobileLeaveCard/MobileLeaveCard";

import ArrowDownwardOutlinedIcon from "../../../../../../assets/svg/export.svg";

import { formattedDate, getTotalTrackedTime } from "utilities/formatInputs";
import { 
  approveTimeTrackingEntry, 
  getTimeTrackingById 
} from "service/timeTrackingApi";
import { getItemFromLocalStorage } from "utilities/getLocalStorageItem";
import { getThemeColors } from "utilities/getThemeColors";
import { Toast } from "service/toast";
import axios from "axios";
import { appURL } from "utilities";
import { downloadBackendExport } from "utilities/backendExport";
import { exportToCSV, exportToExcel, exportToPDF } from "utilities/ExportFunctions";
import moment from "moment";
import CustomMap from "pages/vihanga/components/MapView/CustomMap";
import  CloseIcon  from '@mui/icons-material/Close';
import { getSelectedTabType } from "utilities/getLocalStorageItem";
import { useTranslation } from 'react-i18next';
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { deleteTimeTrackingEntry } from "service/timeTrackingApi";
import { calculateHoursFormatted, calculateHours, parseTime, groupEntriesByUserAndDate } from "../utils/timeCalculations";


// Professional status colors matching weekly time entries
const getStatusColor = (status, isPendingOffline) => {
  if (isPendingOffline) return '#FFA000'; // Amber for pending sync
  switch (status?.toLowerCase()) {
    case "approved":
      return "#2E7D32";
    case "pending":
      return "#F57C00";
    case "rejected":
      return "#D32F2F";
    case "cancelled":
      return "#616161";
    case "clocked in":
      return "#4CAF50";
    case "completed":
      return "#2196F3";
    default:
      return "#757575";
  }
};

const getStatusBackgroundColor = (status, isPendingOffline) => {
  if (isPendingOffline) return '#FFF8E1'; // Light amber for pending sync
  switch (status?.toLowerCase()) {
    case "approved":
      return "#E8F5E8";
    case "pending":
      return "#FFF3E0";
    case "rejected":
      return "#FFEBEE";
    case "cancelled":
      return "#F5F5F5";
    case "clocked in":
      return "#E8F5E8";
    case "completed":
      return "#E3F2FD";
    default:
      return "#F5F5F5";
  }
};

const getStatusDisplay = (status, isPendingOffline) => {
  if (isPendingOffline) return "Pending Sync (Offline)";
  switch (status?.toLowerCase()) {
    case "approved":
      return "Approved";
    case "pending":
      return "Pending Approval";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "clocked in":
      return "Clocked In";
    case "completed":
      return "Completed";
    default:
      return "Pending";
  }
};

const getStatusIcon = (status) => {
  switch (status?.toLowerCase()) {
    case "approved":
      return <CheckCircleIcon sx={{ fontSize: 16 }} />;
    case "pending":
      return <AccessTimeIcon sx={{ fontSize: 16 }} />;
    case "rejected":
      return <CancelIcon sx={{ fontSize: 16 }} />;
    case "cancelled":
      return <BlockIcon sx={{ fontSize: 16 }} />;
    case "clocked in":
      return <CheckCircleIcon sx={{ fontSize: 16 }} />;
    case "completed":
      return <CheckCircleIcon sx={{ fontSize: 16 }} />;
    default:
      return <AccessTimeIcon sx={{ fontSize: 16 }} />;
  }
};

const getStatusChip = (status, userRole, canApprove, isPendingOffline) => {
  return (
    <Box>
      <Chip
        icon={getStatusIcon(isPendingOffline ? 'pending' : status)}
        label={getStatusDisplay(status, isPendingOffline)}
        sx={{
          backgroundColor: getStatusBackgroundColor(status, isPendingOffline),
          color: getStatusColor(status, isPendingOffline),
          fontWeight: 600,
          fontSize: "0.75rem",
          border: `1px solid ${getStatusColor(status, isPendingOffline)}`,
          "& .MuiChip-icon": {
            color: getStatusColor(status, isPendingOffline),
          },
          ...(canApprove &&
            status === "pending" && {
              animation: "pulse 2s infinite",
              "@keyframes pulse": {
                "0%": { opacity: 1 },
                "50%": { opacity: 0.7 },
                "100%": { opacity: 1 },
              },
            }),
        }}
        size="small"
      />
    </Box>
  );
};

const LeaveTable4 = ({ 
  timeTrackingData, 
  onRefresh,
  totalTimeEntries,
  loading: parentLoading,
  loadingMore,
  hasMore,
  onLoadMore,
  page,
  setPage,
  rowsPerPage,
  totalPages,
  setRowsPerPage,
  totalHours,
  totalMinutes,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  offlineMode
}) => {

  console.log("timeTrackingData......",timeTrackingData)

  const [selectedPosition, setSelectedPosition] = useState(null);
const [showMap, setShowMap] = useState(false);


  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  // Approval dialog states
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [approvalAction, setApprovalAction] = useState("");
  const [approvalComments, setApprovalComments] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // View details dialog states
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [entryDetails, setEntryDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const userRoleId = getItemFromLocalStorage("user");
  const currentUserId = userRoleId?._id;
const companyId = getItemFromLocalStorage("companyId");

  const { primaryColor, secondaryColors } = getThemeColors();
  const handleSort = (field) => {
    const isAsc = sortField === field && sortOrder === "asc";
    setSortOrder(isAsc ? "desc" : "asc");
    setSortField(field);
  };

  // transition here 

  const {t} = useTranslation()

  // Filter out manager's own entries in myteam and mycompany views - only show team/company members' entries
  const selectedTabType = getSelectedTabType();
  const isMyTeamView = selectedTabType === 'myteam';
  const isMyCompanyView = selectedTabType === 'mycompany';
  const isManagerView = isMyTeamView || isMyCompanyView;
  
  // Filter data: in myteam and mycompany views, exclude current user's entries
  const filteredData = isManagerView && currentUserId
    ? timeTrackingData.filter(entry => entry.userId !== currentUserId)
    : timeTrackingData;

  // Backend handles pagination, so we use the filtered data as-is
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortField) return 0;
    if (a[sortField] < b[sortField]) return sortOrder === "asc" ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  // Approval functions
  const handleApprovalAction = (entry, action) => {
    setSelectedEntry(entry);
    setApprovalAction(action);
    setApprovalComments("");
    setRejectionReason("");
    setApprovalDialogOpen(true);
  };

  const submitApproval = async () => {
    if (!selectedEntry || !approvalAction || !currentUserId) return;

    setSubmittingApproval(true);
    try {
      const response = await approveTimeTrackingEntry({
        id: selectedEntry._id,
        approverId: currentUserId,
        action: approvalAction,
        comments: approvalComments,
        rejectionReason: approvalAction === 'rejected' ? rejectionReason : undefined
      });

      Toast({
        message:
          response.message || `Time entry ${approvalAction} successfully`,
        type: "success",
      });

      setApprovalDialogOpen(false);

      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error("Error processing approval:", err);
      Toast({
        message: err.message || "Failed to process approval. Please try again.",
        type: "error",
      });
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleViewDetails = async (entry) => {
    setSelectedEntry(entry);
    setDetailsDialogOpen(true);
    setLoadingDetails(true);

    try {
      const response = await getTimeTrackingById(entry._id, currentUserId);
      setEntryDetails(response);

      console.log("response.....", response);
    } catch (err) {
      console.error("Error fetching entry details:", err);
      Toast({
        message: "Failed to load entry details",
        type: "error",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const canApprove = (entry) => {
    if (!entry) return false;
    return (
      entry.currentApprovers?.some(
        (approver) => approver.approverId === currentUserId
      ) || entry.canApprove
    );
  };

  const canViewDetails = (entry) => {
    if (!entry) return false;
    const type = getSelectedTabType();
    if (type === 'myteam' || type === 'mycompany') return true;
    return (
      entry.userId === currentUserId ||
      canApprove(entry) ||
      entry.approvalHistory?.some((h) => h.approverId === currentUserId)
    );
  };

  const canDelete = (entry) => {
    if (!entry) return false;
    const type = getSelectedTabType();
    // In myteam/mycompany views, allow delete action for all rows (backend validates permissions)
    return type === 'myteam' || type === 'mycompany';
  };

  const [deletingId, setDeletingId] = useState(null);
  const handleDelete = async (entry) => {
    if (!entry || !entry._id) return;
    const confirmDelete = window.confirm("Delete this time entry? This cannot be undone.");
    if (!confirmDelete) return;
    try {
      setDeletingId(entry._id);
      const cid = getItemFromLocalStorage("companyId");
      const type = getSelectedTabType();
      await deleteTimeTrackingEntry({
        id: entry._id,
        currentUserId,
        companyId: cid,
        type
      });
      Toast({ message: "Time entry deleted", type: "success" });
      if (onRefresh) onRefresh();
    } catch (err) {
      Toast({ message: err?.message || "Failed to delete entry", type: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  const getCurrentApproversDisplay = (entry) => {
    if (!entry) {
      return "";
    }

    if (!entry.currentApprovers || entry.currentApprovers.length === 0) {
      return entry.currentLevelDisplay || "";
    }

    const approverDetails = entry.currentApprovers
      .map((approver) => {
        const name = approver.approverName || approver.name;
        return name ? `${name}` : null;
      })
      .filter((detail) => detail)
      .join(", ");

    const levelInfo =
      entry.currentLevel || entry.level || entry.approvalLevel || 1;
    const displayLevel =
      levelInfo === 0 || levelInfo === "0" ? 1 : parseInt(levelInfo) || 1;
    const levelDisplay = `Level ${displayLevel}`;

    return approverDetails
      ? `${levelDisplay}: ${approverDetails}`
      : entry.currentLevelDisplay || "";
  };

  const columns = [
    {
      id: "employeeInfo",
      label: <Typography fontWeight={600}>{t("TimeLogin.TableColumn.Employee")}</Typography>,
      sortable: true,
      render: (row) => (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Avatar sx={{ width: 32, height: 32, mr: 1.5, bgcolor: "#837F39" }}>
            {row.employeeInfo?.name?.charAt(0)?.toUpperCase() || "U"}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {row.employeeInfo?.name || "Unknown User"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.employeeInfo?.department || "No Department"}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: "day",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>{t("TimeLogin.TableColumn.day")}</Typography>
          <SwapVertIcon
          tabindex={0}
            style={{
              fontSize: 16,
              color: sortField === "day" ? "#000" : "#777",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleSort("day");
            }}
          />
        </Box>
      ),
      sortable: false,
      render: (row) => {
        // Always use top-level dateString for day calculation
        const dateStr = row.dateString;
        if (!dateStr) return "-";
        const m = moment(dateStr, ["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "M/D/YYYY", "M/D/YY", moment.ISO_8601], true);
        return m.isValid() ? m.format("dddd") : "-";
      }
    },
    {
      id: "dateString",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>{t("TimeLogin.TableColumn.Date")}</Typography>
          <SwapVertIcon
                     tabindex={0}

            style={{
              fontSize: 16,
              color: sortField === "dateString" ? "#000" : "#777",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleSort("dateString");
            }}
          />
        </Box>
      ),
      sortable: false,
      render: (row) => {
        const dateStr = row.dateString;
        if (!dateStr) return "-";
        const m = moment(dateStr, ["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "M/D/YYYY", "M/D/YY", moment.ISO_8601], true);
        return m.isValid() ? m.format("DD MMM YYYY") : dateStr;
      }
    },
    {
      id: "timeIn",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>{t("TimeLogin.TableColumn.timein")}</Typography>
          <SwapVertIcon           tabindex={0}
 style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
    },
    {
      id: "timeOut",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>{t("TimeLogin.TableColumn.timeOut")}</Typography>
          <SwapVertIcon           tabindex={0}
 style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
    },
    {
      id: "hours",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>{t("TimeLogin.TableColumn.hours")}</Typography>
          <SwapVertIcon           tabindex={0}
 style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
      render: (row) => {
        // Use common utility function to calculate hours from timeIn/timeOut
        if (row.timeIn && row.timeOut) {
          const calculatedHours = calculateHoursFormatted(row.timeIn, row.timeOut);
          if (calculatedHours) {
            return calculatedHours;
          }
        }
        // Fallback to existing value
        const value = row.hours;
        if (!value || value === "0" || value === 0) return "0h 0m";
        // Handle time format strings (HH:MM:SS)
        if (typeof value === "string" && (value.includes(":") || value.includes("."))) {
          let parts = value.includes(":") ? value.split(":") : value.split(".");
          parts = parts.map(Number);
          if (parts.length === 3 && !parts.some(isNaN)) {
            const [hh, mm] = parts;
            return `${hh}h ${mm}m`;
          }
        }
        // Handle decimal hours (convert to hours, minutes)
        const decimalHours = parseFloat(value);
        if (!isNaN(decimalHours)) {
          const hours = Math.floor(decimalHours);
          const minutes = Math.floor((decimalHours - hours) * 60);
          return `${hours}h ${minutes}m`;
        }
        return "0h 0m";
      },
    },
    {
      id: "method",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>{t("TimeLogin.TableColumn.method")}</Typography>
          <SwapVertIcon           tabindex={0}
 style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
      render: (row) => {
        // Capitalize first letter, rest lowercase
        if (!row.method) return "-";
        return row.method.charAt(0).toUpperCase() + row.method.slice(1).toLowerCase();
      },
    },


    {
      id: "distanceTraveled",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>Distance Travelled</Typography>
          <SwapVertIcon           tabindex={0}
 style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
      render: (row) => {
        if (!row.distanceTraveled || !row.distanceTraveled.distanceInKm) return "-";
        return row.distanceTraveled.distanceInKm;
      },
    },
    {
      id: "clockInCoordinates",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>Clock In Coordinates</Typography>
          <SwapVertIcon           tabindex={0}
 style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
      render: (row) => {
        if (!row.distanceTraveled?.clockInCoordinates?.latitude || !row.distanceTraveled?.clockInCoordinates?.longitude) return "-";
        const lat = row.distanceTraveled.clockInCoordinates.latitude;
        const lng = row.distanceTraveled.clockInCoordinates.longitude;
        return (
          <a
            href="#"
            style={{ color: "#1976d2" }}
            onClick={(e) => {
              e.preventDefault();
              setSelectedPosition({
                latitude: lat,
                longitude: lng,
                accuracy: row.accuracy,
                city: row.city,
                region: row.region,
                country: row.country
              });
              setShowMap(true);
            }}
          >
            {`${lat}, ${lng}`}
          </a>
        );
      },
    },
    {
      id: "clockOutCoordinates",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>Clock Out Coordinates</Typography>
          <SwapVertIcon           tabindex={0}
 style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
      render: (row) => {
        if (!row.distanceTraveled?.clockOutCoordinates?.latitude || !row.distanceTraveled?.clockOutCoordinates?.longitude) return "-";
        const lat = row.distanceTraveled.clockOutCoordinates.latitude;
        const lng = row.distanceTraveled.clockOutCoordinates.longitude;
        return (
          <a
            href="#"
            style={{ color: "#1976d2" }}
            onClick={(e) => {
              e.preventDefault();
              setSelectedPosition({
                latitude: lat,
                longitude: lng,
                accuracy: row.accuracy,
                city: row.city,
                region: row.region,
                country: row.country
              });
              setShowMap(true);
            }}
          >
            {`${lat}, ${lng}`}
          </a>
        );
      },
    },
    
  
    {
      id: "remarks",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>{t("TimeLogin.TableColumn.remarks")}</Typography>
          <SwapVertIcon           tabindex={0}
 style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
      render: (row) => row.Remarks || row.reason || "-",
    },
    {
      id: "status",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>{t("TimeLogin.TableColumn.status")}</Typography>
          <SwapVertIcon           tabindex={0}
 style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
      render: (row) => (
        <Box>
          {getStatusChip(row.status, row.userRole, canApprove(row), row._isPendingOffline)}
          {row.status === "pending" && getCurrentApproversDisplay(row) && (
            <Typography
              variant="caption"
              display="block"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              {getCurrentApproversDisplay(row)}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: "actions",
      label: (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <Typography fontWeight={600}>{t("TimeLogin.TableColumn.actions")}</Typography>
        </Box>
      ),
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1} alignItems="center">
          {canViewDetails(row) && (
            <IconButton
              size="small"
              onClick={() => handleViewDetails(row)}
              sx={{
                color: "#837F39",
                "&:hover": { backgroundColor: "#837F39" + "20" },
              }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          )}

          {canApprove(row) && row.status === "pending" && (
            <>
              <Button
                size="small"
                variant="contained"
                startIcon={<CheckCircleIcon />}
                onClick={() => handleApprovalAction(row, "approved")}
                sx={{
                  minWidth: 90,
                  backgroundColor: "#2E7D32",
                  "&:hover": { backgroundColor: "#1B5E20" },
                  textTransform: "none",
                  fontWeight: 500,
                }}
              >
                {t("TimeLogin.actionButton.approve")}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={() => handleApprovalAction(row, "rejected")}
                sx={{
                  minWidth: 80,
                  borderColor: "#D32F2F",
                  color: "#D32F2F",
                  "&:hover": {
                    borderColor: "#B71C1C",
                    backgroundColor: "#ffebee",
                  },
                  textTransform: "none",
                  fontWeight: 500,
                }}
              >
                {t("TimeLogin.actionButton.reject")}
              </Button>
            </>
          )}
          
          {canDelete(row) && (
            <IconButton
              size="small"
              onClick={() => handleDelete(row)}
              disabled={deletingId === row._id}
              sx={{
                color: "#D32F2F",
                "&:hover": { backgroundColor: "#ffebee" },
              }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      ),
    },
  ];


  const menuItemsExportOptions = [
    { text: t("TimeLogin.exportOptions.exportCSV"), format: "csv", icon: ArrowDownwardOutlinedIcon },
    {
      text:t("TimeLogin.exportOptions.exportExcel"),
      format: "excel",
      icon: ArrowDownwardOutlinedIcon,
    },
    { text:t("TimeLogin.exportOptions.exportPDF"), format: "pdf", icon: ArrowDownwardOutlinedIcon },
  ];


  const handleExport = async (item) => {
    try {
      const selectedTabType = getSelectedTabType();
      const isManagerView = selectedTabType === "myteam" || selectedTabType === "mycompany";

      const params = {
        companyId,
        userId: currentUserId,
        currentUserId,
        type: selectedTabType,
      };

      if (startDate && endDate) {
        params.from = startDate;
        params.to = endDate;
      }

      if (isManagerView) {
        params.excludeSelf = "true";
      }

      if (item.format === "csv" || item.format === "excel") {
        await downloadBackendExport({
          module: "time-entries",
          params,
          format: item.format,
          filename: `time-entries-export-${new Date().toISOString().split("T")[0]}`,
        });
        Toast({ message: `Exported as ${item.format.toUpperCase()}`, type: "success" });
        return;
      }

      const response = await axios.get(`${appURL}/recruitment/time-tracking`, {
        responseType: "json",
        params,
      });

      if (response?.data?.success) {
        let rawData = response.data.data.data || [];
        if (isManagerView && currentUserId) {
          rawData = rawData.filter((entry) => entry.userId !== currentUserId);
        }

        const groupedData = groupEntriesByUserAndDate(rawData);

        const formattedData = groupedData.map((entry) => ({
          EmployeeName: entry.employeeInfo?.name || "",
          EmployeeMail: entry?.employeeInfo?.email || "",
          Day: (() => {
            const d = new Date(entry.dateString || "");
            return !isNaN(d) ? d.toLocaleString("default", { weekday: "short" }) : "";
          })(),
          Date: (() => {
            const d = new Date(entry.dateString || "");
            return !isNaN(d)
              ? `${d.getDate()} ${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`
              : "";
          })(),
          TimeIn: entry.timeIn || "",
          TimeOut: entry.timeOut || "",
          Hours: entry.hours || "-",
          Method: entry.method?.charAt(0).toUpperCase() + entry.method?.slice(1).toLowerCase() || "",
          DistanceTravelled: entry.distanceTraveled?.distanceInKm || "-",
          location: entry?.employeeInfo?.location || "",
          ClockInCoordinates:
            entry.distanceTraveled?.clockInCoordinates?.latitude &&
            entry.distanceTraveled?.clockInCoordinates?.longitude
              ? `${entry.distanceTraveled.clockInCoordinates.latitude}, ${entry.distanceTraveled.clockInCoordinates.longitude}`
              : "-",
          ClockOutCoordinates:
            entry.distanceTraveled?.clockOutCoordinates?.latitude &&
            entry.distanceTraveled?.clockOutCoordinates?.longitude
              ? `${entry.distanceTraveled.clockOutCoordinates.latitude}, ${entry.distanceTraveled.clockOutCoordinates.longitude}`
              : "-",
          Remarks: entry?.Remarks || entry.employeeInfo?.Remarks || "",
          Status: entry.status?.charAt(0).toUpperCase() + entry.status?.slice(1).toLowerCase() || "",
        }));

        exportToPDF(formattedData);
        Toast({ message: `Exported as ${item.format.toUpperCase()}`, type: "success" });
      } else {
        alert("Failed to fetch export data.");
      }
    } catch (err) {
      console.error("Export Error:", err);
      Toast({
        message: err.response?.data?.message || "Failed to export data",
        type: "error",
      });
    }
  };

  return (
    <Box
      sx={{
        paddingBottom: "70px",
        margin: isMobile ? "1rem .5rem" : "1rem",
        bgcolor: secondaryColors.white,
        padding: isMobile ? ".5rem" : ".5rem",
        borderRadius: "1.5rem",
        boxShadow: "0px 0.5px 0px rgba(0,0,0,0.2)",
      }}
    >
      <Box
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography
            sx={{
              color: "#0E0E0E",
              fontWeight: 600,
              fontSize: isMobile ? "15px" : isTablet ? "20px" : "24px",
              fontFamily: "Montserrat",
              marginBottom: isMobile ? "10px" : isTablet ? "15px" : "10px",
              paddingRight: "22px",
            }}
          >
            {t("TimeLogin.TimeSheetHistory.history")}
          </Typography>
        </Box>
        <Box sx={{ width: isMobile ? '100%' : 'auto', display: 'flex', justifyContent: isMobile ? 'center' : 'flex-end', alignItems: 'center', mb: isMobile ? 2 : 0 }}>
            <Button
              sx={{
                backgroundColor: "#837F39",
                color: "#FFFFFF",
                fontWeight: "500",
                fontFamily: "Work Sans",
                borderRadius: "20px",
                textTransform: "capitalize",
                width: isMobile ? '100%' : 'auto',
                minWidth: isMobile ? 'unset' : '160px',
                margin: isMobile ? 0 : '0 20px 0 0',
                fontSize: isMobile ? '1rem' : '1.1rem',
                '&:hover': {
                  backgroundColor: '#6F6A2E',
                  boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
                },
              }}
            >
             {t("TimeLogin.TimeSheetHistory.totalTime")} :  {`${totalHours}h ${totalMinutes?.toString().padStart(2, '0')}m`}
            </Button>
         </Box>
      </Box>
      <div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            color: "#707070",
            fontFamily: "Work Sans",
            fontWeight: "500",
            fontSize: isMobile ? "15px" : isTablet ? "20px" : "24px",
            marginBottom: "50px",
            marginLeft: "22px",
          }}
        >
          <Typography>  {t("TimeLogin.TimeSheetHistory.week")}: {formattedDate}</Typography>
        </div>
      </div>

      {/* Loading State */}
      {parentLoading && (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="200px"
        >
          <CircularProgress sx={{ color: "#837F39" }} />
        </Box>
      )}

      {/* Content */}
      {!parentLoading && (
        <>
          {isMobile ? (
        <Box sx={{ paddingBottom: "0px",boxShadow: "none" }}>
          <InfiniteScroll
            dataLength={sortedData.length}
            next={onLoadMore}
            hasMore={hasMore && !offlineMode}
            loader={
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress sx={{ color: "#837F39" }} size={24} />
              </Box>
            }
            endMessage={
              sortedData.length > 0 ? (
                <Box sx={{ textAlign: "center", py: 2, color: "text.secondary" }}>
                  <Typography variant="body2">No more entries to load</Typography>
                </Box>
              ) : null
            }
          >
          {sortedData.map((row, index) => {
            // Row highlight logic for mobile
            let highlight = null;
            const isTimeMissing = (!row.timeIn || !row.timeIn.trim()) && (!row.timeOut || !row.timeOut.trim());
            const remarks = (row.Remarks || row.reason || '').toLowerCase();
            if (isTimeMissing && remarks === 'holiday') {
              highlight = 'red';
            } else if (isTimeMissing && remarks === 'leave') {
              highlight = 'orange';
            }
            const customFields = [
              {
                key: "employeeInfo",
                label: t("TimeLogin.TableColumn.Employee"),
                render: (value) => (
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Avatar sx={{ width: 24, height: 24, mr: 1, bgcolor: "#837F39" }}>
                      {value?.name?.charAt(0)?.toUpperCase() || "U"}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {value?.name || "Unknown User"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {value?.department || "No Department"}
                      </Typography>
                    </Box>
                  </Box>
                ),
              },
              { key: "day", label: t("TimeLogin.TableColumn.day"), render: (value, row) => {
                // Always use top-level dateString for day calculation
                const dateStr = row.dateString;
                if (!dateStr) return "-";
                const m = moment(dateStr, ["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "M/D/YYYY", "M/D/YY", moment.ISO_8601], true);
                return m.isValid() ? m.format("dddd") : "-";
              } },
              { key: "dateString", label:t("TimeLogin.TableColumn.Date"), render: (value, row) => {
                const dateStr = row.dateString;
                if (!dateStr) return "-";
                const m = moment(dateStr, ["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "M/D/YYYY", "M/D/YY", moment.ISO_8601], true);
                return m.isValid() ? m.format("DD MMM YYYY") : dateStr;
              } },
              { key: "timeIn", label: t("TimeLogin.TableColumn.timein"), render: (value) => {
                if (!value || value === "") return "-";
                if (typeof value === "string" && value.includes(":")) {
                  const [h = 0, m = 0] = value.split(":").map(n => parseInt(n, 10) || 0);
                  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                }
                const num = typeof value === "number" ? value : parseFloat(value);
                if (!Number.isFinite(num)) return value;
                const hours = num >= 0 && num < 1 ? num * 24 : (num >= 1 && num < 24 ? num : num);
                const h = Math.floor(hours);
                const m = Math.round((hours - h) * 60);
                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              }},
              { key: "timeOut", label: t("TimeLogin.TableColumn.timeOut"), render: (value) => {
                if (!value || value === "") return "-";
                if (typeof value === "string" && value.includes(":")) {
                  const [h = 0, m = 0] = value.split(":").map(n => parseInt(n, 10) || 0);
                  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                }
                const num = typeof value === "number" ? value : parseFloat(value);
                if (!Number.isFinite(num)) return value;
                const hours = num >= 0 && num < 1 ? num * 24 : (num >= 1 && num < 24 ? num : num);
                const h = Math.floor(hours);
                const m = Math.round((hours - h) * 60);
                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              } },
              { 
                key: "hours", 
                label: t("TimeLogin.TableColumn.hours"),
                render: (value) => {
                  if (!value || value === "0" || value === 0) return "0h 0m";

                  // Handle time format strings (HH:MM:SS)
                  if (typeof value === "string" && value.includes(":")) {
                    const parts = value.split(":").map(Number);
                    if (parts.length === 3 && !parts.some(isNaN)) {
                      const [hh, mm] = parts;
                      return `${hh}h ${mm}m`;
                    }
                  }

                  // Handle decimal hours (convert to hours, minutes)
                  const decimalHours = parseFloat(value);
                  if (!isNaN(decimalHours)) {
                    const hours = Math.floor(decimalHours);
                    const minutes = Math.floor((decimalHours - hours) * 60);
                    return `${hours}h ${minutes}m`;
                  }

                  return "0h 0m";
                }
              },
              { key: "method", label: t("TimeLogin.TableColumn.method") },
              { 
                key: "distanceTraveled",
                label: "Distance Travelled",
                render: (value, row) => {
                  if (!row.distanceTraveled || !row.distanceTraveled.distanceInKm) return "-";
                  return row.distanceTraveled.distanceInKm;
                }
              },
              { 
                key: "clockInCoordinates",
                label: "Clock In Coordinates",
                render: (value, row) => {
                  if (!row.distanceTraveled?.clockInCoordinates?.latitude || !row.distanceTraveled?.clockInCoordinates?.longitude) return "-";
                  const lat = row.distanceTraveled.clockInCoordinates.latitude;
                  const lng = row.distanceTraveled.clockInCoordinates.longitude;
                  return `${lat}, ${lng}`;
                }
              },
              { 
                key: "clockOutCoordinates",
                label: "Clock Out Coordinates",
                render: (value, row) => {
                  if (!row.distanceTraveled?.clockOutCoordinates?.latitude || !row.distanceTraveled?.clockOutCoordinates?.longitude) return "-";
                  const lat = row.distanceTraveled.clockOutCoordinates.latitude;
                  const lng = row.distanceTraveled.clockOutCoordinates.longitude;
                  return `${lat}, ${lng}`;
                }
              },
              { 
                key: "remarks",
                label: t("TimeLogin.TableColumn.remarks"),
                render: (value, row) => row.Remarks || row.reason || "-"
              },
              { 
                key: "status", 
                label: t("TimeLogin.TableColumn.status"), 
                render: (value, row) => getStatusChip(value, row.userRole, canApprove(row), row._isPendingOffline)
              },
            ];

            return (
              <Box
                key={index}
              
              >
                <MobileLeaveCard
                  row={row}
                  highlight={highlight}
                  fields={customFields}
                  onApprove={canApprove(row) ? () => handleApprovalAction(row, 'approved') : null}
                  onReject={canApprove(row) ? () => handleApprovalAction(row, 'rejected') : null}
                  canApprove={canApprove(row)}
                  canViewDetails={canViewDetails(row)}
                  onViewDetails={canViewDetails(row) ? () => handleViewDetails(row) : null}
                  canDelete={canDelete(row)}
                  onDelete={canDelete(row) ? () => handleDelete(row) : null}
                  currentUserId={currentUserId}
                />
              </Box>
            );
          })}
          </InfiniteScroll>
        </Box>
      ) : (
        <CustomTable
          columns={columns}
          data={sortedData}
          page={page}
          setPage={setPage}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
          totalPages={totalPages}
          pagination={true}
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          menuItemsExportOptions={menuItemsExportOptions}
          onExport={handleExport}
          getRowSx={(row) => {
            const isTimeMissing = (!row.timeIn || !row.timeIn.trim()) && (!row.timeOut || !row.timeOut.trim());
            const remarks = (row.Remarks || row.reason || '').toLowerCase();
            if (isTimeMissing && remarks === 'holiday') return { backgroundColor: '#ffeaea' };
            if (isTimeMissing && remarks === 'leave') return { backgroundColor: '#fff4e5' };
            return undefined;
          }}
        />
      )}
        </>
      )}

      {offlineMode && timeTrackingData.length === 0 && (
        <Typography sx={{ color: '#FFA000', fontWeight: 600, textAlign: 'center', mt: 2 }}>
          No offline records to display. Your data will appear here once you are back online.
        </Typography>
      )}

      {/* Approval Dialog */}
      <Dialog
        open={approvalDialogOpen}
        onClose={() => setApprovalDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {approvalAction === "approved" ? "Approve" : "Reject"} Time Entry
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {approvalAction === "approved" 
              ? "Are you sure you want to approve this time entry?" 
              : "Please provide a reason for rejecting this time entry."}
          </Typography>
          
          {approvalAction === "rejected" && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Rejection Reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              sx={{ mb: 2 }}
              required
            />
          )}
          
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Comments (Optional)"
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submitApproval}
            disabled={submittingApproval || (approvalAction === "rejected" && !rejectionReason.trim())}
            variant="contained"
            color={approvalAction === "approved" ? "success" : "error"}
          >
            {submittingApproval ? (
              <CircularProgress size={20} />
            ) : (
              approvalAction === "approved" ? "Approve" : "Reject"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
        sx={{ 
          bgcolor: '#837F39',
          color: 'white',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center'
        }}>{t("TimeLogin.DialogBox.title")}</DialogTitle>
        <DialogContent>
          {loadingDetails ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
              <CircularProgress />
            </Box>
          ) : entryDetails ? (

            <Box sx={{ p: 3 }}>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              {/* <Typography variant="h6" gutterBottom>
                Entry Information
              </Typography> */}

              <Avatar 
          sx={{ 
            width: 56, 
            height: 56, 
            mr: 2, 
            bgcolor: '#837F39',
            fontSize: '1.5rem',
            fontWeight: 600
          }}
        >
           
          {entryDetails.employeeInfo?.name?.charAt(0)?.toUpperCase() || 'U'}
        </Avatar>
        <Box sx={{ flex: 1 }}>

        <Typography variant="h6" fontWeight={600} color="text.primary">
            {entryDetails.employeeInfo?.name || "Unknown User"}
          </Typography>

          <Box sx={{ mt: 1 }}>
            <Chip
              icon={getStatusIcon(entryDetails.status)}
              label={getStatusDisplay(entryDetails.status)}
              sx={{
                backgroundColor: getStatusBackgroundColor(entryDetails.status),
                color: getStatusColor(entryDetails.status),
                fontWeight: 600,
                fontSize: "0.75rem",
                border: `1px solid ${getStatusColor(entryDetails.status)}`,
                '& .MuiChip-icon': {
                  color: getStatusColor(entryDetails.status)
                }
              }}
              size="small"
            />
          </Box>
          </Box>

</Box>

       
     

          <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {t("TimeLogin.TableColumn.Date")}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {entryDetails.dateString ? moment(entryDetails.from).format("MMM DD, YYYY") : "Not specified"}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {t("TimeLogin.TableColumn.timein")}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
            {entryDetails.timeIn}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {t("TimeLogin.TableColumn.timeOut")}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
            {entryDetails.timeOut}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {t("TimeLogin.TableColumn.hours")}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
            {entryDetails.hours}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {t("TimeLogin.TableColumn.method")}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
            {entryDetails.method}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Distance Travelled
            </Typography>
            <Typography variant="body1" fontWeight={600}>
            {entryDetails.distanceTraveled?.distanceInKm || "-"}
            </Typography>
          </Box>
        </Grid>

</Grid>




              {/* <Typography>Date: {entryDetails.dateString}</Typography> */}
              {/* <Typography>Time In: {entryDetails.timeIn}</Typography>
              <Typography>Time Out: {entryDetails.timeOut}</Typography> */}
              {/* <Typography>Hours: {entryDetails.hours}</Typography>
              <Typography>Method: {entryDetails.method}</Typography>
              <Typography>Status: {entryDetails.status}</Typography> */}

             

              {/* Approval History */}
              {entryDetails.approvalHistory && entryDetails.approvalHistory.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom fontWeight={600}>
                    {t("TimeLogin.DialogBox.ApprovalHistory")}
                  </Typography>
                  {entryDetails.approvalHistory.map((approval, index) => (
                    <Box 
                      key={index} 
                      sx={{ 
                        mb: 2, 
                        p: 2, 
                        bgcolor: approval.action === "rejected" ? "#FFEBEE" : approval.action === "approved" ? "#E8F5E8" : "#FFF3E0",
                        borderRadius: 2,
                        border: `1px solid ${approval.action === "rejected" ? "#FFCDD2" : approval.action === "approved" ? "#C8E6C9" : "#FFE0B2"}`
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {approval.approverName}
                        </Typography>
                        <Chip
                          label={approval.action === "approved" ? "Approved" : approval.action === "rejected" ? "Rejected" : approval.action}
                          size="small"
                          sx={{
                            ml: 1,
                            backgroundColor: approval.action === "approved" ? "#2E7D32" : approval.action === "rejected" ? "#D32F2F" : "#F57C00",
                            color: "white",
                            fontWeight: 500,
                            fontSize: "0.7rem"
                          }}
                        />
                      </Box>
                      {approval.approverType && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                          {approval.approverType} • {moment(approval.timestamp).format("MMM DD, YYYY HH:mm")}
                        </Typography>
                      )}
                      {approval.comments && (
                        <Box sx={{ mt: 1.5 }}>
                          <Typography variant="body2" fontWeight={600} color="text.secondary" gutterBottom>
                            Comments:
                          </Typography>
                          <Typography variant="body2" color="text.primary">
                            {approval.comments}
                          </Typography>
                        </Box>
                      )}
                      {approval.rejectionReason && (
                        <Box sx={{ mt: 1.5 }}>
                          <Typography variant="body2" fontWeight={600} color="#D32F2F" gutterBottom>
                            Rejection Reason:
                          </Typography>
                          <Typography variant="body2" color="text.primary">
                            {approval.rejectionReason}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ) : (
            <Typography>{t("TimeLogin.DialogBox.Nodetailsavailable")}</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>{t("AbsenceTime.close")}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showMap} onClose={() => setShowMap(false)} maxWidth="md" fullWidth>

      
  <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} >{t("TimeLogin.DialogBox.CurrentLocationMap")}
  <IconButton onClick={()=>setShowMap(false)}  size="small">
   <CloseIcon />
   </IconButton>
   </DialogTitle>
  <DialogContent>
    {selectedPosition && (
      <CustomMap
        latitude={selectedPosition.latitude}
        longitude={selectedPosition.longitude}
        accuracy={selectedPosition.accuracy}
        city={selectedPosition.city}
        region={selectedPosition.region}
        country={selectedPosition.country}
        offlineMode={offlineMode}
      />
    )}
  </DialogContent>
</Dialog>

    </Box>
  );
};

export default LeaveTable4;