import React, { useState, useEffect } from "react";
import { 
  Box, 
  Typography, 
  IconButton, 
  Button, 
  useTheme, 
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  CircularProgress,
  Alert,
  Grid,
  Paper,
  Avatar,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import InfiniteScroll from "react-infinite-scroll-component";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import BlockIcon from "@mui/icons-material/Block";
import CustomTable from "../../../../components/CustomTable/index";
import axios from "axios";
import { Toast } from "service/toast";
import { appURL } from "utilities";
import moment from "moment";
import ActionDropdown from "pages/vihanga/components/ActionDropdown/ActionDropdown";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import { getItemFromLocalStorage } from "utilities/getLocalStorageItem";
import { getThemeColors } from "utilities/getThemeColors";
import { getSelectedTabType } from "utilities/getLocalStorageItem";
import ArrowDownwardOutlinedIcon from "../../../../../../assets/svg/export.svg";
import MobileLeaveCard from "../../../../components/MobileLeaveCard/MobileLeaveCard";
import { useTranslation } from "react-i18next";
import { canEdit, canDelete } from "utilities/privilegeHelper";
import {
  downloadBackendExport,
  buildLeaveExportParams,
} from "utilities/backendExport";
import { exportToPDF } from "utilities/ExportFunctions";

const formatLocalYMD = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Rolling window: last 30 calendar days including today */
const getDefault30DayRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    startDate: formatLocalYMD(start),
    endDate: formatLocalYMD(end),
  };
};

const getDefaultLeaveStatusFilter = () =>
  String(getSelectedTabType() || "")
    .toLowerCase()
    .trim() === "me"
    ? "all"
    : "pending";

