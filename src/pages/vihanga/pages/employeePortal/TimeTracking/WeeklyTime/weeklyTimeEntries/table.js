import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  Pagination,
  Grid,
  Paper,
  Avatar,
  Divider,
  Stack,
  TableRow,
} from "@mui/material";
import SwapVertIcon from '@mui/icons-material/SwapVert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BlockIcon from '@mui/icons-material/Block';
import CustomTable from "pages/vihanga/components/CustomTable/index";
import MobileLeaveCard from "pages/vihanga/components/MobileLeaveCard/MobileLeaveCard";
import ArrowDownwardOutlinedIcon from "../../../../../../../assets/svg/export.svg";

import {
  approveTimeTrackingEntry,
  getTimeTrackingById
} from "service/timeTrackingApi";
import { getItemFromLocalStorage, getSelectedTabType } from "utilities/getLocalStorageItem";
import { Toast } from "service/toast";
import moment from "moment";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { deleteTimeTrackingEntry } from "service/timeTrackingApi";
import axios from "axios";
import { appURL } from "utilities";
import { downloadBackendExport } from "utilities/backendExport";
import { exportToCSV, exportToExcel, exportToPDF } from "utilities/ExportFunctions";
import { calculateHours as calculateHoursUtil, parseTime, groupEntriesByUserAndDate } from "../../utils/timeCalculations";

// Professional status colors without emojis (matching leave system)
const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "approved":
      return "#2E7D32"; // Professional green
    case "pending":
      return "#F57C00"; // Professional orange
    case "rejected":
      return "#D32F2F"; // Professional red
    case "cancelled":
      return "#616161"; // Professional gray
    default:
      return "#757575";
  }
};

const getStatusBackgroundColor = (status) => {
  switch (status?.toLowerCase()) {
    case "approved":
      return "#E8F5E8";
    case "pending":
      return "#FFF3E0";
    case "rejected":
      return "#FFEBEE";
    case "cancelled":
      return "#F5F5F5";
    default:
      return "#F5F5F5";
  }
};

