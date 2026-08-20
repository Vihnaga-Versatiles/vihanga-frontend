 import React, { useState, useEffect, useRef } from "react";
import { useHistory } from 'react-router-dom';
import CircularProgress from "@mui/material/CircularProgress";
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Grid,
  Typography,
  Box,
  Card,
  Button,
  Avatar,
  Link,
} from "@mui/material";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import { InputTextComponent } from "../../../../components/input-elements/text";
import { SelectComponent } from "../../../../components/input-elements/select";
import AddIcon from '../../../../../../assets/svg/addIcon.svg'
import FileUploadCustom from "../../../../components/filesUplode/draganddropFile";
import InterviewerCard from "./fotter";
import axios from "axios";
import { Toast } from "service/toast";
import { appURL, PsychometricURL, removeDuplicates, UiURL } from "utilities";
import { getDesignations } from "action/DesignationAct";
import { getDepartmentsData } from "action/DepartmentAct";
import { getEntities } from "action/EntityAct";
import { useDispatch } from "react-redux";
import Departments from "pages/Setup/Departments";

import html2pdf from "html2pdf.js";
import { useLocation } from "react-router-dom";
import { hiringOptions } from "pages/vihanga/utils/const";
import { date } from "yup";
import { useTranslation } from "react-i18next";


