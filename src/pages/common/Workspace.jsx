// src/pages/Workspace.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Modal, Input, Form, InputNumber, notification } from "antd";

import Column from "../../components/common/kanban/Column";
import TaskModal from "../../components/common/kanban/TaskModal";
import useKanbanBoard from "../../hook/useKanbanBoard";
import { useTranslation } from "../../hook/useTranslation";
import { useLocation, useParams } from "react-router-dom";
import { GroupService } from "../../services/group.service";
import { BoardService } from "../../services/board.service";
import ListView from "../../components/common/workspace/ListView";
import { Pagination } from "../../components/common/forum/Pagination";

const Workspace = () => {
  const { id: routeGroupId } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const queryGroupId = searchParams.get("groupId");
  const storedGroupId =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("last_group_id") || ""
      : "";
  const [resolvedGroupId, setResolvedGroupId] = useState(
    queryGroupId || routeGroupId || storedGroupId
  );
  const [boardView, setBoardView] = useState(
    searchParams.get("view") === "list" ? "list" : "kanban"
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  const [activeTab, setActiveTab] = useState("overview");
  const [listViewFilterStatus, setListViewFilterStatus] = useState("All");
  const [listViewFilterPriority, setListViewFilterPriority] = useState("All");
  const [listViewPage, setListViewPage] = useState(1);
  const [listViewPageSize, setListViewPageSize] = useState(10);
  const [listViewRawTasks, setListViewRawTasks] = useState([]);
  const [listViewTotal, setListViewTotal] = useState(0);
  const [listViewLoading, setListViewLoading] = useState(false);
  const [listViewError, setListViewError] = useState("");
  const [listViewIsServerPaged, setListViewIsServerPaged] = useState(false);

  const {
    columns,
    filteredColumns,
    columnMeta,
    groupMembers,
    selectedTask,
    setSelectedTask,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filterPriority,
    setFilterPriority,
    handleDragOver,
    handleDragEnd,
    createColumn,
    createTask,
    updateTaskFields,
    updateTaskAssignees,
    deleteTask,
    deleteColumn,
    loading,
    error,
    refetchBoard,
    loadTaskComments,
    addTaskComment,
    updateTaskComment,
    deleteTaskComment,
  } = useKanbanBoard(resolvedGroupId);
  const { t } = useTranslation();

  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [columnForm] = Form.useForm();

  const normalizeTitle = (value = "") =>
    value.toLowerCase().replace(/\s+/g, "_");
  const normalizeKey = (value = "") =>
    (value || "").toString().trim().toLowerCase();
  const toApiStatusFilter = (value = "") => {
    const normalized = normalizeKey(value);
    if (!normalized || normalized === "all") return undefined;
    return normalized === "todo" ? "to_do" : normalized;
  };
  const normalizeAssignees = (assignees) => {
    const list = Array.isArray(assignees)
      ? assignees
      : assignees
      ? [assignees]
      : [];
    return list
      .map((assignee) => {
        if (!assignee) return null;
        const rawId =
          assignee.id ||
          assignee.userId ||
          assignee.memberId ||
          assignee.email ||
          assignee;
        const matched = (groupMembers || []).find(
          (member) =>
            normalizeKey(member.id) === normalizeKey(rawId) ||
            normalizeKey(member.userId) === normalizeKey(rawId) ||
            normalizeKey(member.email) === normalizeKey(rawId)
        );
        const fallbackName =
          assignee.name ||
          assignee.displayName ||
          assignee.fullName ||
          assignee.email ||
          rawId ||
          "";
        if (matched) {
          return {
            id: matched.id || rawId,
            name:
              matched.name ||
              matched.displayName ||
              matched.fullName ||
              fallbackName ||
              rawId ||
              "",
            email: matched.email || "",
            avatarUrl:
              matched.avatarUrl ||
              matched.avatarURL ||
              matched.photoUrl ||
              matched.photoURL ||
              "",
          };
        }
        return {
          id: rawId || fallbackName || "",
          name: fallbackName || rawId || "",
          email: assignee.email || "",
          avatarUrl:
            assignee.avatarUrl ||
            assignee.avatarURL ||
            assignee.photoUrl ||
            assignee.photoURL ||
            "",
        };
      })
      .filter((item) => item && (item.id || item.name));
  };
  const normalizeListTask = (task) => {
    if (!task) return null;
    const statusValue = task.status || task.columnId || task.state || "";
    const columnIdValue = task.columnId || statusValue || "";
    return {
      id: task.id || task.taskId || task._id,
      columnId: columnIdValue,
      title: task.title || task.name || "",
      description: task.description || "",
      priority: (task.priority || "").toLowerCase(),
      status: statusValue,
      dueDate:
        task.dueDate ||
        task.deadline ||
        task.targetDate ||
        task.endDate ||
        null,
      assignees: normalizeAssignees(
        task.assignees || task.assignee || task.members || []
      ),
      comments: task.comments || task.commentResponses || [],
    };
  };
  const parseListResponse = (response) => {
    const payload = response?.data ?? response;
    if (Array.isArray(payload?.columns)) {
      const items = payload.columns.flatMap((col) =>
        Array.isArray(col?.tasks) ? col.tasks : []
      );
      const total =
        payload?.page?.totalElements ||
        payload?.page?.totalItems ||
        payload?.totalItems ||
        payload?.total ||
        payload?.totalCount ||
        items.length;
      const totalNumber = Number(total) || items.length;
      const isServerPaged = totalNumber > items.length;
      return { items, total: totalNumber, fromColumns: true, isServerPaged };
    }
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.tasks)
      ? payload.tasks
      : [];
    const total =
      payload?.totalItems ||
      payload?.total ||
      payload?.totalCount ||
      payload?.page?.totalElements ||
      payload?.page?.totalItems ||
      payload?.meta?.total ||
      items.length;
    const totalNumber = Number(total) || items.length;
    const isServerPaged = totalNumber > items.length;
    return { items, total: totalNumber, fromColumns: false, isServerPaged };
  };
  const handleCreateColumn = () => {
    columnForm.validateFields().then((values) => {
      const positionValue = Number(values.position);
      
      // Validate position: must be a valid number >= 0 and <= 1000
      if (isNaN(positionValue) || positionValue < 0 || positionValue > 1000) {
        notification.info({
          message: t("validationError") || "Validation Error",
          description: t("positionMustBeValidNumber") || "Position must be a valid number between 0 and 1000.",
        });
        return;
      }
      
      const payload = {
        columnName: values.columnName,
        position: positionValue,
      };
      createColumn(payload);
      setIsColumnModalOpen(false);
      columnForm.resetFields();
    });
  };
  const handleQuickCreateTask = () => {
    if (!firstColumnId) return;
    createTask({
      columnId: firstColumnId,
      title: "New Task",
      description: "",
      priority: "medium",
      status: normalizeTitle(columnMeta?.[firstColumnId]?.title || "todo"),
      dueDate: null,
    });
  };
  const handleSwitchView = (view) => {
    setBoardView(view);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      window.history.replaceState({}, "", url.toString());
    } catch (err) {

    }
  };
  const handleResetFilters = () => {
    setSearch("");
    setFilterPriority("All");
    setFilterStatus("All");
  };
  const formatStatusLabel = (value = "") =>
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  const sortedColumns = useMemo(() => {
    return Object.entries(columnMeta || {}).sort(
      (a, b) => (a[1]?.position || 0) - (b[1]?.position || 0)
    );
  }, [columnMeta]);
  const flattenedTasks = useMemo(() => {
    return Object.entries(filteredColumns || {}).flatMap(
      ([colId, tasksInCol]) =>
        (tasksInCol || []).map((task) => ({
          ...task,
          columnId: colId,
          columnTitle: columnMeta?.[colId]?.title || colId,
        }))
    );
  }, [filteredColumns, columnMeta]);
  const taskById = useMemo(() => {
    const map = new Map();
    Object.values(columns || {}).forEach((tasksInCol) => {
      (tasksInCol || []).forEach((task) => {
        if (task?.id) map.set(task.id, task);
      });
    });
    return map;
  }, [columns]);

  const listViewTasks = useMemo(() => {
    return (listViewRawTasks || [])
      .map((task) => normalizeListTask(task))
      .filter(Boolean);
  }, [listViewRawTasks, groupMembers]);
  const listViewAllTasks = useMemo(() => {
    return Object.entries(columns || {}).flatMap(([colId, tasksInCol]) =>
      (tasksInCol || [])
        .map((task) => normalizeListTask({ ...task, columnId: colId }))
        .filter(Boolean)
    );
  }, [columns, groupMembers]);
  const filterListViewTasks = useCallback((tasks) => {
    const normalizeStatusKey = (value = "") =>
      value.toString().toLowerCase().replace(/[\s_]+/g, "");
    const searchValue = (search || "").toLowerCase().trim();
    const statusFilterKey = normalizeStatusKey(listViewFilterStatus);
    const priorityFilter = (listViewFilterPriority || "").toLowerCase();
    return tasks.filter((task) => {
      const effectiveStatus = normalizeStatusKey(
        columnMeta?.[task.columnId]?.title || task.status || task.columnId || ""
      );
      const matchesSearch =
        !searchValue ||
        (task.title || "").toLowerCase().includes(searchValue) ||
        (task.description || "").toLowerCase().includes(searchValue);
      const matchesStatus =
        listViewFilterStatus === "All" ||
        effectiveStatus === statusFilterKey;
      const matchesPriority =
        listViewFilterPriority === "All" ||
        (task.priority || "").toLowerCase() === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [search, listViewFilterStatus, listViewFilterPriority, columnMeta]);
  const listViewFilteredTasks = useMemo(() => {
    return filterListViewTasks(listViewTasks);
  }, [listViewTasks, filterListViewTasks]);
  const listViewFallbackFiltered = useMemo(() => {
    return filterListViewTasks(listViewAllTasks);
  }, [listViewAllTasks, filterListViewTasks]);
  const listViewTotalForPager = useMemo(() => {
    return listViewIsServerPaged
      ? listViewTotal
      : listViewFilteredTasks.length;
  }, [listViewIsServerPaged, listViewTotal, listViewFilteredTasks]);
  const listViewPagedTasks = useMemo(() => {
    if (listViewIsServerPaged) {
      if (listViewFilteredTasks.length <= listViewPageSize) {
        return listViewFilteredTasks;
      }
      return listViewFilteredTasks.slice(0, listViewPageSize);
    }
    const start = Math.max(0, (listViewPage - 1) * listViewPageSize);
    const end = start + listViewPageSize;
    return listViewFilteredTasks.slice(start, end);
  }, [
    listViewIsServerPaged,
    listViewFilteredTasks,
    listViewPage,
    listViewPageSize,
  ]);
  const statusOptions = useMemo(() => {
    const map = new Map();
    const addStatus = (raw) => {
      if (!raw) return;
      const key = normalizeTitle(raw);
      const canonical = key === "to_do" ? "todo" : key;
      if (!canonical) return;
      if (!map.has(canonical)) {
        map.set(canonical, canonical);
      }
    };
    Object.entries(columnMeta || {}).forEach(([colId, meta]) => {
      addStatus(meta?.title || colId);
    });
    Object.values(columns || {}).forEach((list) => {
      (list || []).forEach((task) => addStatus(task.status));
    });
    return Array.from(map.values());
  }, [columns, columnMeta]);
  const priorityOptions = useMemo(() => {
    const set = new Set();
    Object.values(columns || {}).forEach((list) => {
      (list || []).forEach((task) => {
        if (task.priority) set.add(task.priority.toLowerCase());
      });
    });
    return Array.from(set);
  }, [columns]);
  const recentActivity = useMemo(() => {
    const items = Object.values(filteredColumns || {}).flat();
    return items
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0) -
          new Date(a.updatedAt || a.createdAt || 0)
      )
      .slice(0, 4);
  }, [filteredColumns]);
  useEffect(() => {
    setListViewPage(1);
  }, [listViewFilterStatus, listViewFilterPriority, listViewPageSize, resolvedGroupId]);
  useEffect(() => {
    if (boardView !== "list" || !resolvedGroupId) return;
    const fetchListViewTasks = async () => {
      setListViewLoading(true);
      setListViewError("");
      try {
        const params = {
          page: listViewPage,
          pageSize: listViewPageSize,
        };
        const apiStatus = toApiStatusFilter(listViewFilterStatus);
        if (apiStatus) params.status = apiStatus;
        const res = await BoardService.getBoard(resolvedGroupId, params);
        const { items, total } = parseListResponse(res);
        const fallbackTotal = listViewFallbackFiltered.length;
        const totalNumber = Number.isFinite(Number(total)) ? Number(total) : 0;
        const resolvedTotal =
          totalNumber > items.length
            ? totalNumber
            : Math.max(items.length, fallbackTotal);
        setListViewRawTasks(items);
        setListViewTotal(resolvedTotal);
        setListViewIsServerPaged(resolvedTotal > items.length);
      } catch (err) {
        setListViewError(
          t("failedLoadTasks") || "Failed to load tasks."
        );
        setListViewRawTasks([]);
        setListViewTotal(0);
        setListViewIsServerPaged(false);
      } finally {
        setListViewLoading(false);
      }
    };
    fetchListViewTasks();
  }, [
    boardView,
    resolvedGroupId,
    listViewPage,
    listViewPageSize,
    listViewFilterStatus,
    listViewFallbackFiltered.length,
  ]);
  const firstColumnId = useMemo(
    () => sortedColumns?.[0]?.[0] || Object.keys(columnMeta || {})[0] || null,
    [sortedColumns, columnMeta]
  );

  // Fallback: if groupId missing, pick the first of my groups
  useEffect(() => {
    if (resolvedGroupId) {
      localStorage.setItem("last_group_id", resolvedGroupId);
      return;
    }
    const fetchDefaultGroup = async () => {
      try {
        const res = await GroupService.getMyGroups();
        const list = res?.data || [];
        if (list.length > 0) {
          const fallback = list[0].id || list[0]._id || "";
          setResolvedGroupId(fallback);
          localStorage.setItem("last_group_id", fallback);
        }
      } catch (err) {

      }
    };
    fetchDefaultGroup();
  }, [resolvedGroupId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-500">Loading board...</span>
      </div>
    );
  }

  if (error || !filteredColumns) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-red-500">{error || "Something went wrong"}</span>
      </div>
    );
  }

  const hasData = filteredColumns && Object.keys(filteredColumns).length > 0;
  const mentor =
    groupMembers?.find(
      (member) =>
        (member.role || "").toLowerCase().includes("mentor") ||
        (member.position || "").toLowerCase().includes("mentor")
    ) || null;
  const fallbackFiles = [
    { name: "Project brief.pdf", owner: "Team", size: "1.2 MB" },
    { name: "Requirements.docx", owner: "Leader", size: "650 KB" },
    { name: "Architecture.drawio", owner: "Team", size: "430 KB" },
  ];
  const handleOpenListTask = (task) => {
    if (!task) return;
    const fullTask = taskById.get(task.id);
    setSelectedTask(fullTask || task);
  };

  return (
    <div className="relative">
      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-between pt-28 xl:pt-20 pb-20 bg-[#f7f9fb]">
        <div className="w-full max-w-7xl px-6">
          {/* Tabs */}
          <div className="inline-flex gap-0 bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
            {["overview", "workspace", "files"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 text-sm font-semibold capitalize transition border-r last:border-r-0 ${
                  activeTab === tab
                    ? "bg-blue-600 text-white shadow-sm border-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Overview */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Description
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Align the team on goals, milestones, and deliverables. Use
                    this space to document the project scope, acceptance
                    criteria, and communication rules so every member knows what
                    success looks like.
                  </p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Recent Activity
                    </h3>
                    <span className="text-sm text-gray-400">
                      {recentActivity.length}{" "}
                      {recentActivity.length === 1 ? "update" : "updates"}
                    </span>
                  </div>
                  {recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {recentActivity.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between bg-gray-50 border border-gray-100 px-4 py-3 rounded-xl"
                        >
                          <div>
                            <p className="font-medium text-gray-800">
                              {task.title || "Untitled task"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {task.status || "updated"} -{" "}
                              {new Date(
                                task.updatedAt || task.createdAt || Date.now()
                              ).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                            {task.priority || "medium"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      No activity yet. Start by creating a task.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Team Members
                    </h3>
                    <span className="text-sm text-gray-400">
                      {groupMembers?.length || 0}{" "}
                      {groupMembers?.length === 1 ? "person" : "people"}
                    </span>
                  </div>
                  {groupMembers?.length ? (
                    <div className="space-y-3">
                      {groupMembers.map((member) => (
                        <div
                          key={member.id || member._id || member.email}
                          className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 flex items-center justify-center font-semibold">
                            {(member.name || member.displayName || "U")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {member.name || member.displayName || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {member.role || "Member"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Invite teammates to collaborate on this workspace.
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Mentor
                  </h3>
                  {mentor ? (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-semibold">
                        {(mentor.name || mentor.displayName || "M")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {mentor.name || mentor.displayName}
                        </p>
                        <p className="text-sm text-gray-500">Assigned mentor</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      No mentor assigned. Add a mentor to keep guidance aligned.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Workspace (Kanban) */}
          {activeTab === "workspace" && (
            <>
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Workspace
                    </h3>
                    <p className="text-sm text-gray-500">
                      Switch between Kanban and List to manage busy boards.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 rounded-full p-1 text-sm font-medium">
                      <button
                        type="button"
                        className={`px-3 py-1 rounded-full transition ${
                          boardView === "kanban"
                            ? "bg-white shadow text-gray-900"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                        onClick={() => handleSwitchView("kanban")}
                      >
                        Kanban
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 rounded-full transition ${
                          boardView === "list"
                            ? "bg-white shadow text-gray-900"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                        onClick={() => handleSwitchView("list")}
                      >
                        List
                      </button>
                    </div>
                    {boardView === "kanban" ? (
                      <button
                        className="flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-50"
                        onClick={() => setIsColumnModalOpen(true)}
                      >
                        <Plus className="w-5 h-5" />
                        New Column
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                        onClick={handleQuickCreateTask}
                        disabled={!firstColumnId}
                      >
                        <Plus className="w-5 h-5" />
                        New Task
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Input
                      allowClear
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={
                        t("searchTasks") ||
                        "Search tasks by title or description..."
                      }
                      className="!w-72"
                    />
                  </div>
                  <select
                    value={listViewFilterStatus}
                    onChange={(e) => setListViewFilterStatus(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
                  >
                    <option value="All">
                      {t("allStatuses") || "All statuses"}
                    </option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {formatStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={listViewFilterPriority}
                    onChange={(e) => setListViewFilterPriority(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
                  >
                    <option value="All">
                      {t("allPriorities") || "All priorities"}
                    </option>
                    {priorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-sm text-blue-600 font-medium hover:underline"
                    onClick={handleResetFilters}
                  >
                    {t("reset") || "Reset"}
                  </button>
                  <div className="text-sm text-gray-500">
                    {boardView === "list"
                      ? listViewTotalForPager
                      : flattenedTasks.length}{" "}
                    tasks
                  </div>
                </div>
              </div>

              {boardView === "kanban" ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  {hasData ? (
                    <div className="mt-4 flex gap-6 overflow-x-auto pb-2">
                      {sortedColumns.map(([colId, meta]) => {
                        const normalizedTitleValue = normalizeTitle(
                          meta?.title || colId
                        );
                        const statusForColumn =
                          normalizedTitleValue === "to_do"
                            ? "todo"
                            : normalizedTitleValue;
                        return (
                          <Column
                            key={colId}
                            id={colId}
                            meta={meta}
                            tasks={filteredColumns[colId] || []}
                            columnMeta={columnMeta}
                            onOpen={setSelectedTask}
                            onCreate={(quickPayload) => {
                              createTask({
                                columnId: colId,
                                title: quickPayload?.title || "New Task",
                                description: "",
                                priority: "medium",
                                status: statusForColumn,
                                dueDate: null,
                              });
                            }}
                            onDelete={() => {
                              Modal.confirm({
                                title: "Delete Column",
                                content: `Delete column "${
                                  columnMeta[colId]?.title || colId
                                }"?`,
                                okText: "OK",
                                cancelText: "Cancel",
                                onOk: () => deleteColumn(colId),
                              });
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-10 text-gray-500">
                      No board data available.
                    </div>
                  )}
                </DndContext>
              ) : (
                <div className="space-y-4">
                  <Pagination
                    page={listViewPage}
                    setPage={setListViewPage}
                    pageSize={listViewPageSize}
                    setPageSize={setListViewPageSize}
                    total={listViewTotalForPager}
                    showPager={false}
                  />
                  {listViewLoading ? (
                    <div className="text-sm text-gray-500">
                      {t("loading") || "Loading..."}
                    </div>
                  ) : listViewError ? (
                    <div className="text-sm text-red-500">{listViewError}</div>
                  ) : (
                    <ListView
                      tasks={listViewPagedTasks}
                      columnMeta={columnMeta}
                      onOpenTask={handleOpenListTask}
                      onCreateTask={handleQuickCreateTask}
                      pageSize={listViewPageSize}
                      t={t}
                    />
                  )}
                  {!listViewLoading && !listViewError && (
                    <Pagination
                      page={listViewPage}
                      setPage={setListViewPage}
                      pageSize={listViewPageSize}
                      setPageSize={setListViewPageSize}
                      total={listViewTotalForPager}
                      showPageSize={false}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* Files */}
          {activeTab === "files" && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Team Files
                  </h3>
                  <p className="text-sm text-gray-500">
                    Quick access to shared documents and assets.
                  </p>
                </div>
                <button className="text-blue-600 text-sm font-medium hover:underline">
                  Upload
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {fallbackFiles.map((file) => (
                  <div
                    key={file.name}
                    className="border border-gray-100 rounded-xl p-4 bg-gray-50"
                  >
                    <p className="font-semibold text-gray-800">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {file.owner} - {file.size}
                    </p>
                    <button className="text-xs text-blue-600 mt-3 hover:underline">
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Modal */}
      <TaskModal
        task={selectedTask}
        groupId={resolvedGroupId}
        members={groupMembers}
        columnMeta={columnMeta}
        onFetchComments={loadTaskComments}
        onClose={() => setSelectedTask(null)}
        onAddComment={addTaskComment}
        onUpdateComment={updateTaskComment}
        onDeleteComment={deleteTaskComment}
        onUpdateTask={updateTaskFields}
        onUpdateAssignees={updateTaskAssignees}
        onDeleteTask={(taskId) => {
          deleteTask(taskId);
          setSelectedTask(null);
        }}
      />

      {/* New Column Modal */}
      <Modal
        title={t("newColumn") || "New Column"}
        open={isColumnModalOpen}
        onOk={handleCreateColumn}
        onCancel={() => {
          setIsColumnModalOpen(false);
          columnForm.resetFields();
        }}
        okText={t("create") || "Create"}
        cancelText={t("cancel") || "Cancel"}
        destroyOnClose
      >
        <Form form={columnForm} layout="vertical">
          <Form.Item
            name="columnName"
            label={t("columnName") || "Column Name"}
            rules={[
              {
                required: true,
                message:
                  t("pleaseEnterColumnName") || "Please enter column name",
              },
            ]}
          >
            <Input placeholder={t("enterColumnName") || "Enter column name"} />
          </Form.Item>
          <Form.Item
            name="position"
            label={t("position") || "Position"}
            initialValue={Object.keys(columnMeta || {}).length}
            rules={[
              {
                required: false,
                validator: (_, value) => {
                  if (value === undefined || value === null || value === "") {
                    return Promise.resolve();
                  }
                  const numValue = Number(value);
                  if (isNaN(numValue)) {
                    return Promise.reject(
                      new Error(t("positionMustBeNumber") || "Position must be a number")
                    );
                  }
                  if (numValue < 0) {
                    return Promise.reject(
                      new Error(t("positionMustBePositive") || "Position must be greater than or equal to 0")
                    );
                  }
                  if (numValue > 1000) {
                    return Promise.reject(
                      new Error(t("positionTooLarge") || "Position must be less than or equal to 1000")
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber
              min={0}
              max={1000}
              placeholder={String(Object.keys(columnMeta || {}).length)}
              className="w-full"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Workspace;

