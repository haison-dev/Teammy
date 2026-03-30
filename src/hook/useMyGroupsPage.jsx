import { useEffect, useMemo, useRef, useState } from "react";
import { notification, Modal } from "antd";
import { GroupService } from "../services/group.service";
import { MajorService } from "../services/major.service";
import { ReportService } from "../services/report.service";
import { useInvitationRealtime } from "./useInvitationRealtime";
import { useAuth } from "../context/AuthContext";
import { useDispatch, useSelector } from "react-redux";
import { updatePendingList } from "../app/invitationSlice";

import { normalizeGroup, mapPendingRequest } from "../utils/group.utils";

export const useMyGroupsPage = (t, navigate, userInfo) => {
  const dispatch = useDispatch();
  const { token } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("groups");

  const [pendingByGroup, setPendingByGroup] = useState({});
  const [pendingLoading, setPendingLoading] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [acceptingInvitationId, setAcceptingInvitationId] = useState(null);
  const [rejectingInvitationId, setRejectingInvitationId] = useState(null);

  const reduxApplications = useSelector(
    (state) => state.invitation?.applications || []
  );

  const { isConnected, joinGroupChannel, leaveGroupChannel } =
    useInvitationRealtime(token, userInfo?.userId || userInfo?.id, {
      onApplicationReceived: (payload) => {
        console.log("[MyGroups] Received PendingUpdated:", payload);

        dispatch(updatePendingList(payload));

        const count = payload.candidates?.length || 0;
        if (count > 0) {
          notification.success({
            message: t("newApplication") || "New Application",
            description: `You have ${count} new application${
              count > 1 ? "s" : ""
            }`,
            placement: "topRight",
            duration: 4,
          });
        }

        if (payload.groupId) {
          refreshPendingForGroup(payload.groupId);
        }
      },
    });

  useEffect(() => {
    if (activeTab === "applications" && isConnected) {
      const leaderGroups = groups.filter((g) => g.isLeader);

      // Join all leader groups
      leaderGroups.forEach((group) => {
        joinGroupChannel(group.id);
      });

      // Cleanup: leave all groups when switching tab or unmounting
      return () => {
        leaderGroups.forEach((group) => {
          leaveGroupChannel(group.id);
        });
      };
    }
  }, [activeTab, groups, isConnected]);

  // Sync Redux applications to local state
  useEffect(() => {
    if (reduxApplications.length > 0) {
      // Group applications by groupId
      const grouped = {};
      reduxApplications.forEach((app) => {
        if (!grouped[app.groupId]) {
          grouped[app.groupId] = [];
        }
        grouped[app.groupId].push(mapPendingRequest(app));
      });

      setPendingByGroup((prev) => ({
        ...prev,
        ...grouped,
      }));
    }
  }, [reduxApplications]);

  // Modal state
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    maxMembers: 5,
    majorId: "",
    topicId: "",
  });
  const [errors, setErrors] = useState({});
  const [majors, setMajors] = useState([]);
  const [majorsLoading, setMajorsLoading] = useState(false);
  const hasFetchedGroupsRef = useRef(false);
  const majorsFetchLock = useRef(false);

  const groupsById = useMemo(() => {
    const map = new Map();
    groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  const pendingTotal = useMemo(
    () =>
      Object.values(pendingByGroup).reduce(
        (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
        0
      ),
    [pendingByGroup]
  );

  const heroStats = useMemo(
    () => [
      {
        label: t("activeGroups") || "Active groups",
        value: groups.filter((g) => g.status !== "closed").length,
      },
      {
        label: t("pendingApplications") || "Pending applications",
        value: pendingTotal,
      },
    ],
    [groups, pendingTotal, t]
  );

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = t("groupName") || "Group name is required";

    // Remove majorId validation - no longer required
    // Remove maxMembers validation - let API handle validation

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetModal = () => {
    setForm({
      name: "",
      description: "",
      maxMembers: 5,
      majorId: "",
      topicId: "",
    });
    setErrors({});
    setSubmitting(false);
  };

  const closeModal = () => {
    setOpen(false);
    resetModal();
  };

  const requestCloseModal = () => {
    if (!submitting) closeModal();
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateGroup = async (e) => {
    e?.preventDefault();
    if (!validate()) return;
    try {
      setSubmitting(true);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        maxMembers: Number(form.maxMembers) || 1,
      };
      const res = await GroupService.createGroup(payload);
      if (res?.data) {
        notification.success({ message: t("success") || "Group created!" });
        closeModal();
        await fetchMyGroups();
      }
    } catch (error) {
      // Extract error message from API response
      // Handle both object response (error.response.data.message) and string response
      const errorMessage = 
        error?.response?.data?.message || 
        error?.response?.data?.error ||
        (typeof error?.response?.data === "string" ? error.response.data : "") ||
        error?.message || 
        t("error") || 
        "Failed to create group.";
      notification.info({
        message: errorMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewGroup = (groupId) => navigate(`/my-group/${groupId}`);

  const handleLeaveGroup = async (groupId) => {
    const group = groups.find((g) => g.id === groupId);
    const isActiveGroup = group && group.status === "active";

    Modal.confirm({
      title: t("confirmLeaveGroup") || "Leave Group",
      content: isActiveGroup
        ? t("leaveActiveGroupWarning") ||
          "This group is currently active. Leaving will remove you from all ongoing activities. Are you sure you want to leave?"
        : t("confirmLeaveGroupMessage") ||
          `Are you sure you want to leave this group?`,
      okText: t("leave") || "Leave",
      cancelText: t("cancel") || "Cancel",
      okButtonProps: { danger: true },
      onOk: async () => {
        // Check if group is active before attempting to leave
        if (isActiveGroup) {
          notification.info({
            message: t("cannotLeaveActiveGroup") || "Cannot leave active group",
            description:
              t("cannotLeaveActiveGroupDesc") ||
              "You cannot leave a group that is currently active. Please wait until the group status changes or contact your mentor.",
            duration: 5,
          });
          return;
        }

        try {
          await GroupService.leaveGroup(groupId);
          notification.success({
            message: t("leaveGroupSuccess") || "Successfully left the group",
          });
          await fetchMyGroups();
        } catch (error) {
          // Check if error is 409 Conflict (need to transfer leadership)
          if (error?.response?.status === 409) {
            notification.info({
              message: t("cannotLeaveAsLeader") || "Cannot leave as leader",
              description:
                t("transferLeadershipFirst") ||
                "You must transfer leadership to another member before leaving the group. Please assign a new leader first.",
              duration: 6,
            });
          } else {
            notification.info({
              message: t("error") || "Error",
              description:
                error?.response?.data?.message ||
                t("failedToLeaveGroup") ||
                "Failed to leave group.",
              duration: 4,
            });
          }
        }
      },
    });
  };

  const handleApprove = async (groupId, request) => {
    try {
      const payload = {
        type: request.type || "application",
        postId: request.postId || "",
      };
      await GroupService.acceptJoinRequest(groupId, request.id, payload);
      setPendingByGroup((prev) => {
        const clone = { ...prev };
        clone[groupId] = (clone[groupId] || []).filter(
          (item) => item.id !== request.id
        );
        return clone;
      });
      notification.success({
        message: t("approve") || "Approved",
      });
    } catch (error) {
          notification.info({
            message: t("approveFailed") || "Approve failed",
          });
    }
  };

  const handleReject = async (groupId, request) => {
    try {
      const payload = {
        type: request.type || "application",
        postId: request.postId || "",
      };
      await GroupService.rejectJoinRequest(groupId, request.id, payload);
      setPendingByGroup((prev) => {
        const clone = { ...prev };
        clone[groupId] = (clone[groupId] || []).filter(
          (item) => item.id !== request.id
        );
        return clone;
      });
      notification.info({
        message: t("reject") || "Rejected",
      });
    } catch (error) {
      notification.info({
        message: t("rejectFailed") || "Reject failed",
      });
    }
  };

  // Accept / reject mentor invitations (type: mentor_invitation)
  const handleAcceptInvitation = async (invitation) => {
    if (!invitation?.groupId || !invitation?.id) return;
    if (acceptingInvitationId === invitation.id) return; // Prevent double click
    
    try {
      setAcceptingInvitationId(invitation.id);
      await GroupService.acceptJoinRequest(invitation.groupId, invitation.id, {
        type: "mentor_invitation",
      });
      setInvitations((prev) =>
        prev.filter((item) => item.id !== invitation.id)
      );
      notification.success({
        message: t("accept") || "Accepted",
      });
    } catch (error) {
      notification.info({
        message: t("approveFailed") || "Approve failed",
      });
    } finally {
      setAcceptingInvitationId(null);
    }
  };

  const handleDeclineInvitation = async (invitation) => {
    if (!invitation?.groupId || !invitation?.id) return;
    if (rejectingInvitationId === invitation.id) return; // Prevent double click
    
    try {
      setRejectingInvitationId(invitation.id);
      await GroupService.rejectJoinRequest(invitation.groupId, invitation.id, {
        type: "mentor_invitation",
      });
      setInvitations((prev) =>
        prev.filter((item) => item.id !== invitation.id)
      );
      notification.info({
        message: t("reject") || "Rejected",
      });
    } catch (error) {
      notification.info({
        message: t("rejectFailed") || "Reject failed",
      });
    } finally {
      setRejectingInvitationId(null);
    }
  };

  const fetchMajors = async () => {
    if (majors.length > 0) return;
    setMajorsLoading(true);
    try {
      const res = await MajorService.getMajors();
      const data = Array.isArray(res?.data) ? res.data : [];
      setMajors(data);
    } catch (error) {
      notification.info({
        message: t("error") || "Failed to load majors.",
      });
    } finally {
      setMajorsLoading(false);
    }
  };

  const loadPendingApplications = async (dataset) => {
    const leaderGroups = dataset.filter((g) => g.isLeader);
    setPendingLoading(true);
    setInvitationsLoading(true);
    try {
      const entries = await Promise.all(
        leaderGroups.map(async (group) => {
          try {
            const res = await GroupService.getJoinRequests(group.id);
            const payload = res?.data;
            let list = [];
            if (Array.isArray(payload)) {
              list = payload;
            } else if (Array.isArray(payload?.data)) {
              list = payload.data;
            } else if (Array.isArray(payload?.items)) {
              list = payload.items;
            } else if (Array.isArray(res?.items)) {
              list = res.items;
            }
            return [group.id, list];
          } catch (error) {
            return [group.id, []];
          }
        })
      );

      // Separate applications and invitations
      const applicationsByGroup = {};
      let allInvitations = [];

      entries.forEach(([groupId, list]) => {
        const applications = list.filter(
          (item) => item.type === "application" || !item.type
        );
        const invitations = list
          .filter(
            (item) =>
              item.type === "invitation" || item.type === "mentor_invitation"
          )
          .map((inv) => ({
            ...inv,
            groupId,
          }));

        // Group applications by groupId
        if (applications.length > 0) {
          applicationsByGroup[groupId] = applications.map(mapPendingRequest);
        }

        // Collect all invitations (keep original structure + groupId)
        allInvitations = allInvitations.concat(invitations);
      });

      setPendingByGroup(applicationsByGroup);
      setInvitations(allInvitations);
    } catch (error) {
      setPendingByGroup({});
      setInvitations([]);
    } finally {
      setPendingLoading(false);
      setInvitationsLoading(false);
    }
  };

  // Refresh pending applications for a specific group
  const refreshPendingForGroup = async (groupId) => {
    try {
      const res = await GroupService.getJoinRequests(groupId);
      const list = Array.isArray(res?.data) ? res.data : [];

      const applications = list.filter(
        (item) => item.type === "application" || !item.type
      );

      setPendingByGroup((prev) => ({
        ...prev,
        [groupId]: applications.map(mapPendingRequest),
      }));
    } catch (error) {
      console.error("Failed to refresh pending for group:", groupId, error);
    }
  };

  const fetchMyGroups = async () => {
    try {
      setLoading(true);
      const res = await GroupService.getMyGroups();
      const arr = Array.isArray(res?.data) ? res.data : [];
      const normalized = arr.map((g, idx) => normalizeGroup(g, idx));

      // Load completion percent from tracking reports API for each group
      const groupsWithProgress = await Promise.all(
        normalized.map(async (group) => {
          try {
            const reportRes = await ReportService.getProjectReport(group.id);
            const completionPercent =
              reportRes?.data?.project?.completionPercent ?? 0;
            return {
              ...group,
              progress: completionPercent,
            };
          } catch (error) {
            return group; // Return group with original progress if report fetch fails
          }
        })
      );

      setGroups(groupsWithProgress);
      await loadPendingApplications(groupsWithProgress);
    } catch (error) {
      setGroups([]);
      setPendingByGroup({});
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetchedGroupsRef.current) return;
    hasFetchedGroupsRef.current = true;
    fetchMyGroups();
  }, []);

  useEffect(() => {
    if (!open) {
      majorsFetchLock.current = false;
      return;
    }
    if (majorsFetchLock.current) return;
    majorsFetchLock.current = true;
    fetchMajors();
  }, [open]);

  const activeApplications = Object.entries(pendingByGroup).filter(
    ([, list]) => Array.isArray(list) && list.length > 0
  );

  return {
    // state
    groups,
    loading,
    heroStats,
    activeTab,
    setActiveTab,
    open,
    submitting,
    form,
    errors,
    pendingByGroup,
    pendingLoading,
    pendingTotal,
    groupsById,
    activeApplications,
    invitations,
    invitationsLoading,
    majors,
    majorsLoading,

    // handlers
    setOpen,
    handleFormChange,
    handleCreateGroup,
    requestCloseModal,
    handleViewGroup,
    handleLeaveGroup,
    handleApprove,
    handleReject,

    handleAcceptInvitation,
    handleDeclineInvitation,
    acceptingInvitationId,
    rejectingInvitationId,
  };
};

