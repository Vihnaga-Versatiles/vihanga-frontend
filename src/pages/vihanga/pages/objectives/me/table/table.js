import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Typography,
  Box,
  Button,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material";
import InfiniteScroll from "react-infinite-scroll-component";

// Removed Checkbox, FormatListBulletedIcon, CheckIcon imports
import DeleteIcon from "@mui/icons-material/Delete";
import BorderColorIcon from "@mui/icons-material/BorderColor";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import messageIcon from "../../../../../../assets/svg/messageIcon.svg";
import addButtonIcon from "../../../../../../assets/svg/addButtonIcon.svg";
import ActionDropdown from "../../../../components/ActionDropdown/ActionDropdown";
import TasksView from "../../../../../../pages/TasksTableView/TasksView";
import ShowAuditHistory from "../../../../../../pages/TasksTableView/ShowAuditHistory";
import CommentPopup from "../../../../../../pages/Tasks/commentPopup";
import { useDispatch, useSelector } from "react-redux";
import { getTasks, deleteTask, exportSheet, getAuditHistory, updateTask, copyTask } from "action/TasksAct";
import { getAllRewards } from "action/RewardManagementAct";
import { getAllPrivilegesGroup } from "action/PrivilegesGroupAct";
import { Toast } from "service/toast";
import { appURL, isTalentSpotify, LoadingIndicator } from "utilities";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation } from "react-router-dom";
// import { debounce } from "lodash";
import UserOnboarding from "react-user-onboarding";
import CustomTable from "pages/vihanga/components/CustomTable";
import axios from "axios";
import { getItemFromLocalStorage } from "utilities/getLocalStorageItem";
import { getThemeColors } from "utilities/getThemeColors";
import { downloadBackendExport } from "utilities/backendExport";
import { exportToCSV, exportToExcel, exportToPDF } from "utilities/ExportFunctions";
// import ToggleTabs from "pages/vihanga/components/commonSwichButtons";
import HistoryIcon from "@mui/icons-material/History";
import googleSheetsIcon from "../../../../../../assets/svg/googleSheets.svg";
import TableHeader2 from "pages/vihanga/pages/objectives/tableHeader";
import TasksCalendar from "./TasksCalender";
import SubTask from "pages/Dashboard/Subtask";
import useWindowSize from "components/UseWindowSize";
import MobileLeaveCard from "pages/vihanga/components/MobileLeaveCard/MobileLeaveCard";
// import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
// import TableChartIcon from "@mui/icons-material/TableChart";
import { canEdit, canDelete } from "utilities/privilegeHelper";
import { getTaskRewardPoints, getSubTaskRewardPoints } from "utils/rewardCalculator";
import { renderTextWithLinks } from "utils/linkUtils";
import taskIcon from "../../../../../../assets/svg/tasks.svg";



// Status configuration
const statusConfig = {
  notstarted: { name: "Not Started", color: "#FA5453", bgColor: "#FFEEEE" },
  inprogress: { name: "In Progress", color: "#FFBF00", bgColor: "#FFF8E5" },
  onhold: { name: "On Hold", color: "#8884D8", bgColor: "#EEF0FF" },
  completed: { name: "Completed", color: "#3FC429", bgColor: "#E6F4EA" },
};

// Progress label configuration
const getProgressLabel = (progress, startDate, dueDate, actualCompletionDate) => {
  const normalizedProgress = Math.min(100, Math.max(0, Number(progress)));

  const parseDate = (dateStr) => {
    if (!dateStr || dateStr === "No date") return null;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = parseDate(startDate);
  const due = parseDate(dueDate);
  const actual = parseDate(actualCompletionDate);

  // If task is completed, check if it was delayed
  if (normalizedProgress === 100) {
    if (due && actual && actual > due) {
      // Completed after the due date → Delayed
      return { label: "Delayed", color: "white", backgroundColor: "#FF7043" };
    }
    // Completed on or before due date → OnTrack
    return { label: "OnTrack", color: "white", backgroundColor: "#4CAF50" };
  }

  // If task hasn't started yet
  if (start && today < start) {
    return { label: "NotStarted", color: "white", backgroundColor: "#9E9E9E" };
  }

  // If both start and due dates are available, compute expected progress by elapsed time
  if (start && due) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.round((due - start) / msPerDay) + 1);
    const elapsedDays = Math.min(
      totalDays,
      Math.max(0, Math.round((today - start) / msPerDay) + 1)
    );
    const expectedProgress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

    // If past due and not completed
    if (today > due && normalizedProgress < 100) {
      return { label: "OffTrack", color: "white", backgroundColor: "#F44336" };
    }

    if (normalizedProgress >= expectedProgress) {
      return { label: "OnTrack", color: "white", backgroundColor: "#4CAF50" };
    }
    // Slightly behind schedule
    if (normalizedProgress >= Math.max(0, expectedProgress - 20)) {
      return { label: "AtRisk", color: "white", backgroundColor: "#FFC107" };
    }
    return { label: "OffTrack", color: "white", backgroundColor: "#F44336" };
  }

  if (normalizedProgress >= 80) return { label: "OnTrack", color: "white", backgroundColor: "#4CAF50" };
  if (normalizedProgress >= 50) return { label: "AtRisk", color: "white", backgroundColor: "#FFC107" };

  let hasStarted = true;
  if (start) {
    hasStarted = today >= start;
  }
  if (!hasStarted) {
    return { label: "NotStarted", color: "white", backgroundColor: "#9E9E9E" };
  }
  return { label: "OffTrack", color: "white", backgroundColor: "#F44336" };
};

const getPriorityStyle = (priority) => {
  if (priority === "High Level") return { label: "High", backgroundColor: "#EF3838", color: "#FFFFFF" };
  if (priority === "Medium Level") return { label: "Medium", backgroundColor: "#E9C034", color: "#FFFFFF" };
  if (priority === "Low Level") return { label: "Low", backgroundColor: "#A9A9A9", color: "#FFFFFF" };
  return { label: priority || "--", backgroundColor: "#E0E0E0", color: "#535353" };
};

// Check if task is overdue
const isTaskOverdue = (dueDate) => {
  if (!dueDate || dueDate === "No date") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day
  const taskDueDate = new Date(dueDate);
  taskDueDate.setHours(0, 0, 0, 0);
  return taskDueDate < today;
};

