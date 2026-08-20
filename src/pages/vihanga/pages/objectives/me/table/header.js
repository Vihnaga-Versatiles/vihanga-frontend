import React, { useState } from "react";
import {
  Box,
  Button,
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  ListItemIcon,
  ListItemText,
    Checkbox as MuiCheckbox,
    
} from "@mui/material";
import {
  Search as SearchIcon,
  Add as AddIcon,
  SystemUpdateAltOutlined as ExportIcon,
} from "@mui/icons-material";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { useHistory } from "react-router-dom";
import CustomButton from "../../../../components/Button/CustomButton";
import CheckboxDropdown from "../../dashboard/tableHeader/DisplayOptions";
import displayOptions from "../../../../../../assets/svg/displayOptionsIconDashboard.svg";
import ArrowDownwardOutlinedIcon from "../../../../../../assets/svg/ExportSvg.svg";
import { exportToCSV, exportToExcel, exportToPDF } from "utilities/ExportFunctions";
import { useTranslation } from "react-i18next";
import { t } from "i18next";
import { canEdit } from "utilities/privilegeHelper";
const TableHeaderTasks = ({
  search,
  setSearch,
  selectedItems,
  columns,
  setVisibleColumns,
  visibleColumns,
  selectedStatus,
  setSelectedStatus,
  handleBulkDelete,
  setIsCompanyOKRsFilterActive,
  isCompanyOKRsFilterActive,
  filteredData,
  handleCascade,
  handleCreateTask,
  createTaskRef,
  onExport,
}) => {
    const history = useHistory();
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [statusAnchorEl, setStatusAnchorEl] = useState(null);
  const [displayAnchorEl, setDisplayAnchorEl] = useState(null);
 const [anchorEl, setAnchorEl] = useState(null);
  const [showLibraryPopup, setShowLibraryPopup] = useState(false); // 🔥 Modal control state
const { i } = useTranslation()
  const exportOptions = [
    { text: t("Dashboard.csv"), format: "csv", icon: ArrowDownwardOutlinedIcon },
    { text: t("Dashboard.excel"), format: "excel", icon: ArrowDownwardOutlinedIcon },
    { text: t("Dashboard.pdf"), format: "pdf", icon: ArrowDownwardOutlinedIcon },
  ];

  const statusOptions = [
    { value: "ontrack", label: t("Dashboard.onTrack"), color: "#FA5453" },
    { value: "atrisk", label: t("Dashboard.atRisk"), color: "#FFBF00" },
    { value: "offtrack", label: t("Dashboard.offTrack") ,color: "#3FC429" }
  ];

    
   const handleColumnMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };


   const handleColumnMenuClose = () => {
    setAnchorEl(null);
  };

  const toggleColumnVisibility = (columnId) => {
    setVisibleColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId) 
        : [...prev, columnId]
    );
  };

  const handleStatusToggle = (status) => {
    setSelectedStatus((prev) =>
      prev.includes(status) 
        ? prev.filter((item) => item !== status) 
        : [...prev, status]
    );
  };

  const handleExport = (format) => {
    if (onExport) {
      onExport(format);
      return;
    }

    // Fallback: client-side export from loaded rows
    let dataToExport;
    if (selectedItems && selectedItems.length > 0) {
      // If selectedItems contains keys (for tasks), filter the data
      if (typeof selectedItems[0] === 'string') {
        dataToExport = filteredData.filter(item => selectedItems.includes(item.id || item._id));
      } else {
        dataToExport = selectedItems;
      }
    } else {
      dataToExport = filteredData;
    }

    if (!dataToExport || dataToExport.length === 0) {
      alert("No data to export");
      return;
    }

    // Function to flatten the nested OKR structure
    const flattenOKRs = (items, level = 0) => {
      let result = [];

      items.forEach((item) => {
        // Create base record for current item
        const baseRecord = {
          "Type": level === 0 ? "Task" : level === 1 ? "Key Result" : "Sub Task",
          "Title": item.title || item.task || item.name || "N/A",
          "Description": item.description || "N/A",
          "Progress": `${item.progress || 0}%`,
          "Status": getStatusLabel(item.progress || 0),
          "Owner": item.owner?.name || item.owner || item.assignee?.name || item.assignee || "N/A",
          "Weight": item.weight ? `${item.weight}%` : "N/A",
          "Start Date": item.startDate
            ? new Date(item.startDate).toLocaleDateString()
            : "N/A",
          "Due Date": item.dueDate
            ? new Date(item.dueDate).toLocaleDateString()
            : "N/A",
          "Priority": item.priority || "N/A",
          "Created At": item.createdAt
            ? new Date(item.createdAt).toLocaleDateString()
            : "N/A",
        };

        result.push(baseRecord);

        // Recursively add children if they exist
        if (item.children && item.children.length > 0) {
          result = result.concat(flattenOKRs(item.children, level + 1));
        }
      });

      return result;
    };

    // Helper function to determine status label
    const getStatusLabel = (progress) => {
      if (progress >= 80) return "On Track";
      if (progress >= 50) return "At Risk";
      return "Off Track";
    };

    // Get flattened data
    const exportData = flattenOKRs(dataToExport);

    // Handle different export formats using the utility functions
    switch (format) {
      case "csv":
        exportToCSV(exportData);
        break;

      case "excel":
        exportToExcel(exportData);
        break;

      case "pdf":
        exportToPDF(exportData);
        break;

      default:
        break;
    }
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2 }}>
      {/* Left side: Display Options & Status */}
      <Box sx={{ display: "flex", gap: 2 }}>
        <CheckboxDropdown
          anchorEl={displayAnchorEl}
          setAnchorEl={setDisplayAnchorEl}
          options={columns.map((col) => col.label)}
          selectedOptions={visibleColumns.map(
            (id) => columns.find((col) => col.id === id)?.label
          )}
          onToggle={(label) => {
            const column = columns.find((col) => col.label === label);
            if (!column) return;
            setVisibleColumns((prev) =>
              prev.includes(column.id)
                ? prev.filter((id) => id !== column.id)
                : [...prev, column.id]
            );
          }}
          icon={<img src={displayOptions} alt="Display Options" />}
          label={t("objectives.Display_options")}
        />

        <CheckboxDropdown
          anchorEl={statusAnchorEl}
          setAnchorEl={setStatusAnchorEl}
          options={statusOptions?.map(opt => opt?.label) || []}
          selectedOptions={selectedStatus?.map(status => 
            statusOptions?.find(opt => opt?.value === status)?.label
          ) || []}
          onToggle={(label) => {
            const status = statusOptions.find(opt => opt.label === label)?.value;
            if (status) handleStatusToggle(status);
          }}
          label={t("objectives.Status")}
          useCustomIcons={true}
        />
      </Box>

      {/* Right side: Search, Export, Create */}
      <Box sx={{ display: "flex", gap: 2 }}>
        <TextField
          placeholder={t("Tasks.Search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            minWidth: "300px",
            height: "34px",
            border: "1px solid #837F39",
            padding: ".3rem",
            borderRadius: "5rem",
            "& fieldset": { border: "none" },
            ".MuiInputBase-root": {
              height: "100%",
              alignItems: "center",
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#85803c" }} />
              </InputAdornment>
            ),
            sx: {
              height: "100%",
              padding: "0 12px",
              "& input": {
                padding: "0",
                fontSize: "12px",
              },
            },
          }}
        />
        

        <CustomButton
          iconPosition="start"
          iconExists={true}
          onClick={(e) => setExportAnchorEl(e.currentTarget)}
          IconProp={ExportIcon}
          text={t("task.export")}
          variant="outlined"
          color="#000"
          backgroundColor="transparent"
          hoverColor="#f5f5f5"
          sx={{
            margin: "0 0 .3rem .5rem",
            fontWeight: 550,
            border: "1px solid #85803c",
            borderRadius: "5rem",
            height: "34px",
            marginTop: "10px",
            "&:hover": {
              backgroundColor: "#f5f5f5",
              border: "1px solid #85803c",
            },
          }}
        />

        <Menu
          anchorEl={exportAnchorEl}
          open={Boolean(exportAnchorEl)}
          onClose={() => setExportAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          PaperProps={{
            sx: {
              borderRadius: "1rem",
              border: "1px solid #ddd",
              mt: "10px",
            },
          }}
        >
          {exportOptions.map((item, index) => (
            <MenuItem
              key={index}
              onClick={() => {
                handleExport(item.format);
                setExportAnchorEl(null);
              }}
            >
              <ListItemIcon sx={{ minWidth: "30px" }}>
                <img src={item.icon} alt={item.text} width={18} height={18} />
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{
                  color: "#6D6D6D",
                  fontWeight: "500",
                  fontSize: "14px",
                }}
              />
            </MenuItem>
          ))}
        </Menu>

        {canEdit() && (
          <Box ref={createTaskRef} sx={{ display: "inline-block" }}>
            <CustomButton
              text={t("objectives.Create")}
              backgroundColor="#837F39"
              color="white"
              hoverColor="#736F33"
              onClick={handleCreateTask}
              iconExists={true}
              IconProp={AddIcon}
              iconPosition="start"
              sx={{
                height: "34px",
                borderRadius: "100px",
                textTransform: "capitalize",
                fontWeight: 600,
                fontSize: "12px",
                "&:hover": {
                  backgroundColor: "#736F33",
                },
              }}
            />
          </Box>
        )}

                {/* <Box>
                  <Button 
                    variant="contained"
                    onClick={handleColumnMenuClick}
                    sx={{
                      backgroundColor: '#8A8543',
                      borderRadius: 999,
                      textTransform: 'none',
                      '&:hover': { backgroundColor: '#7c7b3b' },
                    }}
                  >
                    Display Options
                  </Button>
                  <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleColumnMenuClose}
                  >
                    {columns.map((column) => (
                      <MenuItem 
                        key={column.id} 
                        onClick={() => toggleColumnVisibility(column.id)}
                      >
                        <MuiCheckbox checked={visibleColumns.includes(column.id)} />
                        <ListItemText primary={column.label} />
                      </MenuItem>
                    ))}
                  </Menu>
                </Box> */}
      </Box>
    </Box>
  );
};

export default TableHeaderTasks;