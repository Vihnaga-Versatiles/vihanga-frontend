import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Box,
  Menu,
  Button,
  MenuItem,
  TableSortLabel,
  Select,
  LinearProgress,
  CircularProgress,
} from "@mui/material";
import {
  KeyboardDoubleArrowLeft as KeyboardDoubleArrowLeftIcon,
  KeyboardDoubleArrowRight as KeyboardDoubleArrowRightIcon,
  MoreVert as MoreVertIcon,
} from "@mui/icons-material";
import TableHeader2 from "../../pages/objectives/tableHeader/index";
import TableHeader from "../../pages/Recruitment/sections/section1/table-section/header.js";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { useLocation } from "react-router-dom";
import TableHeader3 from "pages/vihanga/pages/objectives/dashboard/tableHeader/tableHeader";
import TableHeader4 from "pages/vihanga/pages/employeePortal/tableHeaderLeaves/tableHeader";
import TableHeader7 from 'pages/vihanga/pages/objectives/chats/team/THeader';
import TableHeaderTasks from 'pages/vihanga/pages/objectives/me/table/header'
import {
  KeyboardArrowRight,
  KeyboardArrowDown,
} from "@mui/icons-material";
import {
  Collapse,
  Typography,
} from "@mui/material";
import ReviewsTableHeader from "pages/vihanga/pages/Reviews/ReviewsTableHeader";
import { formatDate } from "pages/vihanga/utils";

const cellStyle = {
  padding: ".5rem",
  borderRight: "1px solid #ddd",
  fontSize: "12px",
  height: "38px",
  textAlign: "left",
  color: "#000",
};

const TableHeaderCell = ({ column, orderBy, order, handleSort, selectedItems, sortedData, handleSelectAll }) => {
  // Always return something - null is valid if we want to render nothing
  if (!column) return null;

  if (column?.headerCheckbox && column?.renderHeader) {
    const visibleSelectedCount = Array.isArray(selectedItems) && Array.isArray(sortedData)
      ? (sortedData || []).filter(row =>
        selectedItems?.some(item => item.id === row.id)
      ).length
      : 0;

    return column.renderHeader(
      visibleSelectedCount,
      sortedData.length,
      handleSelectAll
    );
  }

  if (column.sortable) {
    return (
      <TableSortLabel
        active={orderBy === column.id}
        direction={orderBy === column.id ? order : "asc"}
        onClick={() => handleSort(column.id)}
      >
        {column.label || ''}
      </TableSortLabel>
    );
  }

  // Default return for all other cases
  return <>{column.label || ''}</>;
};

const RenderRow = ({
  row,
  level = 0,
  indexPath = [],
  toggleRow,
  openRows,
  columns,
  lastRow, // This should be columnsToRender
  getRowSx,
  indentOnlyFirstColumn
}) => {
  const indexKey = indexPath.join("-");

  return (
    <React.Fragment key={row._id || row.id || indexKey}>
      <TableRow sx={getRowSx ? getRowSx(row) : undefined}>
        {columns?.map((column) => (
          <TableCell
            key={column.id}
            sx={{
              width: column.width || "auto",
              borderBottom: lastRow ? "none" : "1px solid #F4F4F4",
            }}
          >
            {column.id === "actions" ? (
              column.render(row)
            ) : (
              <Box
                display="flex"
                alignItems="center"
                ml={indentOnlyFirstColumn && column.id !== columns[0].id ? 0 : `${level * 24}px`}
                gap="20px"
              >
                {row.children?.length > 0 && column.id === columns[0].id && (
                  <IconButton
                    size="small"
                    onClick={() => toggleRow(indexKey)}
                    sx={{ padding: 0 }}
                  >
                    {openRows[indexKey] ? (
                      <KeyboardArrowDown sx={{ color: "black", }} tabindex="0" />
                    ) : (
                      <KeyboardArrowRight sx={{ color: "black" }} tabindex="0" />
                    )}
                  </IconButton>
                )}
                {column.render ? column.render(row) : row[column.id]}
              </Box>
            )}
          </TableCell>
        ))}
      </TableRow>

      {row.children?.length > 0 && openRows[indexKey] && (
        row.children.map((child, childIndex) => (
          <RenderRow
            key={child._id || child.id || `${indexKey}-${childIndex}`}
            row={child}
            level={level + 1}
            indexPath={[...indexPath, childIndex]}
            toggleRow={toggleRow}
            openRows={openRows}
            columns={columns}
            getRowSx={getRowSx}
            indentOnlyFirstColumn={indentOnlyFirstColumn}
          />
        ))
      )}
    </React.Fragment>
  );
};