// Professional status colors without emojis
const getStatusColor = (status) => {
  switch (status) {
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
  switch (status) {
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
  switch (status) {
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
  switch (status) {
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

const LeaveTable = ({ onEdit, refreshTable, viewMode = "auto" }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPageForInfiniteScroll, setCurrentPageForInfiniteScroll] = useState(0);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const {t} = useTranslation();
  
  // Date filter: default last 30 days; status default depends on selected tab (localStorage selectedTab)
  const [startDate, setStartDate] = useState(() => getDefault30DayRange().startDate);
  const [endDate, setEndDate] = useState(() => getDefault30DayRange().endDate);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState(getDefaultLeaveStatusFilter);
  const [exporting, setExporting] = useState(false);
  
  // Professional approval modal states
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [approvalAction, setApprovalAction] = useState("");
  const [approvalComments, setApprovalComments] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);
  
  // Professional details modal states
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [leaveDetails, setLeaveDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const userRoleId = getItemFromLocalStorage("user");
  const currentUserId = userRoleId?._id;

  // Privilege checks - automatically detects current page from route
  const hasEditPrivilege = canEdit();
  const hasDeletePrivilege = canDelete();

const companyId = getItemFromLocalStorage("companyId");

  const { secondaryColors } = getThemeColors();

  const fetchData = async (append = false, nextPage = null) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      // Get user role to determine what data to fetch
      const userRole = userRoleId?.employmentInformation?.role;
      const isEmployee = userRole === "Employee";
      const isManager = ["Manager", "Line Manager"].includes(userRole);
      const isHR = ["HR Admin", "HR Manager"].includes(userRole);
      const isSuperAdmin = userRole === "Super Admin";

      // Use nextPage if provided (for infinite scroll), otherwise use current page
      const currentPage = append && nextPage !== null ? nextPage : page;

      // Build parameters based on viewMode prop or user role
      let apiParams = {
        page: currentPage + 1,
        limit: rowsPerPage,
        search,
        companyId,
        currentUserId, // Always send current user ID for role-based filtering
        ...filters,
        type: getSelectedTabType(),
      };

      // Always include date range - if not set, use default 30-day window
      if (startDate && endDate) {
        apiParams.startDate = startDate;
        apiParams.endDate = endDate;
      } else {
        const range = getDefault30DayRange();
        apiParams.startDate = range.startDate;
        apiParams.endDate = range.endDate;
      }

      if (leaveStatusFilter && leaveStatusFilter !== "all") {
        apiParams.status = leaveStatusFilter;
      }

      // Determine view type based on prop or role
      let effectiveViewMode = viewMode;
      if (viewMode === "auto") {
        if (isEmployee) {
          effectiveViewMode = "employee";
        } else if (isManager) {
          effectiveViewMode = "manager";
        } else if (isHR || isSuperAdmin) {
          effectiveViewMode = "admin";
        } else {
          effectiveViewMode = "employee";
        }
      }

      // Role-based parameter logic
      if (effectiveViewMode === "employee") {
        // Show only user's own leaves
        apiParams.empId = currentUserId;
      } else if (effectiveViewMode === "manager") {
        // Show leaves that need manager's approval
        apiParams.viewType = "pending-approvals";
      } else if (effectiveViewMode === "admin") {
        // Show all company leaves
        apiParams.viewType = "all-leaves";
      }

      const response = await axios.get(`${appURL}/recruitment/leaves`, {
        params: apiParams,
      });
      
      const responseData = response.data?.data?.data || [];
      const responseTotalPages = response?.data?.data?.totalPages || 1;
      
      if (append) {
        // Append new data to existing data
        setData(prev => [...prev, ...responseData]);
        // Update internal page counter for infinite scroll
        setCurrentPageForInfiniteScroll(currentPage);
      } else {
        // Replace data on initial load or refresh
        setData(responseData);
        setCurrentPageForInfiniteScroll(0);
      }
      
      setTotalPages(responseTotalPages);
      
      // Check if there's more data to load
      setHasMore(currentPage + 1 < responseTotalPages);
    } catch (err) {
      console.error("Fetch Error:", err);
      setError(err.response?.data?.message || "Failed to fetch data");
      if (!append) {
        Toast({
          message: err.response?.data?.message || "Failed to fetch data",
          type: "error",
        });
      }
      setHasMore(false);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Load more data for infinite scroll
  const loadMoreData = async () => {
    if (loadingMore || !hasMore || loading) return;
    const nextPage = currentPageForInfiniteScroll + 1;
    await fetchData(true, nextPage);
  };

  const fetchLeaveDetails = async (leaveId) => {
    setLoadingDetails(true);
    try {
      const response = await axios.get(`${appURL}/recruitment/leaves`, {
        params: {
          id: leaveId,
          currentUserId,
          type: getSelectedTabType(),
        }
      });
      setLeaveDetails(response.data?.data || null);
    } catch (err) {
      console.error("Fetch Details Error:", err);
      Toast({
        message: err.response?.data?.message || "Failed to fetch leave details",
        type: "error",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDelete = async (row) => {
    setLoading(true);
    try {
      await axios.delete(`${appURL}/recruitment/leaves?id=${row._id}`);
      Toast({
        message: "Leave request deleted successfully",
        type: "success",
      });
      fetchData();
    } catch (err) {
      console.error("Delete Error:", err);
      Toast({
        message: err.response?.data?.message || "Failed to delete leave request",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = (leave, action) => {
    setSelectedLeave(leave);
    setApprovalAction(action);
    setApprovalComments("");
    setRejectionReason("");
    setApprovalDialogOpen(true);
  };

  const handleViewDetails = (leave) => {
    setSelectedLeave(leave);
    setDetailsDialogOpen(true);
    fetchLeaveDetails(leave._id);
  };

  const submitApproval = async () => {
    if (!selectedLeave || !approvalAction) return;

    setSubmittingApproval(true);
    try {
      const response = await axios.post(`${appURL}/recruitment/approve-leave?id=${selectedLeave._id}`, {
        approverId: currentUserId,
        action: approvalAction,
        comments: approvalComments,
        rejectionReason: approvalAction === 'rejected' ? rejectionReason : undefined
      });

      Toast({
        message: response.data?.message || `Leave request ${approvalAction} successfully`,
        type: "success",
      });

      setApprovalDialogOpen(false);
      fetchData(); // Refresh the data
    } catch (err) {
      console.error("Approval Error:", err);
      Toast({
        message: err.response?.data?.message || `Failed to ${approvalAction} leave request`,
        type: "error",
      });
    } finally {
      setSubmittingApproval(false);
    }
  };

  useEffect(() => {
    // Reset page and hasMore when filters change
    setPage(0);
    setCurrentPageForInfiniteScroll(0);
    setHasMore(true);
    fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsPerPage, search, filters, refreshTable, startDate, endDate, leaveStatusFilter]);

  // Handle page change for desktop pagination (only for desktop, not mobile infinite scroll)
  useEffect(() => {
    // Only fetch if page changed and it's not from infinite scroll
    if (page > 0 && !loadingMore) {
      fetchData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Reset data when switching from mobile to desktop to prevent showing accumulated data
  useEffect(() => {
    if (!isMobile && data.length > rowsPerPage) {
      // If switching to desktop and we have more data than one page, reset to current page
      fetchData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  const sortedData = [...data].sort((a, b) => {
    if (!sortField) return 0;
    const aValue = a[sortField] || "";
    const bValue = b[sortField] || "";
    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });
  // Check if user can approve a specific leave
  const canApprove = (leave) => {
    return leave.currentApprovers?.some(
      approver => approver.approverId === currentUserId
    );
  };

  // Check if user can view details
  const canViewDetails = (leave) => {
    return leave.empId === currentUserId || 
           canApprove(leave) || 
           leave.approvalHistory?.some(h => h.approverId === currentUserId);
  };

  const columns = [
    {
      id: "from",
      sortable: true,
      label: <Typography fontWeight={600}>{t("AbsenceTime.tableColumn.date")}</Typography>,
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {row.from && row.to
              ? `${moment(row.from).format("MMM DD")} - ${moment(row.to).format("MMM DD, YYYY")}`
              : "Not specified"}
          </Typography>
        </Box>
      ),
    },
    {
      id: "employeeInfo",
      label: <Typography fontWeight={600}>{t("AbsenceTime.tableColumn.employee")}</Typography>,
      sortable: true,
      render: (row) => (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Avatar sx={{ width: 32, height: 32, mr: 1.5, bgcolor: '#837F39' }}>
            {row.employeeInfo?.name?.charAt(0)?.toUpperCase() || 'U'}
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
      id: "absenceType",
      label: <Typography fontWeight={600}>{t("AbsenceTime.tableColumn.type")}</Typography>,
      sortable: true,
      render: (row) => (
        <Chip
          label={row.absenceType || "Not specified"}
          variant="outlined"
          size="small"
          sx={{ 
            borderColor: '#837F39',
            color: '#837F39',
            fontWeight: 500
          }}
        />
      ),
    },
    {
      id: "durationOfAbsence",
      sortable: true,
      label: <Typography fontWeight={600}>{t("AbsenceTime.tableColumn.duration")}</Typography>,
      render: (row) => (
        <Typography variant="body2" fontWeight={500}>
          {row.durationOfAbsence ? `${row.durationOfAbsence} day${row.durationOfAbsence > 1 ? 's' : ''}` : 'N/A'}
        </Typography>
      ),
    },
    {
      id: "status",
      sortable: true,
      label: <Typography fontWeight={600}>{t("AbsenceTime.tableColumn.status")}</Typography>,
      render: (row) => (
        <Box>
          <Chip
            icon={getStatusIcon(row.status)}
            label={getStatusDisplay(row.status)}
            sx={{
              backgroundColor: getStatusBackgroundColor(row.status),
              color: getStatusColor(row.status),
              fontWeight: 600,
              fontSize: "0.75rem",
              border: `1px solid ${getStatusColor(row.status)}`,
              '& .MuiChip-icon': {
                color: getStatusColor(row.status)
              }
            }}
            size="small"
          />
          {row.status === 'pending' && row.currentLevelDisplay && (
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              {row.currentLevelDisplay}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: "action",
      label: <Typography fontWeight={600}>{t("AbsenceTime.tableColumn.action")}</Typography>,
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1} alignItems="center">
          {/* View Details Button */}
          {canViewDetails(row) && (
            <IconButton
              size="small"
              onClick={() => handleViewDetails(row)}
              sx={{ 
                color: '#837F39',
                '&:hover': { backgroundColor: '#837F39' + '20' }
              }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          )}
          
          {/* Approval Buttons for Approvers */}
          {canApprove(row) && row.status === 'pending' && (
            <>
              <Button
                size="small"
                variant="contained"
                startIcon={<CheckCircleIcon />}
                onClick={() => handleApprovalAction(row, 'approved')}
                sx={{ 
                  minWidth: 90,
                  backgroundColor: "#2E7D32",
                  '&:hover': { backgroundColor: "#1B5E20" },
                  textTransform: "none",
                  fontWeight: 500
                }}
              >
                {t("AbsenceTime.approve")}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={() => handleApprovalAction(row, 'rejected')}
                sx={{ 
                  minWidth: 80,
                  borderColor: "#D32F2F",
                  color: "#D32F2F",
                  '&:hover': { 
                    borderColor: "#B71C1C",
                    backgroundColor: "#FFEBEE" 
                  },
                  textTransform: "none",
                  fontWeight: 500
                }}
              >
                 {t("AbsenceTime.reject")}
              </Button>
            </>
          )}
          
          {/* Edit/Delete for Owner - with privilege checks */}
          {(hasEditPrivilege || hasDeletePrivilege) && (
            <ActionDropdown
              row={row}
              actions={[
                ...(row.status === 'pending' && hasEditPrivilege ? [{
                  label: t("AbsenceTime.editRequest"),
                  icon: <BorderColorIcon fontSize="small" />,
                  onClick: onEdit,
                }] : []),
                ...(hasDeletePrivilege ? [{
                  label: t("AbsenceTime.deleteRequest"),
                  icon: <DeleteIcon fontSize="small" />,
                  onClick: handleDelete,
                }] : []),
              ]}
            />
          )}
        </Stack>
      ),
    },
  ];

  const menuItemsExportOptions = [
    { text: t("Export as CSV"),format: "csv", icon: ArrowDownwardOutlinedIcon },
    {
      text: t("Export as Excel"),
      format: "excel",
      icon: ArrowDownwardOutlinedIcon,
    },
    { text: t("Export as PDF"),format: "pdf", icon: ArrowDownwardOutlinedIcon },
  ];

  const buildExportParams = (exportStartDate, exportEndDate) => {
    let actualStartDate = exportStartDate;
    let actualEndDate = exportEndDate;

    if (!actualStartDate || !actualEndDate) {
      if (startDate && endDate) {
        actualStartDate = startDate;
        actualEndDate = endDate;
      } else {
        const range = getDefault30DayRange();
        actualStartDate = range.startDate;
        actualEndDate = range.endDate;
      }
    }

    const userRole = userRoleId?.employmentInformation?.role;
    return buildLeaveExportParams({
      companyId,
      currentUserId,
      type: getSelectedTabType(),
      search,
      startDate: actualStartDate,
      endDate: actualEndDate,
      status: leaveStatusFilter,
      viewMode,
      userRole,
    });
  };

  const fetchLeavesForPdfExport = async (exportParams) => {
    const response = await axios.get(`${appURL}/recruitment/leaves`, {
      params: { ...exportParams, page: 1, limit: 50000 },
    });
    return response.data?.data?.data || [];
  };

  const mapLeavesToExportRows = (leaves) =>
    leaves.map((leave) => ({
      "Employee ID": leave.employeeInfo?.employeeNumber || leave.empId || "N/A",
      "Employee Name": leave.employeeInfo?.name || "N/A",
      "Department": leave.employeeInfo?.department || "N/A",
      "Leave Type": leave.absenceType || "N/A",
      "Leave From Date": leave.from ? new Date(leave.from).toLocaleDateString() : "N/A",
      "Leave To Date": leave.to ? new Date(leave.to).toLocaleDateString() : "N/A",
      Duration: leave.durationOfAbsence || "N/A",
      Status: leave.status || "N/A",
      "Pending With":
        leave.status === "pending" && leave.currentApprovers?.length
          ? leave.currentApprovers.map((a) => a.approverName || a.approverId).join(", ")
          : "N/A",
    }));

  // Export with same filters as the table view
  const handleExportWithDateFilter = async (exportStartDate = null, exportEndDate = null, format = "excel") => {
    setExporting(true);
    try {
      const exportParams = buildExportParams(exportStartDate, exportEndDate);

      if (format === "pdf") {
        const leaves = await fetchLeavesForPdfExport(exportParams);
        if (!leaves.length) {
          Toast({ message: "No leave records found for the selected filters.", type: "warning" });
          return;
        }
        exportToPDF(mapLeavesToExportRows(leaves));
        Toast({
          message: `Leave records exported successfully. ${leaves.length} records exported.`,
          type: "success",
        });
        return;
      }

      await downloadBackendExport({
        module: "leaves",
        params: exportParams,
        format,
        filename: `leave-records-export-${new Date().toISOString().split("T")[0]}`,
      });

      Toast({
        message: "Leave records exported successfully.",
        type: "success",
      });
    } catch (err) {
      console.error("Export error:", err);
      Toast({
        message: err.response?.data?.message || "Failed to export leave records. Please try again.",
        type: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExport = async (item) => {
    await handleExportWithDateFilter(startDate, endDate, item?.format || "excel");
  };

  return (
    <Box sx={{ bgcolor: secondaryColors.white, minHeight: '100vh' }}>
      {/* Desktop/Tablet View */}
      {!isMobile && (
        <CustomTable
          columns={columns}
          data={sortedData}
          loading={loading}
          error={error}
          totalPages={totalPages}
          page={page}
          rowsPerPage={rowsPerPage}
          setPage={setPage}
          setRowsPerPage={setRowsPerPage}
          setSearch={setSearch}
          setFilters={setFilters}
          searchPlaceholder="Search leave requests..."
          menuItemsExportOptions={menuItemsExportOptions}
          onExport={handleExport}
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          leaveStatusFilter={leaveStatusFilter}
          setLeaveStatusFilter={setLeaveStatusFilter}
        />
      )}

      {/* Mobile View */}
      {isMobile && (
        <Box sx={{ p: 2 }}>
          {/* Date Filter for Mobile */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid #837F39',
            borderRadius: '24px',
            background: '#FEFEFE',
            px: 2,
            py: 1,
            mb: 2,
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'center'
          }}>
            <input
              type="date"
              value={startDate || ''}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 14,
                fontFamily: 'Work Sans',
                color: '#0E0E0E',
                padding: '4px',
                borderRadius: 4,
                minWidth: 100
              }}
            />
            <span style={{ color: '#837F39', fontWeight: 600, fontSize: 14 }}>to</span>
            <input
              type="date"
              value={endDate || ''}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 14,
                fontFamily: 'Work Sans',
                color: '#0E0E0E',
                padding: '4px',
                borderRadius: 4,
                minWidth: 100
              }}
            />
          </Box>

          <FormControl
            size="small"
            fullWidth
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": { borderRadius: "24px", background: "#FEFEFE" },
            }}
          >
            <InputLabel id="leave-status-mob">{t("AbsenceTime.tableColumn.status")}</InputLabel>
            <Select
              labelId="leave-status-mob"
              label={t("AbsenceTime.tableColumn.status")}
              value={leaveStatusFilter || "all"}
              onChange={(e) => setLeaveStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </Select>
          </FormControl>
          
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <InfiniteScroll
              dataLength={sortedData.length}
              next={loadMoreData}
              hasMore={hasMore}
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
              <Stack spacing={2}>
                {sortedData.map((row, index) => (
                  <MobileLeaveCard
                    key={row._id || index}
                    leave={row}
                    onEdit={onEdit}
                    onDelete={handleDelete}
                    onViewDetails={handleViewDetails}
                    onApprove={canApprove(row) ? () => handleApprovalAction(row, 'approved') : null}
                    onReject={canApprove(row) ? () => handleApprovalAction(row, 'rejected') : null}
                    canApprove={canApprove(row)}
                    canEdit={row.empId === currentUserId && row.status === 'pending' && hasEditPrivilege}
                    canDelete={row.empId === currentUserId && hasDeletePrivilege}
                    canViewDetails={canViewDetails(row)}
                  />
                ))}
              </Stack>
            </InfiniteScroll>
          )}
        </Box>
      )}

      {/* Professional Approval Dialog */}
      <Dialog
        open={approvalDialogOpen}
        onClose={() => setApprovalDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: theme.shadows[10]
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#837F39',
          color: 'white',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center'
        }}>
          {approvalAction === 'approved' ? (
            <CheckCircleIcon sx={{ mr: 1 }} />
          ) : (
            <CancelIcon sx={{ mr: 1 }} />
          )}
          {approvalAction === 'approved' ? t("AbsenceTime.requests.approveLeave") : t("AbsenceTime.requests.rejectLeave") }
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedLeave && (
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
              <Typography variant="h6" gutterBottom fontWeight={600}>
                {t("AbsenceTime.requests.details") }
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">{t("AbsenceTime.tableColumn.employee")}</Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedLeave.employeeInfo?.name}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">{t("AbsenceTime.leaveDetailsView.leaveType")}</Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedLeave.absenceType}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">{t("AbsenceTime.leaveDetailsView.duration")}</Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedLeave.durationOfAbsence} day{selectedLeave.durationOfAbsence > 1 ? 's' : ''}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">{t("AbsenceTime.period")}</Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {moment(selectedLeave.from).format("MMM DD")} - {moment(selectedLeave.to).format("MMM DD, YYYY")}
                  </Typography>
                </Grid>
                {selectedLeave.note && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">{t("AbsenceTime.reasons.reason")}</Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {selectedLeave.note}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          )}
          
          <TextField
            fullWidth
            label={t("AbsenceTime.Comments(Optional)")}
            multiline
            rows={3}
            value={approvalComments}
            onChange={(e) => setApprovalComments(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="Add any comments regarding this decision..."
          />
          
          {approvalAction === 'rejected' && (
            <TextField
              fullWidth
              label={t("AbsenceTime.RejectionReason")}
              multiline
              rows={2}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
              error={!rejectionReason.trim()}
              helperText={!rejectionReason.trim() ? "Please provide a reason for rejection" : ""}
              placeholder="Please specify the reason for rejecting this leave request..."
            />
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, bgcolor: 'grey.50' }}>
          <Button 
            onClick={() => setApprovalDialogOpen(false)}
            disabled={submittingApproval}
            sx={{ textTransform: 'none' }}
          >
            {t("AbsenceTime.buttonConfg.cancel")}
          </Button>
          <Button
            onClick={submitApproval}
            disabled={submittingApproval || (approvalAction === 'rejected' && !rejectionReason.trim())}
            variant="contained"
            sx={{ 
              textTransform: 'none',
              fontWeight: 600,
              minWidth: 120,
              backgroundColor: '#837F39',
              '&:hover': { backgroundColor: '#6f6b2f' }
            }}
            startIcon={submittingApproval && <CircularProgress size={20} />}
          >
            {submittingApproval ? 'Processing...' : (approvalAction === 'approved' ? t("AbsenceTime.approveRequest") : t("AbsenceTime.rejectRequest"))}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Professional Leave Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: theme.shadows[10]
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: '#837F39',
          color: 'white',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center'
        }}>
          <VisibilityIcon sx={{ mr: 1 }} />
          {t("AbsenceTime.DialogBox.title")}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {loadingDetails ? (
            <Box display="flex" justifyContent="center" p={6}>
              <CircularProgress />
            </Box>
          ) : leaveDetails ? (
            <LeaveDetailsView leaveDetails={leaveDetails?.data?.[0]} />
          ) : (
            <Alert severity="error" sx={{ m: 3 }}>
              {t("AbsenceTime.DialogBox.alert")}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, bgcolor: 'grey.50' }}>
          <Button 
            onClick={() => setDetailsDialogOpen(false)}
            variant="contained"
            sx={{ 
              textTransform: 'none',
              backgroundColor: '#837F39',
              '&:hover': { backgroundColor: '#6f6b2f' }
            }}
          >
            {t("AbsenceTime.close")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Simple and clean leave details component
const LeaveDetailsView = ({ leaveDetails }) => {
  const {t} = useTranslation();
  
  if (!leaveDetails) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          {t("AbsenceTime.noDetails")}
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Employee Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
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
          {leaveDetails.employeeInfo?.name?.charAt(0)?.toUpperCase() || 'U'}
        </Avatar>

        
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={600} color="text.primary">
            {leaveDetails.employeeInfo?.name || "Unknown User"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {leaveDetails.employeeInfo?.department || "No Department"}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Chip
              icon={getStatusIcon(leaveDetails.status)}
              label={getStatusDisplay(leaveDetails.status)}
              sx={{
                backgroundColor: getStatusBackgroundColor(leaveDetails.status),
                color: getStatusColor(leaveDetails.status),
                fontWeight: 600,
                fontSize: "0.75rem",
                border: `1px solid ${getStatusColor(leaveDetails.status)}`,
                '& .MuiChip-icon': {
                  color: getStatusColor(leaveDetails.status)
                }
              }}
              size="small"
            />
            {leaveDetails.isUrgent && (
              <Chip
                label="URGENT"
                color="error"
                size="small"
                sx={{ ml: 1, fontWeight: 600 }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Leave Details Grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {t("AbsenceTime.leaveDetailsView.leaveType")}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {leaveDetails.absenceType || "Not specified"}
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {t("AbsenceTime.leaveDetailsView.duration")}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {leaveDetails.durationOfAbsence ? `${leaveDetails.durationOfAbsence} day${leaveDetails.durationOfAbsence > 1 ? 's' : ''}` : 'Not specified'}
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
               {t("AbsenceTime.leaveDetailsView.startDate")}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {leaveDetails.from ? moment(leaveDetails.from).format("MMM DD, YYYY") : "Not specified"}
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
               {t("AbsenceTime.leaveDetailsView.endDate")}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {leaveDetails.to ? moment(leaveDetails.to).format("MMM DD, YYYY") : "Not specified"}
            </Typography>
          </Box>
        </Grid>
        
        <Grid item xs={12} sm={6}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
               {t("AbsenceTime.leaveDetailsView.applicationOn")}
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {leaveDetails.createdAt ? moment(leaveDetails.createdAt).format("MMM DD, YYYY") : "Not specified"}
            </Typography>
          </Box>
        </Grid>
        
        {leaveDetails.halfDay && (
          <Grid item xs={12} sm={6}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500}>
               {t("AbsenceTime.formLabel.halfDay")}
              </Typography>
              <Chip
                label="Yes"
                color="info"
                size="small"
                sx={{ fontWeight: 600 }}
              />
            </Box>
          </Grid>
        )}
        
        {leaveDetails.note && (
          <Grid item xs={12}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={500} mb={1}>
                {t("AbsenceTime.reasons.reason")}
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body1">
                  {leaveDetails.note}
                </Typography>
              </Paper>
            </Box>
          </Grid>
        )}
        
        {leaveDetails.rejectionReason && (
          <Grid item xs={12}>
            <Alert severity="error" sx={{ mt: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                {t("AbsenceTime.reasons.rejectionReason")}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {leaveDetails.rejectionReason}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ mt: 1.5 }}>
                {t("AbsenceTime.Comments")}:
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {(() => {
                  const rejectedHistory = leaveDetails.approvalHistory?.find(
                    (history) => history.action === "rejected"
                  );
                  const comments = rejectedHistory?.comments;
                  return comments && comments.trim() ? comments : t("AbsenceTime.noComments");
                })()}
              </Typography>
            </Alert>
          </Grid>
        )}
      </Grid>

      {/* Current Approval Status */}
      {leaveDetails.status === 'pending' && leaveDetails.currentLevelDisplay && (
        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500} mb={1}>
            {t("AbsenceTime.approvalStatus")}
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
            <Typography variant="body1" color="warning.dark" fontWeight={600}>
              {leaveDetails.currentLevelDisplay}
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default LeaveTable;
