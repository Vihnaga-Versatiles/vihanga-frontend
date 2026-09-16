import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Checkbox,
  InputLabel,
  Grid,
  Box,
  Typography,
  useTheme,
  useMediaQuery,
  Autocomplete,
  TextField,
  Chip,
} from "@mui/material";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import FileUpload from "../../../components/filesUplode/draganddropFile";
import { SelectComponent } from "pages/vihanga/components/input-elements/select";
import { InputTextComponent } from "pages/vihanga/components/input-elements/text";
import axios from "axios";

import Stepper from "pages/vihanga/components/stepper";
import { useHistory, useLocation } from "react-router-dom";
import Recurrence from "./Recurrance";
import Progress from "../components/pages/Progress";
import {
  createTask,
  getTasksById,
  updateTask,
  getTasks,
} from "action/TasksAct";
import { getKeyResults, getKeyResultsSingle } from "action/keyResultAct";
import { getEmployees } from "action/EmployeeAct";
import { useDispatch } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import CheckIcon from "@mui/icons-material/Check";
import { debounce } from "lodash";
import LottieConfettie from "assets/images/LottieConfettie.gif";
import { Toast } from "service/toast";
import "./task.scss";
import { getAllRewards } from "action/RewardManagementAct";
import { getAllPrivilegesGroup } from "action/PrivilegesGroupAct";
import {
  getTaskRewardPoints,
  getSubTaskRewardPoints,
} from "utils/rewardCalculator";
import { useTranslation } from "react-i18next";
import { createComment as createTaskComment } from "action/TasksCommentsAct";
const useQuery = () => {
  return new URLSearchParams(useLocation().search);
};

const resolveTaskId = (payload) => {
  if (!payload) return null;

  const normalize = (value) => {
    if (!value) return null;
    if (typeof value === "string" || typeof value === "number") {
      return value.toString();
    }
    return resolveTaskId(value);
  };

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const id = resolveTaskId(item);
      if (id) return id;
    }
    return null;
  }

  return (
    normalize(payload._id) ||
    normalize(payload.id) ||
    normalize(payload.taskId) ||
    normalize(payload.task) ||
    normalize(payload.data) ||
    normalize(payload.result) ||
    null
  );
};