// ListView component for Kanban-style view
const ListView = ({ tasks }) => {
  const groupedTasks = tasks.reduce((acc, task) => {
    if (!acc[task.status]) {
      acc[task.status] = [];
    }
    acc[task.status].push(task);
    return acc;
  }, {});




  return (
    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", p: 2 }}>
      {Object.entries(statusConfig).map(([status, config]) => (
        <Box
          key={status}
          sx={{
            width: 300,
            bgcolor: "#f5f5f5",
            borderRadius: 2,
            p: 2,
            boxShadow: 1,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
              borderBottom: `2px solid ${config.color}`,
              pb: 1,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              {config.name} ({groupedTasks[status]?.length || 0})
            </Typography>
          </Box>

          {groupedTasks[status]?.map((task) => (
            <Box
              key={task.id}
              sx={{
                bgcolor: "white",
                borderRadius: 1,
                p: 2,
                mb: 2,
                boxShadow: 1,
                borderLeft: `3px solid ${config.color}`,
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
                {task.title}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                Due: {task.dueDate || "No date"}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mt: 2,
                }}
              >
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Owner: {task.owner}
                </Typography>
                <Chip
                  label={task.priority}
                  size="small"
                  sx={{
                    backgroundColor:
                      task.priority === "High Level"
                        ? "#EF3838"
                        : task.priority === "Medium Level"
                        ? "#E9C034"
                        : "#E0E0E0",
                    color: "#fff",
                    fontSize: "0.7rem",
                  }}
                />
              </Box>
            </Box>
          ))}

         
        </Box>
      ))}
    </Box>
  );
};

const TaskTable = () => {

  const userId = getItemFromLocalStorage("user")?._id || null;
const companyId = getItemFromLocalStorage("companyId");
const type=getItemFromLocalStorage("selectedTab")
  const user = getItemFromLocalStorage("user");
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const isMobile = useWindowSize();
  const { primaryColor, secondaryColors } = getThemeColors();
  // Onboarding states and refs
  const [isVisible, setIsVisible] = useState(false);
  const createTaskRef = useRef();
  const taskActionMenuRef = useRef();
  const taskEditButtonRef = useRef();

  // Privilege checks
  const hasEditPrivilege = canEdit();
  const hasDeletePrivilege = canDelete();


  // State management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tasks, setTasks] = useState([]);
  const [totalTasks, setTotalTasks] = useState(0); // For server-side pagination
  const [totalPages, setTotalPages] = useState(0); // For pagination display
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPageForInfiniteScroll, setCurrentPageForInfiniteScroll] = useState(0);
  const [error, setError] = useState(null);
  const [subTaskModal, setSubTaskModal] = useState({ show: false, taskId: null });
  const [editTaskId, setEditTaskId] = useState(null); // For edit mode
  const [showView, setShowView] = useState(localStorage.getItem("taskView") || "Table");
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTasks, setSelectedTasks] = useState({});
  const [commentPopupShow, setCommentPopupShow] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);
  const [isCompanyOKRsFilterActive, setIsCompanyOKRsFilterActive] = useState(false);
  const selectedTab = JSON.parse(localStorage.getItem("selectedTab")) || null;
  const [selectedSwitch, setSelectedSwitch] = useState(selectedTab?.tab || "me");
  const [search, setSearch] = useState("");
  const [searchText,setSearchText]=useState("")
  const [visibleColumns, setVisibleColumns] = useState([
    "task",
    "dueDate",
    "status",
    "owner",
    "progress",
    "comments",
    "subTask",
    "approval",
    "action",
  ]);
  const [selectedStatus, setSelectedStatus] = useState(["ontrack", "atrisk", "offtrack", "notstarted"]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditData, setAuditData] = useState([]);
 const [stage, setStage] = useState("All");
  const [selectedItems, setSelectedItems] = useState([]);
  const [rewardSchemes, setRewardSchemes] = useState([]);
  const [privilegeGroups, setPrivilegeGroups] = useState([]);
  const [approvingTaskId, setApprovingTaskId] = useState(null);
  const googleSheetEnable = useSelector((state) => state.companyConfig?.googleSheetEnable === true);

   const menuItemsStage = [
    { text: "High" },
    { text: "Medium" },
    { text: "Low" },
  ];

  const menuItemsExportOptions = [
    { text: "Export as CSV", icon: "/icons/csv.png" },
    { text: "Export as PDF", icon: "/icons/pdf.png" },
  ];
  // Debounced search
  // const debouncedSearch = debounce((value) => {
  //   setSearch(value);
  //   setPage(0);
  // }, 300);

  // Fetch reward schemes and privilege groups on component mount
  useEffect(() => {
    const fetchRewardData = async () => {
      try {
        
        // Fetch reward schemes
        const rewardsResponse = await dispatch(getAllRewards());
        
        if (rewardsResponse.data) {
          setRewardSchemes(rewardsResponse.data);
        }
        
        // Fetch privilege groups
        const groupsResponse = await dispatch(getAllPrivilegesGroup());
        
        if (groupsResponse.data && groupsResponse.data.privilegeGroups) {
          setPrivilegeGroups(groupsResponse.data.privilegeGroups);
        
        }
      } catch (error) {
        console.error("Error fetching reward data:", error);
      }
    };
    
    fetchRewardData();
  }, [dispatch]);

  const mobileFields = [
  {
    label:"TaskName",
    key: "task",
    render: (value, data) => {
      const isOverdue = isTaskOverdue(data.dueDate);
      return (
        <Typography
          onClick={() => onEdit(data)}
          sx={{
            tabindex: 0,
            fontSize: "16px",
            color: isOverdue ? "#EF3838" : "#2c3e50",
            lineHeight: 1.5,
            ml: 6,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-word",
            cursor: "pointer",
            textDecoration: "underline",
            textDecorationColor: "#8A8543",
            "&:hover": {
              opacity: 0.8,
              textDecorationColor: "#7c7b3b",
            },
          }}
        >
          {value || "No Task"}
        </Typography>
      );
    },
  },
  {
    label:"DueDate",
    key: "dueDate",
    render: (value) => {
      if (!value)
        return (
          <Typography
            sx={{ fontSize: "15px", fontWeight: 500, color: "#666", ml: 6 }}
          >
            N/A
          </Typography>
        );
      return (
        <Chip
          label={value}
          size="small"
          sx={{
            backgroundColor: "#26925F",
            color: "#fff",
            fontSize: "12px",
            height: "22px",
            ml: 6,
          }}
        />
      );
    },
  },
  {
    label: "Progress & Status",
    key: "progress",
    render: (value, data) => {
      const progressValue = Math.min(100, Math.max(0, Number(data.progress)));
      const { label, backgroundColor, color } = getProgressLabel(progressValue, data.startDate, data.dueDate, data.actualCompletionDate);

      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 1.5,
          }}
        >
          <Typography
            fontSize="16px"
            sx={{
              fontFamily: "Work Sans",
              fontWeight: 600,
              color: "#2c3e50",
              ml: 6,
            }}
          >
            {progressValue}%
          </Typography>
          <Box sx={{ width: "100px" }}>
            <LinearProgress
              variant="determinate"
              value={progressValue}
              sx={{
                height: "10px",
                borderRadius: "20px",
                backgroundColor: "#f5f5f5",
                "& .MuiLinearProgress-bar": {
                  backgroundColor,
                  borderRadius: "20px",
                },
              }}
            />
          </Box>
          <Typography
            sx={{
              fontSize: "14px",
              fontWeight: 500,
              color,
              backgroundColor,
              borderRadius: "12px",
              px: 1.5,
              py: 0.3,
              textAlign: "center",
              mt: 0.5,
              minWidth: "60px",
            }}
          >
            {label}
          </Typography>
        </Box>
      );
    },
  },
  {
    label: "Owner",
    key: "owner",
    render: (value, data) => (
      <Box sx={{ display: "flex", flexDirection: "column", ml: 6, gap: 0.5 }}>
        <Typography
          sx={{ fontSize: "15px", fontWeight: 500, color: "#546e7a" }}
        >
          {value || "Unknown"}
        </Typography>
        {data.ownerRole && (
          <Chip
            label={data.ownerRole}
            size="small"
            sx={{
              backgroundColor: "#26925F",
              color: "#fff",
              fontSize: "12px",
              height: "22px",
              fontWeight: 500,
              width: "fit-content",
            }}
          />
        )}
      </Box>
    ),
  },
];


  // Fetch tasks with server-side pagination and filtering
  const fetchTasks = useCallback(async (selectedSwitch, append = false, nextPage = null) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      // Use nextPage if provided (for infinite scroll), otherwise use current page
      const currentPage = append && nextPage !== null ? nextPage : page;

      // console.log("Fetching tasks - append:", append, "currentPage:", currentPage, "nextPage:", nextPage);

      const response = await axios.get(
        `${appURL}/tasks2/getTasks/${userId}/${companyId}`,
        {
          params: {
            type: selectedSwitch || "me",
            page: currentPage,
            limit: rowsPerPage,
            search: search || "",
          }
        }
      );
  
      const { data, pagination, message } = response.data;
  
      // Map tasks while preserving the hierarchy for nested subtasks
      const mapTask = (task) => ({
        ...task,
        id: task._id,
        task: task.title,
        progress: task.progressStatus || 0,
        dueDate: task.dueDate ? task.dueDate.split("T")[0] : "No date",
        owner: task.owner || "Unassigned",
        ownerRole: task.role || "Member",
        priority: task.priority || "High Level",
        comments: task.comments ? task.comments.length : 0,
        status: task.status || "notstarted",
        rewardPoints: parseFloat(task.dynamicRewardPoints) || 0,
        approvalStatus: task.isApproved || task.approvalRequired || "N/A",
        isApproved: task.isApproved || "pending",
        pending: task.pending || null,
        title: task.title,
        description: task.description,
        startDate: task.startDate ? task.startDate.split("T")[0] : "",
        actualCompletionDate: task.actualCompletionDate,
        assignTo: task.assignTo || [],
        krReferenceId: task.krReferenceId || "",
        estimationEffort: task.estimationEffort || 0,
        actualEffort: task.actualEffort || 0,
        recurrence: task.recurrence,
        recurrenceDetails: task.recurrenceDetails,
        mainTask: task.mainTask,
        attachments: task.attachments || "",
        linkToKR: task.linkToKR || "",
        isAlignedToCompany: task.isAlignedToCompany || false,
        children: Array.isArray(task.children) ? task.children.map(mapTask) : [],
        companyId: task.companyId || "",
      });
  
      const mappedTasks = Array.isArray(data) ? data.map(mapTask) : [];
  
      if (append) {
        // Append new data to existing data
        setTasks(prev => {
          return [...prev, ...mappedTasks];
        });
        // Update internal page counter for infinite scroll
        setCurrentPageForInfiniteScroll(currentPage);
      } else {
        // Replace data on initial load or refresh
        setTasks(mappedTasks);
        setCurrentPageForInfiniteScroll(0);
      }
      
      // Use pagination object from API response
      setTotalTasks(pagination?.totalCount || 0);
      
      // Update total pages from API response
      const calculatedTotalPages = pagination?.totalPages || Math.ceil((pagination?.totalCount || 0) / rowsPerPage);
      setTotalPages(calculatedTotalPages);
      
      // Check if there's more data to load (API uses 0-based pagination)
      const hasMoreData = currentPage < calculatedTotalPages - 1;
      setHasMore(hasMoreData);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError(err.message || "Failed to fetch tasks");
      if (!append) {
        setTasks([]);
        setTotalTasks(0);
      }
      setHasMore(false);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [userId, companyId, rowsPerPage, search, page]);

  // Load more data for infinite scroll
  const loadMoreData = useCallback(async () => {
    if (loadingMore || !hasMore || isLoading) {
      console.log("loadMoreData blocked");
      return;
    }
    const nextPage = currentPageForInfiniteScroll + 1;
    await fetchTasks(selectedSwitch, true, nextPage);
  }, [loadingMore, hasMore, isLoading, currentPageForInfiniteScroll, selectedSwitch, fetchTasks]);
  
  useEffect(() => {
    // Reset page and hasMore when filters change
    setPage(0);
    setCurrentPageForInfiniteScroll(0);
    setHasMore(true);
    fetchTasks(selectedSwitch, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSwitch, rowsPerPage]);

  // Handle page change for desktop pagination (only for desktop, not mobile infinite scroll)
  useEffect(() => {
    // Only fetch if page changed and it's not from infinite scroll
    if (page > 0 && !loadingMore) {
      fetchTasks(selectedSwitch, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Reset data when switching from mobile to desktop to prevent showing accumulated data
  useEffect(() => {
    if (!isMobile && tasks.length > rowsPerPage) {
      // If switching to desktop and we have more data than one page, reset to current page
      fetchTasks(selectedSwitch, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Persist view preference
  useEffect(() => {
    localStorage.setItem("taskView", showView);
  }, [showView]);

  // Onboarding tutorial effect
  useEffect(() => {
    if (location.state && location.state.story === "story") {
      // Wait for the element to be rendered
      const checkAndActivate = () => {
        if (createTaskRef.current) {
          setIsVisible(location.state ? location.state.isVisible : false);
          window.history.replaceState({ isVisible: false }, document.title);
        } else {
          // Retry after a short delay if element not ready
          setTimeout(checkAndActivate, 100);
        }
      };
      
      setTimeout(checkAndActivate, 300);
    } else if (location.state && location.state.story === "story1") {
      // For update task tutorial
      const checkAndActivate = () => {
        if (taskActionMenuRef.current) {
          setIsVisible(location.state ? location.state.isVisible : false);
          window.history.replaceState({ isVisible: false }, document.title);
        } else {
          // Retry after a short delay if element not ready
          setTimeout(checkAndActivate, 100);
        }
      };
      
      setTimeout(checkAndActivate, 300);
    }
  }, [location, createTaskRef, taskActionMenuRef]);

  // Add highlight class to tutorial elements when visible
  useEffect(() => {
    if (isVisible && location.state) {
      if (location.state.story === "story" && createTaskRef.current) {
        createTaskRef.current.classList.add('tutorial-highlight');
      } else if (location.state.story === "story1") {
        if (taskActionMenuRef.current) {
          taskActionMenuRef.current.classList.add('tutorial-highlight');
        }
        if (taskEditButtonRef.current) {
          taskEditButtonRef.current.classList.add('tutorial-highlight');
        }
      }
    } else {
      if (createTaskRef.current) {
        createTaskRef.current.classList.remove('tutorial-highlight');
      }
      if (taskActionMenuRef.current) {
        taskActionMenuRef.current.classList.remove('tutorial-highlight');
      }
      if (taskEditButtonRef.current) {
        taskEditButtonRef.current.classList.remove('tutorial-highlight');
      }
    }
    
    return () => {
      // Cleanup on unmount
      if (createTaskRef.current) {
        createTaskRef.current.classList.remove('tutorial-highlight');
      }
      if (taskActionMenuRef.current) {
        taskActionMenuRef.current.classList.remove('tutorial-highlight');
      }
      if (taskEditButtonRef.current) {
        taskEditButtonRef.current.classList.remove('tutorial-highlight');
      }
    };
  }, [isVisible, location]);

  // Story configuration for create task tutorial
  const createTaskStory = [
    {
      component: "tooltip",
      ref: createTaskRef,
      children: (
        <Box>
          <Typography>Click here to create a new Task</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.9rem" }}>
            Tasks help you break down work into actionable items
          </Typography>
        </Box>
      ),
    },
    {
      component: "modal",
      tooltipID: "#getStarted",
      verticalPosition: "center",
      horizontalPosition: "center",
      intro: false,
      children: (
        <Box>
          <Typography>Thanks {user?.firstName || user?.name}!</Typography>
          <Typography>You have completed the Create Task tutorial!</Typography>
          <Typography sx={{ mt: 2 }}>Now you know how to create tasks for your work.</Typography>
        </Box>
      ),
    },
  ];

  // Story configuration for update task tutorial
  const updateTaskStory = [
    {
      component: "tooltip",
      ref: taskActionMenuRef,
      children: (
        <Box>
          <Typography>Click on the three dots (⋮) to open the actions menu</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.9rem" }}>
            This menu contains options to Edit, Copy, Delete, or view Audit History
          </Typography>
        </Box>
      ),
    },
    {
      component: "tooltip",
      ref: taskEditButtonRef,
      children: (
        <Box>
          <Typography>Click on "Edit" to update the task</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.9rem" }}>
            This will open the task form where you can make changes
          </Typography>
        </Box>
      ),
    },
    {
      component: "modal",
      tooltipID: "#getStarted",
      verticalPosition: "center",
      horizontalPosition: "center",
      intro: false,
      children: (
        <Box>
          <Typography>Great work {user?.firstName || user?.name}!</Typography>
          <Typography>You have completed the Update Task tutorial!</Typography>
          <Typography sx={{ mt: 2 }}>Now you know how to edit your tasks.</Typography>
        </Box>
      ),
    },
  ];

  const getStory = () => {
    if (location.state?.story === "story") {
      return createTaskStory;
    } else if (location.state?.story === "story1") {
      return updateTaskStory;
    }
    return [];
  };

  // Filter tasks (client-side fallback if server-side filtering is not fully supported)
  const filterTasks = useCallback(
    (tasks) => {
      if (!tasks) return [];
      const searchLower = search.toLowerCase();

      const filterNode = (task) => {
        const matchesSearch = [
          task.title,
          task.description,
          task.owner,
          task.priority,
          task.ownerRole,
          task.progress,
        ].some((text) => text?.toString().toLowerCase().includes(searchLower));

        const taskStatus = (() => {
          const progressVal = Number(task.progress) || 0;
          const parseDate = (dateStr) => {
            if (!dateStr || dateStr === "No date") return null;
            const d = new Date(dateStr);
            if (Number.isNaN(d.getTime())) return null;
            d.setHours(0, 0, 0, 0);
            return d;
          };
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const start = parseDate(task.startDate);
          const due = parseDate(task.dueDate);

          if (start && today < start) return "notstarted";

          if (start && due) {
            const msPerDay = 24 * 60 * 60 * 1000;
            const totalDays = Math.max(1, Math.round((due - start) / msPerDay) + 1);
            const elapsedDays = Math.min(
              totalDays,
              Math.max(0, Math.round((today - start) / msPerDay) + 1)
            );
            const expected = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

            if (today > due && progressVal < 100) return "offtrack";
            if (progressVal >= expected) return "ontrack";
            if (progressVal >= Math.max(0, expected - 20)) return "atrisk";
            return "offtrack";
          }

          // Fallback
          if (progressVal >= 80) return "ontrack";
          if (progressVal >= 50) return "atrisk";
          return start && today >= start ? "offtrack" : "notstarted";
        })();
        const matchesStatus = selectedStatus.includes(taskStatus);
        const passesCompanyOKRFilter =
          !isCompanyOKRsFilterActive ||
          task.isAlignedToCompany ||
          (task.children && task.children.some((child) => child.isAlignedToCompany));

        // Recursively filter children
        const filteredChildren = (task.children || [])
          .map(filterNode)
          .filter(Boolean);

        const shouldInclude = (matchesSearch && matchesStatus && passesCompanyOKRFilter) || filteredChildren.length > 0;

        if (!shouldInclude) return null;

        return { ...task, children: filteredChildren };
      };

      return tasks.map(filterNode).filter(Boolean);
    },
    [search, selectedStatus, isCompanyOKRsFilterActive]
  );

  const filteredTasks = filterTasks(tasks);

  const flattenTasksForExport = (items, level = 0) => {
    let result = [];
    items.forEach((item) => {
      result.push({
        Type: level === 0 ? "Task" : "Sub Task",
        Title: item.title || item.task || "N/A",
        Description: item.description || "N/A",
        Progress: `${item.progress || 0}%`,
        Status: item.status || "N/A",
        Owner: item.owner || "N/A",
        "Due Date": item.dueDate || "N/A",
        Priority: item.priority || "N/A",
      });
      if (item.children?.length) {
        result = result.concat(flattenTasksForExport(item.children, level + 1));
      }
    });
    return result;
  };

  const fetchAllTasksForExport = async () => {
    const response = await axios.get(`${appURL}/tasks2/getTasks/${userId}/${companyId}`, {
      params: {
        type: selectedSwitch || "me",
        search: search || "",
        exportAll: "true",
      },
    });
    const rawTasks = response.data?.data || [];
    const mapTask = (task) => ({
      ...task,
      id: task._id,
      task: task.title,
      progress: task.progressStatus || 0,
      dueDate: task.dueDate ? task.dueDate.split("T")[0] : "No date",
      owner: task.owner || "Unassigned",
      startDate: task.startDate ? task.startDate.split("T")[0] : "",
      status: task.status || "notstarted",
      isAlignedToCompany: task.isAlignedToCompany || false,
      children: Array.isArray(task.children) ? task.children.map(mapTask) : [],
    });
    return filterTasks(Array.isArray(rawTasks) ? rawTasks.map(mapTask) : []);
  };

  const handleTasksExport = async (format) => {
    try {
      if (format === "csv" || format === "excel") {
        await downloadBackendExport({
          module: "tasks",
          pathSuffix: `/${userId}/${companyId}`,
          params: {
            type: selectedSwitch || "me",
            search: search || "",
          },
          format,
          filename: `tasks-export-${new Date().toISOString().split("T")[0]}`,
        });
        Toast({ message: `Exported as ${format.toUpperCase()}`, type: "success" });
        return;
      }

      const allTasks = await fetchAllTasksForExport();
      if (!allTasks.length) {
        Toast({ message: t("Tasks.NoDataToExport"), type: "warning", time: 4000 });
        return;
      }
      const exportData = flattenTasksForExport(allTasks);
      if (format === "pdf") {
        exportToPDF(exportData);
      } else {
        exportToCSV(exportData);
      }
      Toast({ message: `Exported as ${format.toUpperCase()}`, type: "success" });
    } catch (err) {
      console.error("Task export error:", err);
      Toast({
        message: err.response?.data?.message || "Failed to export tasks",
        type: "error",
      });
    }
  };

  // Navigate to AddTaskForm
  const handleNavigateToAddTask = () => {
    history.push(`/admin/objectives/task?fromTask=${true}`)
  };

  const handleGoogleSheet = async () => {
    try {
      const allTasks = await fetchAllTasksForExport();
      if (!allTasks?.length) {
        Toast({ message: t("Tasks.NoDataToExport"), type: "warning", time: 4000 });
        return;
      }
      const dataForSheet = allTasks.map((item) => ({
        ...item,
        comments: Array.isArray(item.comments) ? item.comments : [],
      }));
      dispatch(exportSheet({ data: dataForSheet }))
      .then((response) => {
        const sheetUrl = typeof response?.data === "string"
          ? response.data
          : response?.data?.data;
        if (sheetUrl) {
          window.open(sheetUrl, "_blank", "noopener,noreferrer");
        }
      })
      .catch(() => {});
    } catch (err) {
      Toast({ message: t("Tasks.NoDataToExport"), type: "error", time: 4000 });
    }
  };

  // Handlers for edit, view, delete, and subtask
  const handleSubTaskClick = (mainTaskId) => {
    
    history.push(`/admin/objectives/task?parentTaskId=${mainTaskId}&fromTask=true`);
  };

  const onEdit = (row) => {
    setEditTaskId(row.id);
    history.push(`/admin/objectives/task?isEdit=true&keyResultId=${row?.krReferenceId}&taskId=${row?.id}&fromTask=${true}`)

  };

  const onView = (row) => {
    setSelectedTask(row);
    setShowViewModal(true);
  };

  const handleDelete = async (row) => {

    try {
      setIsLoading(true);
      await dispatch(deleteTask(row?.id));
      await fetchTasks(selectedSwitch);
    } catch (err) {
      Toast({ type: "error", message: err.message || "Error deleting tasks", time: 3000 });
    } finally {
      setIsLoading(false);
    }
  };

  // Copy handler
  const handleCopy = async (row) => {
    try {
      setIsLoading(true);
      await dispatch(copyTask(row?.id));
      await fetchTasks(selectedSwitch);
      Toast({ type: "success", message: "Task copied successfully!", time: 3000 });
    } catch (err) {
      Toast({ type: "error", message: err.message || "Error copying task", time: 3000 });
    } finally {
      setIsLoading(false);
    }
  };

  // Audit history handler
  const handleAuditHistory = async (row) => {
    try {
      const respPromise = dispatch(getAuditHistory(row?.id));
      respPromise.then(({ data }) => {
        setAuditData(Array.isArray(data) ? data : []);
        setShowAuditModal(true);
      });
    } catch (err) {
      setAuditData([]);
      setShowAuditModal(true);
    }
  };

  // Approve task handler
  const handleApprove = async (row) => {
    
    try {
      setApprovingTaskId(row.id);
      
      // Calculate configured reward points based on whether it's a subtask or regular task
      // Use task's assigned employee ID, not the logged-in manager's ID
      const isSubTask = row.mainTask && row.mainTask !== "";
      const taskOwnerId = row.assignTo?.[0] || row.owner;
      
      // console.log("Approve Task - Calculating reward points:", {
      //   isSubTask,
      //   taskOwnerId,
      //   loggedInUserId: user?._id,
      //   rewardSchemesCount: rewardSchemes?.length,
      //   privilegeGroupsCount: privilegeGroups?.length,
      //   taskData: { id: row.id, mainTask: row.mainTask, assignTo: row.assignTo, owner: row.owner }
      // });
      
      const rewardConfig = isSubTask 
        ? getSubTaskRewardPoints({
            userId: taskOwnerId,
            rewardSchemes,
            privilegeGroups
          })
        : getTaskRewardPoints({
            userId: taskOwnerId,
            rewardSchemes,
            privilegeGroups
          });
      
      
      const dynamicRewardPoints = rewardConfig?.points || 0;
      
      // Build the update task payload
      const payload = {
        title: row.title,
        description: row.description,
        startDate: row.startDate,
        dueDate: row.dueDate,
        actualCompletionDate: row.actualCompletionDate || null,
        linkToKr: row.linkToKR || row.krReferenceId || null,
        assignTo: row.assignTo,
        priority: row.priority,
        status: row.status,
        comments: row.comments || "",
        attachments: row.attachments || "",
        krReferenceId: row.krReferenceId || "",
        objectiveReferenceId: row.objectiveReferenceId || null,
        recurrence: row.recurrence || false,
        recurrenceDetails: row.recurrenceDetails || null,
        progressStatus: row.progress,
        mainTask: row.mainTask || null,
        companyId: companyId,
        userId: user?._id,
        dynamicRewardPoints: dynamicRewardPoints,
        approvalRequired: false, // Set to false to trigger approval
        isApproved: "approved"
      };
      
      
      // Use update task action from Redux
      const response = await dispatch(updateTask(row.id, payload));


      if (response.success) {
        Toast({ type: "success", message: "Task approved successfully", time: 3000 });
        await fetchTasks(selectedSwitch);
      } else {
        throw new Error(response.message || "Failed to approve task");
      }
    } catch (err) {
      console.error("Error in handleApprove:", err);
      Toast({ type: "error", message: err?.message || "Error approving task", time: 3000 });
    } finally {
      setApprovingTaskId(null);
    }
  };

  // Reject task handler
  const handleReject = async (row) => {
    console.log("=== REJECT CLICKED ===", row);
    
    try {
      setApprovingTaskId(row.id);
      
      // Build the update task payload for rejection
      const payload = {
        title: row.title,
        description: row.description,
        startDate: row.startDate,
        dueDate: row.dueDate,
        actualCompletionDate: row.actualCompletionDate || null,
        linkToKr: row.linkToKR || row.krReferenceId || null,
        assignTo: row.assignTo,
        priority: row.priority,
        status: row.status,
        comments: row.comments || "",
        attachments: row.attachments || "",
        krReferenceId: row.krReferenceId || "",
        objectiveReferenceId: row.objectiveReferenceId || null,
        recurrence: row.recurrence || false,
        recurrenceDetails: row.recurrenceDetails || null,
        progressStatus: row.progress,
        mainTask: row.mainTask || null,
        companyId: companyId,
        userId: user?._id,
        dynamicRewardPoints: 0,
        approvalRequired: false,
        isApproved: "rejected"
      };
      
      
      // Use update task action from Redux
      const response = await dispatch(updateTask(row.id, payload));


      if (response.success) {
        Toast({ type: "success", message: "Task rejected successfully", time: 3000 });
        await fetchTasks(selectedSwitch);
      } else {
        throw new Error(response.message || "Failed to reject task");
      }
    } catch (err) {
      console.error("Error in handleReject:", err);
      Toast({ type: "error", message: err?.message || "Error rejecting task", time: 3000 });
    } finally {
      setApprovingTaskId(null);
    }
  };
  
 
 
 
  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

   // response.data is your tasks array
  // Table columns
  const columns = [
    {
      id: "task",
      label: t("Tasks.Task"),
      sortable: true,
      render: (row) => {
        const isOverdue = (() => {
          const hasDueDate = row.dueDate && row.dueDate !== "No date";
          const due = hasDueDate ? new Date(row.dueDate) : null;
          const actual = row.actualCompletionDate ? new Date(row.actualCompletionDate) : null;
          if (actual && due) {
            due.setHours(0, 0, 0, 0);
            actual.setHours(0, 0, 0, 0);
            return actual > due;
          }
          return isTaskOverdue(row.dueDate);
        })();
        return (
          <Box sx={{ display: "flex", alignItems: "start", gap: 1, maxWidth: "320px" }}>
            <img
              src={taskIcon}
              alt="Task"
              style={{
                height: 15,
                width: 15,
                marginTop: "2px",
                flexShrink: 0,
              }}
            />
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "start", minWidth: 0 }}>
              <Typography
                onClick={() => onEdit(row)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEdit(row);
                  }
                }}
                tabIndex={0}
                sx={{
                  fontSize: "16px",
                  lineHeight: "19px",
                  color: isOverdue ? "#EF3838" : "#0E0E0E",
                  fontFamily: "Work Sans",
                  fontWeight: isOverdue ? 600 : 600,
                  cursor: "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                  "&:hover": {
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  },
                  "&:focus": {
                    outline: "2px solid #007bff",
                    outlineOffset: "2px",
                  }
                }}
                title={row.task}
              >
                {row.task}
              </Typography>
              {row.description && renderTextWithLinks(row.description, {
                fontSize: "14px",
                lineHeight: "19px",
                color: "#535353",
                fontFamily: "Work Sans",
                fontWeight: "400",
                maxWidth: "280px",
                whiteSpace: "normal",
                wordWrap: "break-word",
                marginTop: "2px",
              })}
            </Box>
          </Box>
        );
      },
    },
    {
      id: "dueDate",
      label: t("Tasks.Due Date"),
      sortable: true,
      render: (row) => (
        <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
          <Chip
            label={row.dueDate}
            size="small"
            sx={{
              backgroundColor: "#26925F",
              color: "#fff",
              fontSize: "12px",
              height: "22px",
              padding: "0 6px",
              fontWeight: 500,
            }}
          />
        </Box>
      ),
    },
    {
      id: "status",
      label: t("Tasks.Priority") || "Priority",
      sortable: true,
      render: (row) => {
        const { label, backgroundColor, color } = getPriorityStyle(row.priority);
        return (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <Chip
              label={label}
              size="small"
              sx={{
                backgroundColor,
                color,
                height: "22px",
                borderRadius: "100px",
                fontFamily: "Work Sans",
                fontWeight: 500,
                fontSize: "12px",
                lineHeight: "100%",
                letterSpacing: "3%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 8px",
              }}
            />
          </Box>
        );
      },
    },
    {
      id: "owner",
      label: t("Tasks.Owner"),
      sortable: true,
      render: (row) => (
        <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
          <Typography
            fontSize={14}
            color="#707070"
            sx={{ fontFamily: "Work Sans", fontWeight: "400" }}
          >
            {row.owner}
          </Typography>
          <Chip
            label={row.ownerRole}
            size="small"
            sx={{
              backgroundColor: "#26925F",
              color: "#fff",
              fontSize: "12px",
              height: "22px",
              padding: "0 6px",
              fontWeight: 500,
            }}
          />
        </Box>
      ),
    },
    {
      id: "progress",
      label: t("Tasks.Progress") || "Progress",
      sortable: true,
      render: (row) => {
        const cappedProgress = Math.min(row.progress, 100);
        const { label, color, backgroundColor } = getProgressLabel(row.progress, row.startDate, row.dueDate, row.actualCompletionDate);

        return (
          <Box display="flex" flexDirection="column" alignItems="flex-start" gap={1.5}>
            <Box sx={{ display: "flex", gap: "5px" }}>
              <Typography
                sx={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: backgroundColor,
                  fontFamily: "Work Sans",
                }}
              >
                {row.progress}%
              </Typography>
              <Typography
                sx={{
                  fontSize: "12px",
                  fontWeight: "500",
                  color,
                  padding: "5px",
                  backgroundColor,
                  borderRadius: "50px",
                  fontFamily: "Work Sans",
                }}
              >
                {label}
              </Typography>
            </Box>
            <Box sx={{ position: "relative", width: 110, height: 11 }}>
              <LinearProgress
                variant="determinate"
                value={cappedProgress}
                sx={{
                  height: "100%",
                  borderRadius: 50,
                  backgroundColor: "#E0E0E0",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor,
                    borderRadius: 95,
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "10px",
                  transform: "translateY(-50%)",
                  color: "#FFFFFF",
                  fontWeight: "400",
                  fontSize: "10px",
                  fontFamily: "Work Sans",
                }}
              >
                {row.progress}%
              </Typography>
            </Box>
          </Box>
        );
      },
    },
    {
      id: "comments",
      label: t("Tasks.Comments"),
      render: (row) => (
        <Box
          display="flex"
          flexDirection="row"
          alignItems="center"
          justifyContent="center"
          gap={1}
          sx={{ cursor: "pointer" }}
          onClick={() => {
            setSelectedRowData(row);
            setCommentPopupShow(true);
          }}
        >
          <img tabIndex={0} src={messageIcon} style={{ fontSize: 18 }} alt="comments" />
          <Typography variant="body2">{row.comments}</Typography>
        </Box>
      ),
    },
    {
      id: "subTask",
      label: t("Tasks.SubTask"),
      render: (row) => (
        <Tooltip title="Add Subtask">
          <IconButton onClick={() => handleSubTaskClick(row.id)}>
            <img tabIndex={0} src={addButtonIcon} alt="Add subtask" />
          </IconButton>
        </Tooltip>
      ),
    },
    {
      id: "approval",
      label: t("Tasks.Approval") || "Approval",
      render: (row) => {
        const formatStatusLabel = (status) => {
          switch (status) {
            case "approved":
              return t("Tasks.Approved") || "Approved";
            case "rejected":
              return t("Tasks.Rejected") || "Rejected";
            case "pending":
              return t("Tasks.PendingApproval") || "Pending Approval";
            default:
              return "--";
          }
        };

        const getStatusColor = (status) => {
          switch (status) {
            case "approved":
              return { backgroundColor: "#4CAF50", color: "#FFFFFF" };
            case "rejected":
              return { backgroundColor: "#F44336", color: "#FFFFFF" };
            case "pending":
              return { backgroundColor: "#2196F3", color: "#FFFFFF" };
            default:
              return { backgroundColor: "#F5F5F5", color: "#707070" };
          }
        };

        // If pending is null or empty object, show "--"
        if (!row.pending || (typeof row.pending === 'object' && Object.keys(row.pending).length === 0)) {
          return (
            <Box display="flex" justifyContent="center" width="100%">
              <Typography
                sx={{
                  fontSize: "14px",
                  fontWeight: "400",
                  color: "#707070",
                }}
              >
                --
              </Typography>
            </Box>
          );
        }

        // Check if selectedTab is myteam or mycompany
        const showApprovalButtons = ["myteam", "mycompany"].includes(selectedSwitch);
        const isApproving = approvingTaskId === row.id;
        
        // Only show buttons if approval is pending (not already approved or rejected)
        const alreadyProcessed = ["approved", "rejected"].includes(row.isApproved);
        const isPending = row.isApproved === "pending";
        
        // Check if task meets completion criteria (progress = 100)
        const meetsCompletionCriteria = row.progress === 100;

        return ( 
          <Box display="flex" justifyContent="center" width="100%" gap={0.5}>
            {showApprovalButtons && isPending && meetsCompletionCriteria ? (
              <Box display="flex" gap={0.5} alignItems="center">
                {isApproving ? (
                  <CircularProgress size={24} sx={{ color: "#837F39" }} />
                ) : (
                  <>
                    <Tooltip title={t("Tasks.Approve") || "Approve"}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(row);
                        }}
                        disabled={isApproving}
                        sx={{
                          color: "#4CAF50",
                          backgroundColor: "#E8F5E9",
                          padding: "6px",
                          "&:hover": {
                            backgroundColor: "#C8E6C9",
                          },
                          "&:disabled": {
                            opacity: 0.5,
                          },
                        }}
                      >
                        <CheckCircleIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t("Tasks.Reject") || "Reject"}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(row);
                        }}
                        disabled={isApproving}
                        sx={{
                          color: "#F44336",
                          backgroundColor: "#FFEBEE",
                          padding: "6px",
                          "&:hover": {
                            backgroundColor: "#FFCDD2",
                          },
                          "&:disabled": {
                            opacity: 0.5,
                          },
                        }}
                      >
                        <CancelIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            ) : (
              // Display status based on isApproved value
              (() => {
                // If approved, show Approved chip
                if (row.isApproved === "approved") {
                  return (
                    <Chip
                      label={formatStatusLabel("approved")}
                      size="small"
                      sx={{
                        fontWeight: 400,
                        fontSize: "12px",
                        height: "23px",
                        borderRadius: "100px",
                        display: "inline-flex",
                        justifyContent: "center",
                        alignItems: "center",
                        ...getStatusColor("approved"),
                      }}
                    />
                  );
                }
                
                // If rejected, show Rejected chip
                if (row.isApproved === "rejected") {
                  return (
                    <Chip
                      label={formatStatusLabel("rejected")}
                      size="small"
                      sx={{
                        fontWeight: 400,
                        fontSize: "12px",
                        height: "23px",
                        borderRadius: "100px",
                        display: "inline-flex",
                        justifyContent: "center",
                        alignItems: "center",
                        ...getStatusColor("rejected"),
                      }}
                    />
                  );
                }
                
                // If pending, show Pending Approval chip
                if (row.isApproved === "pending") {
                  return (
                    <Chip
                      label={formatStatusLabel("pending")}
                      size="small"
                      sx={{
                        fontWeight: 400,
                        fontSize: "12px",
                        height: "23px",
                        borderRadius: "100px",
                        display: "inline-flex",
                        justifyContent: "center",
                        alignItems: "center",
                        ...getStatusColor("pending"),
                      }}
                    />
                  );
                }
                
                // Default: show --
                return (
                  <Typography
                    sx={{
                      fontSize: "14px",
                      fontWeight: "400",
                      color: "#707070",
                    }}
                  >
                    --
                  </Typography>
                );
              })()
            )}
          </Box>
        );
      },
    },
    {
      id: "action",
      label: <span style={{ fontWeight: 500 }}>{t("Tasks.Action")}</span>,
      render: (row) => {
        // Check if this is the first task
        const isFirstTask = filteredTasks[0]?.id === row.id;
        return (
          <ActionDropdown
            row={row}
            taskActionMenuRef={isFirstTask ? taskActionMenuRef : null}
            taskEditButtonRef={isFirstTask ? taskEditButtonRef : null}
            actions={[
              ...(hasEditPrivilege
                ? [
                    {
                      label: t("Tasks.Edit"),
                      icon: <BorderColorIcon tabIndex={0} fontSize="small" />,
                      onClick: () => onEdit(row),
                      isEdit: true, // Mark this as the edit action
                    },
                  ]
                : []),
              {
                label: t("Copy"),
                icon: <ContentCopyIcon tabIndex={0} fontSize="small" />,
                onClick: () => handleCopy(row),
              },
              ...(hasDeletePrivilege
                ? [
                    {
                      label: t("Tasks.Delete"),
                      icon: <DeleteIcon tabIndex={0} fontSize="small" />,
                      onClick: () => {
                        handleDelete(row);
                      },
                    },
                  ]
                : []),
              {
                label: t("Tasks.Audit History"),
                icon: <HistoryIcon tabIndex={0} fontSize="small" />,
                onClick: () => handleAuditHistory(row),
              },
              // Removed "View" action
            ]}
          />
        );
      },
    },
  ];

  // Filter columns based on visibility and privileges
  const columnsToRender = columns.filter((col) => {
    // Hide subTask column if user has no edit privilege
    if (col.id === "subTask" && !hasEditPrivilege) {
      return false;
    }
    return visibleColumns.includes(col.id);
  });

  return (
    <Box
      sx={{
        backgroundColor: secondaryColors.white,
        height: { xs: "calc(100vh - 100px)", sm: "calc(100vh - 120px)", md: "calc(100vh - 140px)" },
        margin: { xs: "0.5rem", sm: "0.75rem", lg: "1rem" },
        padding: { xs: "0.5rem", sm: "0.75rem", lg: "1.5rem" },
        boxShadow: "0px 0.1px 0px rgba(0,0,0,0.2)",
        borderRadius: { xs: "1rem", sm: "1.25rem", lg: "1.5rem" },
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {isLoading && (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    sx={{
      height: { xs: 150, sm: 200, md: 250 }, 
      p: { xs: 1, sm: 2 },
    }}
  >
    <LoadingIndicator size={10} />
  </Box>
)}

{error && (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    flexDirection="column"
    sx={{
      height: { xs: 150, sm: 200, md: 250 },
      p: { xs: 1, sm: 3 },
      textAlign: { xs: "center", sm: "left" }, 
    }}
  >
    <Typography
      color="error"
      sx={{
        fontSize: { xs: 14, sm: 16, md: 18 }, 
        mb: 1,
      }}
    >
      Error: {error}
    </Typography>

    <Button
      onClick={fetchTasks}
      sx={{
        mt: { xs: 1, sm: 2 },
      }}
      variant="outlined"
    >
      Retry
    </Button>
  </Box>
)}

      {!isLoading && !error && (
        <>
          <Box 
            sx={{ 
              px: { xs: 1, sm: 2 }, 
              py: { xs: 1, sm: 1.5 },
              flexShrink: 0,
            }}
          >
            <Box 
              display="flex" 
              alignItems="center" 
              justifyContent="space-between" 
              gap={2} 
              sx={{
                flexDirection: { xs: "column", sm: "row" },
                alignItems: { xs: "flex-start", sm: "center" }, 
              }}
            >
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: "bold",
                  fontSize: { xs: "1.25rem", sm: "1.5rem" },
                }}
              >
                {t("Tasks.Tasks") || "Tasks"}
              </Typography>
              
              {/* Mobile view: Icons and create button on left side */}
              {isMobile ? (
                <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} width="100%">
                  <Box display="flex" alignItems="center" gap={1}>
                 {googleSheetEnable && (
                    <Tooltip title={t("Tasks.Google Sheet")}>
                      <IconButton
                        onClick={handleGoogleSheet}
                        sx={{
                          border: "1px solid #85803c",
                          borderRadius: "8px",
                          width: 36,
                          height: 36,
                          "&:hover": {
                            backgroundColor: "rgba(131, 127, 57, 0.08)",
                            borderColor: "#837F39",
                          },
                        }}
                      >
                        <img src={googleSheetsIcon} alt="Google Sheet" style={{ width: 20, height: 20 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                    <Button
                      variant={showView === "Table" ? "contained" : "text"}
                      onClick={() => setShowView("Table")}
                      sx={{
                        minWidth: "40px",
                        height: "36px",
                        borderRadius: "6px",
                        backgroundColor: showView === "Table" ? "#8A8543" : "transparent",
                        color: showView === "Table" ? "#ffffff" : "#535353",
                        "&:hover": {
                          backgroundColor: showView === "Table" ? "#7c7b3b" : "rgba(0, 0, 0, 0.04)",
                        },
                      }}
                    >
                      <i className="fa fa-table" aria-hidden="true" title="Table"></i>
                    </Button>
                    <Button
                      variant={showView === "Monthly" ? "contained" : "text"}
                      onClick={() => setShowView("Monthly")}
                      sx={{
                        minWidth: "40px",
                        height: "36px",
                        borderRadius: "6px",
                        backgroundColor: showView === "Monthly" ? "#8A8543" : "transparent",
                        color: showView === "Monthly" ? "#fff" : "#535353",
                        "&:hover": {
                          backgroundColor: showView === "Monthly" ? "#7c7b3b" : "rgba(0, 0, 0, 0.04)",
                        },
                      }}
                    >
                      <i className="fa fa-calendar" title="Monthly"></i>
                    </Button>
                  </Box>

                  <Button
                    variant="contained"
                    onClick={handleNavigateToAddTask}
                    sx={{
                      backgroundColor: "#8A8543",
                      color: "#ffffff",
                      borderRadius: "6px",
                      textTransform: "none",
                      fontWeight: 600,
                      fontSize: "12px",
                      height: "36px",
                      px: 2,
                      "&:hover": {
                        backgroundColor: "#7c7b3b",
                      },
                    }}
                  >
                    <i className="fa fa-plus" style={{ marginRight: "6px" }}></i>
                    {t("Create") || "Create"}
                  </Button>
                </Box>
              ) : (
                /* Desktop view: Google Sheet, then View toggles (Table/Calendar) */
                <Box display="flex" alignItems="center" gap={1}>
             {isTalentSpotify() && googleSheetEnable && (
                    <Tooltip title={t("Tasks.Google Sheet")}>
                      <IconButton
                        onClick={handleGoogleSheet}
                        sx={{
                          border: "1px solid #85803c",
                          borderRadius: "8px",
                          width: 36,
                          height: 36,
                          "&:hover": {
                            backgroundColor: "rgba(131, 127, 57, 0.08)",
                            borderColor: "#837F39",
                          },
                        }}
                      >
                        <img src={googleSheetsIcon} alt="Google Sheet" style={{ width: 20, height: 20 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Button
                    variant={showView === "Table" ? "contained" : "text"}
                    onClick={() => setShowView("Table")}
                    sx={{
                      minWidth: "40px",
                      height: "36px",
                      borderRadius: "6px",
                      backgroundColor: showView === "Table" ? "#8A8543" : "transparent",
                      color: showView === "Table" ? "#ffffff" : "#535353",
                      "&:hover": {
                        backgroundColor: showView === "Table" ? "#7c7b3b" : "rgba(0, 0, 0, 0.04)",
                      },
                    }}
                  >
                    <i className="fa fa-table" aria-hidden="true" title="Table"></i>
                  </Button>
                  <Button
                    variant={showView === "Monthly" ? "contained" : "text"}
                    onClick={() => setShowView("Monthly")}
                    sx={{
                      minWidth: "40px",
                      height: "36px",
                      borderRadius: "6px",
                      backgroundColor: showView === "Monthly" ? "#8A8543" : "transparent",
                      color: showView === "Monthly" ? "#fff" : "#535353",
                      "&:hover": {
                        backgroundColor: showView === "Monthly" ? "#7c7b3b" : "rgba(0, 0, 0, 0.04)",
                      },
                    }}
                  >
                    <i className="fa fa-calendar" title="Monthly"></i>
                  </Button>
                </Box>
              )}
            </Box>
          </Box>

          {showView === "Table" && !isMobile &&(
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                minHeight: 0,
                height: "100%",
              }}
            >
              <CustomTable
                columns={columnsToRender}
                data={filteredTasks}
                page={page}
                setPage={setPage}
                rowsPerPage={rowsPerPage}
                setRowsPerPage={setRowsPerPage}
                totalPages={totalPages}
                totalCount={totalTasks}
                setVisibleColumns={setVisibleColumns}
                visibleColumns={visibleColumns}
                selectedItems={selectedTasks}
                setSelectedItems={setSelectedTasks}
                search={search}
                setSearch={setSearch}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
                pagination={true}
                handleCreateTask={handleNavigateToAddTask}
                skipInternalFilter
                indentOnlyFirstColumn
                createTaskRef={createTaskRef}
                onExport={handleTasksExport}
              />
            </Box>
          )}
          {showView === "Table" && isMobile && (
            <Box
              id="mobile-tasks-scroll-container"
              sx={{
                flex: 1,
                overflow: "auto",
                minHeight: 0,
                px: 1,
                height: "100%",
                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-track": {
                  backgroundColor: "#f1f1f1",
                  borderRadius: "3px",
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "#85803c",
                  borderRadius: "3px",
                  "&:hover": {
                    backgroundColor: "#6b6a2f",
                  },
                },
              }}
            >
              {isLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : (
                <InfiniteScroll
                  dataLength={filteredTasks.length}
                  next={loadMoreData}
                  hasMore={hasMore && !isLoading}
                  loader={
                    <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                      <CircularProgress sx={{ color: "#85803c" }} size={24} />
                    </Box>
                  }
                  endMessage={
                    filteredTasks.length > 0 ? (
                      <Box sx={{ textAlign: "center", py: 2, color: "text.secondary" }}>
                        <Typography variant="body2">No more tasks to load</Typography>
                      </Box>
                    ) : null
                  }
                  scrollableTarget="mobile-tasks-scroll-container"
                >
                  <Stack spacing={2} pb={2}>
                    {filteredTasks.map((row, index) => (
                      <MobileLeaveCard
                        key={row.id || index}
                        row={row}
                        fields={mobileFields}
                        textColor="#707070"
                        onEdit={onEdit}
                        onDelete={handleDelete}
                        canEdit={hasEditPrivilege}
                        canDelete={hasDeletePrivilege}
                      />
                    ))}
                  </Stack>
                </InfiniteScroll>
              )}
            </Box>
          )}
               
          {showView === "List" && (
            <Box
              sx={{
                flex: 1,
                overflow: "auto",
                minHeight: 0,
                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-track": {
                  backgroundColor: "#f1f1f1",
                  borderRadius: "3px",
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "#85803c",
                  borderRadius: "3px",
                  "&:hover": {
                    backgroundColor: "#6b6a2f",
                  },
                },
              }}
            >
              <ListView tasks={filteredTasks}  />
            </Box>
          )}
          {showView === "Monthly" && (
  <Box 
    sx={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      minHeight: 0,
      border: "1px solid #85803c",
      borderRadius: { xs: "0.75rem", sm: "0.875rem", lg: "1rem" },
      mx: { xs: 0.5, sm: 1 },
    }}
  >
    <Box 
      sx={{ 
        flexShrink: 0,
        px: { xs: 1, sm: 1.5 },
        pt: { xs: 1, sm: 1.5 },
      }}
    >
      <TableHeader2
        stage={stage}
        setStage={setStage}
        search={search}
        setSearch={setSearch}
        selectedItems={selectedItems}
        setSelectedItems={setSelectedItems}
        menuItemsStage={menuItemsStage}
        menuItemsExportOptions={menuItemsExportOptions}
      />
    </Box>
    <Box
      sx={{
        flex: 1,
        overflow: "auto",
        minHeight: 0,
        px: { xs: 1, sm: 1.5 },
        pb: { xs: 1, sm: 1.5 },
        "&::-webkit-scrollbar": {
          width: "6px",
          height: "6px",
        },
        "&::-webkit-scrollbar-track": {
          backgroundColor: "#f1f1f1",
          borderRadius: "3px",
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "#85803c",
          borderRadius: "3px",
          "&:hover": {
            backgroundColor: "#6b6a2f",
          },
        },
      }}
    >
      <TasksCalendar 
        tasks={filteredTasks}
        viewType="month"
        showEditPopup={(id) => setEditTaskId(id)}
        setOrderModalShow={(status) => setSubTaskModal({ show: status, taskId: null })}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
      />
    </Box>
  </Box>
)}

          {/* Modals */}
          {subTaskModal.show && (
            <SubTask
              show={subTaskModal.show}
              onHide={() => {
                setSubTaskModal({ show: false, taskId: null });
                fetchTasks();
              }}
              task={tasks.find((task) => task.id === subTaskModal.taskId)}
              handlecallback={() => fetchTasks()}
            />
          )}

          {selectedTask && (
            <TasksView
              show={showViewModal}
              onHide={() => setShowViewModal(false)}
              data={selectedTask}
            />
          )}
          {commentPopupShow && selectedRowData && (
            <CommentPopup
              show={commentPopupShow}
              onHide={() => setCommentPopupShow(false)}
              krReferenceId={selectedRowData.id}
              data={selectedRowData}
              handlecallback={(updatedComments) => {
                try {
                  const count = Array.isArray(updatedComments) ? updatedComments.length : Number(updatedComments?.length || 0);
                  const targetId = selectedRowData.id;
                  const updateCommentsCountInTree = (nodes) =>
                    (nodes || []).map((node) => {
                      if (node.id === targetId) {
                        return { ...node, comments: count };
                      }
                      if (Array.isArray(node.children) && node.children.length > 0) {
                        return { ...node, children: updateCommentsCountInTree(node.children) };
                      }
                      return node;
                    });
                  setTasks((prev) => updateCommentsCountInTree(prev));
                } catch (e) {}
              }}
            />
          )}

          <ShowAuditHistory
            show={showAuditModal}
            onHide={() => setShowAuditModal(false)}
            data={auditData}
          />
        </>
      )}

      {/* Onboarding Component */}
      <UserOnboarding
        story={location.state ? getStory() : []}
        isVisible={isVisible}
        onClose={() => {
          setIsVisible(false);
        }}
      />

      {/* CSS Styles for tutorial */}
      <style>{`
        /* Fix broken cancel icon in react-user-onboarding */
        img[alt="cancel"] {
          display: none !important;
        }
        
        img[alt="cancel"]::before {
          content: '✕';
          font-size: 24px;
          color: #666;
          cursor: pointer;
          font-weight: 300;
          display: inline-block;
        }
        
        /* Target the cancel button container */
        [class*="cancel"] {
          position: relative;
          cursor: pointer;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        [class*="cancel"]::after {
          content: '✕';
          font-size: 24px;
          color: #666;
          cursor: pointer;
          font-weight: 300;
          line-height: 1;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        
        [class*="cancel"]:hover::after {
          color: #333;
        }
        
        /* Tutorial highlight effect */
        .tutorial-highlight {
          position: relative;
          z-index: 9999 !important;
          box-shadow: 0 0 0 4px rgba(131, 127, 57, 0.4) !important;
          border-radius: 100px !important;
          animation: pulse 2s infinite;
          display: inline-block;
        }
        
        .tutorial-highlight button {
          border-radius: 100px !important;
        }
        
        /* Highlight for menu items */
        li.tutorial-highlight {
          border-radius: 8px !important;
          background-color: rgba(131, 127, 57, 0.1) !important;
        }
        
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 4px rgba(131, 127, 57, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(131, 127, 57, 0.2);
          }
          100% {
            box-shadow: 0 0 0 4px rgba(131, 127, 57, 0.4);
          }
        }
      `}</style>
    </Box>
  );
};

export default TaskTable;