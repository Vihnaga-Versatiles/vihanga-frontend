import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Typography,
  Box,
  Button,
  Grid,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { InputTextComponent } from "../../../../../vihanga/components/input-elements/text";
import { SelectComponent } from "../../../../../vihanga/components/input-elements/select";
import FileUploadCustom from "pages/vihanga/components/filesUplode/draganddropFile";
import LeaveCards from "./cardsTopSection";
import LeaveTable from "../leaveHistory";
import axios from "axios";
import { Toast } from "service/toast";
import { appURL } from "utilities";
import { validateForm } from "utilities/Validator";
import { leaveFormRules } from "./validateRules";
import { getItemFromLocalStorage } from "utilities/getLocalStorageItem";
import { getSelectedTabType } from "utilities/getLocalStorageItem";
import { getThemeColors } from "utilities/getThemeColors";
import { differenceInDays, format, isValid, parse } from "date-fns";
import { useHistory, useLocation } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import UserOnboarding from "react-user-onboarding";
import { canEdit } from "utilities/privilegeHelper";

const ApplyforLeave = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // < 600px
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md")); // 600px - 960px
  const history = useHistory();
  const location = useLocation();

  // Onboarding refs
  const absenceTypeRef = useRef();
  const fromDateRef = useRef();
  const toDateRef = useRef();
  const halfDayRef = useRef();
  const noteRef = useRef();
  const fileUploadRef = useRef();
  const submitButtonRef = useRef();

  // Onboarding state
  const [isVisible, setIsVisible] = useState(false);

  const [resumeFile, setResumeFile] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshTable, setRefreshTable] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(false);
  const [leaveSummary, setLeaveSummary] = useState([]);
  const [othersDialogOpen, setOthersDialogOpen] = useState(false);
  const [othersDialogItems, setOthersDialogItems] = useState([]);
  const [othersDialogHeader, setOthersDialogHeader] = useState("");
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [formData, setFormData] = useState({
    absenceType: "",
    from: "",
    to: "",
    durationOfAbsence: "",
    note: "",
    halfDay: false,
  });

  const [obj,setSelectedObject]=useState({})
  const {t} = useTranslation()
  const user = getItemFromLocalStorage("user");

  const openPdfViewer = async () => {
    setPdfViewerOpen(true);
    setPdfLoading(true);
    try {
      const response = await axios.get(`${appURL}/recruitment/leave-policy`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const objectUrl = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return objectUrl;
      });
    } catch (err) {
      console.error("Leave Policy load error:", err);
      Toast({
        message: err.response?.data?.message || "Failed to load Leave Policy",
        type: "error",
      });
      setPdfViewerOpen(false);
    } finally {
      setPdfLoading(false);
    }
  };

  const closePdfViewer = () => {
    setPdfViewerOpen(false);
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const fetchLeaveTypes = async () => {
    setLoadingLeaveTypes(true);
    try {
      const companyId = getItemFromLocalStorage("companyId");
      const type = getSelectedTabType();
      const response = await axios.get(`${appURL}/recruitment/leave-type`, {
        params: {
          page: 1,
          limit: 100,
          companyId,
          type,
        },
      });

      setLeaveTypes(response?.data?.data?.data || []);
    } catch (err) {
      console.error("Fetch Leave Types Error:", err);
      Toast({
        message: err.response?.data?.message || "Failed to fetch leave types",
        type: "error",
      });
    } finally {
      setLoadingLeaveTypes(false);
    }
  };

  const userRoleId = getItemFromLocalStorage("user");
const companyId = getItemFromLocalStorage("companyId");

  const { primaryColor, secondaryColors } = getThemeColors();
  const fetchData = async () => {
    try {
      const type = getSelectedTabType();
      const response = await axios.get(`${appURL}/recruitment/summary`, {
        params: {
          companyId,
          empId: userRoleId._id,
          type,
        },
      });
      setLeaveSummary(response.data?.data?.data);
    } catch (err) {
      console.error("Fetch Error:", err);
      Toast({
        message: err.response?.data?.message || "Failed to fetch data",
        type: "error",
      });
    }
  };

  const handleCardClick = (item) => {
    const category = (item?.category || "").toLowerCase();
    if (category === "others") {
      setOthersDialogHeader("Other Leaves");
      setOthersDialogItems(item?.leaveTypes || []);
      setOthersDialogOpen(true);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
    fetchData();
  }, []);

  // Onboarding tutorial effect
  useEffect(() => {
    if (location.state && location.state.story === "applyLeaveTutorial") {
      const checkAndActivate = () => {
        if (absenceTypeRef.current) {
          setIsVisible(location.state ? location.state.isVisible : false);
          window.history.replaceState({ isVisible: false }, document.title);
        } else {
          setTimeout(checkAndActivate, 100);
        }
      };
      
      setTimeout(checkAndActivate, 300);
    }
  }, [location]);

  // Add highlight class to tutorial elements
  useEffect(() => {
    if (isVisible && location.state) {
      const refs = [absenceTypeRef, fromDateRef, toDateRef, halfDayRef, noteRef, fileUploadRef, submitButtonRef];
      refs.forEach(ref => {
        if (ref.current) {
          ref.current.classList.add('tutorial-highlight');
        }
      });
    } else {
      const refs = [absenceTypeRef, fromDateRef, toDateRef, halfDayRef, noteRef, fileUploadRef, submitButtonRef];
      refs.forEach(ref => {
        if (ref.current) {
          ref.current.classList.remove('tutorial-highlight');
        }
      });
    }
    
    return () => {
      const refs = [absenceTypeRef, fromDateRef, toDateRef, halfDayRef, noteRef, fileUploadRef, submitButtonRef];
      refs.forEach(ref => {
        if (ref.current) {
          ref.current.classList.remove('tutorial-highlight');
        }
      });
    };
  }, [isVisible, location]);

  // Story configuration for apply leave tutorial
  const applyLeaveStory = [
    {
      component: "tooltip",
      ref: absenceTypeRef,
      children: (
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>Step 1: Select Absence Type</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.9rem" }}>
            Choose the type of leave you want to apply for (e.g., Sick Leave, Annual Leave, etc.)
          </Typography>
        </Box>
      ),
    },
    {
      component: "tooltip",
      ref: fromDateRef,
      children: (
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>Step 2: Select From Date</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.9rem" }}>
            Choose the start date of your leave
          </Typography>
        </Box>
      ),
    },
    {
      component: "tooltip",
      ref: toDateRef,
      children: (
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>Step 3: Select To Date</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.9rem" }}>
            Choose the end date of your leave. The duration will be calculated automatically
          </Typography>
        </Box>
      ),
    },
    {
      component: "tooltip",
      ref: halfDayRef,
      children: (
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>Step 4: Half Day Option</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.9rem" }}>
            If you need leave for half a day only, check this box
          </Typography>
        </Box>
      ),
    },
    {
      component: "tooltip",
      ref: noteRef,
      children: (
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>Step 5: Add Note</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.9rem" }}>
            Write a brief description or reason for your leave
          </Typography>
        </Box>
      ),
    },
    {
      component: "tooltip",
      ref: fileUploadRef,
      children: (
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>Step 6: Upload Documents (Optional)</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.9rem" }}>
            You can upload supporting documents like medical certificates if needed
          </Typography>
        </Box>
      ),
    },
    {
      component: "tooltip",
      ref: submitButtonRef,
      children: (
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: "1rem" }}>Step 7: Submit Your Leave Application</Typography>
          <Typography sx={{ mt: 1, fontSize: "0.9rem" }}>
            Click the Submit button to apply for leave. You can also cancel to reset the form
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
          <Typography sx={{ fontWeight: 600, fontSize: "1.1rem" }}>Excellent {user?.firstName || user?.name}!</Typography>
          <Typography sx={{ mt: 2 }}>You have completed the Apply for Leave tutorial!</Typography>
          <Typography sx={{ mt: 1 }}>Now you know how to apply for leave in the system.</Typography>
        </Box>
      ),
    },
  ];

  const getStory = () => {
    if (location.state?.story === "applyLeaveTutorial") {
      return applyLeaveStory;
    }
    return [];
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };

      if (name === "halfDay") {
        if (checked) {
          updatedData.durationOfAbsence = "0.5";
        } else {
          updatedData.from = "";
          updatedData.to = "";
          updatedData.durationOfAbsence = "";
        }
      }

      if (name === "from" || name === "to" || name === "halfDay") {
        const fromDate = name === "from" ? value : prev.from;
        const toDate = name === "to" ? value : prev.to;

        if (
          fromDate &&
          toDate &&
          isValid(new Date(fromDate)) &&
          isValid(new Date(toDate))
        ) {
          const parsedFrom = parse(fromDate, "yyyy-MM-dd", new Date());
          const parsedTo = parse(toDate, "yyyy-MM-dd", new Date());

          if (parsedTo >= parsedFrom) {
            // Only calculate duration if dates are valid
            if (fromDate === toDate && updatedData.halfDay) {
              updatedData.durationOfAbsence = "0.5";
            } else {
              const diffDays = differenceInDays(parsedTo, parsedFrom) + 1;
              updatedData.durationOfAbsence = diffDays.toString();
            }
          } else {
            updatedData.durationOfAbsence = ""; // Clear duration if invalid
          }
        } else {
          updatedData.durationOfAbsence = ""; // Clear duration if dates are invalid
        }
      }

      return updatedData;
    });

    // Validate form on change for relevant fields
    if (
      name === "from" ||
      name === "to" ||
      name === "absenceType" ||
      name === "note"
    ) {
      const updatedFormData = {
        ...formData,
        [name]: type === "checkbox" ? checked : value,
      };
      const errors = validateForm(updatedFormData, leaveFormRules);
      setFormErrors(errors);
    } else {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleReset = () => {
    setFormData({
      absenceType: "",
      from: "",
      to: "",
      durationOfAbsence: "",
      note: "",
      halfDay: false,
    });
    setResumeFile(null);
    setError(null);
    setFormErrors({});
  };

  const handleResumeUpload = (file) => {
    setResumeFile(file?.file || file);
  };

  const handleEdit = useCallback((selectedRow) => {
    setFormData({
      _id: selectedRow?._id || "",
      absenceType: selectedRow?.absenceType || "",
      from: selectedRow?.from || "",
      to: selectedRow?.to || "",
      durationOfAbsence: selectedRow?.durationOfAbsence || "",
      note: selectedRow?.note || "",
      halfDay: selectedRow?.halfDay || false,
      attachment: selectedRow?.attachment || "",
    });
    setResumeFile(null);
    setError(null);
    setFormErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Find the selected leave type
    const selectedLeaveType = leaveTypes.find(
      (type) => type.name === formData.absenceType
    );

    // Validate form
    const errors = validateForm(formData, leaveFormRules);


    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false);
     const firstError = Object.values(errors)[0];
    Toast({
      message: firstError,
      type: "error",
    });
      return;
    }
    
    // Enforce attachment requirement on the client for immediate feedback
    if (selectedLeaveType) {
      const attachmentsRequiredFlag = selectedLeaveType.attachmentsRequired;
      const attachmentRule = selectedLeaveType.attachmentRequiredDays || {};
      const operator = attachmentRule?.operator;
      const thresholdValue = Number(attachmentRule?.value);
      const isAttachmentsRequired =
        attachmentsRequiredFlag === true || attachmentsRequiredFlag === "true";
      const duration = Number(formData.durationOfAbsence);
      const meetsThreshold = (d, op, threshold) => {
        if (!op || Number.isNaN(threshold) || Number.isNaN(d)) return false;
        switch (op) {
          case "greater_than":
            return d > threshold;
          case "greater_than_or_equal_to":
            return d >= threshold;
          case "equal_to":
            return d === threshold;
          case "less_than":
            return d < threshold;
          case "less_than_or_equal_to":
            return d <= threshold;
          default:
            return false;
        }
      };
      const hasAttachment = Boolean(resumeFile) || Boolean(formData?.attachment);
      if (isAttachmentsRequired && meetsThreshold(duration, operator, thresholdValue) && !hasAttachment) {
        const unit = selectedLeaveType.unit || "days";
        const msg = `Attachment is required for ${selectedLeaveType.name} when duration is ${String(operator || '')
          .replaceAll('_', ' ')} ${thresholdValue} ${unit}. Please upload an attachment.`;
        setFormErrors((prev) => ({ ...prev, attachment: msg }));
        Toast({ message: msg, type: "error" });
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const type = getSelectedTabType();
      const isEditMode = Boolean(formData._id);
      const url = isEditMode
        ? `${appURL}/recruitment/leaves?id=${formData._id}`
        : `${appURL}/recruitment/leaves`;
      const method = isEditMode ? "put" : "post";

      const companyId = getItemFromLocalStorage("companyId");
      const userRoleId = getItemFromLocalStorage("user");

      let dataToSend;
      let headers = { "Content-Type": "application/json" };

      const fullFormData = {
        ...formData,
        leaveTypeId:obj?.id,
        eligibilityId:obj?.eligibilityId,
        ...(companyId && { companyId }),
        ...(userRoleId && { empId: userRoleId._id }),
        type,
      };

      if (resumeFile) {
        const formDataToSend = new FormData();
        Object.entries(fullFormData).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            formDataToSend.append(key, value);
          }
        });

        formDataToSend.append("attachment", resumeFile);

        dataToSend = formDataToSend;
        headers = {};
      } else {
        dataToSend = fullFormData;
      }

      const response = await axios({
        method,
        url,
        data: dataToSend,
        headers,
      });

      Toast({
        message:
          response?.data?.data?.message ||
          (isEditMode
            ? "Leave updated successfully"
            : "Leave created successfully"),
        type: "success",
      });

      handleReset();
      setRefreshTable((prev) => !prev);
      fetchData(); // Refresh leave summary after submission
    } catch (err) {
      console.error("API Error:", err.response || err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "An error occurred while submitting the form. Please try again.";
      setError(errorMessage);
      Toast({
        message: errorMessage,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonConfigs = [
    {
      label: t("AbsenceTime.buttonConfg.cancel"),
      type: "button",
      variant: "contained",
      sx: {
        backgroundColor: "#FFFFFF",
        color: "#847F3B",
        fontFamily: "Work Sans",
        fontWeight: "500",
        borderRadius: "20px",
        "&:hover": { backgroundColor: "#f5f5f5" },
        "&:active": { backgroundColor: "#e0e0e0" },
      },
      onClick: handleReset,
    },
    {
      label: formData._id ? t("AbsenceTime.buttonConfg.update") : t("AbsenceTime.buttonConfg.submit"),
      type: "submit",
      variant: "contained",
      sx: {
        backgroundColor: "#837F39",
        color: "#FFFFFF",
        fontFamily: "Work Sans",
        fontWeight: "500",
        borderRadius: "20px",
        "&:hover": { backgroundColor: "#6f6b2f" },
        "&:active": { backgroundColor: "#5c5828" },
      },
      disabled: isSubmitting,
    },
  ];

  return (
    <Box
      sx={{
        padding: isMobile ? "10px" : "30px",
        paddingBottom: isMobile ? "30px" : "70px",
        bgcolor:"white"
      }}
    >
      <LeaveCards leaveSummary={leaveSummary} onCardClick={handleCardClick} />

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          paddingBottom: "70px",
          margin: isMobile ? "1rem .5rem" : "1rem",
          bgcolor: secondaryColors.white,
          padding: isMobile ? ".5rem" : "2rem",
          borderRadius: "1.5rem",
          boxShadow: "0px 0.5px 0px rgba(0,0,0,0.2)",
        }}
      >
        {!isMobile && (
          <Typography
            onClick={openPdfViewer}
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              fontSize: isMobile ? "10px" : isTablet ? "20px" : "24px",
              fontWeight: 500,
              color: "#837E3B",
              textDecoration: "underline",
              textUnderlineOffset: "1px",
              display: "flex",
              justifyContent: "flex-end",
              paddingRight: isMobile ? "20px" : isTablet ? "30px" : "50px",
              marginBottom: isMobile ? "8px" : "12px", // Added for better spacing
              cursor: "pointer",
              "&:hover": {
                color: "#6f6b2f",
                textDecoration: "underline",
              },
            }}
          >
            {t("AbsenceTime.LeavePolicy")}
          </Typography>
        )}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            padding: "8px 0px",
          }}
        >
          {isMobile ? (
            <Typography
              onClick={openPdfViewer}
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                fontSize: isMobile ? "18px" : isTablet ? "20px" : "24px",
                fontWeight: 600,
                color: "#837E3B",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
                display: "flex",
                justifyContent: "flex-end",
                paddingRight: "20px",
                marginBottom: "12px",
                cursor: "pointer",
                "&:hover": {
                  color: "#6f6b2f",
                  textDecoration: "underline",
                },
              }}
            >
               {t("AbsenceTime.LeavePolicy")}
            </Typography>
          ) : (
            <Typography
              sx={{
                fontSize: "32px",
                fontWeight: 600,
                fontFamily: "Montserrat, sans-serif",
                color: "#0E0E0E",
              }}
            >
              {t("AbsenceTime.applyForLeave")}
            </Typography>
          )}

          <Button
            variant="contained"
            onClick={() => history.push("/admin/previlages/team-leave")}
            sx={{
              backgroundColor: "#837E3B",
              borderRadius: "20px",
              padding: isMobile
                ? "5px 10px"
                : isTablet
                ? "7px 14px"
                : "8px 16px",
              textTransform: "none",
              fontWeight: 500,
              fontFamily: '"Work Sans"',
              fontSize: isMobile ? "16px" : isTablet ? "18px" : "20px",
              "&:hover": { backgroundColor: "#6f6b2f" },
              "&:active": { backgroundColor: "#5c5828" },
            }}
            endIcon={<CalendarMonthIcon />}
          >
            {t("AbsenceTime.teamLeave")}
          </Button>
        </Box>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {loadingLeaveTypes && (
          <Typography sx={{ mb: 2 }}>{t("AbsenceTime.LoadingLeaves")}</Typography>
        )}

        <Grid container spacing={isMobile ? 2 : 4}>
          <Grid
            item
            xs={12}
            md={12}
            container
            spacing={isMobile ? 2 : 0}
            direction={isMobile ? "row" : "row"}
            alignItems={isMobile ? "center" : ""}

          >
            {/* Absence Type */}
            <Grid item xs={isMobile ? 7 :""} sm={6} 
            sx={{ flexWrap: "nowrap !important" }}
            ref={absenceTypeRef}
            >
              <SelectComponent
                id="absenceType"
                label={t("AbsenceTime.formLabel.absenceType")}
                name="absenceType"
                value={formData.absenceType}
                onChange={handleChange}
                setSelectedObject={setSelectedObject}
                options={leaveTypes.map((leaveType) => ({
                  label: leaveType.name,
                  value: leaveType.name,
                  id: leaveType._id,
                  eligibilityId: leaveType.eligibilityId,
                }))}
                error={formErrors.absenceType}
                disabled={!canEdit()}
              />
            </Grid>

            {/* Half Day Checkbox */}
            <Grid
              item
              xs={isMobile ? 5 : 12}
              sm={6}
              display="flex"
              alignItems="center"
              justifyContent="flex-start"
              ref={halfDayRef}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.halfDay}
                    name="halfDay"
                    onChange={handleChange}
                    disabled={!canEdit()}
                    sx={{
                      color: "#837F39",
                      "&.Mui-checked": { color: "#837F39" },
                      marginLeft: isMobile ? 0 : "50px",
                    }}
                  />
                }
                label={<Box sx={{ marginTop: "10px" }}>{t("AbsenceTime.formLabel.halfDay")}</Box>}
                sx={{
                  fontFamily: "Work Sans",
                  display: "flex",
                  alignItems: "flex-start",
                }}
              />
            </Grid>
          </Grid>

          {/* From Date */}
          <Grid item xs={12} sm={6} ref={fromDateRef}>
            <InputTextComponent
              id="from"
              label={t("AbsenceTime.formLabel.form")}
              name="from"
              type="date"
              value={formData.from}
              onChange={handleChange}
              error={formErrors.from}
              disabled={!canEdit()}
            />
          </Grid>

          {/* To Date */}
          <Grid item xs={12} sm={6} ref={toDateRef}>
            <InputTextComponent
              id="to"
              label={t("AbsenceTime.formLabel.to")}
              name="to"
              type="date"
              value={formData.to}
              onChange={handleChange}
              error={formErrors.to}
              disabled={!canEdit()}
            />
           
          </Grid>

          {/* Duration */}
          <Grid item xs={12} sm={6}>
            <InputTextComponent
              id="durationOfAbsence"
              label={t("AbsenceTime.formLabel.durationAbsence")}
              name="durationOfAbsence"
              value={formData.durationOfAbsence}
              disabled
              sx={{
                '& .MuiInputLabel-root': {
                  fontWeight: 700,
                  color: '#555',
                },
                '& .MuiOutlinedInput-root.Mui-disabled': {
                  backgroundColor: '#f4f4f4',
                  '& input': {
                    fontWeight: 700,
                    color: '#555',
                    '-webkit-text-fill-color': '#555',
                  },
                },
              }}
            />
          </Grid>

          {/* Note */}
          <Grid item xs={12} sm={6} ref={noteRef}>
            <InputTextComponent
              id="note"
              // placeholder="Enter a description..."
              label={t("AbsenceTime.formLabel.note")}
              name="note"
              type="text"
              value={formData.note}
              onChange={handleChange}
              multiline
              rows={5}
              disabled={!canEdit()}
            />
          </Grid>
        </Grid>

        {canEdit() && (
          <Box
            ref={fileUploadRef}
            sx={{
              marginTop: { xs: "24px", sm: "40px", md: "50px" },
              marginBottom: { xs: "12px", sm: "16px", md: "24px" },
            }}
          >
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: { xs: "10px", sm: "15px", md: "24px" },

                fontFamily: "Montserrat",
                marginBottom: "4px",
                color: "#000000",
              }}
            >
              {t("AbsenceTime.Uplode")}
            </Typography>
            <FileUploadCustom
              id="leave-attachment-upload"
              onFileUpload={handleResumeUpload}
              file={resumeFile}
              acceptedFileTypes=".pdf,.doc,.docx"
              maxFileSize={5000000}
              link={formData?.attachment}
              error={formErrors.attachment}
            />
            {formErrors.attachment && (
              <Typography color="error" variant="caption">
                {formErrors.attachment}
              </Typography>
            )}
          </Box>
        )}

        <Box display="flex" justifyContent="flex-end" gap={2} mt={4} mb={2} ref={submitButtonRef}>
          {buttonConfigs
            .filter((btn) => btn.type !== "submit" || canEdit())
            .map((btn, index) => (
              <Button
                key={index}
                type={btn.type}
                variant={btn.variant}
                sx={btn.sx}
                onClick={btn.onClick}
                disabled={btn.disabled}
              >
                {isSubmitting && btn.type === "submit" ? (
                  <Box display="flex" alignItems="center" gap={1}>
                    <CircularProgress
                      size={16}
                      thickness={5}
                      sx={{ color: "#ffffff" }}
                    />
                    {t("AbsenceTime.sumbitting")}
                  </Box>
                ) : (
                  btn.label
                )}
              </Button>
            ))}
        </Box>
      </Box>

      <Box
        sx={{
          paddingBottom: "70px",
          margin: isMobile ? "1rem .5rem" : "1rem",
          bgcolor: secondaryColors.white,
          padding: isMobile ? ".5rem" : "2rem",
          borderRadius: "1.5rem",
          boxShadow: "0px 0.5px 0px rgba(0,0,0,0.2)",
        }}
      >
        <LeaveTable onEdit={handleEdit} refreshTable={refreshTable} />
      </Box>

      {/* Others Popup */}
      <Dialog open={othersDialogOpen} onClose={() => setOthersDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle
          sx={{
            fontFamily: 'Montserrat',
            fontWeight: 600,
            color: '#0E0E0E',
            borderBottom: '1px solid rgba(0,0,0,0.08)'
          }}
        >
          {othersDialogHeader}
        </DialogTitle>
        <DialogContent sx={{ paddingTop: 2 }}>
          {othersDialogItems?.length === 0 ? (
            <Typography sx={{ fontFamily: 'Work Sans', color: '#707070' }}>
             {t("AbsenceTime.leavesAvailable")}
            </Typography>
          ) : (
            <Box>
              {othersDialogItems.map((lt, idx) => (
                <Box key={idx} sx={{ paddingY: 1.5 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Typography sx={{ fontFamily: 'Work Sans', fontWeight: 500, color: '#0E0E0E' }}>
                      {lt.name}
                    </Typography>
                    <Typography sx={{ fontFamily: 'Work Sans', color: '#837E3B', fontWeight: 600 }}>
                      {lt.remaining} {lt.unit || 'days'} left
                    </Typography>
                  </Box>
                  {idx < othersDialogItems.length - 1 && <Divider sx={{ marginTop: 1.25 }} />}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ paddingX: 3, paddingBottom: 2 }}>
          <Button
            onClick={() => setOthersDialogOpen(false)}
            variant="contained"
            sx={{
              backgroundColor: '#837E3B',
              color: '#FFFFFF',
              borderRadius: '20px',
              textTransform: 'none',
              fontFamily: 'Work Sans',
              '&:hover': { backgroundColor: '#6f6b2f' },
            }}
          >
            {t("AbsenceTime.close")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PDF Viewer Modal */}
      <Dialog 
        open={pdfViewerOpen} 
        onClose={closePdfViewer} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            height: isMobile ? '95vh' : '90vh',
            maxHeight: isMobile ? '95vh' : '90vh',
            margin: isMobile ? '8px' : '32px',
            width: isMobile ? 'calc(100% - 16px)' : 'calc(100% - 16px)',
          }
        }}
      >
        <DialogTitle
          sx={{
            fontFamily: 'Montserrat',
            fontWeight: 600,
            color: '#0E0E0E',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: isMobile ? '12px 16px' : '16px 24px',
          }}
        >
          <Typography 
            variant="h6" 
            component="div"
            sx={{
              fontSize: isMobile ? '18px' : '24px',
            }}
          >
            Leave Policy
          </Typography>
          <IconButton
            onClick={closePdfViewer}
            sx={{
              color: '#837E3B',
              '&:hover': { backgroundColor: 'rgba(131, 126, 59, 0.1)' }
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent 
          sx={{ 
            padding: 0, 
            height: isMobile ? 'calc(95vh - 64px)' : '70vh',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {pdfLoading || !pdfUrl ? (
            <CircularProgress sx={{ color: '#837E3B' }} />
          ) : (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              width="100%"
              height="100%"
              style={{
                border: 'none',
                display: 'block'
              }}
              title="Leave Policy"
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
        </DialogContent>
      </Dialog>

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
          border-radius: 8px !important;
          animation: pulse 2s infinite;
          background-color: #fff !important;
        }
        
       
      `}</style>
    </Box>
  );
};

export default ApplyforLeave;