const CandidateDetailsForm = ({ id, setStatus }) => {
    const { t } = useTranslation();
  const generateCandidateId = () => {
    const now = new Date();
    // Offset hour by 10 so the ID never starts with 0 (hours 0-23 → 10-33)
    const h = (now.getHours() + 10).toString();
    const m = now.getMinutes().toString().padStart(2, "0");
    const s = now.getSeconds().toString().padStart(2, "0");
    const rand = Math.floor(Math.random() * 90 + 10); // random 2-digit

    return `${h}${m}${s}${rand}`; // e.g., "19344743" instead of "09344743"
  };
  const companyId = localStorage.getItem("companyId") !== null
    ? JSON.parse(localStorage.getItem("companyId"))
    : null;
  const [formData, setFormData] = useState({
    candidateId: generateCandidateId(),
    candidateName: "",
    title: "",
    middleName: "",
    panNumber: "",
    countryOfBirth: "",
    cityStateOfBirth: "",
    nationality: "",
    marriageDate: "",
    fatherName: "",
    bloodGroup: "",
    pfNumber: "",
    experience: "",
    educationQualification: "",
    dateOfJoining: "",

    email: "",
    phone: "",
    dob: "",
    gender: "",
    location: "",
    source: "",
    department: "",
    designation: "",
    legalEntity: "",
    status: 'New Applied',
    companyId: companyId,
    interviewer1: {
      name: '',
      email: '',
      id: '',
      feedbackId: ""
    },
    interviewer2: {
      name: '',
      email: '',
      id: '',
      feedbackId: ""
    },
    reportingManager: {
      name: '',
      email: '',
      id: ''
    },
    projectName: "",
    grossSalary: "",
    noticePeriod: "",
    probationPeriod: "",
    moveToTalentPool: ""
  });

  const pdfRef = useRef();

  const location = useLocation();

  const [photoFile, setPhotoFile] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [existingPhoto, setExistingPhoto] = useState("");
  const [existingResume, setExistingResume] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedbackId, setFeedbackId] = useState();
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false)
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [legalEntities, setLegalEntities] = useState([]);
  const [error, setError] = useState('')
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const dispatch = useDispatch();
  
  // Store raw data for filtering
  const [allDepartmentsRaw, setAllDepartmentsRaw] = useState([]);
  const [allDesignationsRaw, setAllDesignationsRaw] = useState([]);
  const [noDepartmentsAvailable, setNoDepartmentsAvailable] = useState(false);
  const [noDesignationsAvailable, setNoDesignationsAvailable] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const companyId = JSON.parse(localStorage.getItem("companyId"));
        const response = await axios.get(
          `${appURL}/employees/getEmployees/${companyId}`
        );

        const employees = response?.data?.data;

        const options = employees.map((emp) => ({
          value:
            `${emp.personalInformation?.firstName} ${emp.personalInformation?.lastName}`.trim(),
          label:
            `${emp.personalInformation?.firstName} ${emp.personalInformation?.lastName}`.trim(),
          key: emp._id,
          email: emp?.contactInformation?.email,
          gender:emp?.personalInformation?.gender,
          image:emp?.personalInformation?.profilePicture
        }));

        setEmployeeOptions(options);
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };
    
    // Load draft from localStorage if creating new candidate (no id)
    const loadDraftFromLocalStorage = () => {
      if (!id && !candidateId) {
        try {
          const draftData = localStorage.getItem("candidateFormDraft");
          if (draftData) {
            const parsedDraft = JSON.parse(draftData);
            setFormData(parsedDraft.formData);
            if (parsedDraft.existingPhoto) {
              setExistingPhoto(parsedDraft.existingPhoto);
            }
            if (parsedDraft.existingResume) {
              setExistingResume(parsedDraft.existingResume);
            }
            setIsDraftLoaded(true);
            Toast({ message: "Draft loaded successfully", type: "info" });
          }
        } catch (error) {
          console.error("Error loading draft:", error);
        }
      }
    };
    
    fetchDepartments();
    fetchDesignations();
    fetchEntities();
    fetchEmployees();
    loadDraftFromLocalStorage();
  }, []);

  

  const candidateDataFromState = location.state?.candidateData;
  const Candidate_Id = candidateDataFromState ? candidateDataFromState.candidateId : null;
  const candidateId = Candidate_Id || id;

  useEffect(() => {
    if (candidateId) {
      const fetchCandidate = async () => {
        try {
          setLoading(true);
          const response = await axios.get(
            `${appURL}/recruitment/getCandidateById?_id=${candidateId}`
          );

          const candidateData = response?.data?.data?.[0];
          setFeedbackId(candidateData?.candidateId);
          setFormData({
            showDocuments: candidateData?.documents?.length > 0,
            candidateId: candidateData?.candidateId || generateCandidateId(),
            candidateName: candidateData?.candidateName || "",
            title: candidateData?.title || "",
            middleName: candidateData?.middleName || "",
            panNumber: candidateData?.panNumber || "",
            countryOfBirth: candidateData?.countryOfBirth || "",
            cityStateOfBirth: candidateData?.cityStateOfBirth || "",
            nationality: candidateData?.nationality || "",
            marriageDate: candidateData?.marriageDate || "",
            fatherName: candidateData?.fatherName || "",
            bloodGroup: candidateData?.bloodGroup || "",
            pfNumber: candidateData?.pfNumber || "",
            status: candidateData?.status || "",
            email: candidateData?.email || "",
            phone: candidateData?.phone || "",
            dob: candidateData?.dob,
            gender: candidateData?.gender || "",
            location: candidateData?.location || "",
            source: candidateData?.source || "",
            department: candidateData?.department || "",
            designation: candidateData?.designation || "",
            legalEntity: candidateData?.legalEntity || "",
            interviewer1: candidateData?.interviewer1 || "",
            interviewer2: candidateData?.interviewer2 || "",
            reportingManager: candidateData?.reportingManager || "",
            projectName: candidateData?.projectName || "",
            grossSalary: candidateData?.grossSalary || "",
            noticePeriod: candidateData?.noticePeriod || "",
            probationPeriod: candidateData?.probationPeriod || "",
            moveToTalentPool: candidateData?.moveToTalentPool || "",
            nextSuitableRole: candidateData?.nextSuitableRole || "",
            showOfferLetter: candidateData?.showOfferLetter || false,
            experience: candidateData?.experience || "",
            educationQualification: candidateData?.educationQualification || "",
            dateOfJoining: candidateData?.dateOfJoining || ""
          });
          setStatus(candidateData?.status);
          
          if (candidateData?.image) {
            setExistingPhoto(candidateData.image);
          }
          if (candidateData?.resume) {
            setExistingResume(candidateData.resume);
          }
        } catch (error) {
          console.error("Error fetching candidate:", error);
        } finally {
          setLoading(false);
        }
      };

      const fetchCandidateData = async () => {
        try {
          const response = await axios.get(
            `${PsychometricURL}/users/user-results?candidateId=${candidateId}`
          );
          setShowFeedback(response?.data?.candidateId);
        } catch (error) {
          console.error("Error fetching candidate data:", error);
        }
      };
      fetchCandidateData();
      fetchCandidate();
    }
  }, [candidateId]);

  // Apply filters when legal entity or department is selected
  useEffect(() => {
    const selectedLegalEntity = formData?.legalEntity;
    const selectedDepartment = formData?.department;

    if (selectedLegalEntity && allDepartmentsRaw.length > 0) {
      filterDepartmentsByLegalEntity(selectedLegalEntity);
    }

    if (selectedDepartment && allDesignationsRaw.length > 0) {
      filterDesignationsByDepartment(selectedDepartment);
    }
    //eslint-disable-next-line
  }, [allDepartmentsRaw, allDesignationsRaw, formData?.legalEntity, formData?.department]);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      let response = dispatch(getDepartmentsData());
      response.then(({ data, message }) => {
        if (data !== undefined && data.length > 0 && data[0].departments.length > 0) {
          // Store raw data for filtering
          const activeDepartments = data[0].departments.filter(
            (item) => item.status === "Active"
          );
          setAllDepartmentsRaw(activeDepartments);
          
          // Initially show all departments (will be filtered when legal entity is selected)
          let result = activeDepartments.map((item) => ({
            value: item.departmentName,
            label: item.departmentName,
            key: item.departmentName
          }));
          let nonduplicates = removeDuplicates(result, "value");
          setDepartments(nonduplicates);
          setError("");
        } else if (data.length === 0) {
          setError("No Data Found!");
        } else {
          setError(message);
        }
      });
    } catch (error) {
      setError(error.toString());
      console.error("Error fetching departments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDesignations = () => {
    try {
      setLoading(true);
      let response = dispatch(getDesignations());
      response.then(({ data, message }) => {
        if (data !== undefined && data.length > 0) {
          // Store raw data for filtering
          const activeDesignations = data.filter(
            (item) => item.status === "Active"
          );
          setAllDesignationsRaw(activeDesignations);
          
          // Initially show all designations (will be filtered when department is selected)
          let result = activeDesignations.map((item) => ({
            value: item.designationName,
            label: item.designationName,
            key: item.designationName
          }));
          let nonduplicates = removeDuplicates(result, "value");
          setDesignations(nonduplicates);
          setError("");
        } else if (data.length === 0) {
          setError("No Data Found!");
        } else {
          setError(message);
        }
      });
    } catch (error) {
      setError(error.toString());
      console.error("Error fetching designations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEntities = () => {
    try {
      setLoading(true);
      let response = dispatch(getEntities());
      response.then(({ data, message }) => {
        if (data !== undefined && data.length > 0) {
          let result = data
            .filter((item) => item.status === "Active")
            .map((item) => ({
              value: item.legalEntityName,
              label: item.legalEntityName,
              key: item.legalEntityName
            }));
          let nonduplicates = removeDuplicates(result, "value");
          setLegalEntities(nonduplicates);
          setError("");
        } else if (data.length === 0) {
          setError("No Data Found!");
        } else {
          setError(message);
        }
      });
    } catch (error) {
      setError(error.toString());
      console.error("Error fetching legal entities:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter departments based on selected legal entity
  const filterDepartmentsByLegalEntity = (selectedLegalEntity) => {
    if (!selectedLegalEntity || allDepartmentsRaw.length === 0) {
      // If no legal entity selected, show all departments
      const allDepartments = allDepartmentsRaw.map((item) => ({
        value: item.departmentName,
        label: item.departmentName,
        key: item.departmentName
      }));
      let nonduplicates = removeDuplicates(allDepartments, "value");
      setDepartments(nonduplicates);
      setNoDepartmentsAvailable(false);
      return;
    }
    
    const filtered = allDepartmentsRaw
      .filter((dept) => dept.legalEntityName === selectedLegalEntity)
      .map((item) => ({
        value: item.departmentName,
        label: item.departmentName,
        key: item.departmentName
      }));
    
    let nonduplicates = removeDuplicates(filtered, "value");
    setDepartments(nonduplicates);
    // Show message if no departments available for selected legal entity
    setNoDepartmentsAvailable(nonduplicates.length === 0 && selectedLegalEntity && allDepartmentsRaw.length > 0);
  };
  
  // Filter designations based on selected department
  const filterDesignationsByDepartment = (selectedDepartment) => {
    if (!selectedDepartment || allDesignationsRaw.length === 0) {
      // If no department selected, show all designations
      const allDesignations = allDesignationsRaw.map((item) => ({
        value: item.designationName,
        label: item.designationName,
        key: item.designationName
      }));
      let nonduplicates = removeDuplicates(allDesignations, "value");
      setDesignations(nonduplicates);
      setNoDesignationsAvailable(false);
      return;
    }
    
    const filtered = allDesignationsRaw
      .filter((desig) => desig.departmentName === selectedDepartment)
      .map((item) => ({
        value: item.designationName,
        label: item.designationName,
        key: item.designationName
      }));
    
    let nonduplicates = removeDuplicates(filtered, "value");
    setDesignations(nonduplicates);
    // Show message if no designations available for selected department
    setNoDesignationsAvailable(nonduplicates.length === 0 && selectedDepartment && allDesignationsRaw.length > 0);
  };

  const history = useHistory();

  const onBack = () => {
    history.push({
      pathname: "/admin/previlages/RecruitmentManagement",
    });
  };

  const handleInputChange = (e) => {
    const { id, value, name } = e.target;
    const fieldName = id || name;
    
    setFormData((prev) => {
      const updated = {
        ...prev,
        [fieldName]: value,
      };
      
      // Handle cascading filters for legal entity, department, and designation
      if (fieldName === "legalEntity") {
        // When legal entity changes, clear department and designation
        updated.department = "";
        updated.designation = "";
        // Filter departments based on selected legal entity (or show all if empty)
        filterDepartmentsByLegalEntity(value);
        // Show all designations when department is cleared
        if (allDesignationsRaw.length > 0) {
          const allDesignations = allDesignationsRaw.map((item) => ({
            value: item.designationName,
            label: item.designationName,
            key: item.designationName
          }));
          let nonduplicates = removeDuplicates(allDesignations, "value");
          setDesignations(nonduplicates);
          setNoDesignationsAvailable(false);
        }
      } else if (fieldName === "department") {
        // When department changes, clear designation
        updated.designation = "";
        // Filter designations based on selected department (or show all if empty)
        filterDesignationsByDepartment(value);
      }
      
      return updated;
    });
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setExistingPhoto("");
    }
  };

  const handleResumeUpload = (file) => {
    setResumeFile(file?.file || file);
    setExistingResume("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const requiredFields = [
        { key: "candidateName", label: t("RecruitmentManagement.CandidateName") },
        { key: "email", label: t("RecruitmentManagement.EmailAddress") },
        { key: "phone", label: t("RecruitmentManagement.PhoneNo") },
        { key: "dob", label: t("RecruitmentManagement.DateOfBirth") },
      ];
      const missing = requiredFields
        .filter(({ key }) => {
          const value = formData?.[key];
          return value === undefined || value === null || String(value).trim() === "";
        })
        .map(({ label }) => label);
      if (missing.length > 0) {
        setLoading(false);
        Toast({
          message: `Please fill required fields: ${missing.join(", ")}`,
          type: "error",
        });
        return;
      }

      // Interviewer mandatory check
      if (
        (formData.status === "Interview 1" && !formData.interviewer1?.id) ||
        (formData.status === "Interview 2" && !formData.interviewer2?.id)
      ) {
        setLoading(false);
        Toast({
          message: "Please select interviewer",
          type: "error"
        });
        return;
      }


      const formDataToSend = new FormData();
      const user = JSON.parse(localStorage.getItem("user"));
      formDataToSend.append("hr", user?.email);
      // formDataToSend.append("hr", "interviewtesting345@yopmail.com");
      if (formData.status === "Offer Letter") {
        if (!formData.grossSalary || !formData.noticePeriod || !formData.probationPeriod) {
          setLoading(false);
          Toast({ 
            message: "Please fill all required fields for Offer Letter", 
            type: "error" 
          });
          // alert("Please fill all required fields for Offer Letter");
          return;
        }
      }

      // Flatten form data including nested objects
      Object.entries(formData).forEach(([key, value]) => {
        if (
          (key === "interviewer1" || key === "interviewer2" || key === "reportingManager") &&
          typeof value === "object" &&
          value !== null
        ) {
          Object.entries(value).forEach(([subKey, subValue]) => {
            formDataToSend.append(`${key}[${subKey}]`, subValue || "");
          });
        } else {
          formDataToSend.append(key, value);
        }
      });

      // Append files if they exist
      if (photoFile) {
        formDataToSend.append("photo", photoFile);
      }
      if (resumeFile) {
        formDataToSend.append("resume", resumeFile);
      }

      const url = `${appURL}/recruitment/candidates`;
      const method = id ? "put" : "post";

      const response = await axios[method](url, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      Toast({ 
        message: response?.data?.message || `Candidate ${id ? "updated" : "created"} successfully`, 
        type: "success" 
      });

      // Clear draft from localStorage after successful submission
      localStorage.removeItem("candidateFormDraft");

      setLoading(false)
      history.push({
        pathname: "/admin/previlages/RecruitmentManagement",
      });
    } catch (error) {
      setLoading(false)
      Toast({ 
        message: error.response?.data?.message || error?.message?.message || `Candidate ${id ? "updation" : "creation"} failed`, 
        type: "error" 
      });
      console.error("Submission error:", error.response?.data || error.message);
    }
  };

  const handleSaveDraft = () => {
    try {
      const draftData = {
        formData: formData,
        existingPhoto: photoFile ? URL.createObjectURL(photoFile) : existingPhoto,
        existingResume: resumeFile ? resumeFile.name : existingResume,
        savedAt: new Date().toISOString()
      };
      
      localStorage.setItem("candidateFormDraft", JSON.stringify(draftData));
      Toast({ message: "Draft saved successfully", type: "success" });
      setIsDraftLoaded(true);
    } catch (error) {
      console.error("Error saving draft:", error);
      Toast({ message: "Failed to save draft", type: "error" });
    }
  };

  const handleInterview = (opt, fieldName) => {
    setFormData((prevData) => ({
      ...prevData,
      [fieldName]: {
        name: opt.label,
        email: opt.email,
        id: opt.key,
        gender:opt.gender,
        image:opt.img
      },
    }));
  };

  const pdfContentRef = useRef(null);

  useEffect(() => {
    window.onload = () => {
      if (pdfContentRef.current) {
        html2pdf().from(pdfContentRef.current).save("candidate_report.pdf");
      }
    };
  }, []);

  return (
    <>
      <Card
        sx={{
          backgroundColor: "#FFFFFF",
          borderRadius: "20px",
          marginX: "30px",
          marginTop: "30px",
          boxShadow: "none",
        }}
      >
        <Box sx={{ paddingX: { lg: "40px" }, marginTop: "20px" }}>
          <Box
            display="flex"
            alignItems="center"
            sx={{ marginBottom: "50px", padding: "0px" }}
          >
            <Box
              onClick={onBack}
              sx={{ background: "none", cursor: "pointer", padding: "0px" }}
            >
              <ArrowBackIosIcon
                sx={{ fontSize: 35, color: "#000000", background: "none" }}
              />
            </Box>
            <Typography
              fontWeight="700"
              sx={{
                marginLeft: "8px",
                fontSize: "32px",
                fontFamily: "Work Sans",
                color: "#0E0E0E",
                padding: "0px",
              }}
            >
            {t('RecruitmentManagement.CandidateDetails')}
            </Typography>
          </Box>
          <form onSubmit={handleSubmit} noValidate>
            <Grid container spacing={2}>
              {/* First Row: ID, Name, and Photo */}
              <Grid item xs={12} md={8}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <InputTextComponent
                      id="candidateId"
                      label={t('RecruitmentManagement.ID')}
                      value={formData.candidateId}
                      onChange={handleInputChange}
                      disabled
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <InputTextComponent
                      id="candidateName"
                      label={<>{t('RecruitmentManagement.CandidateName')} <span style={{ color: "red" }}>*</span></>}
                      value={formData.candidateName}
                      onChange={handleInputChange}
                    />
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: "158px",
                    height: "158px",
                    border: "1.22px dashed #99965E",
                    borderRadius: "19.45px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12.15px",
                    bgcolor: "#FFFFFF",
                    cursor: "pointer",
                    padding: "10px",
                    position: "relative",
                  }}
                >
                <>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    id="photo-upload"
                    onChange={handlePhotoUpload}
                  />
                  <label
                    htmlFor="photo-upload"
                    style={{ padding: "0px", height: "100%" }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        padding: "0px",
                        position: "relative",
                      }}
                    >
                      {photoFile || existingPhoto ? (
                        <>
                          <img
                            src={
                              photoFile
                                ? URL.createObjectURL(photoFile)
                                : existingPhoto
                            }
                            alt="Preview"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              borderRadius: "19.45px",
                            }}
                          />
                          <EditOutlinedIcon
                            sx={{
                              position: "absolute",
                              top: "-6px",
                              right: "-0.5rem",
                              backgroundColor: "#fff",
                              borderRadius: "50%",
                              padding: "3px",
                              fontSize: "2rem",
                              color: "#000",
                              zIndex: 10,
                              cursor: "pointer",
                              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.4)",
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <img 
                          tabIndex={0}
                            src={AddIcon}
                            alt="Add"
                            style={{
                              color: "#837F39",
                              width: "37px",
                              height: "37px",
                            }}
                          />
                          <Typography
                            sx={{
                              color: "#99965E",
                              fontSize: "21px",
                              fontWeight: "500",
                              fontFamily: "Work Sans",
                            }}
                          >
{t('RecruitmentManagement.AddPhoto')}                          </Typography>
                        </>
                      )}
                    </Box>
                  </label>
                </>
                </Box>
              </Grid>

              {/* Rest of the form fields */}
              <Grid item xs={4}>
                <InputTextComponent
                  id="email"
                  label={<>{t('RecruitmentManagement.EmailAddress')} <span style={{ color: "red" }}>*</span></>}
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={4}>
                <InputTextComponent
                  id="phone"
                  label={<>{t('RecruitmentManagement.PhoneNo')} <span style={{ color: "red" }}>*</span></>}
                  type="number"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={4}>
                <InputTextComponent
                  id="experience"
                  label={t('RecruitmentManagement.ExperienceInYears')}
                  type="text"
                  value={formData.experience}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={4}>
                <SelectComponent
                  id="educationQualification"
                  label={t('RecruitmentManagement.EducationQualification')}
                  value={formData.educationQualification}
                  onChange={handleInputChange}
                  options={[
                    { value: "10thclass", label: "10th class" },
                    { value: "Intermediate", label: "Intermediate" },
                    { value: "Degree", label: "Degree" },
                    { value: "Post graduate", label: "Post graduate" },
                    { value: "None", label: "None" },
                  ]}
                />
              </Grid>
              <Grid item xs={4}>
                <InputTextComponent
                  id="dob"
                  label={<>{t('RecruitmentManagement.DateOfBirth')} <span style={{ color: "red" }}>*</span></>}
                  type="date"
                  value={formData.dob}
                  onChange={handleInputChange}
                  disableFutureDate={true}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Grid>
              <Grid item xs={4}>
                <SelectComponent
                  id="gender"
                  label={t('RecruitmentManagement.Gender')}
                  value={formData.gender}
                  onChange={handleInputChange}
                  options={[
                    { value: "Male", label: "Male" },
                    { value: "Female", label: "Female" },
                    { value: "Other", label: "Other" },
                  ]}
                />
              </Grid>
              <Grid item xs={4}>
                <InputTextComponent
                  id="location"
                  label={t('RecruitmentManagement.Location')}
                  value={formData.location}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid item xs={4}>
                <InputTextComponent
                  id="source"
                  label={t('RecruitmentManagement.Source')}
                  value={formData.source}
                  onChange={handleInputChange}
                />
              </Grid>

               <Grid item xs={4}>
                <SelectComponent
                  id="legalEntity"
                  label={t('RecruitmentManagement.LegalEntity')}
                  value={formData.legalEntity}
                  onChange={handleInputChange}
                  options={legalEntities}
                />
              </Grid>
              
              <Grid item xs={4}>
                <SelectComponent
                  id="department"
                  label={t('RecruitmentManagement.Department')}
                  value={formData.department}
                  onChange={handleInputChange}
                  options={departments}
                />
                {noDepartmentsAvailable && (
                  <Typography
                    sx={{
                      color: "red",
                      fontSize: "12px",
                      marginTop: "4px",
                      fontFamily: "Work Sans",
                    }}
                  >
                    No Functions available for the selected legal entity
                  </Typography>
                )}
              </Grid>
              <Grid item xs={4}>
                <SelectComponent
                  id="designation"
                  label={t('RecruitmentManagement.Designation')}
                  value={formData.designation}
                  onChange={handleInputChange}
                  options={designations}
                />
                {noDesignationsAvailable && (
                  <Typography
                    sx={{
                      color: "red",
                      fontSize: "12px",
                      marginTop: "4px",
                      fontFamily: "Work Sans",
                    }}
                  >
                    No designations available for the selected department
                  </Typography>
                )}
              </Grid>

             

              <Grid item xs={4}>
                <InputTextComponent
                  id="projectName"
                  label={t('RecruitmentManagement.ProjectName')}
                  value={formData.projectName}
                  onChange={handleInputChange}
                />
              </Grid>

              <Grid item xs={4}>
                <SelectComponent
                  id="reportingManager"
                  label={t('RecruitmentManagement.ReportingManager')}
                  setSelectedObject={(opt) => handleInterview(opt, "reportingManager")}
                  value={formData.reportingManager?.name || ""}
                  options={employeeOptions}
                />
              </Grid>

              <Grid item xs={4}>
                <SelectComponent
                  id="status"
                  label={t('RecruitmentManagement.Status')}
                  value={formData.status}
                  onChange={handleInputChange}
                  options={hiringOptions}
                />
              </Grid>

              {formData.status === "Rejected" && (
                <Grid item xs={4}>
                  <SelectComponent
                    id="moveToTalentPool"
                    label={t("RecruitmentManagement.MoveToTalentPool")}
                    value={formData.moveToTalentPool}
                    onChange={handleInputChange}
                    options={[
                      { value: "Yes", label: "Yes" },
                      { value: "No", label: "No" },
                    ]}
                  />
                </Grid>
              )}

              {formData.status === "Rejected" && (
                <Grid item xs={4}>
                  <SelectComponent
                    id="nextSuitableRole"
      label={t("RecruitmentManagement.SuitableDesignation")}
                    value={formData.nextSuitableRole}
                    onChange={handleInputChange}
                    options={designations}
                  />
                </Grid>
              )}

              {["Interview 1"].includes(formData.status) && (
                <Grid item xs={4}>
                  <SelectComponent
                    id="interviewer1"
                    label={
        <>
          {t("RecruitmentManagement.Interviewer1")}
          <span style={{ color: "red" }}> *</span>
        </>
      }
                    setSelectedObject={(opt) => handleInterview(opt, "interviewer1")}
                    value={formData.interviewer1?.name || ""}
                    options={employeeOptions}
                    required
                  />
                </Grid>
              )}

              {["Interview 2"].includes(formData.status) && (
                <Grid item xs={4}>
                  <SelectComponent
                    id="interviewer2"
        label={
        <>
          {t("RecruitmentManagement.Interviewer2")}
          <span style={{ color: "red" }}> *</span>
        </>
      }
                    setSelectedObject={(opt) => handleInterview(opt, "interviewer2")}
                    value={formData.interviewer2?.name || ""}
                    options={employeeOptions}
                    required
                  />
                </Grid>
              )}

              {formData.status === "Offer Letter" && (
                <>
                  <Grid item xs={4}>
                    <InputTextComponent
                      id="grossSalary"
        label={t("RecruitmentManagement.GrossSalary")}
                      type="number"
                      value={formData.grossSalary}
                      onChange={handleInputChange}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <InputTextComponent
                      id="dateOfJoining"
        label={t("RecruitmentManagement.DateOfJoining")}
                      type="date"
                      value={formData.dateOfJoining}
                      onChange={handleInputChange}
                      disableFutureDate={false}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <InputTextComponent
                      id="noticePeriod"
        label={t("RecruitmentManagement.NoticePeriodDays")}
                      type="number"
                      value={formData.noticePeriod}
                      onChange={handleInputChange}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <InputTextComponent
                      id="probationPeriod"
        label={t("RecruitmentManagement.ProbationPeriodDays")}
                      type="number"
                      value={formData.probationPeriod}
                      onChange={handleInputChange}
                    />
                  </Grid>
                </>
              )}
            </Grid>

            <Box sx={{ mt: 2, mb: 2 }}>
              <FileUploadCustom
                id="resume-upload"
                label={t('RecruitmentManagement.Resume')}
                onFileUpload={handleResumeUpload}
                file={resumeFile}
              />
              {existingResume && (
                <Link
                  href={existingResume}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    color: "primary.main",
                    textDecoration: "underline",
                    fontFamily: "Work Sans",
                    fontSize: "16px",
                    marginTop: "5px",
                    "&:hover": {
                      color: "primary.dark",
                    },
                  }}
                >
                  {t('RecruitmentManagement.ClickHere')}
                </Link>
              )}
            </Box>
            {showFeedback && (
              <a
                href={`${UiURL}/admin/previlages/ReportPages/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#1976d2",
                  textDecoration: "underline",
                  fontFamily: "Work Sans",
                  fontSize: "16px",
                  marginTop: "5px",
                  display: "inline-block",
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#115293")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#1976d2")}
              >
               { t('RecruitmentManagement.PsychometricReviewReport')}
              </a>
            )}

            {formData?.showDocuments && (
              <div>
                <a
                  href={`${UiURL}/candidate/document-upload?candidateId=${id}&round=documentupload`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#1976d2",
                    textDecoration: "underline",
                    fontFamily: "Work Sans",
                    fontSize: "16px",
                    marginTop: "5px",
                    display: "inline-block",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#115293")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "#1976d2")}
                >
                {  t('RecruitmentManagement.DocumentsUploadOverview')}
                </a>
              </div>
            )}

            {formData?.showOfferLetter && (
              <div>
                <a
                  href={`${UiURL}/admin/previlages/AppointmentLetter/${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#1976d2",
                    textDecoration: "underline",
                    fontFamily: "Work Sans",
                    fontSize: "16px",
                    marginTop: "5px",
                    display: "inline-block",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#115293")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "#1976d2")}
                >
{t('RecruitmentManagement.OfferLetter') }               </a>
              </div>
            )}

{formData?.panNumber && (
              <div>
                <a
                  href={`${UiURL}/candidate/profile?candidateId=${id}&round=onboarding`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#1976d2",
                    textDecoration: "underline",
                    fontFamily: "Work Sans",
                    fontSize: "16px",
                    marginTop: "5px",
                    display: "inline-block",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#115293")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "#1976d2")}
                >
                  Onboarding Overview
                </a>
              </div>
            )}
            <InterviewerCard formData={formData}employeeOptions={employeeOptions}/>
            
            {isDraftLoaded && (
              <Box display="flex" justifyContent="flex-start" mt={2}>
                <Typography
                  sx={{
                    color: "#837F39",
                    fontSize: "14px",
                    fontFamily: "Work Sans",
                    fontStyle: "italic",
                  }}
                >
                  {t('RecruitmentManagement.DraftLoaded') || "Draft data loaded"}
                </Typography>
              </Box>
            )}
            
            <Box display="flex" justifyContent="flex-end" gap={2} mt={2} mb={2}>
              <Button
                onClick={onBack}
                sx={{
                  borderRadius: "136px",
                  border: "1.37px solid rgba(131, 127, 57, 1)",
                  width: "107px",
                  color: "#837F39",
                  fontFamily: "Work Sans, sans-serif",
                  fontWeight: "500",
                  textTransform: "capitalize",
                }}
              >
                {t('RecruitmentManagement.Cancel')}
              </Button>
              
              { !id && (
                <Button
                  onClick={handleSaveDraft}
                  disabled={loading}
                  sx={{
                    borderRadius: "136px",
                    border: "1.37px solid rgba(131, 127, 57, 1)",
                    background: "#FFFFFF",
                    color: "#837F39",
                    width: "161px",
                    textTransform: "capitalize",
                    fontFamily: "Work Sans, sans-serif",
                    fontWeight: "500",
                    "&:hover": {
                      background: "#F5F5F5",
                      border: "1.37px solid #837F39",
                    },
                  }}
                >
                  {t('RecruitmentManagement.SaveAsDraft') || "Save as Draft"}
                </Button>
              )}
              
             
                <Button
                  type="submit"
                  disabled={loading}
                  sx={{
                    borderRadius: "136px",
                    background: "#837F39",
                    color: "#FFFFFF",
                    width: "161px",
                    textTransform: "capitalize",
                    fontFamily: "Work Sans, sans-serif",
                    fontWeight: "500",
                    "&:hover": {
                      background: "#99965E",
                      color: "#FFFFFF",
                      border: "1px solid #837F39",
                    },
                  }}
                >
                  {loading ? (
                    <Box
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      width="100%"
                    >
                      <CircularProgress
                        size={24}
                        thickness={5}
                        sx={{ color: "#ffffff" }}
              />
            </Box>
                  ) : id ? (
                      t('RecruitmentManagement.Update') 
                  ) : (
                    t('RecruitmentManagement.Submit') 
                  )}
                </Button>
           
            </Box>
          </form>
        </Box>
      </Card>
    </>
  );
};

export default CandidateDetailsForm;