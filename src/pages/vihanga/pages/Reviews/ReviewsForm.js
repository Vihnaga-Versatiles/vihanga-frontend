import React, { useEffect, useState } from "react";
import "./styles.scss";
import { getReviewFormById, updateReviewForm } from "action/ReviewFormAct";
import { useDispatch } from "react-redux";
import Stepper from "./Stepper";
import ObjectivesTable from "./ObjectivesTable";
import { RatingComponent } from "./Rating";
import { useHistory, useParams } from "react-router-dom";
import {
  AuthUser,
  LoadingIndicator,
  removeDuplicates,
  companyId,
  getDateFormat,
  defaultProfilePic,
  AuthRole,
  AuthUserId,
} from "utilities";
import Button from "components/Company/Button";
import { getEmployeeById, getEmployees } from "action/EmployeeAct";
import { useQueryClient } from "@tanstack/react-query";
import GoalsTable from "./GoalsTable";
import { getTemplateById } from "action/TemplatesAct";
import { Toast } from "service/toast";
import { tableGeneratorObjective } from "./ObjectivesTable/transformTable";
import { tableGenerator } from "pages/Rewards";
import { Box, Card, Chip, LinearProgress, Typography, useMediaQuery, useTheme } from "@mui/material";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { InputTextComponent } from "pages/vihanga/components/input-elements/text";
import FileUploadCustom from "pages/vihanga/components/filesUplode/draganddropFile";
import { useGetObjectives } from "pages/Objectives/hooks/useGetEmployees";
import axios from "axios";
import { competencies } from "service/apiVariables";
import { getAllCompetencies } from "action/CompetencyAct";