const CustomTable = ({
  onExport,
  loading,
  columns,
  data = [],
  sx = {},
  rowsPerPageOptions = [8, 10, 15],
  pagination = true,
  onEdit,
  onDelete,
  menuItemsStage = [],
  menuItemsExportOptions = [],
  page,
  totalPages,
  rowsPerPage,
  setRowsPerPage,
  setPage = () => { },
  setSelectedItems = () => { },
  selectedItems = [],
  search = "",
  setSearch = () => { },
  visibleColumns,
  setVisibleColumns = () => { },
  columnsToRender,
  selectedStatus,
  setSelectedStatus,
  filters,
  setFilters,
  selectedCount = 0,
  totalCountChecked = 0,
  onSelectAll = () => { },
  handleBulkDelete = () => { },
  isCompanyOKRsFilterActive,
  setIsCompanyOKRsFilterActive,
  handleCascade = () => { },
  filteredData = [],
  isCompany,
  isEmployee,
  handleEmployeeExport,
  setStatusAnchorEl,
  statusAnchorEl,
  statusOptions,
  handleStatusToggle,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  leaveStatusFilter,
  setLeaveStatusFilter,
  showHeader = true,
  getRowSx,
  RewardsTableHeader,
  CommonHeader,
  header,
  selectedTasks, // Just declare the prop
  handleCreateTask, // Just declare the pr
  skipInternalFilter = false, // NEW: allow parent to handle filtering
  indentOnlyFirstColumn = false, // NEW: indent only first column for nested rows
  createOKRRef, // For onboarding tutorial
  createTaskRef, // For tasks onboarding tutorial
}) => {
  const { tableSx, headerSx, columnSx, rowSx } = sx;
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("");
  const [stage, setStage] = useState("All");
  // const [search, setSearch] = useState("");
  const [openRows, setOpenRows] = React.useState({});
  const sortedData = [...data]
    .filter((row) =>
      skipInternalFilter
        ? true
        : columns
          .filter((col) => col.id !== "actions")
          .some((col) => {
            const value = row[col.id];
            return (
              typeof value === "string" &&
              value.toLowerCase().includes(search.toLowerCase())
            );
          })
    )
    .sort((a, b) => {
      if (orderBy) {
        const aValue = a[orderBy] ?? "";
        const bValue = b[orderBy] ?? "";
        if (typeof aValue === "number") {
          return order === "asc" ? aValue - bValue : bValue - aValue;
        } else {
          return order === "asc"
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
      }
      return 0;
    });
  const handleSelectAll = (shouldSelect) => {
    if (shouldSelect) {
      // Select all currently visible rows
      const newSelected = [...new Set([...selectedItems, ...sortedData])];
      setSelectedItems(newSelected);
    } else {
      // Deselect all currently visible rows
      const newSelected = selectedItems?.filter(
        selectedItem => !sortedData?.some(row => row.id === selectedItem.id)
      );
      setSelectedItems(newSelected);
    }
  };



  const toggleRow = (index) => {
    setOpenRows((prev) => ({ ...prev, [index]: !prev[index] }));
  };
  const location = useLocation();

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleChangePage = (_, newPage) => {
    setPage(newPage);
  };

  const renderHeader = () => {
    if (location.pathname.includes("/objectives/myteam")) {
      return (
        <TableHeader7
          stage={stage}
          setStage={setStage}
          search={search}
          setSearch={setSearch}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          menuItemsStage={menuItemsStage}
          menuItemsExportOptions={menuItemsExportOptions}
          setVisibleColumns={setVisibleColumns}
          visibleColumns={visibleColumns}
          columns={columns}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          handleBulkDelete={handleBulkDelete}
          isCompanyOKRsFilterActive={isCompanyOKRsFilterActive}
          setIsCompanyOKRsFilterActive={setIsCompanyOKRsFilterActive}
          handleCascade={handleCascade}
          filteredData={filteredData}



        />
      );
    }

    if (location.pathname.includes("/tasks")) {
      return (
        <TableHeaderTasks
          search={search}
          setSearch={setSearch}
          columns={columns}
          visibleColumns={visibleColumns}
          setVisibleColumns={setVisibleColumns}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          selectedItems={selectedTasks ? Object.keys(selectedTasks).filter(key => selectedTasks[key]) : []}
          filteredData={data}
          handleCreateTask={handleCreateTask}
          createTaskRef={createTaskRef}
          onExport={onExport}
        />
      );
    }
    if (location.pathname.includes("/objectives")) {
      return (
        <TableHeader3
          stage={stage}
          setStage={setStage}
          search={search}
          setSearch={setSearch}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          menuItemsStage={menuItemsStage}
          menuItemsExportOptions={menuItemsExportOptions}
          setVisibleColumns={setVisibleColumns}
          visibleColumns={visibleColumns}
          columns={columns}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          handleBulkDelete={handleBulkDelete}
          isCompanyOKRsFilterActive={isCompanyOKRsFilterActive}
          setIsCompanyOKRsFilterActive={setIsCompanyOKRsFilterActive}
          handleCascade={handleCascade}
          filteredData={filteredData}
          createOKRRef={createOKRRef}


        />
      );
    }

    if (location.pathname.includes("/objectives/myteam")) {
      return (
        <TableHeader7
          stage={stage}
          setStage={setStage}
          search={search}
          setSearch={setSearch}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          menuItemsStage={menuItemsStage}
          menuItemsExportOptions={menuItemsExportOptions}
          setVisibleColumns={setVisibleColumns}
          visibleColumns={visibleColumns}
          columns={columns}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          handleBulkDelete={handleBulkDelete}
          isCompanyOKRsFilterActive={isCompanyOKRsFilterActive}
          setIsCompanyOKRsFilterActive={setIsCompanyOKRsFilterActive}
          handleCascade={handleCascade}
          filteredData={filteredData}
          createOKRRef={createOKRRef}


        />
      );
    }

    // if (
    //   [
    //     "/apply-leave",
    //     "/Recruitment",
    //     "/time-tracking",
    //     "document-verification",
    //   ].some((route) => location.pathname.includes(route))
    // ) {

    if (location.pathname.includes("/objectives")) {
      return (
        <TableHeader3
          onExport={onExport}
          stage={stage}
          setStage={setStage}
          search={search}
          setSearch={setSearch}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          menuItemsStage={menuItemsStage}
          menuItemsExportOptions={menuItemsExportOptions}
          columns={columns}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          handleBulkDelete={handleBulkDelete}
          isCompanyOKRsFilterActive={isCompanyOKRsFilterActive}
          setIsCompanyOKRsFilterActive={setIsCompanyOKRsFilterActive}
          handleCascade={handleCascade}
          filteredData={filteredData}
          createOKRRef={createOKRRef}
        />
      );
    }
    if (
      location.pathname.includes("/Recruitment") ||
      location.pathname.includes("/eligibitity") ||
      location.pathname.includes("/leave-type") ||
      location.pathname.includes("/eligibitity-criteria") ||
      location.pathname.includes("holidays-calendar") ||
      location.pathname.includes("/asset-management")
    ) {
      let dataToExport = data
      if (location.pathname.includes("/holidays-calendar")) {
        dataToExport = data.map((item) => ({
          holidayName: item.holidayName || "",
          fromDate: item.fromDate
            ? new Date(item.fromDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
            : "",
          toDate: item.toDate
            ? new Date(item.toDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
            : "",
          holidayDuration: item.holidayDuration || "",
          type: item.type || "",
          description: item.description || ""
        }));
      }
      if (location.pathname.includes("/Recruitment")) {
        const exportFields = [
          "candidateId", "candidateName", "email", "phone", "dob", "gender", "location", "source", "department", "designation", "status", "projectName", "appliedOn"
        ];
        dataToExport = data.map((item) => {
          const ordered = {};
          exportFields.forEach(key => {
            ordered[key] = item[key] !== undefined ? item[key] : '';
          });
          Object.keys(item).forEach(key => {
            if (!exportFields.includes(key)) {
              ordered[key] = item[key];
            }
          });
          return ordered;
        })
      }
      if (location.pathname.includes("/asset-management")) {
        dataToExport = data.map((item) => ({
          employeeId: item.employeeId || '',
          fullName: item.fullName || '',
          department: item.department || '',
          position: item.position || '',
          workLocation: item.workLocation || '',
          assetType: item.assetType || '',
          assetNumber: item.assetNumberDisplay || item.assetNumber || '',
          issueDate: formatDate(item.issueDate),
          handoverDate: formatDate(item.handoverDate)
        }));
      }
      return (
        <TableHeader
          onExport={onExport}
          stage={stage}
          setStage={setStage}
          search={search}
          setSearch={setSearch}
          setPage={setPage}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          menuItemsStage={menuItemsStage}
          menuItemsExportOptions={menuItemsExportOptions}
          filters={filters}
          setFilters={setFilters}
          filteredData={dataToExport}
        />
      );
    }
    if (

      location.pathname.includes("/previlages/time-tracking") ||
      location.pathname.includes("/previlages/apply-leave") ||
      location.pathname.includes("/previlages/document-verification") ||
      location.pathname.includes("/previlages/time-history") || location.pathname.includes("/admin/setups/company") || location.pathname.includes("/admin/setups/employees") || location.pathname.includes("/previlages/time-history") ||
      location.pathname.includes("/admin/approval") || location.pathname.includes("/admin/setups/departments")
      || location.pathname.includes("/previlages/competencyManagement")

    ) {
      return (
        <TableHeader4
          showSearch={location.pathname !== "/admin/previlages/competencyManagement" && location.pathname !== "/admin/previlages/time-tracking" && location.pathname !== "/admin/previlages/time-history" && location.pathname !== "/admin/previlages/apply-leave"}
          showFilterButton={location.pathname !== "/admin/previlages/time-tracking" && location.pathname !== "/admin/previlages/time-history" && location.pathname !== "/admin/reviews" && location.pathname !== "/admin/previlages/apply-leave"}
          onExport={onExport}
          stage={stage}
          setStage={setStage}
          search={search}
          setSearch={setSearch}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          menuItemsStage={menuItemsStage}
          menuItemsExportOptions={menuItemsExportOptions}
          isCompany={isCompany}
          isEmployee={isEmployee}
          columns={columns}
          visibleColumns={visibleColumns}
          setVisibleColumns={setVisibleColumns}
          handleEmployeeExport={handleEmployeeExport}
          statusAnchorEl={statusAnchorEl}
          setStatusAnchorEl={setStatusAnchorEl}
          statusOptions={statusOptions}
          handleStatusToggle={handleStatusToggle}
          selectedStatus={selectedStatus}
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          filteredData={data}
          leaveStatusFilter={leaveStatusFilter}
          setLeaveStatusFilter={setLeaveStatusFilter}
        />
      );
    }
    if (location.pathname.includes("/admin/reviews")) {
      return (
        <ReviewsTableHeader
          search={search}
          setSearch={setSearch}
          onExport={onExport}
          showExport={true}
          showFilterButton={false}
        />
      );
    }
    else {
      return (
        <TableHeader
          onExport={onExport}
          stage={stage}
          setStage={setStage}
          search={search}
          setSearch={setSearch}
          setPage={setPage}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          menuItemsStage={menuItemsStage}
          menuItemsExportOptions={menuItemsExportOptions}
          filters={filters}
          setFilters={setFilters}
          columns={columns}
          filteredData={data}
        />
      );
    }
    return null; // If no matching header
  };





  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          border: "1px solid #85803c",
          borderRadius: "1rem",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {header ? header : (showHeader && renderHeader())}

        <TableContainer
          sx={{
            borderTop: "1px solid #85803c",
            flex: 1,
            overflow: "auto",
            maxHeight: "calc(100vh - 300px)",
          }}
        >
          {loading ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: "100%",
                padding: 2,
              }}
            >
              <CircularProgress sx={{ color: "#837F39" }} />
            </Box>
          ) : (
            <>
              <Table sx={{ ...tableSx }}>
                <TableHead
                  sx={{
                    ...headerSx,
                    background: "#F4F4F4",
                    borderBottom: "none",
                  }}
                >
                  <TableRow sx={{ display: "contents", ...rowSx }}>
                    {(columnsToRender?.length > 0
                      ? columnsToRender
                      : columns
                    )
                      .filter(col => !col.hidden)
                      .map((col) => (
                        <TableCell
                          key={col.id}
                          sx={{
                            fontSize: "16px",
                            fontWeight: 600,
                            fontFamily: "Montserrat",
                            borderBottom: "none",
                            ...columnSx,
                          }}
                        >
                          <TableHeaderCell
                            column={col}
                            orderBy={orderBy}
                            order={order}
                            handleSort={handleSort}
                            selectedItems={selectedItems}
                            sortedData={sortedData}
                            handleSelectAll={handleSelectAll}
                          />
                        </TableCell>
                      ))}
                  </TableRow>
                </TableHead>

                {sortedData.length === 0 ? (
                  <>
                    <TableRow>
                      <TableCell
                        colSpan={
                          (columnsToRender?.length > 0
                            ? columnsToRender.filter(col => !col.hidden).length
                            : columns.filter(col => !col.hidden).length)
                        }
                        sx={{
                          textAlign: "center",
                          fontSize: "16px",
                          fontFamily: "Montserrat",
                          color: "#85803c",
                          padding: "2rem",
                        }}
                      >
                        Oops! It looks like there's
                        No data available ....!
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  sortedData.map((row, idx) => (
                    <RenderRow
                      key={row._id || row.id || idx}
                      row={row}
                      lastRow={idx === sortedData.length - 1}
                      indexPath={[idx]}
                      toggleRow={toggleRow}
                      openRows={openRows}
                      columns={
                        (columnsToRender?.length > 0 ? columnsToRender : columns).filter(col => !col.hidden)
                      }
                      getRowSx={getRowSx}
                      indentOnlyFirstColumn={indentOnlyFirstColumn}
                    />
                  ))
                )}

                { }
              </Table>
            </>
          )}
        </TableContainer>
      </Box>
      {/* Replace the existing pagination code with this simplified version */}
      {pagination && totalPages > 0 && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "0.5rem",
            marginTop: "1rem",
            fontFamily: "Montserrat",
            fontSize: "14px",
          }}
        >
          <Button
            variant="text"
            onClick={() => handleChangePage(null, page - 1)}
            disabled={page === 0}
            sx={{
              minWidth: "auto",
              color: page === 0 ? "#837F3980" : "#837F39",
              fontWeight: 400,
              textTransform: "none",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <ArrowBackIosNewIcon fontSize="small" />
            Back
          </Button>

          {[...Array(totalPages).keys()]
            .slice(Math.max(0, page - 1), Math.min(totalPages, page + 2))
            .map((number) => (
              <Button
                key={number}
                onClick={() => handleChangePage(null, number)}
                sx={{
                  minWidth: "auto",
                  color: page === number ? "#fff" : "#837F39",
                  backgroundColor: page === number ? "#837F39" : "transparent",
                  fontWeight: 500,
                  fontFamily: "Montserrat",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  padding: 0,
                }}
              >
                {number + 1}
              </Button>
            ))}

          <Button
            variant="text"
            onClick={() => handleChangePage(null, page + 1)}
            disabled={page >= totalPages - 1}
            sx={{
              minWidth: "auto",
              color: page >= totalPages - 1 ? "#837F3980" : "#837F39",
              fontWeight: 400,
              textTransform: "none",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            Next
            <ArrowForwardIosIcon fontSize="small" />
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default CustomTable;

