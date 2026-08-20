import React, { useState, useEffect } from "react";
import { Box, Button, Typography, CircularProgress, IconButton, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Accordion, AccordionSummary, AccordionDetails, Alert, Dialog, DialogTitle, DialogContent, TablePagination, Stack } from "@mui/material";
import { useTranslation } from 'react-i18next';
import * as XLSX from "xlsx";
import axios from "axios";
import { Toast } from "service/toast";
import FileUploadCustom from "pages/vihanga/components/filesUplode/draganddropFile";
import { getItemFromLocalStorage } from "utilities/getLocalStorageItem";
import { getSelectedTabType } from "utilities/getLocalStorageItem";
import { appURL } from "utilities";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import EventIcon from "@mui/icons-material/Event";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import DateFilterButton from "pages/vihanga/pages/board/components/Date";
import FilePreview from "pages/vihanga/pages/employeePortal/TimeTracking/AttendanceUpload/FilePreview";
import { canEdit, canDelete } from "utilities/privilegeHelper";
import { downloadBackendExport, buildLeaveExportParams } from "utilities/backendExport";

const UploadLeaves = () => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [processedData, setProcessedData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingBalances, setExportingBalances] = useState(false);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [records, setRecords] = useState([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsPage, setRecordsPage] = useState(0);
  const [recordsRowsPerPage, setRecordsRowsPerPage] = useState(10);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const companyId = getItemFromLocalStorage("companyId");
  const currentUser = getItemFromLocalStorage("user");
  const currentUserId = currentUser?._id;

  const fetchUploads = async () => {
    try {
      setLoadingUploads(true);
      const res = await axios.get(`${appURL}/recruitment/leave-balance/uploads`, { params: { companyId, limit: 25 } });
      setUploads(res.data?.data || []);
    } catch (e) {
      // ignore
    } finally {
      setLoadingUploads(false);
    }
  };

  useEffect(() => {
    fetchUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Static template data - keep existing structure
  const templateData = [
    {
      "EmpId": "T0005",
      "Earned Leave": 1,
      "Sick Leave": 2,
      "Casual Leave": 3
    },
   
  ];

  const handleFileUpload = async ({ file, data }) => {
    if (!file) return;
    setUploading(true);
  
    try {
      let json = data;
  
      if (
        !json &&
        (file.name.endsWith('.xls') ||
          file.name.endsWith('.xlsx') ||
          file.name.endsWith('.csv'))
      ) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, {
          cellDates: false, 
        });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        json = XLSX.utils.sheet_to_json(sheet, {
          raw: false,       
          defval: "", 
          dateNF: "dd-mm-yyyy"      
        });
      }
  
      if (!json || json.length === 0) {
        setUploading(false);
        return;
      }
  
      setProcessedData({ json });
      setUploadedFile(file);
    } catch (err) {
      console.error(err);
      Toast({
        message: "Error processing file. Please check the format.",
        type: "error",
      });
    } finally {
      setUploading(false);
      setFileInputKey(prev => prev + 1);
    }
  };

  const handleSubmit = async () => {
    console.log("checkprocessedData", processedData);
    if (!processedData) return;
    setSubmitting(true);

    try {
      const employees = [];
      const errors = [];
      const warnings = [];

      for (let i = 0; i < processedData.json.length; i++) {
        const row = processedData.json[i];
        
        if (!row.EmpId) {
          errors.push(`Row ${i + 1}: Missing EmpId`);
          continue;
        }

        const leaveBalances = {};
        Object.keys(row).forEach(key => {
          if (key === 'EmpId') return;
          const rawValue = row[key];
          // Skip truly empty cells but allow 0 and negatives
          const isEmpty = rawValue === '' || rawValue === null || typeof rawValue === 'undefined' || (typeof rawValue === 'string' && rawValue.trim() === '');
          if (isEmpty) return;
          const num = Number(rawValue);
          if (Number.isFinite(num)) {
            leaveBalances[key] = num;
          }
        });

        if (Object.keys(leaveBalances).length === 0) {
          warnings.push(`Row ${i + 1}: No valid leave data found for employee ${row.EmpId}`);
          continue;
        }

        // Add employee to the bulk array
        employees.push({
          empId: row.EmpId,
          leaveTypes: leaveBalances
        });
      }

      if (employees.length === 0) {
        Toast({
          message: "No valid employee data found to process.",
          type: "warning",
        });
        setSubmitting(false);
        return;
      }

      // 1) Upload original file to S3 via backend for traceability/rollback
      let fileMeta = null;
      if (uploadedFile) {
        const formData = new FormData();
        formData.append("file", uploadedFile);
        const uploadRes = await axios.post(`${appURL}/recruitment/leave-balance/uploads/file`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        fileMeta = uploadRes.data?.data || null;
      }

      // 2) Post bulk upload with grouped data and file metadata
      const response = await axios.post(
        `${appURL}/recruitment/bulk-upload/leave-type?companyId=${companyId}`,
        {
          employees: employees,
          fileMeta: fileMeta,
          type: getSelectedTabType()
        }
      );

      if (response.data && response.data.success === false) {
        Toast({
          message: response.data.message || "Failed to process leave balances",
          type: "error",
        });
        return;
      }

      const result = response.data.data;
      
      // Transform results to match the expected format
      const transformedResults = result.results?.map((employeeResult, index) => ({
        row: index + 1,
        empId: employeeResult.empId,
        employeeName: employeeResult.employeeName,
        updated: employeeResult.reduced || [],
        warnings: employeeResult.warnings || [],
        summary: {
          successCount: employeeResult.successCount || 0
        }
      })) || [];

      // Store combined results
      const combinedResults = {
        message: result.message || `Leave balance updates completed. ${result.summary?.processedEmployees || 0} employees processed successfully.`,
        summary: {
          totalRows: processedData.json.length,
          successfulRows: result.summary?.processedEmployees || 0,
          errorRows: errors.length,
          warningRows: result.warnings?.length || 0
        },
        results: transformedResults,
        errors: errors,
        warnings: [...warnings, ...(result.warnings || [])]
      };

      setAnalysisResults(combinedResults);
      setShowResults(true);
      
      // Show success message
      Toast({
        message: combinedResults.message,
        type: "success",
      });
      
      // Reset form after successful submission
      setProcessedData(null);
      setUploadedFile(null);

      // Refresh uploads list
      fetchUploads();
      
    } catch (err) {
      console.error(err);
      
      // Extract error message from API response
      const errorMessage = err.response?.data?.message || err.message || "Failed to submit data. Please try again.";
      
      Toast({
        message: errorMessage,
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ... existing code ...

  const handleExportBalances = async () => {
    setExportingBalances(true);
    try {
      console.log("Starting leave balances export process...");
      
      // Build API URL without date parameters
      const apiUrl = `${appURL}/recruitment/bulk-export-balances?companyId=${companyId}`;
      
      // Call the new bulk export API endpoint to get all employees' leave balances
      const balancesResponse = await axios.get(apiUrl);

      console.log("Leave balances response:", balancesResponse.data);

      // Handle the response structure
      const responseData = balancesResponse.data.data || balancesResponse.data;
      const employeeDetails = responseData.employeeDetails || [];
      
      console.log("Found employee details:", employeeDetails.length);
      console.log("First employee sample:", employeeDetails[0]);
      
      // If no employees found, show message
      if (employeeDetails.length === 0) {
        Toast({
          message: "No employee records found for this company.",
          type: "warning",
        });
        return;
      }
      
      // Process the data for Excel export
      const exportData = employeeDetails.map(employee => {
        const row = {
      
          'Employee Number': employee.employeeNumber || 'N/A',
          'Employee Name': employee.employeeName || 'N/A',
          'Legal Entity': employee.legalEntity || 'N/A',
          'Department': employee.department || 'N/A',
          'Designation': employee.designation || 'N/A'
        };
        
        // Add remaining balance for each leave type
        if (employee.leaveSummary && typeof employee.leaveSummary === 'object') {
          Object.keys(employee.leaveSummary).forEach(leaveType => {
            const leaveData = employee.leaveSummary[leaveType];
            if (leaveData) {
              // Clean the leave type name to avoid duplicates
              const cleanLeaveType = leaveType.replace(/\([^)]*\)/g, '').trim();
              
              // Add only remaining balance column for each leave type
              row[`${cleanLeaveType} - Remaining`] = leaveData.remaining || 0;
            }
          });
        }
        
        return row;
      });

      console.log("Export data prepared:", exportData);
      console.log("First employee data:", employeeDetails[0]);
      console.log("First export row:", exportData[0]);

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      console.log("Worksheet data:", ws);
      console.log("Worksheet range:", ws['!ref']);
      
      const columnCount = Object.keys(exportData[0] || {}).length;
      const colWidths = [];
      
      colWidths.push({ wch: 25 }); // Employee ID
      colWidths.push({ wch: 18 }); // Employee Number
      colWidths.push({ wch: 25 }); // Employee Name
      colWidths.push({ wch: 20 }); // Legal Entity
      colWidths.push({ wch: 20 }); // Department
      colWidths.push({ wch: 25 }); // Designation
      
      // Dynamic widths for leave type remaining columns
      for (let i = 6; i < columnCount; i++) {
        colWidths.push({ wch: 20 }); // Leave type remaining columns
      }
      
      ws['!cols'] = colWidths;
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Company Leave Balances");
      
      // Generate and download file
      const fileName = `company-leave-balances-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      Toast({
        message: `Leave balances exported successfully!`,
        type: "success",
      });
    } catch (err) {
      console.error("Export balances error:", err);
      Toast({
        message: "Failed to export leave balances. Please try again.",
        type: "error",
      });
    } finally {
      setExportingBalances(false);
    }
  };

  const handleExport = async (exportStartDate = null, exportEndDate = null) => {
    setExporting(true);
    try {
      const exportParams = buildLeaveExportParams({
        companyId,
        currentUserId,
        type: getSelectedTabType() || "mycompany",
        viewMode: "admin",
        viewType: "all-leaves",
        startDate: exportStartDate || undefined,
        endDate: exportEndDate || undefined,
        userRole: currentUser?.employmentInformation?.role,
      });

      await downloadBackendExport({
        module: "leaves",
        params: exportParams,
        format: "excel",
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


  // Handler for date range selection from Date component
  const handleDateRangeApply = (startDate, endDate) => {
    if (!startDate || !endDate) {
      // If dates are cleared, export without date filter
      handleExport(null, null);
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      Toast({
        message: "Start date cannot be later than end date.",
        type: "warning",
      });
      return;
    }

    // Call handleExport with selected dates
    handleExport(startDate, endDate);
  };


// ... existing code ...

  const openView = async (batch) => {
    setSelectedBatch(batch);
    setViewOpen(true);
    setRecordsPage(0);
    await loadBatchRecords(batch._id, 0, recordsRowsPerPage);
  };

  const loadBatchRecords = async (batchId, page, limit) => {
    try {
      setRecordsLoading(true);
      const res = await axios.get(`${appURL}/recruitment/leave-balance/uploads/${batchId}/records`, {
        params: { companyId, page: page + 1, limit }
      });
      setRecords(res.data?.data || []);
      setRecordsTotal(res.data?.total || 0);
    } catch (_) {
      setRecords([]);
      setRecordsTotal(0);
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleChangePage = async (_e, newPage) => {
    setRecordsPage(newPage);
    if (selectedBatch) await loadBatchRecords(selectedBatch._id, newPage, recordsRowsPerPage);
  };

  const handleChangeRowsPerPage = async (e) => {
    const newSize = parseInt(e.target.value, 10);
    setRecordsRowsPerPage(newSize);
    setRecordsPage(0);
    if (selectedBatch) await loadBatchRecords(selectedBatch._id, 0, newSize);
  };

  const handleRollback = async (batch) => {
    if (!window.confirm(t("Are you sure you want to rollback this upload?"))) return;
    try {
      await axios.delete(`${appURL}/recruitment/leave-balance/uploads/${batch._id}/rollback`, {
        params: { companyId }
      });
      Toast({ message: t("Rollback completed."), type: "success" });
      fetchUploads();
      if (selectedBatch?._id === batch._id) setViewOpen(false);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || t("Failed to rollback");
      Toast({ message: errorMessage, type: "error" });
    }
  };

  const handleDeleteBatch = async (batch) => {
    if (!window.confirm(t("Delete this upload record? This cannot be undone."))) return;
    try {
      await axios.delete(`${appURL}/recruitment/leave-balance/uploads/${batch._id}`, {
        params: { companyId }
      });
      Toast({ message: t("Upload deleted."), type: "success" });
      fetchUploads();
      if (selectedBatch?._id === batch._id) setViewOpen(false);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || t("Failed to delete upload");
      Toast({ message: errorMessage, type: "error" });
    }
  };

  const downloadTemplate = () => {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    const colWidths = [
      { wch: 15 }, // EmpId
      { wch: 15 }, // Earned Leave
      { wch: 15 }, // Sick Leave 
      { wch: 15 }  // Casual Leave
    ];
    ws['!cols'] = colWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Leave Upload Template");
    
    // Generate and download file
    XLSX.writeFile(wb, "Leave-Upload-Template.xlsx");
  };
  
  return (
    <Box sx={{ margin:"0 1.3rem 0 1.3rem", mt: 6, p: 4,
          borderRadius: "1rem",
        boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.1)",
        border: "1px solid #eee", }}>
      
      {/* Header Section */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <EventIcon sx={{ fontSize: 40, mr: 1, color: 'rgb(153, 150, 94)' }} />
        <Typography variant="h5" fontWeight={700}>{t("UploadLeaves.PageTitle")}</Typography>
      </Box>
      
      <Typography variant="body1" sx={{ mb: 2 }}>
        {t("UploadLeaves.PageDescription")}
      </Typography>

      {/* Action Buttons */}
      <Box sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 2,
        mb: 3
      }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={downloadTemplate}
          sx={{ 
            borderColor: 'rgb(153, 150, 94)',
            color: 'rgb(153, 150, 94)',
            '&:hover': {
              borderColor: 'rgb(153, 150, 94)',
              backgroundColor: 'rgba(153, 150, 94, 0.1)',
            }
          }}
        >
          {t("UploadLeaves.DownloadTemplate")}
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DateFilterButton
            onApply={handleDateRangeApply}
            buttonText={t("UploadLeaves.ExportLeaveRecords")}
            disabled={exporting}
          />
          {exporting && <CircularProgress size={20} sx={{ color: 'rgb(153, 150, 94)' }} />}
        </Box>

        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportBalances}
          disabled={exportingBalances}
          sx={{ 
            borderColor: 'rgb(153, 150, 94)',
            color: 'rgb(153, 150, 94)',
            '&:hover': {
              borderColor: 'rgb(153, 150, 94)',
              backgroundColor: 'rgba(153, 150, 94, 0.1)',
            },
            '&:disabled': {
              borderColor: 'rgba(153, 150, 94, 0.5)',
              color: 'rgba(153, 150, 94, 0.5)',
            }
          }}
        >
          {exportingBalances ? <CircularProgress size={20} color="inherit" /> : t("UploadLeaves.ExportLeaveBalances")}
        </Button>
      </Box>

      {/* File Upload Section */}
      {canEdit() && (
        <FileUploadCustom
          key={fileInputKey}
          label={t("UploadLeaves.UploadFileLabel")}
          id="leave-records-upload-input"
          onFileUpload={handleFileUpload}
          sx={{ minHeight: 180, mb: 2 }}
        />
      )}

      {/* File Preview */}
      {canEdit() && processedData && processedData.json && uploadedFile && !uploading && (
        <FilePreview 
          data={processedData.json} 
          fileName={uploadedFile.name}
        />
      )}

      {/* File Status and Submit Section */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 2, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {uploadedFile && !uploading ? (
            <>
              <Typography variant="body2" sx={{ mr: 1 }}>
                {t("UploadLeaves.UploadedFile")} <b>{uploadedFile.name}</b>
              </Typography>
              <IconButton size="small" onClick={() => {
                setUploadedFile(null);
                setProcessedData(null);
              }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t("UploadLeaves.NoFileUploaded")}
            </Typography>
          )}
        </Box>
        
        {canEdit() && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!processedData || submitting}
            sx={{
              backgroundColor: 'rgb(153, 150, 94)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgb(133, 130, 74)',
              },
              '&:disabled': {
                backgroundColor: 'rgba(153, 150, 94, 0.5)',
              },
              minWidth: 120,
            }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : t("UploadLeaves.Submit")}
          </Button>
        )}
      </Box>


      {/* Recent Uploads */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>{t("Recent Uploads")}</Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          {loadingUploads ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : uploads.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t("No uploads yet.")}</Typography>
          ) : (
            <Box>
              {uploads.map((u) => {
                const rolledBack = u.status === 'rolled_back';
                return (
                  <Box key={u._id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #eee' }}>
                    <Box>
                      <Typography variant="body2"><b>{u.filename || t("File")}</b> · {new Date(u.createdAt).toLocaleString()}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t("Records")}: {u.successCount}/{u.totalRecords} · {t("Status")}: {u.status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1))  
    .join(" ")}</Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => openView(u)}
                        disabled={rolledBack}
                        sx={{
                          borderColor: 'rgb(153, 150, 94)',
                          color: 'rgb(153, 150, 94)',
                          borderRadius: '5rem',
                          px: 2,
                          '&:hover': { borderColor: 'rgb(153, 150, 94)', backgroundColor: 'rgba(153,150,94,0.08)' },
                          '&.Mui-disabled': { color: 'rgba(0,0,0,0.26)', borderColor: '#e0e0e0' }
                        }}
                      >
                        {t("View")}
                      </Button>
                      {rolledBack && u.s3Url ? (
                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={u.s3Url}
                          target="_blank"
                          rel="noopener"
                          sx={{
                            borderColor: 'rgb(153, 150, 94)',
                            color: 'rgb(153, 150, 94)',
                            borderRadius: '5rem',
                            px: 2,
                            '&:hover': { borderColor: 'rgb(153, 150, 94)', backgroundColor: 'rgba(153,150,94,0.08)' }
                          }}
                        >
                          {t("Download")}
                        </Button>
                      ) : null}
                      {canEdit() && (
                        <Button
                          size="small"
                          variant={rolledBack ? 'outlined' : 'contained'}
                          color="error"
                          disabled={rolledBack}
                          onClick={() => handleRollback(u)}
                          sx={{ borderRadius: '5rem', px: 2 }}
                        >
                          {rolledBack ? t("Rolled Back") : t("Rollback")}
                        </Button>
                      )}
                      {canDelete() && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => handleDeleteBatch(u)}
                          disabled={!rolledBack && u.status !== 'failed'}
                          sx={{ borderRadius: '5rem', px: 2 }}
                        >
                          {t("Delete")}
                        </Button>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      </Box>

      {/* View Records Dialog */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{t("Upload Records")}{selectedBatch?.filename ? ` - ${selectedBatch.filename}` : ''}</DialogTitle>
        <DialogContent>
          {selectedBatch?.status === 'rolled_back' ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              {t("This upload was rolled back. The balance updates were reverted.")}
              {selectedBatch?.s3Url ? (
                <> {t("You can still download the original file")} <a href={selectedBatch.s3Url} target="_blank" rel="noopener">{t("here")}</a>.</>
              ) : null}
            </Typography>
          ) : recordsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("Employee ID")}</TableCell>
                    <TableCell>{t("Leave Types")}</TableCell>
                    <TableCell>{t("Updated At")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell>{r.empId || '-'}</TableCell>
                      <TableCell>
                        {r.leaveTypes && r.leaveTypes.length > 0 ? (
                          <Box>
                            {r.leaveTypes.map((lt, idx) => (
                              <Typography key={idx} variant="body2">
                                {lt.name}: {lt.balance} {lt.unit || 'days'}
                              </Typography>
                            ))}
                          </Box>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={recordsTotal}
                page={recordsPage}
                onPageChange={handleChangePage}
                rowsPerPage={recordsRowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[10, 25, 50]}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Instructions */}
      <Box sx={{ mt: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("UploadLeaves.Instructions.Title")}</Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          1. {t("UploadLeaves.Instructions.Step1")}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          2. {t("UploadLeaves.Instructions.Step2")}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          3. {t("UploadLeaves.Instructions.Step3")}
        </Typography>
        <Typography variant="body2">
          4. {t("UploadLeaves.Instructions.Step4")}
        </Typography>
      </Box>
    
    </Box>
  );
};

export default UploadLeaves;