export default function ReviewsForm() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const { id } = useParams();
  const history = useHistory();
  const [data2, setData2] = useState({
    datasets: [{ data: [0] }],
  });
  const [loading, setLoading] = useState(false);
  const [empData, setEmpData] = useState([]);
  const [, setError] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [, handleSetWeight] = useState(0);
  const [, handleOverRating] = useState(0);
  const [orderModalShow3, setOrderModalShow3] = useState(false);
  const [orderModalShow5, setOrderModalShow5] = useState(false);
  const [sectionGoalsRating, setSectionGoalsRating] = useState(0);
  const [sectionCompetenciesRating, setSectionCompetenciesRating] = useState(0);
  const queryClient = useQueryClient();
  const [formsData, setFormsData] = useState([
    { competencyName: "", Feedback: "", Comments: "", type: "employee" },
  ]);
  const [formsDataManagerReview, setFormsDataManagerReview] = useState([
    { competencyName: "", Feedback: "", Comments: "", type: "manager" },
  ]);
  // File upload states
  const [uploading, setUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  
  // Flag to track if competencies have been loaded
  const [competenciesLoaded, setCompetenciesLoaded] = useState(false);
  
  const [reviewForm, setReviewForm] = useState({
    employeeName: "",
    reviewPeriod: "",
    goals: [],
    competencies: [],
    companyId: companyId,
    totalAchievement: "",
    overallRating: 0,
    attachment: "",
    status: "",
    managerName: "",
    managerId: "",
    employeeFullName: "",
    templateName: "",
    templateId: "",
  });
  const [employeeInfo, setEmployeeInfo] = useState({
    name: "-",
    profilePicture: "",
    designation: "-",
    department: "-",
    grade: "-",
    manager: "-",
    managerId: "",
  });
  const [objectiveData, setLoadObjectiveData] = useState({
    id: "",
    role: "",
  });
  const [templateInfo, setTemplateInfo] = useState({
    displayOptions: [],
    displaySteps: [],
    ratingScale: "",
    goalPercentage: "",
    competenciesPercentage: "",
    competencies: [],
  });
  const [text, setText] = useState({
    cm1: "",
    cm2: "",
    cm3: "",
  });
  const [steps, setSteps] = useState([]);
  const [status, setStatus] = useState([]);
  const dispatch = useDispatch();

  let user = localStorage.getItem("user") !== null
    ? JSON.parse(localStorage.getItem("user"))
    : null;
  let selectedTab = localStorage.getItem("selectedTab") !== null
    ? JSON.parse(localStorage.getItem("selectedTab"))
    : null;

  // Use the hook for objectives
  const { data: objectivesResponse } = useGetObjectives({
    userId: user?._id || companyId,
    companyId: companyId,
    type: "me"
  });


  // Cloudinary file upload function
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
            if (percent === 25 || percent === 50 || percent === 75 || percent === 100) {
              Toast({ 
                message: `Uploaded ${percent}%`, 
                type: "success", 
                time: 500 
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
        time: 2000 
      });
      
      // Update the review form with the uploaded file URL
      setReviewForm(prev => ({
        ...prev,
        attachment: fileUrl
      }));
      
      return fileUrl;
    } catch (error) {
      console.error("Upload failed:", error);
      Toast({ 
        message: "Upload failed. Please try again.", 
        type: "error", 
        time: 3000 
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  function handleChange(event) {
    const { name, value } = event.target;
    const newData = { ...reviewForm };
    newData[name] = value;
    setReviewForm(newData);
  }

  function handleInputChange1(event) {
    const { name, value } = event.target;
    setText(prev => ({
      ...prev,
      [name]: value
    }));
  }

  function handleInputChange(event, index) {
    const { name, value } = event.target;
    const newData = [...formsData];
    newData[index][name] = value;
    setFormsData(newData);
  }

  const getReviewById = () => {
    try {
      if (id !== "create") {
        setLoading(true);
        let response = dispatch(getReviewFormById(id));
        response.then(({ data, message, success }) => {

          if (success) {
            let updatedData = {
              ...data,
              reviewPeriod: getDateFormat(data.reviewPeriod, "YYYY-MM-DD"),
              overallRating: data.overallRating !== "NaN" ? data.overallRating : 0,
            };

            if(updatedData?.goals?.length===0){
              delete updatedData?.goals
            }
            
            // Set the uploaded file URL if it exists
            if (data.attachment) {
              setUploadedFileUrl(data.attachment);
            }
            
            let result = { ...reviewForm, ...updatedData };
            setReviewForm(result);
            
            // Initialize text state with saved comments
            if (data.overalComments) {
              setText({
                cm1: data.overalComments.cm1 || "",
                cm2: data.overalComments.cm2 || "",
                cm3: data.overalComments.cm3 || "",
              });
            } else {
              setText({
                cm1: "",
                cm2: "",
                cm3: "",
              });
            }
            
            setLoading(false);
            setLoadObjectiveData({
              id: updatedData.employeeRole,
              role: updatedData.employeeId,
            });
            
            // Handle competencies properly (aligned to review employee, not logged-in user)
            if (data.competencies && data.competencies.length > 0) {
              const employeeCompetencies = data.competencies.filter(c => c.type === 'employee');
              const managerCompetencies = data.competencies.filter(c => c.type === 'manager');
              
              if(employeeCompetencies.length > 0) {
                const formattedEmployeeCompetencies = employeeCompetencies.map(comp => ({
                  competencyName: comp.competencyName || "",
                  _id: comp._id || "",
                  Feedback: comp.Feedback || 0,
                  Comments: comp.Comments || "",
                  type: comp.type || "employee",
                  startDate: comp.startDate || window.moment().format("YYYY-MM-DD"),
                  endDate: comp.endDate || window.moment().add(1, 'year').format("YYYY-MM-DD"),
                }));
                setFormsData(formattedEmployeeCompetencies);
                setCompetenciesLoaded(true);
              }

              if(managerCompetencies.length > 0){
                const formattedManagerCompetencies = managerCompetencies.map(comp => ({
                  competencyName: comp.competencyName || "",
                  _id: comp._id || "",
                  Feedback: comp.Feedback || 0,
                  Comments: comp.Comments || "",
                  type: comp.type || "manager",
                  startDate: comp.startDate || window.moment().format("YYYY-MM-DD"),
                  endDate: comp.endDate || window.moment().add(1, 'year').format("YYYY-MM-DD"),
                }));
                setFormsDataManagerReview(formattedManagerCompetencies);
                setCompetenciesLoaded(true);
              } else if (employeeCompetencies.length > 0) {
                // Same competency set as employee; manager rates the same items (API may only persist employee rows until manager saves)
                const mirrorForManager = employeeCompetencies.map(comp => ({
                  competencyName: comp.competencyName || "",
                  _id: comp._id || "",
                  Feedback: 0,
                  Comments: "",
                  type: "manager",
                  startDate: comp.startDate || window.moment().format("YYYY-MM-DD"),
                  endDate: comp.endDate || window.moment().add(1, 'year').format("YYYY-MM-DD"),
                }));
                setFormsDataManagerReview(mirrorForManager);
              }
            }
          } else {
            setLoading(false);
            setError(message);
          }
        });
      } else {
        let updatedData = {
          ...reviewForm,
          status: "Submit",
          reviewPeriod: getDateFormat(new Date(), "YYYY-MM-DD"),
        };
        if(updatedData?.goals?.length===0){
          delete updatedData?.goals
        }
        setReviewForm(updatedData);
        setLoadObjectiveData({
          id: updatedData.employeeRole,
          role: updatedData.employeeId,
        });
        // Reset competencies loaded flag for new review
        setCompetenciesLoaded(false);
      }
    } catch (error) {
      setLoading(false);
      setError(error.toString());
    }
  };

  const getUserDetailsById = () => {
    try {
      setLoading(true);
      let response = dispatch(getEmployeeById(reviewForm.employeeId));
      response.then(({ data, message, success }) => {
        if (success) {
          let formattedData = {
            name:
              data?.personalInformation?.firstName +
              " " +
              data?.personalInformation?.lastName,
            profilePicture: data?.personalInformation?.profilePicture,
            designation: data?.employmentInformation?.designation,
            department: data?.employmentInformation?.department,
            grade: data?.employmentInformation?.grade,
            managerId: (() => {
              const lm = data?.employmentInformation?.lineManager;
              return lm != null && typeof lm === "object" ? lm._id : lm;
            })(),
          };
          setEmployeeInfo(formattedData);
        
          setReviewForm((prev)=>{
            return {...prev,employeeFullName: formattedData.name}
          });
          setLoading(false);
        } else {
          setLoading(false);
          setError(message);
        }
      });
    } catch (error) {
      setLoading(false);
      setError(error.toString());
    }
  };

  const getManagerDetailsById = () => {
    try {
      setLoading(true);
      let response = dispatch(getEmployeeById(employeeInfo.managerId));
      response.then(({ data, message, success }) => {
        if (success) {
          let formattedData = {
            ...employeeInfo,
            manager:
              data?.personalInformation?.firstName +
              " " +
              data?.personalInformation?.lastName,
          };
          setEmployeeInfo(formattedData);
          setLoading(false);
        } else {
          setLoading(false);
          setError(message);
        }
      });
    } catch (error) {
      setLoading(false);
      setError(error.toString());
    }
  };

  const fetchEmployees = () => {
    try {
      setLoading(true);
      let response = dispatch(getEmployees());
      response.then(({ data, message, success }) => {
        if (data !== undefined && data.length > 0) {
          let updatedData = data
            .filter((item) => {
              if (selectedTab !== null && selectedTab.tab === "me") {
                if (user !== null && item._id === user._id) {
                  return item;
                }
              } else {
                if (
                  (user !== null &&
                    item.employmentInformation &&
                    item.employmentInformation.lineManager &&
                    item.employmentInformation.lineManager === user._id) ||
                  item._id === user._id
                ) {
                  return item;
                }
              }
            })
            .map((item) => {
              return {
                key:
                  item?.personalInformation?.firstName +
                  " " +
                  item?.personalInformation?.lastName,
                value: item._id,
                designation: item?.employmentInformation?.designation,
              };
            });
          let nonduplicates = removeDuplicates(updatedData, "key");
          setEmpData(nonduplicates);
          if (id === "create" && reviewForm.employeeName === "") {
            let findUser = nonduplicates.find(
              (item) => item.value === user._id
            );
            setReviewForm((prevData) => ({
              ...prevData,
              employeeName: findUser.value,
            }));
          }
          setLoading(false);
          setError("");
        } else if (data.length === 0) {
          setLoading(false);
          setError("No Data Found!");
        } else {
          setLoading(false);
          setError(message);
        }
      });
    } catch (error) {
      setLoading(false);
      setError(error.toString());
    }
  };

  useEffect(() => {
    if (reviewForm.goals?.length > 0) {
      let totalEmployeeRating = reviewForm.goals.reduce((prev, current) => {
        return (
          prev +
          ((Number(current.employeeRating) * Number(current.weight)) / 100 || 0)
        );
      }, 0);

      let totalManagerRating = reviewForm.goals.reduce((prev, current) => {
        return (
          prev +
          ((Number(current.managerRating) * Number(current.weight)) / 100 || 0)
        );
      }, 0);
      totalEmployeeRating = Number(totalEmployeeRating).toFixed(2);
      totalManagerRating = Number(totalManagerRating).toFixed(2);
      const avgRating =
        totalEmployeeRating > 0
          ? (totalEmployeeRating + totalManagerRating) / 2
          : totalManagerRating;
    }
  }, [reviewForm.goals]);

  const getTemplateDetails = () => {
    try {
      setLoading(true);
      let response = dispatch(getTemplateById(reviewForm.templateId));
      response.then(({ data, message, success }) => {
        if (success) {
          setTemplateInfo(data);
          const finData = [];
          data?.displaySteps.map((item, index) => {
            if (item.isChecked) {
              finData.push({
                id: finData.length,
                label: item.value,
                key: item.key,
                text: item?.text || "Self Submission",
              });
            }
          });

          const index = finData.filter(
            (item) => item.label === reviewForm.status
          );


          let response1 = dispatch(getAllCompetencies());
          response1.then(({ success, message, data:comData }) => {
            // Existing review already has competencies from API — do not replace with template/logged-in-user filtering
            if (id !== "create" && reviewForm.competencies?.length > 0) {
              return;
            }

            // Wait for empData to be available before filtering
            if (!empData || empData.length === 0) {
              console.warn('empData not yet loaded, skipping competency filtering');
              return;
            }

            const reviewedEmployeeId = reviewForm.employeeId || reviewForm.employeeName;
            const userRole = empData.find(
              (e) => e.value === reviewedEmployeeId
            )?.designation?.toLowerCase();

            // Filter by template; match reviewed employee's designation when we have it (not empData[0] / logged-in context)
            const finalCompetencies = comData.filter(item =>
              data.competencies.some(competency =>
                competency.value.toString() === item._id.toString()
              ) &&
              (!userRole ||
                item.designation.some(
                  d => d.value?.toLowerCase() === userRole || d.key?.toLowerCase() === userRole
                ))
            );
            console.log(comData,data.competencies,finalCompetencies,'fsdfdsinalCompetencies')
            if (success) {
              let updatedData = finalCompetencies.map((item, index) => {
                return {
                  ...item,
                  Feedback: 0,
                  Comments: "",
                  type: "",
                  startDate: window.moment(item.startDate).format("YYYY-MM-DD"),
                  endDate: window.moment(item.endDate).format("YYYY-MM-DD")
                };
              });
              setFormsData(updatedData);
              setFormsDataManagerReview(updatedData);
            }
          });

          
          setActiveStep(index.length > 0 ? index[0]?.id : finData[0]?.id);
          setStatus(index.length > 0 ? index[0]?.label : finData[0]?.label);
          setSteps(finData);
          setLoading(false);
        } else {
          setLoading(false);
          setError(message);
        }
      });
    } catch (error) {
      setLoading(false);
      setError(error.toString());
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    getReviewById();
  }, [id]);

  useEffect(() => {
    if (reviewForm.employeeFullName !== "") {
      getUserDetailsById();
    }
    // Only call getTemplateDetails after empData is loaded to avoid race conditions
    if (reviewForm.templateId !== "" && empData.length > 0) {
      getTemplateDetails();
    }
  }, [reviewForm.employeeFullName, empData]);


  useEffect(() => {
    if (employeeInfo.managerId !== "") {
      getManagerDetailsById();
    }
  }, [employeeInfo.managerId]);

  const handleNext = () => {
    const newActiveStep = activeStep + 1;
    const index = steps.filter((item) => item.id === newActiveStep);
    setStatus(index.length > 0 ? index[0]?.label : steps[0].label);
    setActiveStep(newActiveStep);
  };

  const handleBack = () => {
    const index = steps.filter((item) => item.id === activeStep - 1);
    setStatus(index.length > 0 ? index[0]?.label : steps[0].label);
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = () => {
    setLoading(true);
    let status = steps.filter((item) => item.id === activeStep)[0].label;
    reviewForm.status = status;
    if (status === "Submit") {
      reviewForm.competencies = formsData.map((item) => ({
        ...item,
        type: "employee",
      }));
      reviewForm.managerId = employeeInfo.managerId;
      reviewForm.managerName = employeeInfo.manager;
      const kr = [];
      const allKeyresultsHaveActual = reviewForm.goals.filter((item) => {
        const data = item.children.filter(
          (childKey) =>
            childKey.actual === undefined || childKey.actual === null
        );
        kr.push(...data);
        return data.length > 0;
      });
      const finalData = kr
        .map((item) => {
          return item.keyResultName;
        })
        .join(",\n");
      if (allKeyresultsHaveActual?.length > 0) {
        Toast({
          type: "error",
          message: `Every Key Results Must have Actual Result. Below KR's don't have actual results:\n ${finalData}`,
        });
        setLoading(false);
      } else if (text.cm1 === "" || !text.cm1 || !text.cm2 || text.cm2 === "") {
        Toast({ type: "error", message: `Employee comments are mandatory` });
        setLoading(false);
      } else if (allKeyresultsHaveActual?.length === 0) {
        const allKeyResultsRatingCheck = reviewForm.goals.filter((item) => {
          if (
            item.employeeRating === undefined ||
            item.employeeRating === null ||
            !item.employeeRating
          ) {
            return true;
          }
        });
        if (allKeyResultsRatingCheck.length > 0) {
          Toast({
            type: "error",
            message: `Each okr must have employee rating`,
          });
          setLoading(false);
        } else {
          reviewForm.status = "Manager Review";
          let response = dispatch(
            updateReviewForm(reviewForm._id, {
              ...reviewForm,
              competencies: formsData.map((item) => ({
                ...item,
                type: "employee",
              })),
              overalComments: {
                cm1: text.cm1 || "",
                cm2: text.cm2 || "",
                cm3: text.cm3 || ""
              },
            })
          );
          response.then(({ success, message }) => {
            if (success) {
              setLoading(false);
              let newActiveStep = activeStep + 1;
              setActiveStep(newActiveStep);
              history.push("/admin/reviews");
              queryClient.invalidateQueries("reviewsForm");
            } else {
              setLoading(false);
            }
          });
        }
      }
    } else if (status === "Manager Review") {
      const allKeyResultsRatingCheck = reviewForm.goals.filter((item) => {
        if (
          item.managerRating === undefined ||
          item.managerRating === null ||
          !item.managerRating
        ) {
          return true;
        }
      });
      if (allKeyResultsRatingCheck.length > 0) {
        Toast({ type: "error", message: `Each okr must have manager rating` });
        setLoading(false);
      } else if (!text.cm3 || text.cm3 === "") {
        Toast({ type: "error", message: `Manager comments are mandatory` });
        setLoading(false);
      } else {
        let status = steps.filter((item) => item.id === activeStep + 1)[0]
          .label;
        reviewForm.status = status;
        
        // Preserve employee competencies and add manager competencies
        const employeeCompetencies = reviewForm.competencies ? reviewForm.competencies.filter(c => c.type === 'employee') : [];
        const managerCompetencies = formsDataManagerReview.map(item => ({...item, type: 'manager'}));

        let response = dispatch(
          updateReviewForm(reviewForm._id, {
            ...reviewForm,
            competencies: [...employeeCompetencies, ...managerCompetencies],
            overalComments: {
              cm1: text.cm1 || "",
              cm2: text.cm2 || "",
              cm3: text.cm3 || ""
            },
          })
        );
        response.then(({ success, message }) => {
          if (success) {
            setLoading(false);
            let newActiveStep = activeStep + 1;
            setActiveStep(newActiveStep);
            Toast({
              type: "success",
              message: "Review Form Updated Successfully!",
              time: 5000,
            });
            getReviewById();
            history.push("/admin/reviews");
            queryClient.invalidateQueries("reviewsForm");
          } else {
            setLoading(false);
          }
        });
      }
    } else {
      let status = steps.filter((item) => item.id === activeStep + 1)[0].label;
      reviewForm.status = status;
      let response = dispatch(
        updateReviewForm(reviewForm._id, { ...reviewForm })
      );
      response.then(({ success, message }) => {
        if (success) {
          setLoading(false);
          let newActiveStep = activeStep + 1;
          setActiveStep(newActiveStep);
          history.push("/admin/reviews");
          queryClient.invalidateQueries("reviewsForm");
        } else {
          setLoading(false);
        }
      });
    }
  };

  const lineManagerIdRaw = employeeInfo.managerId || reviewForm.managerId;
  const lineManagerId =
    lineManagerIdRaw != null && typeof lineManagerIdRaw === "object"
      ? lineManagerIdRaw._id
      : lineManagerIdRaw;

  const idsMatch = (a, b) =>
    a != null &&
    b != null &&
    String(a).trim() === String(b).trim();

  const isCurrentUserLineManager = idsMatch(reviewForm?.managerId, lineManagerId);

  const managerReviewStepId = steps.find((s) => s.label === "Manager Review")?.id;
  const isManagerReviewStep =
    (status === "Manager Review" || reviewForm.status === "Manager Review") &&
    (managerReviewStepId === undefined
      ? activeStep === 1
      : activeStep === managerReviewStepId);
  const canEditManagerReview = isCurrentUserLineManager && isManagerReviewStep;

  const handleSave = () => {
    setLoading(true);

    const payload = { 
      ...reviewForm, 
      overalComments: {
        cm1: text.cm1 || "",
        cm2: text.cm2 || "",
        cm3: text.cm3 || ""
      }
    };

    if (activeStep === 0) {
      // Save employee competencies
      payload.competencies = formsData.map((item) => ({
        ...item,
        type: "employee",
      }));
    } else if (canEditManagerReview) {
      // Save manager competencies while preserving employee competencies
      const employeeCompetencies = reviewForm.competencies ? reviewForm.competencies.filter(c => c.type === 'employee') : [];
      const managerCompetencies = formsDataManagerReview.map(item => ({...item, type: 'manager'}));
      payload.competencies = [...employeeCompetencies, ...managerCompetencies];
    }
    
    let response = dispatch(
      updateReviewForm(payload._id, payload)
    );
    response.then(({ success, message }) => {
      if (success) {
        setLoading(false);
        Toast({ type: 'success', message: 'Review form saved successfully!' });
        // Reload the review data to ensure UI is updated with saved data
        getReviewById(); 
        history.push("/admin/reviews");
        queryClient.invalidateQueries("reviewsForm");
      } else {
        setLoading(false);
        Toast({ type: 'error', message: message || 'Failed to save review form.' });
      }
    });
  };

  const handleCancel = () => {
    history.push("/admin/reviews");
  };

  const nonAllowed = ["Manager", "HR Admin", "Super Admin"];

  const handleUpdateGoals = (id, row) => {
    setLoading(true);
    let index = reviewForm.goals.findIndex((item) => item._id === id);
    let updatedGoals = [...reviewForm.goals];
    updatedGoals[index] = row;
    setReviewForm({ ...reviewForm, goals: updatedGoals });
    if (isManagerReviewStep && isCurrentUserLineManager) {
      let response = dispatch(
        updateReviewForm(
          reviewForm._id,
          { ...reviewForm, goals: updatedGoals },
          true
        )
      );
      response.then(({ success, message }) => {
        if (success) {
          setLoading(false);
          getReviewById();
        } else {
          setLoading(false);
        }
      });
    } else {
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  };

  let isFullNameEnabled =
    templateInfo?.displayOptions?.length > 0 &&
    templateInfo?.displayOptions?.find((item) => item.value === "firstName")
      .isChecked &&
    templateInfo?.displayOptions?.find((item) => item.value === "lastName")
      .isChecked;
  let isDepartmentEnabled =
    templateInfo?.displayOptions?.length > 0 &&
    templateInfo?.displayOptions?.find((item) => item.value === "department")
      .isChecked;
  let isGradeEnabled =
    templateInfo?.displayOptions?.length > 0 &&
    templateInfo?.displayOptions?.find((item) => item.value === "grade")
      .isChecked;
  let isManagerEnabled =
    templateInfo?.displayOptions?.length > 0 &&
    templateInfo?.displayOptions?.find((item) => item.value === "manager")
      .isChecked;
  let isDesignationEnabled =
    templateInfo?.displayOptions?.length > 0 &&
    templateInfo?.displayOptions?.find((item) => item.value === "designation")
      .isChecked;

  const getText = (status) => {
    const data = steps.filter((item) => item?.label === status)[0];
    const nextData = steps.filter((item) => item?.id === data?.id + 1)[0];
    return nextData?.text || "Self Submission";
  };

  // Updated refreshData function using the hook
  const refreshData = async (hardRefresh = false) => {
    try {
      if (user !== null && objectiveData.id !== "") {
        setLoading(true);
        
        const objectivesData = objectivesResponse?.data || [];
        if (objectivesData.length > 0 && (reviewForm?.goals?.length === 0 || hardRefresh)) {
          let existingUser = localStorage.getItem("userData") !== null
            ? JSON.parse(localStorage.getItem("userData"))
            : null;
          
          let filteredData = objectivesData.filter(
            (item) =>
              item.employeeName ===
              (existingUser !== null ? existingUser.ownerName : AuthUser.name)
          );
          
          let result = templateInfo.percentageType === "goal"
            ? tableGenerator(
                objectivesData.length > 0 ? objectivesData : filteredData,
                objectivesData.length > 0 ? objectivesData.length : filteredData.length,
                objectivesData.length > 0 ? objectivesData : filteredData
              )
            : tableGeneratorObjective(
                objectivesData.length > 0 ? objectivesData : filteredData,
                objectivesData.length > 0 ? objectivesData.length : filteredData.length,
                objectivesData.length > 0 ? objectivesData : filteredData
              );
          
          setReviewForm({ ...reviewForm, goals: result });
        } else if (objectivesData.length === 0) {
          setError("No Data Found!");
        }
        
        setLoading(false);
      }
    } catch (error) {
      setError(error.toString());
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    refreshData(true);
  };

  useEffect(() => {
    if (objectivesResponse?.data?.length >0) {
      refreshData();
    }
  }, [objectivesResponse]);

  function handleInputChangeMReview(event, index) {
    const { name, value } = event.target;
    const newData = [...formsDataManagerReview];
    newData[index][name] = value;
    setFormsDataManagerReview(newData);
    
    // Auto-save manager competencies when feedback or comments change
    // if ((name === "Feedback" || name === "Comments") && canEditManagerReview) {
    //   setLoading(true);
      
    //   // Preserve employee competencies and update manager competencies
    //   const employeeCompetencies = reviewForm.competencies ? reviewForm.competencies.filter((item) => item.type === "employee") : [];
    //   const managerCompetencies = newData.map((item) => ({ ...item, type: "manager" }));
      
    //   const updatedReviewForm = {
    //     ...reviewForm,
    //     competencies: [...employeeCompetencies, ...managerCompetencies],
    //     overalComments: {
    //       cm1: text.cm1 || "",
    //       cm2: text.cm2 || "",
    //       cm3: text.cm3 || ""
    //     },
    //   };
      
    //   let response = dispatch(
    //     updateReviewForm(reviewForm._id, updatedReviewForm, true)
    //   );
    //   response.then(({ success, message }) => {
    //     if (success) {
    //       setLoading(false);
    //       // Update the local state to reflect the saved data
    //       setReviewForm(updatedReviewForm);
    //     } else {
    //       setLoading(false);
    //       Toast({ type: 'error', message: 'Failed to save competency update.' });
    //     }
    //   });
    // }
  }

  // Handle file upload with Cloudinary integration
  const handleFileUpload = async ({ file }) => {
    if (file) {
      await handleUploadToCloudinary(file);
    }
  };

  return (
    <div className=" rounded-12 mh-100" style={{padding:isMobile || isTablet ? ".3rem" : "1rem",margin:isMobile || isTablet ? ".3rem" : "1rem"}}>
    <Box  backgroundColor="#FFFFFF"  borderRadius="20px" padding={isMobile || isTablet ? "10px" : "24px"} boxShadow="0px 0.1px 0px rgba(0,0,0,0.2)" mb={isMobile || isTablet ? 2 : 4}>
      <div className="d-flex justify-content-between align-items-center">
        <Typography fontWeight="600" fontFamily="Montserrat" textAlign={isMobile || isTablet ? "center" : "left"} fontSize={isMobile || isTablet ? 20 : 32}>Review Form</Typography>
        <div className="d-flex">
          <button
            className="btn bg-brown mr-2"
            onClick={() => {
              history.push("/admin/reviews");
            }}
            style={{borderRadius: "2rem",color: "#FFFFFF"}}
          >
            <ArrowBackIcon style={{marginRight: isMobile || isTablet ? 3 : 8,color: "#FFFFFF"}} />
            Go Back
          </button>
          {activeStep === 5 && (
            <a
              className="btn btn-primary bg-brown"
              href={`/admin/reviews-report/${reviewForm._id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Report
            </a>
          )}
        </div>
      </div>
      <div className="company-fom">
      <Card
      sx={{
        backgroundColor: "#FFFFFF",
        boxShadow: 0,
        borderRadius: "16px",
        marginX: isMobile || isTablet ? "10px" : "30px",
        marginTop: isMobile || isTablet ? "10px" : "30px",
        marginBottom: isMobile || isTablet ? "10px" : "30px",
        padding: isMobile || isTablet ? "10px" : "30px",
        border: "1px solid #565656",
      }}
    >
      <div className={`${isMobile || isTablet ? "overflow-auto p-1 m-1" : ""}`}>
          <Stepper
            {...{
              stepIconColor:"#837F39",
              connectorColor:"#9E9E9E",
              steps: steps,
              isIconStepper: false,
              activeStep: activeStep,
              setActiveStep: setActiveStep,
              handleBack: handleBack,
              handleNext: handleNext,
            }}
          />
        </div>
        </Card>
        <div className="mt-3">
          <div className="d-flex justify-content-center">
            <div>
              <Typography className={`${isMobile || isTablet ? "text-center" :""}`} fontWeight={600} fontFamily="Montserrat" fontSize={16}>
                Form Employee Name - Review Period ({reviewForm?.startDate} -{" "}
                {reviewForm?.endDate})
              </Typography>
            </div>
          </div>
          <div className="d-flex justify-content-center">
            <div className="p-0">
              {isFullNameEnabled && (
                <Typography fontWeight="semibold" fontFamily="Montserrat" fontSize={16} className={`${isMobile || isTablet ? "text-center" :""}`}>
                  {reviewForm.employeeFullName} - &nbsp;
                </Typography>
              )}
            </div>
            <Typography fontWeight="semibold" fontFamily="Montserrat" fontSize={16}>
              <p>({reviewForm.reviewPeriod})</p>
            </Typography>
          </div>
        </div>
        <p className={`text-dark mt-4 mb-3  ml-3 font-weight-bold ${isMobile || isTablet ? "text-center" :""}`}>
          Employee Information
        </p>
        <div className={`${isMobile || isTablet ? "ml-0" : "ml-4"} w-100 `}>
          <div className={`d-flex ${isMobile || isTablet ? "flex-column" : "flex-row"} ${isMobile || isTablet ? "align-items-center mb-3" :""}`}>
            <div className={`col-sm-12 col-md-10 col-lg-3 p-0`} style={{
              backgroundColor: "#F4F4F4",
              boxShadow: "0px 0.1px 0px rgba(0,0,0,0.2)",
              scale: "1.07", 
              borderRadius: "20px",
              maxWidth: isMobile ? "90%" : "auto"
            }}>
              <div className="top1 d-flex justify-content-center">
                <img
                  src={
                    employeeInfo?.profilePicture
                      ? employeeInfo?.profilePicture
                      : defaultProfilePic
                  }
                  alt="none"
                  className="imagepro"
                />
              </div>
              <div className="d-flex justify-content-center mt-5">
                <div>
                  {isFullNameEnabled && (
                    <Typography fontWeight="bold" fontFamily="Montserrat" fontSize={16} textAlign={"center"}>{employeeInfo?.name}</Typography>
                  )}
                  {isDesignationEnabled && (
                    <Typography fontWeight="600" fontFamily="Montserrat" fontSize={16} textAlign={"center"}>{employeeInfo?.designation}</Typography>
                  )}
                </div>
              </div>
              <div class="mt-3 mb-5 px-3">
                <div class="col">
                  {isDepartmentEnabled && (
                    <div className="row" >
                      <div class="col m-1" style={{fontWeight: "600",fontStyle:"Montserrat",fontSize:"16px"}}>Department</div>
                      <div class="col m-1" style={{fontWeight: "600",fontStyle:"Montserrat",fontSize:"16px"}}>:  {employeeInfo?.department}</div>
                    </div>
                  )}
                  {isGradeEnabled && (
                    <div className="row">
                      <div class="col m-1" style={{fontWeight: "600",fontStyle:"Montserrat",fontSize:"16px"}}>Grade</div>
                      <div class="col m-1" style={{fontWeight: "600",fontStyle:"Montserrat",fontSize:"16px"}}>:  {employeeInfo?.grade}</div>
                    </div>
                  )}

                  {isManagerEnabled && (
                    <div className="row">
                      <div class="col m-1" style={{fontWeight: "600",fontStyle:"Montserrat",fontSize:"16px"}}>Manager</div>
                      <div class="col m-1" style={{fontWeight: "600",fontStyle:"Montserrat",fontSize:"16px"}}>:  {employeeInfo?.manager || employeeInfo?.managerName || "N/A"}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={` col-8  ${isMobile || isTablet ? "ml-0" : "ml-4"} ${isMobile || isTablet ? " d-flex col-12 ml-0 flex-column mt-3" : "flex-row"} ${isMobile || isTablet ? "align-items-center" :""}`} style={{marginLeft: "2rem !important"}}>
            <Typography fontWeight="600" fontFamily="Montserrat" fontSize={16} margin={"0px 0px .5rem 2rem !important"}>Guidelines</Typography>
              <div className={`card2  p-2 ${isMobile || isTablet ? "ml-0" : "ml-4"}`} style={{backgroundColor: "#fff",boxShadow: "0px 0.1px 0px rgba(0,0,0,0.2)",
              }}>
                <p className="largecon" style={{fontWeight: "400",fontStyle:"Work Sans",fontSize:"12px"}}>
                  The below links / documents provide information to assist
                  managers and employees with the following: Appraisal Process :
                  Provides guidance un writing performance feedback based on
                  achievements that are factual, constractive and supported by
                  evidence. Rating Guidelines : Provides guidance on how to
                  appropriately rate an employee based on the 5-Star rating
                  scale. User Manual : Provides guidence on system navigation
                </p>
              </div>
              <div className={`    mt-4 justify-content-around ${isMobile || isTablet ? "col-12 " : "ml-2"}  ${isMobile? " d-flex flex-column" : "d-flex row"} `}>
                <div
                  className={`card3 col-${
                    reviewForm.overallRating > 0 ? "5" : "5"
                  }  ${isMobile  ? "col-12 " : ""} d-flex justify-content-around align-items-center p-1`}
                   style={{backgroundColor: "#FFFFFF",boxShadow: "0px 0.1px 0px rgba(0,0,0,0.2)"}}
                >
                 <Typography fontWeight="400" fontFamily="Work Sans" fontSize={12}>Total Weight Achievement</Typography>
                  {loading ? (
                    <LoadingIndicator />
                  ) : (
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 100,
                        background: "#837F39",
                        color: "white",
                      }}
                    >
                      <p className="text-white text-center mt-2 pt-1" style={{fontWeight: "400",fontStyle:"Work Sans",fontSize:"12px"}}>
                        {data2?.datasets[0]?.data[0] + "%"}
                      </p>
                    </div>
                  )}
                </div>
                <div
                 style={{backgroundColor: "#FFFFFF",boxShadow: "0px 0.1px 0px rgba(0,0,0,0.2)"}}
                  className={` card3 col-6
                  ${isMobile  ? "col-12 mt-3 " : ""}
                   d-flex justify-content-around align-items-center p-1 ${
                    Number(reviewForm?.overallRating) > 0 ? "" : ""
                  }`}
                >
                  <div>
                    <Typography fontWeight="400" fontFamily="Work Sans" fontSize={12}>Overall Rating</Typography>
                  </div>
                  <div>
                    {loading ? (
                      <LoadingIndicator />
                    ) : (
                      <div>
                        {
                          <div>
                            <RatingComponent
                              readonly
                              value={reviewForm.overallRating || 0}
                              ratingScale={reviewForm.ratings}
                            />
                            {reviewForm.overallRating || 0} out of {reviewForm.ratings?.[0]?.value?.length || 5}
                          </div>
                        }
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4" style={{marginTop: "2.5rem !important"}}>
          {loading ? (
            <LoadingIndicator />
          ) : (
            <>
              {reviewForm.goals.length > 0 ? (
               <Box sx={{marginTop: isMobile || isTablet ? "1rem !important" : "2.5rem !important"}}>
                <GoalsTable
                  refresh={true}
                  refresh2={true}
                  ownerDet={empData}
                  orderModalShow3={orderModalShow3}
                  orderModalShow5={orderModalShow5}
                  setOrderModalShow3={(status) => setOrderModalShow3(status)}
                  setOrderModalShow5={(status) => setOrderModalShow5(status)}
                  companyInfo={{ employeeNames: AuthUser.name }}
                  setDataWeights={(data) => {}}
                  setDataWeightsPercent={(data) => setData2(data)}
                  setDataQ1={(data) => {}}
                  setDataQ2={(data) => {}}
                  setDataQ3={(data) => {}}
                  setDataQ4={(data) => {}}
                  refresher={handleRefresh}
                  handlecallback={(data) => {}}
                  templateInfo={templateInfo}
                  handleUpdateGoals={handleUpdateGoals}
                  handleCallback2={() => {}}
                  goals={reviewForm.goals}
                  hideColumns={employeeInfo.managerId}
                  hideHeaders
                  status={reviewForm.status}
                  isEmployee={reviewForm.employeeName}
                  isManager={employeeInfo.managerId}
                  handleSetWeight={(weight) => handleSetWeight(weight)}
                  handleOverRating={(rating) => handleOverRating(rating)}
                  stepStatus={steps}
                  ratingScale={reviewForm.ratings}
                />
               </Box>
              ) : (
                <Box sx={{marginTop: "2.5rem !important"}}>
                <ObjectivesTable
                  refresh={true}
                  refresh2={true}
                  ownerDet={empData}
                  orderModalShow3={orderModalShow3}
                  orderModalShow5={orderModalShow5}
                  setOrderModalShow3={(status) => setOrderModalShow3(status)}
                  setOrderModalShow5={(status) => setOrderModalShow5(status)}
                  companyInfo={{ employeeNames: AuthUser.name }}
                  setDataWeights={(data) => {}}
                  setDataWeightsPercent={(data) => setData2(data)}
                  setDataQ1={(data) => {}}
                  setDataQ2={(data) => {}}
                  setDataQ3={(data) => {}}
                  setDataQ4={(data) => {}}
                  templateInfo={templateInfo}
                  handlecallback={(data) => {
                    let updatedForm = {
                      ...reviewForm,
                      goals: data.map((item) => ({ ...item })),
                    };
                    handleChange({
                      target: { name: "goals", value: updatedForm.goals },
                    });
                  }}
                  handleCallback2={() => {}}
                  goals={reviewForm.goals.length > 0 ? reviewForm.goals : []}
                  hideColumns={employeeInfo.managerId}
                  hideHeaders
                  status={reviewForm.status}
                  isEmployee={reviewForm.employeeName}
                  stepStatus={steps}
                  objectiveData={objectiveData}
                  isManager={employeeInfo.managerId}
                  ratingScale={reviewForm.ratings}
                />
                </Box>
              )}
            </>
          )}
        </div>
          </div>
          </Box>

        {/* Section Overall Ratings */}
        <Box backgroundColor="#FFFFFF" borderRadius="20px" padding="24px" boxShadow="0px 0.1px 0px rgba(0,0,0,0.2)" mb={4}>
          <Typography variant="h6" fontWeight={600} mb={3} fontFamily="Montserrat">
            Section Overall Ratings
          </Typography>
          <Box display="flex" gap={3} flexWrap="wrap">
            {/* Goals / Objectives Card */}
            <Box
              sx={{
                flex: 1,
                minWidth: 200,
                border: "1px solid #e0e0e0",
                borderRadius: "12px",
                padding: "16px",
                backgroundColor: "#FAFAFA",
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography fontWeight={600} fontSize={14} fontFamily="Work Sans">
                  Goals / Objectives
                </Typography>
                <Chip
                  label="Manual"
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: "#837F39",
                    color: "#837F39",
                    fontFamily: "Work Sans",
                    fontSize: 11,
                    height: 22,
                  }}
                />
              </Box>
              <Typography fontSize={12} color="text.secondary" fontFamily="Work Sans" mb={1}>
                Calculated: {reviewForm.goals.length > 0
                  ? (reviewForm.goals.reduce((sum, g) => sum + (Number(g.employeeRating) || 0), 0) / reviewForm.goals.length).toFixed(2)
                  : "0.00"} / {reviewForm.ratings?.[0]?.value?.length || 5}
              </Typography>
              <RatingComponent
                value={sectionGoalsRating}
                readonly={false}
                onChange={(e) => setSectionGoalsRating(Number(e.target.value))}
                ratingScale={reviewForm.ratings}
              />
              <Typography fontSize={12} color="text.secondary" fontFamily="Work Sans" mt={0.5} mb={1}>
                {sectionGoalsRating.toFixed(2)} / {reviewForm.ratings?.[0]?.value?.length || 5}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(sectionGoalsRating / (reviewForm.ratings?.[0]?.value?.length || 5)) * 100}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#e0e0e0",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "#4CAF50",
                    borderRadius: 4,
                  },
                }}
              />
            </Box>

            {/* Competencies Card */}
            <Box
              sx={{
                flex: 1,
                minWidth: 200,
                border: "1px solid #e0e0e0",
                borderRadius: "12px",
                padding: "16px",
                backgroundColor: "#FAFAFA",
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                <Typography fontWeight={600} fontSize={14} fontFamily="Work Sans">
                  Competencies
                </Typography>
                <Chip
                  label="Manual"
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: "#837F39",
                    color: "#837F39",
                    fontFamily: "Work Sans",
                    fontSize: 11,
                    height: 22,
                  }}
                />
              </Box>
              <Typography fontSize={12} color="text.secondary" fontFamily="Work Sans" mb={1}>
                Calculated: {formsData.length > 0 && formsData[0]?.competencyName
                  ? (formsData.reduce((sum, c) => sum + (Number(c.Feedback) || 0), 0) / formsData.length).toFixed(2)
                  : "0.00"} / {reviewForm.ratings?.[0]?.value?.length || 5}
              </Typography>
              <RatingComponent
                value={sectionCompetenciesRating}
                readonly={false}
                onChange={(e) => setSectionCompetenciesRating(Number(e.target.value))}
                ratingScale={reviewForm.ratings}
              />
              <Typography fontSize={12} color="text.secondary" fontFamily="Work Sans" mt={0.5} mb={1}>
                {sectionCompetenciesRating.toFixed(2)} / {reviewForm.ratings?.[0]?.value?.length || 5}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(sectionCompetenciesRating / (reviewForm.ratings?.[0]?.value?.length || 5)) * 100}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#e0e0e0",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "#4CAF50",
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
          </Box>
        </Box>

<Box  backgroundColor="#FFFFFF"  borderRadius="20px" padding="24px" boxShadow="0px 0.1px 0px rgba(0,0,0,0.2)" mb={4} sx={{paddingBottom: "4rem"}}>
          <Box display="flex" gap={4} flexWrap="wrap" justifyContent="space-between">
            {/* Left Column: Employee Review */}
            <Box width={400} maxWidth={400}>
              <Typography variant="h6" fontWeight={600} mb={2}>Employee Competencies Review</Typography>
              {/* Show employee competencies - either from current step or saved data */}
              {(activeStep === 0 ? formsData : (reviewForm.competencies && reviewForm.competencies.filter(c => c.type === 'employee') || [])).map((data, index) => (
                  <Box mb={3} key={index}>
                    <Typography mb={1} style={{fontWeight: "600",fontStyle:"Work Sans",fontSize:"14px"}}>{data.competencyName}</Typography>
                    <Box display="flex" alignItems="center" mb={2}>
                    <Typography mr={2} style={{fontWeight: "600",fontStyle:"Work Sans",fontSize:"14px"}}>Feedback</Typography>

                      <RatingComponent
                        value={data.Feedback}
                        readonly={activeStep !== 0}
                        name="Feedback"
                        onChange={(event) => handleInputChange(event, index)}
                        ratingScale={reviewForm.ratings}
                      />
                    </Box>
                    <InputTextComponent
                      id={`employee-comments-${index}`}
                      label="Comments"
                      name="Comments"
                      value={data.Comments}
                      onChange={(event) => handleInputChange(event, index)}
                      disabled={activeStep !== 0}
                      multiline
                      minRows={3}
                      sx={{fontWeight: "semibold !important", '& .MuiOutlinedInput-root fieldset': { borderWidth: '2.5px' }}}
                    />
                  </Box>
                ))}
                <InputTextComponent
                  id="cm1"
                  label="What is your key accomplishments in the last quarter? *"
                  name="cm1"
                  value={text?.cm1}
                  onChange={handleInputChange1}
                  disabled={activeStep !== 0}
                  multiline
                  minRows={3}
                  sx={{fontWeight: "600 !important", '& .MuiOutlinedInput-root fieldset': { borderWidth: '2.5px' }}}

                />
                <InputTextComponent
                  id="cm2"
                  label="What is your plan for the next quarter? *"
                  name="cm2"
                  value={text?.cm2}
                  onChange={handleInputChange1}
                  disabled={activeStep !== 0}
                  multiline
                  minRows={3}
                  sx={{fontWeight: "bold !important", '& .MuiOutlinedInput-root fieldset': { borderWidth: '2.5px' }}}
                />
            </Box>
            
            {/* Right Column: Manager Review */}
            {activeStep > 0 && (
                <Box width={400} maxWidth={400}>
                  <Typography variant="h6" fontWeight={600} mb={2}>Manager Competencies Review</Typography>
                  
                  {/* Show manager competencies - either editable or read-only */}
                  { canEditManagerReview
                    ? (
                      formsDataManagerReview.map((data, index) => (
                        <Box mb={3} key={index}>
                          <Typography fontWeight={500} mb={1} style={{fontWeight: "600",fontStyle:"Work Sans",fontSize:"14px"}}>{data.competencyName}</Typography>
                          <Box display="flex" alignItems="center" mb={2}>
                          <Typography mr={2} style={{fontWeight: "600",fontStyle:"Work Sans",fontSize:"14px"}}>Feedback</Typography>

                            <RatingComponent
                              readonly={false}
                              value={data.Feedback}
                              name="Feedback"
                              onChange={(event) => handleInputChangeMReview(event, index)}
                              ratingScale={reviewForm.ratings}
                            />
                          </Box>
                          <InputTextComponent
                            id={`manager-comments-${index}`}
                            label="Comments"
                            name="Comments"
                            value={data.Comments}
                            onChange={(event) => handleInputChangeMReview(event, index)}
                            disabled={false}
                            multiline
                            minRows={3}
                            sx={{fontWeight: "semibold !important", '& .MuiOutlinedInput-root fieldset': { borderWidth: '2.5px' }}}
                          />
                        </Box>
                      ))
                    )
                    : (
                      ((
                        (reviewForm.competencies &&
                          reviewForm.competencies.filter(item => item.type === "manager")) ||
                        []
                      ).length > 0
                        ? reviewForm.competencies.filter(item => item.type === "manager")
                        : formsDataManagerReview
                      ).map((data, index) => (
                          <Box mb={3} key={index}>
                            <Typography fontWeight={500} mb={1} style={{fontWeight: "600",fontStyle:"Work Sans",fontSize:"14px"}}>{data.competencyName}</Typography>
                            <Box display="flex" alignItems="center" mb={2}>
                              <Typography mr={2} style={{fontWeight: "600",fontStyle:"Work Sans",fontSize:"14px"}}>Feedback</Typography>
                              <RatingComponent readonly value={data.Feedback} ratingScale={reviewForm.ratings}/>
                            </Box>
                            <InputTextComponent
                              id={`readonly-manager-comments-${index}`}
                              label="Comments"
                              name="Comments"
                              value={data.Comments}
                              disabled={true}
                              multiline
                              minRows={3}
                              sx={{fontWeight: "semibold !important"}}
                            />
                          </Box>
                      ))
                    )
                  }
                  
                  <InputTextComponent
                    id="cm3"
                    label="Overall Manager comments *"
                    name="cm3"
                    value={text?.cm3}
                    onChange={handleInputChange1}
                    disabled={!canEditManagerReview}
                    multiline
                    minRows={3}
                    sx={{fontWeight: "semibold !important", '& .MuiOutlinedInput-root fieldset': { borderWidth: '2.5px' }}}
                  />
              </Box>
            )}
            
          </Box>

        <div>
        <Box mt={2} mb={4}>
          <Typography fontWeight={500} fontSize={16} mb={1}>
            Upload Attachments
            {uploading && (
              <Typography component="span" sx={{ ml: 1, color: "#1976d2" }}>
                (Uploading...)
              </Typography>
            )}
            {uploadedFileUrl && !uploading && (
              <Typography component="span" sx={{ ml: 1, color: "#4CAF50" }}>
                ✓ File uploaded
              </Typography>
            )}
          </Typography>
          <FileUploadCustom
            border="1.5px dashed #99965E"
            label={"Upload Attachments"}
            id="attachment-upload"
            onFileUpload={handleFileUpload}
            link={uploadedFileUrl || reviewForm.attachment}
            disabled={uploading}
          />
        </Box>

       {(status === "Employee SignOff" ||
          status === "Manager SignOff" ||
          status === "Completed") && (
          <div className="m-3">
            <p style={{fontWeight: "600",fontStyle:"Montserrat",fontSize:"16px"}}>Manager : {employeeInfo.manager}</p>
            <p style={{fontWeight: "600",fontStyle:"Montserrat",fontSize:"16px"}}>
              SignOff :{" "}
              {window
                .moment(reviewForm?.managerSubmissionDate)
                .format("YYYY-MM-DD")}
            </p>
          </div>
        )}

        {(status === "Employee SignOff" || status === "Completed") && (
          <div className="m-3">
            <p style={{fontWeight: "600",fontStyle:"Montserrat",fontSize:"16px"}}>Employee : {employeeInfo.name}</p>
            <p style={{fontWeight: "600",fontStyle:"Montserrat",fontSize:"16px"}}>
              SignOff :{" "}
              {window
                .moment(reviewForm?.employeeSubmissionDate)
                .format("YYYY-MM-DD")}
            </p>
          </div>
        )}
          <div className="buttons ">
            {(activeStep === 0 ||
              canEditManagerReview ||
              (activeStep === 2 &&
                (AuthRole === "HR Admin" || AuthRole === "Manager")) ||
              (activeStep === 3 && isCurrentUserLineManager) ||
              (activeStep === 4 && !nonAllowed.includes(AuthRole))) && (
              <Button
                text="Cancel"
                className="bg-white border-grey"
                handleClick={handleCancel}
                disabled={uploading}
              />
            )}
            {(activeStep === 0 || canEditManagerReview) &&
              <Button
                text={"Save & Close"}
                className="bg-brown border text-white"
                handleClick={handleSave}
                disabled={uploading}
              />
            }
            {status === "Submit" && (
              <Button
                text={getText("Self Submission (Employee)")}
                className="bg-brown border text-white"
                handleClick={handleSubmit}
                disabled={uploading}
              />
            )}
            {status === "Manager Review" &&
              isCurrentUserLineManager && (
                <Button
                  text={getText("Manager Review")}
                  className="bg-brown border text-white"
                  handleClick={handleSubmit}
                  disabled={uploading}
                />
              )}
            {status === "HR Review" &&
              (AuthRole === "HR Admin" || AuthRole === "Manager") && (
                <Button
                  text={getText("HR Review")}
                  className="bg-brown border text-white"
                  handleClick={handleSubmit}
                  disabled={uploading}
                />
              )}
            {status === "Manager SignOff" &&
              isCurrentUserLineManager && (
                <Button
                  text={getText("Manager SignOff")}
                  className="bg-brown border text-white"
                  handleClick={handleSubmit}
                  disabled={uploading}
                />
              )}
            {status === "Employee SignOff" &&
              AuthUserId===reviewForm?.employeeId && (
                <Button
                  text={getText("Employee SignOff")}
                  className="bg-brown border text-white"
                  handleClick={handleSubmit}
                  disabled={uploading}
                />
              )}
          </div>
        </div>

 </Box>

    </div>
  );
}
