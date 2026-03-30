// src/components/common/kanban/Column.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { MoreVertical, Plus, ChevronLeft, ChevronRight, X } from "lucide-react";
import TaskCard from "./TaskCard";
import { useTranslation } from "../../../hook/useTranslation";
import { initials } from "../../../utils/kanbanHelpers";
import { Modal, Input, notification } from "antd";

const getAssigneeId = (assignee) => {
  if (!assignee) return "";
  if (typeof assignee === "string") return assignee;
  return assignee.id || assignee.userId || assignee.memberId || assignee.email || "";
};

const getAssigneeLabel = (assignee) => {
  if (!assignee) return "";
  if (typeof assignee === "string") return assignee;
  return assignee.name || assignee.displayName || assignee.fullName || assignee.email || assignee.id || "";
};

const renderMemberAvatar = (member, size = "w-6 h-6") => {
  const label = member?.name || member?.displayName || member?.fullName || member?.email || "U";
  if (member?.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt={label}
        className={`${size} rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-semibold`}
    >
      {initials(label || "U") || "U"}
    </div>
  );
};

const Column = ({
  id,
  meta,
  tasks,
  onOpen,
  onCreate,
  onDelete,
  onDeleteTask,
  onMoveColumnLeft,
  onMoveColumnRight,
  columnMeta = {},
  groupMembers = [],
}) => {
  const { t } = useTranslation();
  const [showQuickTask, setShowQuickTask] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDueDate, setQuickDueDate] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const assigneeMenuRef = useRef(null);
  const { setNodeRef, isOver } = useDroppable({ id });
  const title = meta?.title || "Column";
  const dueLabel = meta?.dueDate
    ? new Date(meta.dueDate).toLocaleDateString()
    : null;

  // Tính toán màu sắc cho cột dựa trên position
  const columnColor = useMemo(() => {
    const sortedColumns = Object.entries(columnMeta || {})
      .map(([colId, colMeta]) => ({
        id: colId,
        position: colMeta?.position ?? 0,
      }))
      .sort((a, b) => a.position - b.position);
    
    const currentIndex = sortedColumns.findIndex((col) => col.id === id);
    const totalColumns = sortedColumns.length;
    
    // Màu sắc khác nhau cho mỗi cột
    if (currentIndex === 0) {
      return {
        bg: "bg-gray-50",
        border: "border-gray-200",
        hoverBg: "bg-gray-100",
      };
    } else if (currentIndex === 1) {
      return {
        bg: "bg-blue-50",
        border: "border-blue-200",
        hoverBg: "bg-blue-100",
      };
    } else if (currentIndex === 2) {
      return {
        bg: "bg-indigo-50",
        border: "border-indigo-200",
        hoverBg: "bg-indigo-100",
      };
    } else if (meta?.isDone) {
      return {
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        hoverBg: "bg-emerald-100",
      };
    } else {
      // Màu mặc định cho các cột khác
      return {
        bg: "bg-purple-50",
        border: "border-purple-200",
        hoverBg: "bg-purple-100",
      };
    }
  }, [id, columnMeta, meta?.isDone]);

  // Kiểm tra xem có thể move left/right không
  const canMoveLeft = useMemo(() => {
    const sortedColumns = Object.entries(columnMeta || {})
      .map(([colId, colMeta]) => ({
        id: colId,
        position: colMeta?.position ?? 0,
      }))
      .sort((a, b) => a.position - b.position);
    const currentIndex = sortedColumns.findIndex((col) => col.id === id);
    return currentIndex > 0;
  }, [id, columnMeta]);

  const canMoveRight = useMemo(() => {
    const sortedColumns = Object.entries(columnMeta || {})
      .map(([colId, colMeta]) => ({
        id: colId,
        position: colMeta?.position ?? 0,
      }))
      .sort((a, b) => a.position - b.position);
    const currentIndex = sortedColumns.findIndex((col) => col.id === id);
    return currentIndex >= 0 && currentIndex < sortedColumns.length - 1;
  }, [id, columnMeta]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
      if (assigneeMenuRef.current && !assigneeMenuRef.current.contains(event.target)) {
        setAssigneeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div
      ref={setNodeRef}
      className={`w-76 md:w-[23.2rem] min-h-[560px] rounded-2xl p-4 border-2 transition
      ${isOver ? `${columnColor.hoverBg} ${columnColor.border}` : `${columnColor.bg} ${columnColor.border}`}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col flex-1">
          <h3 className="font-bold text-gray-800">{title}</h3>
          {dueLabel && (
            <span className="text-xs text-gray-500">Due: {dueLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-1" ref={menuRef}>
          {/* Move Left Button */}
          {onMoveColumnLeft && (
            <button
              type="button"
              onClick={() => onMoveColumnLeft(id, meta)}
              disabled={!canMoveLeft}
              className="p-1 rounded-md hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move column left"
              title="Move left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {/* Move Right Button */}
          {onMoveColumnRight && (
            <button
              type="button"
              onClick={() => onMoveColumnRight(id, meta)}
              disabled={!canMoveRight}
              className="p-1 rounded-md hover:bg-gray-200 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Move column right"
              title="Move right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs text-gray-500 px-1">{tasks.length}</span>
          {/* Plus Button for Create Task */}
          {onCreate && (
            <button
              type="button"
              onClick={() => setShowQuickTask(true)}
              className="p-1 rounded-md hover:bg-gray-200 text-gray-700"
              aria-label="Create task"
              title={t("createTask") || "Create Task"}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded-md hover:bg-gray-200 text-gray-700"
              aria-label="Column actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  type="button"
                  onClick={() => {
                    let inputValue = "";
                    Modal.confirm({
                      title: t?.("deleteColumn") || "Delete Column",
                      content: (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            {t?.("typeDeleteToConfirm") || "Type 'delete' to confirm."}
                          </p>
                          <Input
                            onChange={(e) => {
                              inputValue = e.target.value;
                            }}
                            placeholder="delete"
                          />
                        </div>
                      ),
                      okText: t?.("delete") || "Delete",
                      okButtonProps: { danger: true },
                      cancelText: t?.("cancel") || "Cancel",
                      onOk: () => {
                        if (inputValue.toLowerCase() !== "delete") {
                          notification.info({
                            message: t?.("validationError") || "Validation Error",
                            description: t?.("mustTypeDelete") || "You must type 'delete' to confirm.",
                          });
                          return Promise.reject();
                        }
                        if (onDelete) onDelete();
                        setMenuOpen(false);
                        return Promise.resolve();
                      },
                    });
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  {t?.("deleteColumn") || "Delete Column"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Task Form - ở đầu cột */}
      {onCreate && showQuickTask && (
        <div className="mb-3">
          <div className="border border-gray-300 rounded-lg p-3 space-y-3 bg-white shadow-sm">
            <input
              autoFocus
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder={t("whatNeedsToBeDone") || "What needs to be done?"}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
            
            {/* Due Date Input */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 whitespace-nowrap">
                {t("dueDate") || "Due Date"}:
              </label>
              <input
                type="date"
                value={quickDueDate}
                onChange={(e) => setQuickDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {/* Assignees Dropdown */}
            <div className="relative" ref={assigneeMenuRef}>
              <label className="text-xs text-gray-600 mb-1 block">
                {t("assignees") || "Assignees"}:
              </label>
              <button
                type="button"
                onClick={() => setAssigneeMenuOpen((v) => !v)}
                className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-2 py-1.5 text-sm hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <div className="flex items-center gap-2 flex-1 overflow-hidden">
                  {selectedAssignees.length === 0 ? (
                    <span className="text-gray-500">{t("selectAssignees") || "Select assignees"}</span>
                  ) : (
                    <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                      {selectedAssignees.slice(0, 3).map((assignee) => (
                        <div key={getAssigneeId(assignee)} className="flex-shrink-0">
                          {renderMemberAvatar(assignee, "w-5 h-5")}
                        </div>
                      ))}
                      {selectedAssignees.length > 3 && (
                        <span className="text-xs text-gray-600">+{selectedAssignees.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-gray-500 text-xs ml-2">▼</span>
              </button>
              {assigneeMenuOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {groupMembers.map((member) => {
                    const memberId = getAssigneeId(member);
                    const isSelected = selectedAssignees.some(a => getAssigneeId(a) === memberId);
                    return (
                      <button
                        key={memberId}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedAssignees(prev => prev.filter(a => getAssigneeId(a) !== memberId));
                          } else {
                            setSelectedAssignees(prev => [...prev, member]);
                          }
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                          isSelected ? "bg-blue-50" : ""
                        }`}
                      >
                        {renderMemberAvatar(member, "w-6 h-6")}
                        <span className="text-gray-900">{getAssigneeLabel(member)}</span>
                        {isSelected && (
                          <span className="ml-auto text-blue-600">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="flex-1 bg-blue-600 text-white text-sm py-1.5 rounded-lg hover:bg-blue-700 transition"
                onClick={() => {
                  if (!quickTitle.trim()) return;
                  onCreate({
                    title: quickTitle.trim(),
                    priority: "medium",
                    dueDate: quickDueDate || null,
                    assignees: selectedAssignees.map(a => getAssigneeId(a)),
                  });
                  setQuickTitle("");
                  setQuickDueDate("");
                  setSelectedAssignees([]);
                  setShowQuickTask(false);
                }}
              >
                {t("add") || "Add"}
              </button>
              <button
                className="flex-1 border border-gray-300 text-gray-600 text-sm py-1.5 rounded-lg hover:bg-gray-50 transition"
                onClick={() => {
                  setShowQuickTask(false);
                  setQuickTitle("");
                  setQuickDueDate("");
                  setSelectedAssignees([]);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={onOpen}
              onDelete={onDeleteTask}
              columnMeta={columnMeta}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};

export default Column;

