import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, notification } from "antd";
import { GroupService } from "../services/group.service";
import { BoardService } from "../services/board.service";
import { SkillService } from "../services/skill.service";
import { ReportService } from "../services/report.service";
import {
  formatSemester,
  normalizeMemberDetailList,
  normalizeSkills,
} from "../utils/group.utils";


export const useGroupDetail = ({ groupId, t, userInfo }) => {
  const [group, setGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupSkillsWithRole, setGroupSkillsWithRole] = useState([]);
  const [groupFiles, setGroupFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadedGroupIdRef = useRef(null);

  const fetchCompletionPercent = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await ReportService.getProjectReport(groupId);
      const completionPercent = res?.data?.project?.completionPercent ?? 0;
      setGroup((prev) =>
        prev ? { ...prev, progress: completionPercent } : prev
      );
    } catch {
      notification.info({
        message: t("error") || "Error",
        description:
          t("failedToFetchProgress") || "Failed to fetch project progress.",
      });
    }
  }, [groupId, t]);

  const fetchGroupDetail = useCallback(async (options = {}) => {
    if (!groupId) return;
    const shouldSkip = loadedGroupIdRef.current === groupId && !options.force;
    if (shouldSkip) return;

    loadedGroupIdRef.current = groupId;

    try {
      setLoading(true);

      const [detailRes, membersRes, reportRes] = await Promise.allSettled([
        GroupService.getGroupDetail(groupId),
        GroupService.getListMembers(groupId),
        ReportService.getProjectReport(groupId),
      ]);

      const d = detailRes.status === "fulfilled" ? detailRes.value.data : {};

      const semesterInfo = d.semester || {};
      const rawStartDate = semesterInfo.startDate || d.startDate;
      const rawEndDate = semesterInfo.endDate || d.endDate;
      const semesterLabel = formatSemester(semesterInfo);

      const members =
        membersRes.status === "fulfilled" &&
        Array.isArray(membersRes.value?.data)
          ? membersRes.value.data
          : [];

      const normalizedMembers = normalizeMemberDetailList(
        members,
        userInfo || {}
      );

      const currentEmail = (userInfo?.email || "").toLowerCase();
      const detailRole = (d.role || "").toLowerCase();
      const leaderFromMembers = normalizedMembers.some(
        (member) =>
          (member.email || "").toLowerCase() === currentEmail &&
          (member.role || "").toLowerCase() === "leader"
      );

      const completionPercent =
        reportRes.status === "fulfilled"
          ? reportRes.value?.data?.project?.completionPercent ?? 0
          : 0;

      setGroup({
        id: d.id || groupId,
        title: d.name || "",
        field:
          d.field ||
          d.major?.name ||
          d.major?.majorName ||
          (typeof d.major === "string" ? d.major : "") ||
          "",
        description: d.description || "",
        start: rawStartDate ? rawStartDate.slice(0, 10) : "",
        end: rawEndDate ? rawEndDate.slice(0, 10) : "",
        semester: semesterLabel,
        progress: completionPercent,
        mentor: Array.isArray(d.mentors) && d.mentors.length > 0 
          ? d.mentors[0] 
          : null,
        mentors: Array.isArray(d.mentors) ? d.mentors : [],
        status: d.status || "",
        statusText: d.status || "",
        maxMembers: Number(d.maxMembers || d.capacity || 5),
        majorId:
          d.majorId || d.major?.id || d.major?.majorId || d.majorID || "",
        topicId: d.topicId || d.topic?.topicId || d.topic?.id || "",
        topicName: d.topicName || d.topic?.title || d.topic?.name || "",
        skills: normalizeSkills(d.skills),
        canEdit: detailRole === "leader" || leaderFromMembers,
      });

      setGroupMembers(normalizedMembers);

      const groupSkillTokens = normalizeSkills(d.skills);
      if (groupSkillTokens.length > 0) {
        try {
          const skillsResponse = await SkillService.list({});
          const allSkills = Array.isArray(skillsResponse?.data)
            ? skillsResponse.data
            : [];
          const matchedSkills = allSkills.filter((s) =>
            groupSkillTokens.includes(s.token)
          );
          setGroupSkillsWithRole(matchedSkills);
        } catch {
          setGroupSkillsWithRole([]);
        }
      } else {
        setGroupSkillsWithRole([]);
      }
    } catch {
      notification.info({
        message: t("error") || "Error",
        description:
          t("failedToLoadGroupData") || "Failed to load group data.",
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, t, userInfo]);

  useEffect(() => {
    fetchGroupDetail();
  }, [fetchGroupDetail]);

  const loadGroupFiles = useCallback(async () => {
    if (!groupId) return;
    try {
      const res = await BoardService.getGroupFiles(groupId);
      const list = Array.isArray(res?.data) ? res.data : res?.items || [];
      setGroupFiles(list);
    } catch {
      notification.info({
        message: t("error") || "Error",
        description:
          t("failedToLoadGroupFiles") || "Failed to load group files.",
      });
      setGroupFiles([]);
    }
  }, [groupId, t]);

  const handleKickMember = useCallback(
    async (memberId, memberName) => {
      if (!groupId || !memberId) return;

      return new Promise((resolve) => {
        Modal.confirm({
          title: t("confirmKickMember") || "Remove Member",
          content: `Are you sure you want to remove ${memberName} from the group?`,
          okText: t("remove") || "Remove",
          cancelText: t("cancel") || "Cancel",
          okButtonProps: {
            danger: true,
            className: "bg-red-600 hover:bg-red-700",
          },
          cancelButtonProps: {
            className: "border-gray-300 text-gray-700 hover:bg-gray-50",
          },
          icon: null,
          width: 480,
          onOk: async () => {
            try {
              await GroupService.kickMember(groupId, memberId);

              notification.success({
                message: t("success") || "Success",
                description:
                  t("memberRemovedSuccessfully") || "Member removed successfully.",
              });

              const membersRes = await GroupService.getListMembers(groupId);
              const members = Array.isArray(membersRes?.data)
                ? membersRes.data
                : [];
              setGroupMembers(
                normalizeMemberDetailList(members, userInfo || {})
              );

              resolve(true);
            } catch (error) {
              notification.info({
                message: t("error") || "Error",
                description:
                  error?.response?.data?.message ||
                  error?.message ||
                  t("failedToRemoveMember") ||
                  "Failed to remove member.",
              });
              resolve(false);
            }
          },
          onCancel: () => {
            resolve(false);
          },
        });
      });
    },
    [groupId, t, userInfo]
  );


  const handleTransferLeader = useCallback(
    (member) => {
      if (!groupId || !member) return;

      const memberId =
        member.id ||
        member.userId ||
        member.userID ||
        member.memberId ||
        member.accountId;
      const memberName = member.name || member.displayName || member.email;

      Modal.confirm({
        title: t("confirmChangeLeader") || "Change Leader",
        content: `${t("confirmChangeLeaderMessage") ||
          "Are you sure you want to transfer leadership to"} ${memberName}?`,
        okText: t("confirm") || "Confirm",
        cancelText: t("cancel") || "Cancel",
        okButtonProps: { type: "primary" },
        onOk: async () => {
          try {
            await GroupService.transferLeader(groupId, memberId);
            notification.success({
              message:
                t("leadershipTransferred") || "Leadership transferred",
              description: `${memberName} ${t("isNowTheLeader") ||
                "is now the leader"}`,
            });

            try {
              await fetchGroupDetail({ force: true });
            } catch (fetchError) {
              // eslint-disable-next-line no-console
              console.error(
                "Failed to refresh group details:",
                fetchError
              );
            }
          } catch (error) {
            notification.info({
              message:
                t("failedToTransferLeader") ||
                "Failed to transfer leadership",
              description:
                error?.response?.data?.message ||
                error?.message ||
                t("pleaseTryAgain") ||
                "Please try again.",
            });
          }
        },
      });
    },
    [groupId, t, fetchGroupDetail]
  );

  return {
    group,
    setGroup,
    groupMembers,
    setGroupMembers,
    groupSkillsWithRole,
    groupFiles,
    loading,
    loadGroupFiles,
    fetchCompletionPercent,
    handleKickMember,
    handleTransferLeader,
    fetchGroupDetail,
  };
};