// Professional status display without emojis
const getStatusDisplay = (status) => {
  switch (status?.toLowerCase()) {
    case "approved":
      return "Approved";
    case "pending":
      return "Pending Approval";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
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
    default:
      return <AccessTimeIcon sx={{ fontSize: 16 }} />;
  }
};
const getStatusChip = (status, userRole, canApprove) => {
  return (
    <Box>
      <Chip
        icon={getStatusIcon(status)}
        label={getStatusDisplay(status)}
        sx={{
          backgroundColor: getStatusBackgroundColor(status),
          color: getStatusColor(status),
          fontWeight: 600,
          fontSize: "0.75rem",
          border: `1px solid ${getStatusColor(status)}`,
          "& .MuiChip-icon": {
            color: getStatusColor(status),
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

const WeeklyTimeEntries = ({
  currentWeek,
  timeEntries,
  companyId,
  userId,
  onRefresh,
  loading: parentLoading,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  totalHours,
  totalMinutes,
  totalTimeEntries,
  page,
  setPage,
  rowsPerPage,
  setRowsPerPage
}) => {
  console.log("timeEentries", timeEntries)
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(false);

  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [approvalAction, setApprovalAction] = useState("");
  const [approvalComments, setApprovalComments] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [entryDetails, setEntryDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const userRoleId = getItemFromLocalStorage("user");
  const currentUserId = userRoleId?._id;
  const [deletingId, setDeletingId] = useState(null);

  // Handle sorting
  const handleSort = (field) => {
    const isAsc = sortField === field && sortOrder === "asc";
    setSortOrder(isAsc ? "desc" : "asc");
    setSortField(field);
  };

  const canDelete = (entry) => {
    if (!entry) return false;
    const type = getSelectedTabType();
    // In myteam/mycompany views, allow delete action for all rows (backend validates permissions)
    return type === 'myteam' || type === 'mycompany';
  };

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

  // Sort data
  const sortedData = [...timeEntries].sort((a, b) => {
    if (!sortField) return 0;
    if (a[sortField] < b[sortField]) return sortOrder === "asc" ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });


  // Export options for the header
  const menuItemsExportOptions = [
    { text: "Export as CSV", format: "csv", icon: ArrowDownwardOutlinedIcon },
    {
      text: "Export as Excel",
      format: "excel",
      icon: ArrowDownwardOutlinedIcon,
    },
    { text: "Export as PDF", format: "pdf", icon: ArrowDownwardOutlinedIcon },
  ];


  const handleExport = async (item) => {
    try {
      const tabType = getSelectedTabType();
      const isManagerView = tabType === "myteam" || tabType === "mycompany";

      const params = {
        companyId,
        userId,
        currentUserId: userId,
        type: tabType,
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
        if (isManagerView && userId) {
          rawData = rawData.filter((entry) => entry.userId !== userId);
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
          Hours: entry.hours || "0h 0m",
          location: entry?.employeeInfo?.location || "",
          Remarks: entry?.Remarks || entry.employeeInfo?.Remarks || "",
          Method: entry.method?.charAt(0).toUpperCase() + entry.method?.slice(1).toLowerCase() || "",
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

  // Professional approval action (matching leave system)
  const handleApprovalAction = (entry, action) => {
    setSelectedEntry(entry);
    setApprovalAction(action);
    setApprovalComments("");
    setRejectionReason("");
    setApprovalDialogOpen(true);
  };

  // Professional approval submission (matching leave system)
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

      // Refresh data
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

  // Professional view details (matching leave system)
  const handleViewDetails = async (entry) => {
    setSelectedEntry(entry);
    setDetailsDialogOpen(true);
    setLoadingDetails(true);

    try {
      const response = await getTimeTrackingById(entry._id, currentUserId);
      setEntryDetails(response);
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

  // Check if user can approve a specific entry
  const canApprove = (entry) => {
    if (!entry) return false;
    return (
      entry.currentApprovers?.some(
        (approver) => approver.approverId === currentUserId
      ) || entry.canApprove
    );
  };

  // Check if user can view details
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

  // Get current approver names for display
  const getCurrentApproversDisplay = (entry) => {
    // Guard clause to handle undefined or null entry
    if (!entry) {
      return "";
    }

    if (!entry.currentApprovers || entry.currentApprovers.length === 0) {
      return entry.currentLevelDisplay || "";
    }

    const approverDetails = entry.currentApprovers
      .map((approver) => {
        const name = approver.approverName || approver.name;
        const role = approver.approverType || approver.role || "Approver";
        return name ? `${name}` : null;
      })
      .filter((detail) => detail)
      .join(", ");

    // Get level information (ensure first level is displayed as Level 1, not Level 0)
    const levelInfo =
      entry.currentLevel || entry.level || entry.approvalLevel || 1;
    // Handle both string and number cases for level 0
    const displayLevel =
      levelInfo === 0 || levelInfo === "0" ? 1 : parseInt(levelInfo) || 1;
    const levelDisplay = `Level ${displayLevel}`;

    return approverDetails
      ? `${levelDisplay}: ${approverDetails}`
      : entry.currentLevelDisplay || "";
  };

  // Table columns definition with employee name
  const columns = [
    {
      id: "employeeInfo",
      label: <Typography fontWeight={600}>Employee</Typography>,
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
          <Typography fontWeight={600}>Day</Typography>
          <SwapVertIcon
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
        if (row.day && row.day.trim() !== "") {
          return row.day;
        }
        if (row.dateString) {
          const m = moment(row.dateString, ["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "M/D/YYYY", "M/D/YY", moment.ISO_8601], true);
          if (m.isValid()) {
            return m.format("dddd");
          }
        }
        return "-";
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
          <Typography fontWeight={600}>Date</Typography>
          <SwapVertIcon
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
          <Typography fontWeight={600}>Time In</Typography>
          <SwapVertIcon style={{ fontSize: 16, color: "#777" }} />
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
          <Typography fontWeight={600}>Time Out</Typography>
          <SwapVertIcon style={{ fontSize: 16, color: "#777" }} />
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
          <Typography fontWeight={600}>Hours</Typography>
          <SwapVertIcon style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
      render: (row) => {
        // Helper to parse time in HH:MM:SS, HH.MM.SS, decimal, and handle AM/PM
        const parseTime = (t) => {
          if (!t) return null;
          let timeStr = t.trim();
          let isPM = false;
          let isAM = false;
          // Handle AM/PM
          if (/am$/i.test(timeStr)) {
            isAM = true;
            timeStr = timeStr.replace(/am$/i, '').trim();
          } else if (/pm$/i.test(timeStr)) {
            isPM = true;
            timeStr = timeStr.replace(/pm$/i, '').trim();
          }
          // Accept both : and . as separators
          let parts = timeStr.includes(':') ? timeStr.split(':') : timeStr.split('.');
          parts = parts.map(Number);
          // If decimal hour (e.g., 14.19)
          if (parts.length === 1 && !isNaN(parts[0])) {
            const num = parts[0];
            const h = Math.floor(num);
            const m = Math.floor((num - h) * 60);
            const s = Math.round((((num - h) * 60) - m) * 60);
            return { h, m, s };
          }
          // If 2 or 3 parts (HH, MM, SS)
          if ((parts.length === 2 || parts.length === 3) && !parts.some(isNaN)) {
            let h = parts[0];
            let m = parts[1] || 0;
            let s = parts[2] || 0;
            // Convert to 24-hour format if AM/PM present
            if (isPM && h < 12) h += 12;
            if (isAM && h === 12) h = 0;
            return { h, m, s };
          }
          return null;
        };
        // If both timeIn and timeOut are present, calculate hours from them
        if (row.timeIn && row.timeOut) {
          const inTime = parseTime(row.timeIn);
          const outTime = parseTime(row.timeOut);
          if (inTime && outTime) {
            // Calculate difference in seconds
            const inSeconds = inTime.h * 3600 + inTime.m * 60 + inTime.s;
            const outSeconds = outTime.h * 3600 + outTime.m * 60 + outTime.s;
            let diff = outSeconds - inSeconds;
            if (diff < 0) diff += 24 * 3600; // handle overnight
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            return `${hours}h ${minutes}m`;
          }
        }
        // Fallback to existing value
        const value = row.hours;
        if (!value || value === "0" || value === 0) return "0h 0m";
        // Handle time format strings (HH:MM:SS or HH.MM.SS)
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
          <Typography fontWeight={600}>Method</Typography>
          <SwapVertIcon style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
      render: (row) => {
        if (!row.method) return "-";
        return row.method.charAt(0).toUpperCase() + row.method.slice(1).toLowerCase();
      },
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
          <Typography fontWeight={600}>Status</Typography>
          <SwapVertIcon style={{ fontSize: 16, color: "#777" }} />
        </Box>
      ),
      sortable: false,
      render: (row) => (
        <Box>
          {getStatusChip(row.status, row.userRole, canApprove(row))}
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
          <Typography fontWeight={600}>Actions</Typography>
        </Box>
      ),
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1} alignItems="center">
          {/* View Details Button */}
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

          {/* Approval Buttons for Approvers */}
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
                Approve
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
                Reject
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

  // Mobile card fields for time tracking
  const mobileFields = [
    {
      key: "employeeInfo",
      label: "Employee",
      render: (value) => (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Avatar sx={{ width: 20, height: 20, mr: 1, bgcolor: "#837F39" }}>
            {value?.name?.charAt(0)?.toUpperCase() || "U"}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={500}>
              {value?.name || "Unknown"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {value?.department || "No Dept"}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      key: "day", label: "Day", render: (value, row) => {
        if (value && value.trim() !== "") {
          return value;
        }
        if (row.dateString) {
          const m = moment(row.dateString, ["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "M/D/YYYY", "M/D/YY", moment.ISO_8601], true);
          if (m.isValid()) {
            return m.format("dddd");
          }
        }
        return "-";
      }
    },
    {
      key: "dateString", label: "Date", render: (value, row) => {
        const dateStr = row.dateString;
        if (!dateStr) return "-";
        const m = moment(dateStr, ["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "M/D/YYYY", "M/D/YY", moment.ISO_8601], true);
        return m.isValid() ? m.format("DD MMM YYYY") : dateStr;
      }
    },
    { key: "timeIn", label: "Time In" },
    { key: "timeOut", label: "Time Out" },
    {
      key: "hours",
      label: "Hours",
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
      },
    },
    { key: "method", label: "Method" },
    {
      key: "status",
      label: "Status",
      render: (value, row) => (
        <Box>
          {getStatusChip(value, null, false)}
          {value === "pending" && getCurrentApproversDisplay(row) && (
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
  ];


  useEffect(() => {
    if (startDate || endDate) {
      console.log('Selected Date Range:', { startDate, endDate });
    }
  }, [startDate, endDate]);

  console.log('WeeklyTimeEntries props:', { startDate, endDate, timeEntries });

  return (
    <>
      <Box
        sx={{
          paddingBottom: isMobile ? "30px" : "70px",
          margin: isMobile ? "1rem .5rem" : "1rem",
          bgcolor: "#fff",
          padding: isMobile ? "10px" : "2rem",
          borderRadius: "1.5rem",
          boxShadow: "0px 0.1px 0px rgba(0,0,0,0.2)",
        }}
      >
        {/* Mobile week display */}
        {isMobile && (
          <Typography
            sx={{
              fontSize: "1rem",
              fontWeight: 500,
              color: "#837F39",
              textAlign: "center",
              marginBottom: "1rem",
            }}
          >
            Week of {startDate} -{" "}
            {endDate}
          </Typography>
        )}

        {/* Responsive: Mobile Card View for Entries */}
        {(isMobile || isTablet) ? (
          <Stack spacing={2}>
            {sortedData.map((entry, idx) => {
              // Determine row highlight color for mobile
              let highlight = null;
              const isTimeMissing = (!entry.timeIn || !entry.timeIn.trim()) && (!entry.timeOut || !entry.timeOut.trim());
              const remarks = (entry.Remarks || entry.reason || '').toLowerCase();
              if (isTimeMissing && remarks === 'holiday') {
                highlight = 'red';
              } else if (isTimeMissing && remarks === 'leave') {
                highlight = 'orange';
              }
              return (
                <Paper key={entry._id || idx} sx={{ p: 2, borderRadius: 2, boxShadow: 1, backgroundColor: highlight === 'red' ? '#ffeaea' : highlight === 'orange' ? '#fff4e5' : undefined }}>
                  <Stack spacing={1}>
                    {mobileFields.map((field) => (
                      <Box key={field.key} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 600, minWidth: 90, fontSize: '0.95rem' }}>{field.label}:</Typography>
                        <Box sx={{ ml: 1, flex: 1 }}>
                          {field.render
                            ? field.render(entry[field.key], entry)
                            : entry[field.key] || '-'}
                        </Box>
                      </Box>
                    ))}
                    {/* Actions */}
                    <Stack direction="row" spacing={1} mt={1}>
                      {canViewDetails(entry) && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleViewDetails(entry)}
                          sx={{ color: "#837F39", borderColor: "#837F39", textTransform: 'none', fontSize: '12px', flex: 1 }}
                        >
                          View
                        </Button>
                      )}
                      {canApprove(entry) && entry.status === "pending" && (
                        <>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleApprovalAction(entry, "approved")}
                            sx={{ backgroundColor: "#2E7D32", textTransform: 'none', fontSize: '12px', flex: 1, '&:hover': { backgroundColor: "#1B5E20" } }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleApprovalAction(entry, "rejected")}
                            sx={{ borderColor: "#D32F2F", color: "#D32F2F", textTransform: 'none', fontSize: '12px', flex: 1, '&:hover': { borderColor: "#B71C1C", backgroundColor: "#ffebee" } }}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        ) : (
          // Tablet/Desktop Table View (as before)
          <>
            {!isMobile && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "2rem",
                }}
              >
                <Box>
                  <Typography
                    sx={{
                      fontSize: "1.5rem",
                      fontWeight: 600,
                      color: "#837F39",
                    }}
                  >
                    Weekly Time Entries
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", mt: 1 }}>
                    <Typography
                      sx={{
                        fontSize: "0.875rem",
                        fontWeight: 400,
                        color: "#555",
                        mt: 1
                      }}
                    >
                      Week: {moment(startDate).format("DD MMM YYYY")}  Start
                    </Typography>

                    <Typography
                      sx={{
                        mt: 1,
                        fontSize: "0.9rem",
                        fontWeight: 400,
                        color: "#555",
                      }}
                    >
                      Week: {moment(endDate).format("DD MMM YYYY")} End
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    backgroundColor: "rgb(131, 127, 57)",
                    padding: "5px 10px",
                    borderRadius: "10px",
                    color: "#fff",
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "1rem",
                      fontWeight: 500,
                      color: "#fff",
                    }}
                  >
                    Total Hours: {`${totalHours}h:${totalMinutes}m`}
                  </Typography>
                </Box>
              </Box>
            )}

            {(loading || parentLoading) && (
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
            {!loading && !parentLoading && (
              <>
                {
                  <>
                    {isMobile ? (
                      // Mobile Layout
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "1rem",
                        }}
                      >
                        {timeEntries.map((row, index) => (
                          <MobileLeaveCard
                            key={row._id || index}
                            row={row}
                            fields={mobileFields}
                            onViewDetails={
                              canViewDetails(row)
                                ? () => handleViewDetails(row)
                                : null
                            }
                            onApprove={
                              canApprove(row) && row.status === "pending"
                                ? () => handleApprovalAction(row, "approved")
                                : null
                            }
                            onReject={
                              canApprove(row) && row.status === "pending"
                                ? () => handleApprovalAction(row, "rejected")
                                : null
                            }
                            canApprove={canApprove(row) && row.status === "pending"}
                            canViewDetails={canViewDetails(row)}
                            currentUserId={currentUserId}
                          />
                        ))}
                      </Box>
                    ) : (
                      // Desktop Layout
                      <CustomTable
                        columns={columns}
                        data={timeEntries}
                        page={page}
                        setPage={setPage}
                        rowsPerPage={rowsPerPage}
                        setRowsPerPage={setRowsPerPage}
                        totalPages={Math.ceil(totalTimeEntries / rowsPerPage)}
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
                }
              </>
            )}
          </>
        )}
      </Box>

      {/* Professional Approval Dialog (matching leave system) */}
      <Dialog
        open={approvalDialogOpen}
        onClose={() => setApprovalDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: theme.shadows[10],
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#837F39",
            color: "white",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
          }}
        >
          {approvalAction === "approved" ? (
            <CheckCircleIcon sx={{ mr: 1 }} />
          ) : (
            <CancelIcon sx={{ mr: 1 }} />
          )}
          {approvalAction === "approved"
            ? "Approve Time Entry"
            : "Reject Time Entry"}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedEntry && (
            <Paper sx={{ p: 3, mb: 3, bgcolor: "grey.50" }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                Time Entry Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Employee
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedEntry.employeeInfo?.name || "Unknown User"}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Department
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedEntry.employeeInfo?.department || "No Department"}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Date
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedEntry.dateString} ({selectedEntry.day})
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Method
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedEntry.method || "Manual"}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Time In
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedEntry.timeIn}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Time Out
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedEntry.timeOut}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Hours
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {(() => {
                      const value = selectedEntry.hours;
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
                    })()}
                  </Typography>
                </Grid>
                {selectedEntry.reason && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Reason
                    </Typography>
                    <Typography
                      variant="body1"
                      fontWeight={500}
                      sx={{
                        backgroundColor: "#fff9c4",
                        padding: "2px 4px",
                        borderRadius: "4px",
                      }}
                    >
                      {selectedEntry.reason}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          )}

          <TextField
            fullWidth
            label="Comments (Optional)"
            multiline
            rows={3}
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="Add any comments regarding this decision..."
          />

          {approvalAction === "rejected" && (
            <TextField
              fullWidth
              label="Rejection Reason *"
              multiline
              rows={2}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
              error={!rejectionReason.trim()}
              helperText={
                !rejectionReason.trim()
                  ? "Please provide a reason for rejection"
                  : ""
              }
              placeholder="Please specify the reason for rejecting this time entry..."
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, bgcolor: "grey.50" }}>
          <Button
            onClick={() => setApprovalDialogOpen(false)}
            disabled={submittingApproval}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={submitApproval}
            disabled={
              submittingApproval ||
              (approvalAction === "rejected" && !rejectionReason.trim())
            }
            variant="contained"
            sx={{
              textTransform: "none",
              fontWeight: 600,
              minWidth: 120,
              backgroundColor: "#837F39",
              "&:hover": { backgroundColor: "#6f6b2f" },
            }}
            startIcon={submittingApproval && <CircularProgress size={20} />}
          >
            {submittingApproval
              ? "Processing..."
              : approvalAction === "approved"
                ? "Approve Entry"
                : "Reject Entry"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Professional Time Entry Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: theme.shadows[10],
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#837F39",
            color: "white",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
          }}
        >
          <VisibilityIcon sx={{ mr: 1 }} />
          Time Entry Details
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {loadingDetails ? (
            <Box display="flex" justifyContent="center" p={6}>
              <CircularProgress />
            </Box>
          ) : entryDetails ? (
            <TimeEntryDetailsView entryDetails={entryDetails} />
          ) : (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                Failed to load time entry details
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, bgcolor: "grey.50" }}>
          <Button
            onClick={() => setDetailsDialogOpen(false)}
            variant="contained"
            sx={{
              textTransform: "none",
              backgroundColor: "#837F39",
              "&:hover": { backgroundColor: "#6f6b2f" },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Simple and clean time entry details component
const TimeEntryDetailsView = ({ entryDetails }) => {
  const theme = useTheme();

  if (!entryDetails) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography variant="body1" color="text.secondary">
          No details available
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Employee Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          mb: 3,
          pb: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Avatar
          sx={{
            width: 56,
            height: 56,
            mr: 2,
            bgcolor: "#837F39",
            fontSize: "1.5rem",
            fontWeight: 600,
          }}
        >
          {entryDetails.employeeInfo?.name?.charAt(0)?.toUpperCase() || "U"}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={600} color="text.primary">
            {entryDetails.employeeInfo?.name || "Unknown User"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {entryDetails.employeeInfo?.department || "No Department"}
          </Typography>
          <Box sx={{ mt: 1 }}>{getStatusChip(entryDetails.status)}</Box>
        </Box>
      </Box>

      {/* Time Entry Details Grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography
            variant="h6"
            fontWeight={600}
            color="text.primary"
            gutterBottom
          >
            Time Information
          </Typography>
          <Paper sx={{ p: 2, bgcolor: "grey.50" }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Day
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {entryDetails.day || "N/A"}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Date
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {entryDetails.dateString || "N/A"}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Time In
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {entryDetails.timeIn || "N/A"}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Time Out
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {entryDetails.timeOut || "N/A"}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Hours
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {entryDetails.hours && typeof entryDetails.hours === "string"
                    ? (() => {
                      const parts = entryDetails.hours.split(":").map(Number);
                      if (parts.length === 3 && !parts.some(isNaN)) {
                        const [hh, mm, ss] = parts;
                        return `${hh}h ${mm}m ${ss}s`;
                      } else if (!isNaN(Number(entryDetails?.hours))) {
                        return `${Number(entryDetails?.hours).toFixed(2)}h`;
                      }

                      return entryDetails.hours;
                    })()
                    : "0h 0m 0s"}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Method
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {entryDetails.method || "Manual"}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Workflow Information */}
        <Grid item xs={12} md={6}>
          <Typography
            variant="h6"
            fontWeight={600}
            color="text.primary"
            gutterBottom
          >
            Workflow Status
          </Typography>
          <Paper sx={{ p: 2, bgcolor: "grey.50" }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Current Status
                </Typography>
                <Box sx={{ mt: 1 }}>{getStatusChip(entryDetails.status)}</Box>
              </Grid>
              {entryDetails.currentLevelDisplay && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Current Level
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {entryDetails.currentLevelDisplay}
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {entryDetails.createdAt
                    ? moment(entryDetails.createdAt).format(
                      "MMM DD, YYYY HH:mm"
                    )
                    : "N/A"}
                </Typography>
              </Grid>
              {entryDetails.finalApprovalDate && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Final Approval
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {moment(entryDetails.finalApprovalDate).format(
                      "MMM DD, YYYY HH:mm"
                    )}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Reason */}
        {entryDetails.reason && (
          <Grid item xs={12}>
            <Typography
              variant="h6"
              fontWeight={600}
              color="text.primary"
              gutterBottom
            >
              Reason
            </Typography>
            <Paper sx={{ p: 2, bgcolor: "grey.50" }}>
              <Typography variant="body1">{entryDetails.reason}</Typography>
            </Paper>
          </Grid>
        )}

        {/* Approval History */}
        {entryDetails.approvalHistory &&
          entryDetails.approvalHistory.length > 0 && (
            <Grid item xs={12}>
              <Typography
                variant="h6"
                fontWeight={600}
                color="text.primary"
                gutterBottom
              >
                Approval History
              </Typography>
              <Paper sx={{ p: 2, bgcolor: "grey.50" }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {entryDetails.approvalHistory.map((history, index) => (
                    <Box
                      key={index}
                      sx={{
                        p: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", mb: 1 }}
                      >
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            mr: 2,
                            bgcolor: "#837F39",
                          }}
                        >
                          {history.approverName?.charAt(0)?.toUpperCase() ||
                            "A"}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body1" fontWeight={500}>
                            {history.approverName} ({history.approverType})
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {moment(history.timestamp).format(
                              "MMM DD, YYYY HH:mm"
                            )}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          {getStatusChip(history.action)}
                        </Box>
                      </Box>
                      {history.comments && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          <strong>Comments:</strong> {history.comments}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          )}
      </Grid>
    </Box>
  );
};

export default WeeklyTimeEntries;