const AddTaskForm = () => {
  const history = useHistory();
  const location = useLocation();
  const query = useQuery();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { t } = useTranslation();
  // Responsive breakpoints
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const steps = [
    { label: t("Tasks.Objective") },
    { label: t("Tasks.KR") },
    { label: t("Tasks.Task") },
  ];

  const [activeStep, setActiveStep] = useState(2); // Default to Task step
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stepperDisabled, setStepperDisabled] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [keyResults, setKeyResults] = useState([]);
  const [loadingKeyResults, setLoadingKeyResults] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [rewardSchemes, setRewardSchemes] = useState([]);
  const [privilegeGroups, setPrivilegeGroups] = useState([]);

  // Query parameters - move this before useState
  const objectiveId = query.get("objectiveId");
  const keyResultId = query.get("keyResultId");
  const taskId = query.get("taskId");
  const parentTaskId = query.get("parentTaskId");
  const isEdit = !!taskId;
  const fromTask = query.get("fromTask");

  // User data
  const user = localStorage.getItem("user")
    ? JSON.parse(localStorage.getItem("user"))
    : null;
  const companyId = localStorage.getItem("companyId")
    ? JSON.parse(localStorage.getItem("companyId"))
    : null;

  // Form state - now parentTaskId is available
  const [formData, setFormData] = useState(() => {
    // Get logged in user from localStorage
    const user = JSON.parse(localStorage.getItem("userData")) || {};


    return {
      taskTitle: "",
      taskDescription: "",
      startDate: "",
      dueDate: "",
      actualCompletionDate: "",
      linkToKr: "",
      assignTo: user?.ownerId ? [user.ownerId] : [], // Set default assignTo as array with logged in user's ID
      priority: "",
      status: "notstarted",
      progressStatus: 0,
      mainTask: parentTaskId || "",
      comments: "",
      recurrence: false,
      recurrenceDetails: "",
      progress: "0",
      file: null,
    };
  });

  // Update active step based on current route
  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath.includes("/objectives/objective")) {
      setActiveStep(0);
    } else if (currentPath.includes("/objectives/keyresult")) {
      setActiveStep(1);
    } else if (currentPath.includes("/objectives/task")) {
      setActiveStep(2);
    }
  }, [location.pathname]);

  // Check form validity and update stepper disabled state
  useEffect(() => {
    const isValid = isFormValid();
    setStepperDisabled(!isValid);
  }, [formData]);

  // Fetch task data if in edit mode and taskId is available
  useEffect(() => {
    if (taskId) {
      fetchTaskData();
    }
  }, [taskId]);

  // Effect to fetch reward schemes and privilege groups on mount
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

  // Fetch key results on component mount
  useEffect(() => {
    fetchKeyResults();
    fetchEmployees();
    fetchTasks();
  }, []);

  const handleUploadToCloudinary = async (file) => {
    try {
      setUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("upload_preset", "ma7nge92");

      const response = await axios.post(
        "https://api.cloudinary.com/v1_1/dbqm9svvp/raw/upload",
        uploadFormData,
        {
          onUploadProgress: (progressEvent) => {
            const percent = Math.round(
              (progressEvent.loaded / progressEvent.total) * 100
            );
            if (
              percent === 25 ||
              percent === 50 ||
              percent === 75 ||
              percent === 100
            ) {
              Toast({
                message: `Uploaded ${percent}%`,
                type: "success",
                time: 500,
              });
            }
          },
        }
      );

      const fileUrl = response.data.secure_url;
      setUploadedFileUrl(fileUrl);
      Toast({
        message: "File uploaded successfully!",
        type: "success",
        time: 2000,
      });

      return fileUrl;
    } catch (error) {
      console.error("Upload failed:", error);
      Toast({
        message: "Upload failed. Please try again.",
        type: "error",
        time: 3000,
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const fetchKeyResults = async () => {
    try {
      setLoadingKeyResults(true);
      let user =
        JSON.parse(localStorage.getItem("user")) !== null
          ? JSON.parse(localStorage.getItem("user"))
          : null;
      let response = await dispatch(
        getKeyResultsSingle(user._id, {
          type: "me",
        })
      );
      console.log(response, "dsfosdijf");
      if (response.data && response.data.length > 0) {
        const keyResultOptions = response.data.map((item) => ({
          value: item._id,
          label: item.keyResultName,
        }));
        setKeyResults(keyResultOptions);

        // Auto-select linkToKr based on keyResultId from URL
        if (keyResultId && !formData.linkToKr) {
          const matchingKeyResult = keyResultOptions.find(
            (kr) => kr.value === keyResultId
          );
          if (matchingKeyResult) {
            setFormData((prev) => ({
              ...prev,
              linkToKr: matchingKeyResult.value,
            }));
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch key results:", err);
    } finally {
      setLoadingKeyResults(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await dispatch(getEmployees());
      if (response.data && response.data.length > 0) {
        const employeeOptions = response.data.map((item) => ({
          value: item._id,
          label: `${item.personalInformation.firstName} ${item.personalInformation.lastName}`,
        }));
        // Remove duplicates based on label
        const uniqueEmployees = employeeOptions.filter(
          (employee, index, self) =>
            index === self.findIndex((e) => e.label === employee.label)
        );
        setEmployees(uniqueEmployees);
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoadingTasks(true);
      const response = await dispatch(getTasks());
      if (response.data && response.data.length > 0) {
        const taskOptions = response.data.map((item) => ({
          value: item._id || item.id,
          label: item.title,
        }));
        // Add default option at the beginning
        const tasksWithDefault = [
          { value: "", label: "--Default--" },
          ...taskOptions,
        ];
        setTasks(tasksWithDefault);
      } else {
        // If no tasks, just set default option
        setTasks([{ value: "", label: "--Default--" }]);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      // Set default option even on error
      setTasks([{ value: "", label: "--Default--" }]);
    } finally {
      setLoadingTasks(false);
    }
  };
const [isOwner, setIsOwner] = useState(true);
const [canEditDueDate, setCanEditDueDate] = useState(false);
  const fetchTaskData = async () => {
    try {
      setLoading(true);
      const response = await dispatch(getTasksById(taskId));
      console.log("response", response);
      if (response.data) {
        const task = response.data;

        const loggedInUser = JSON.parse(localStorage.getItem("user")) || {};
     

      if (loggedInUser._id === task?.userId) {
        setCanEditDueDate(true);
      }
        setFormData({
          taskTitle: task.title || "",
          taskDescription: task.description || "",
          startDate: task.startDate || "",
          dueDate: task.dueDate || "",
          actualCompletionDate: task.actualCompletionDate || "",
          linkToKr: task.linkToKr || task.krReferenceId || "",
          assignTo: Array.isArray(task.assignTo) ? task.assignTo : (task.assignTo ? [task.assignTo] : []), // Handle both array and single value
          priority: task.priority || "",
          status: task.status || "",
          progressStatus: task.progressStatus || 0,
          attachments: task?.attachments || "",
          mainTask: task.mainTask || "",
          comments: task.comments || "",
          recurrence: task.recurrence || false,
          recurrenceDetails: task.recurrenceDetails || "",
          progress: task.progressStatus?.toString() || "0",
          file: task.attachments?.[0] || null,
        });

        // Set uploaded file URL if exists
        if (task.attachments && task.attachments.length > 0) {
          setUploadedFileUrl(task.attachments);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to fetch task data");
    } finally {
      setLoading(false);
    }
  };

  // Handle stepper click navigation
  const handleStepClick = (stepIndex) => {
    if (stepperDisabled) return;

    setActiveStep(stepIndex);
    if (fromTask === "true") {
      history.push("/admin/tasks");
      return;
    }
    if (stepIndex === 0) {
      history.push(
        `/admin/objectives/objective?${
          isEdit ? "isEdit=true" : ""
        }&objectiveId=${objectiveId}`
      );
    } else if (stepIndex === 1) {
      history.push(
        `/admin/objectives/details?${
          isEdit ? "isEdit=true" : ""
        }&objectiveId=${objectiveId}&keyResultId=${keyResultId}`
      );
    } else if (stepIndex === 2) {
      history.push(
        `/admin/objectives/task?${
          isEdit ? "isEdit=true" : ""
        }&objectiveId=${objectiveId}&keyResultId=${keyResultId}&taskId=${taskId}`
      );
    }
  };

  const handleInputChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Handle form field changes
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when field is updated
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate required fields
  const validateForm = () => {
    const requiredFields = {
      taskTitle: "Task title is required",
      taskDescription: "Task description is required",
      startDate: "Start date is required",
      dueDate: "Due date is required",
      priority: "Priority is required",
      status: "Status is required",
    };

    const newErrors = {};

    Object.entries(requiredFields).forEach(([field, message]) => {
      if (!formData[field] || formData[field] === "") {
        newErrors[field] = message;
      }
    });

    // Validate date sequence
    if (
      formData.startDate &&
      formData.dueDate &&
      new Date(formData.startDate) > new Date(formData.dueDate)
    ) {
      newErrors.dueDate = "Due date must be after start date";
    }

    // Validate recurrence details if recurrence is enabled
    if (formData.recurrence && !formData.recurrenceDetails) {
      newErrors.recurrenceDetails = "Recurrence details are required";
    }
    console.log(newErrors, "sdfdsjfdsij");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    const requiredFields = [
      "taskTitle",
      "taskDescription",
      "startDate",
      "dueDate",
      "priority",
      "status",
    ];
    const hasAllRequiredFields = requiredFields.every(
      (field) => formData[field] && formData[field] !== ""
    );

    const datesValid =
      !formData.startDate ||
      !formData.dueDate ||
      new Date(formData.startDate) <= new Date(formData.dueDate);
    const recurrenceValid = !formData.recurrence || formData.recurrenceDetails;

    return hasAllRequiredFields && datesValid && recurrenceValid;
  };

  // Debounced save to sessionStorage
  const debouncedSave = debounce((data) => {
    if (!isEdit) {
      sessionStorage.setItem("taskFormData", JSON.stringify(data));
    }
  }, 500);

  // Save form data to sessionStorage
  useEffect(() => {
    debouncedSave(formData);
    return () => debouncedSave.cancel();
  }, [formData]);

  const handleRecurrenceChange = (event) => {
    const checked = event.target.checked;
    setOpen(checked);
    handleChange("recurrence", checked);

    if (!checked) {
      handleChange("recurrenceDetails", "");
    }
  };

  // Handle form submission
  const handleSubmit = async (finish = false) => {
    console.log("handleSubmit called with finish:", finish, "isEdit:", isEdit);
    // Run validation first to populate errors
    const isValid = validateForm();

    if (!isValid) {
      // Get the current errors after validation
      const currentErrors = { ...errors };
      const errorMessages = Object.values(currentErrors);

      if (errorMessages.length > 0) {
        // Show specific field errors
        const firstError = errorMessages[0];
        Toast({
          type: "error",
          message: firstError,
          time: 4000,
        });
      } else {
        // Fallback message
        Toast({
          type: "error",
          message: "Please fill all required fields",
          time: 4000,
        });
      }
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Calculate dynamic reward points and approval status based on user eligibility
      const isSubTask = formData.mainTask && formData.mainTask !== "";
      const rewardConfig = isSubTask
        ? getSubTaskRewardPoints({
            userId: user._id,
            rewardSchemes,
            privilegeGroups,
          })
        : getTaskRewardPoints({
            userId: user._id,
            rewardSchemes,
            privilegeGroups,
          });

      const dynamicRewardPoints = rewardConfig?.points || 0;
      const approvalRequired = rewardConfig?.approvalRequired || false;

      // Determine the progress value to send in API
      // If status is "completed" and we're updating the task, automatically set progress to 100
      const progressValue =
        isEdit && formData.status === "completed" ? "100" : formData.progress;

      const taskData = {
        title: formData.taskTitle,
        description: formData.taskDescription,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
        actualCompletionDate: formData.actualCompletionDate || null,
        linkToKr: formData.linkToKr || null,
        assignTo: formData.assignTo, // Already an array, send as is
        priority: formData.priority,
        status: formData.status,
        comments: formData.comments || "",
        attachments: uploadedFileUrl ? uploadedFileUrl : "", // Store as attachments array
        krReferenceId: formData.linkToKr || keyResultId,
        objectiveReferenceId: objectiveId,
        recurrence: formData.recurrence,
        recurrenceDetails: formData.recurrenceDetails || null,
        progressStatus: progressValue, // Use the determined progress value
        mainTask: formData.mainTask || null,
        companyId: companyId || "6396f7d703546500086f0200",
        userId:!isEdit ? user?._id:formData?.userId,
        dynamicRewardPoints: dynamicRewardPoints,
        approvalRequired: approvalRequired,
      };

      const response = isEdit
        ? await dispatch(updateTask(taskId, taskData))
        : await dispatch(createTask(taskData));

      if (response.success) {
        const createdTaskId = resolveTaskId(response?.data);
        const referenceId = isEdit ? taskId : createdTaskId;
        const trimmedComment = formData.comments?.trim();

        if (trimmedComment) {
          if (!referenceId) {
            Toast({
              type: "error",
              message: "Unable to link comment to the task",
              time: 3000,
            });
          } else {
            const employeeName =
              user?.name ||
              [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
            const commentPayload = {
              employeeId: user?._id || user?.id || "",
              employeeName: employeeName || "User",
              comment: trimmedComment,
              referenceId,
              attachment: "",
            };

            if (!isEdit) {
              try {
                const commentResponse = await dispatch(createTaskComment(commentPayload));
                if (!commentResponse?.success) {
                  Toast({
                    type: "error",
                    message: commentResponse?.message || "Failed to save comment",
                    time: 3000,
                  });
                }
              } catch (commentError) {
                Toast({
                  type: "error",
                  message: "Failed to save comment",
                  time: 3000,
                });
              }
            }
          }
        }

        // Cleanup and cache invalidation
        sessionStorage.removeItem("taskFormData");
        queryClient.invalidateQueries("tasks");

        // Check if we came from reviews
        const fromReviews = query.get("fromReviews") === "true";

        // Get reward points from API response
        const apiRewardPoints = response.data?.rewardPoints || response.data?.dynamicRewardPoints || 0;
        
        // Show animation only after successful update when progress is 100 and user has reward points from API
        const shouldShowAnimation = formData.progress == 100 && apiRewardPoints > 0;
        
        console.log("Task submission success - Animation check:", {
          progress: formData.progress,
          progressType: typeof formData.progress,
          apiRewardPoints,
          shouldShowAnimation
        });
        
        if (shouldShowAnimation) {
          console.log("Showing reward animation with points from API:", apiRewardPoints);
          setShowGif(true);
          setRewardPoints(apiRewardPoints);
          
          // Delay navigation to show the animation
          setTimeout(() => {
            setShowGif(false);
            setRewardPoints(0);
            
            // Navigate after animation
            performNavigation();
          }, 5000);
        } else {
          // Navigate immediately if no animation
          performNavigation();
        }

        // Helper function to handle navigation logic
        function performNavigation() {
          // When editing, navigate back appropriately
          if (isEdit) {
            console.log("Editing mode - navigating back");
            if (fromTask === "true") {
              history.push('/admin/tasks');
            } else if (fromReviews) {
              // Navigate back to reviews if we came from there
              history.push("/admin/reviews");
            } else {
              // Navigate back to objectives when editing
              history.push(`/admin/objectives`);
            }
          } else {
            // When creating a new task
            if (finish) {
              console.log("Creating mode - Finish button - navigating to tasks");
              // Navigate to tasks page when "Finish" button is clicked
              history.push('/admin/tasks');
            } else {
              console.log("Creating mode - Save & Add Another - staying on page");
              // Stay on page and reset the form for "Save & Add Another"
              const user = JSON.parse(localStorage.getItem("userData")) || {};
              setFormData({
                taskTitle: "",
                taskDescription: "",
                startDate: "",
                dueDate: "",
                actualCompletionDate: "",
                linkToKr: keyResultId || "", 
                assignTo: user?.ownerId ? [user.ownerId] : [], // Reset to array with logged in user
                priority: "",
                status: "notstarted",
                progressStatus: 0,
                mainTask: "",
                comments: "",
                recurrence: false,
                recurrenceDetails: "",
                progress: "0",
                file: null,
              });
              setUploadedFileUrl("");
            }
          }
        }
      } else {
        setError(response.message || "An error occurred");
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = useCallback(async (file) => {
    if (file && file.file) {
      const fileUrl = await handleUploadToCloudinary(file.file);
      if (fileUrl) {
        setFormData((prev) => ({ ...prev, file: file.name }));
      }
    }
  }, []);

  const handleOkrClick = () => {
    // Check if we came from reviews
    const fromReviews = query.get("fromReviews") === "true";

    if (fromReviews) {
      history.push("/admin/reviews");
    } else {
      history.push(
        `/admin/objectives/details?${
          isEdit ? "isEdit=true" : ""
        }&objectiveId=${objectiveId}&keyResultId=${keyResultId}`
      );
    }
  };

  // Remove the useEffect that triggers animation on progress change
  // Animation will only be shown during form submission based on successful update
  
  return (
    <div style={{ paddingLeft: "20px", paddingRight: "20px" }}>
      <div className={showGif ? "gif" : "dgif"}>
        <img
          src={LottieConfettie}
          className={"lottie-img"}
          alt="LottieConfettie"
        />
        <br />
        <h3>You have earned {rewardPoints} reward points</h3>
      </div>
      {open && (
        <Recurrence
        tabindex={0}
          open={open}
          setOpen={setOpen}
          setRecurrenceDetails={(details) =>
            handleChange("recurrenceDetails", details)
          }
        />
      )}

      <Box
        mt={"20px"}
        sx={{
          width: "100%",
          paddingBottom: "10px",
          borderRadius: "16px",
          backgroundColor: "#fff",
          boxShadow: 1,
        }}
      >
        <Stepper
          steps={steps}
          activeStep={activeStep}
          stepIconColor="#837F39"
          connectorColor="#9E9E9E"
          onStepClick={handleStepClick}
          sx={{ width: "100%", mx: "auto", gap: "20px" }}
          disabled={stepperDisabled}
        />
      </Box>

      <Box
        mt={"20px"}
        sx={{
          padding: "20px",
          backgroundColor: "#fff",
          borderRadius: "20px",
          boxShadow: 1,
        }}
      >
        <Box display="flex" alignItems="center" mb={3}>
          {!isEdit && (
            <ArrowBackIosIcon
            tabindex={0}
              sx={{ fontSize: 32, mt: "-4px", mr: 1, cursor: "pointer" }}
              onClick={handleOkrClick}
            />
          )}
          <Typography
            sx={{
              fontSize: "32px",
              fontWeight: 700,
              fontFamily: "Montserrat",
            }}
          >
            {isEdit ? t("Tasks.EditTask") : t("Tasks.AddTask")}
          </Typography>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <Typography>{t("Tasks.Loading task data...")}</Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Required Fields */}
            <Grid item xs={12}>
              <InputLabel>{t("OKR Details.Task Title")} *</InputLabel>
              <InputTextComponent
                value={formData.taskTitle}
                onChange={(e) => handleChange("taskTitle", e.target.value)}
                error={!!errors.taskTitle}
                helperText={errors.taskTitle}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <InputLabel>{t("OKR Details.Task Description")} *</InputLabel>
              <InputTextComponent
                value={formData.taskDescription}
                onChange={(e) =>
                  handleChange("taskDescription", e.target.value)
                }
                error={!!errors.taskDescription}
                helperText={errors.taskDescription}
                multiline
                rows={4}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <InputLabel>{t("OKR Details.Start Date")} *</InputLabel>
              <InputTextComponent
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange("startDate", e.target.value)}
                error={!!errors.startDate}
                helperText={errors.startDate}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <InputLabel>{t("OKR Details.Due Date")}*</InputLabel>
              <InputTextComponent
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleChange("dueDate", e.target.value)}
                error={!!errors.dueDate}
                helperText={errors.dueDate}
                fullWidth
                disabled={!canEditDueDate && isEdit}
              />
            </Grid>

            {/* Optional Fields */}
            <Grid item xs={12} sm={4}>
              <InputLabel>{t("OKR Details.Actual Completion Date")}</InputLabel>
              <InputTextComponent
                type="date"
                value={formData.actualCompletionDate}
                onChange={(e) =>
                  handleChange("actualCompletionDate", e.target.value)
                }
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <InputLabel>{t("OKR Details.Link To KR")}</InputLabel>
              <SelectComponent
                value={formData.linkToKr}
                onChange={(e) => handleChange("linkToKr", e.target.value)}
                options={keyResults}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <InputLabel>{t("Tasks.Assign To")}</InputLabel>
              <Autocomplete
                multiple
                id="assign-to-autocomplete"
                options={employees}
                value={employees.filter(emp => formData.assignTo.includes(emp.value))}
                onChange={(event, newValue) => {
                  handleChange("assignTo", newValue.map(emp => emp.value));
                }}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="outlined"
                    placeholder={formData.assignTo.length === 0 ? "Select users to assign" : ""}
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option.label}
                      {...getTagProps({ index })}
                      sx={{
                        backgroundColor: "#837F39",
                        color: "#fff",
                        "& .MuiChip-deleteIcon": {
                          color: "#fff",
                          "&:hover": {
                            color: "#ddd",
                          },
                        },
                      }}
                    />
                  ))
                }
                sx={{
                  "& .MuiOutlinedInput-root": {
                    padding: "8px",
                  },
                }}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <InputLabel>{t("OKR Details.Priority")} *</InputLabel>
              <SelectComponent
                value={formData.priority}
                onChange={(e) => handleChange("priority", e.target.value)}
                options={[
                  { value: "High Level", label: t("Tasks.HighLevel") },
                  { value: "Medium Level", label: t("Tasks.MediumLevel") },
                  { value: "Low Level", label: t("Tasks.LowLevel") },
                ]}
                error={!!errors.priority}
                helperText={errors.priority}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <InputLabel>{t("OKR Details.Status")} *</InputLabel>
              <SelectComponent
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
                options={[
                  { value: "notstarted", label: t("Tasks.Not Started") },
                  { value: "inprogress", label: t("Tasks.In Progress") },
                  { value: "onhold", label: t("Tasks.OnHold") },
                  { value: "completed", label: t("Tasks.Completed") },
                ]}
                error={!!errors.status}
                helperText={errors.status}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6} marginTop="30px">
              <Box display="flex" alignItems="center">
                <Checkbox
                  checked={formData.recurrence}
                  onChange={handleRecurrenceChange}
                  icon={
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #535353",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    />
                  }
                  checkedIcon={
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        backgroundColor: "#837F39",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckIcon
                        sx={{
                          fontSize: 18,
                          color: "#FFFFFF",
                          alignItems: "center",
                        }}
                      />
                    </Box>
                  }
                  sx={{ padding: 0 }}
                />
                <Typography sx={{ marginLeft: 1 }}>
                  {t("Tasks.Recurrence")}
                </Typography>
              </Box>
              {errors.recurrenceDetails && (
                <Typography color="error" variant="caption">
                  {errors.recurrenceDetails}
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={6}>
              <InputLabel>{t("Tasks.Main Task")}</InputLabel>
              <SelectComponent
                value={formData.mainTask}
                onChange={(e) => handleChange("mainTask", e.target.value)}
                options={tasks}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <Progress
                value={formData.progress}
                onChange={(e) =>
                  handleInputChange("progress", Number(e.target.value))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Typography component="label">{t("Tasks.Comment")}</Typography>
              <InputTextComponent
                type="text"
                value={formData.comments}
                onChange={(e) => handleInputChange("comments", e.target.value)}
                placeholder={t("Tasks.commentHere")}
                multiline={true}
                minRows={3}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <Typography
                variant="body1"
                fontWeight={500}
                mt={3}
                color="rgba(14, 14, 14, 1)"
              >
                {t("Tasks.Upload Files")}
                {uploading && (
                  <Typography component="span" sx={{ ml: 1, color: "#1976d2" }}>
                    {t("Tasks.Uploading")}
                  </Typography>
                )}
                {uploadedFileUrl && !uploading && (
                  <Typography component="span" sx={{ ml: 1, color: "#4CAF50" }}>
                    ✓ {t("Tasks.File uploaded")}
                  </Typography>
                )}
              </Typography>
              <FileUpload
                id="task-upload"
                sx={{ width: "100%" }}
                value={formData.file}
                link={uploadedFileUrl}
                onFileUpload={handleFileChange}
                disabled={uploading}
              />
            </Grid>

            {error && (
              <Grid item xs={12}>
                <Typography color="error" align="center">
                  {error}
                </Typography>
              </Grid>
            )}

            <Grid item xs={12} sx={{ textAlign: "center", mt: 2 }}>
              <Box
                display="flex"
                justifyContent="center"
                gap={2}
                flexDirection={isMobile ? "column" : "row"}
                alignItems={isMobile ? "stretch" : "center"}
              >
                <Button
                  variant="outlined"
                  sx={{
                    color: "#73712A",
                    borderColor: "#73712A",
                    borderRadius: "30px",
                    padding: isMobile
                      ? "16px 24px"
                      : isTablet
                      ? "14px 28px"
                      : "12px 30px",
                    fontWeight: "bold",
                    fontSize: isMobile ? "14px" : "16px",
                    minWidth: isMobile ? "100%" : "auto",
                    "&:disabled": { opacity: 0.7 },
                  }}
                  onClick={() => handleSubmit(false)}
                  disabled={loading || uploading}
                >
                  {loading
                    ? t("Tasks.Processing")
                    : isEdit
                    ? t("Tasks.UpdateTask")
                    : t("Tasks.SaveAddAnother")}
                </Button>

                {!isEdit && (
                  <Button
                    variant="contained"
                    onClick={() => handleSubmit(true)}
                    disabled={loading || uploading}
                    sx={{
                      backgroundColor: "#73712A",
                      borderRadius: "30px",
                      padding: isMobile
                        ? "16px 24px"
                        : isTablet
                        ? "14px 28px"
                        : "12px 30px",
                      fontWeight: "bold",
                      fontSize: isMobile ? "14px" : "16px",
                      minWidth: isMobile ? "100%" : "auto",
                      marginLeft: isMobile ? "0" : "10px",
                      marginTop: isMobile ? "10px" : "0",
                      "&:disabled": { opacity: 0.7 },
                      "&:hover": { backgroundColor: "#5a581f" },
                    }}
                  >
                    {t("Tasks.Finish")}
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        )}
      </Box>
    </div>
  );
};

export default AddTaskForm;
