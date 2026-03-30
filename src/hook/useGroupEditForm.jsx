import { useEffect, useState } from "react";
import { notification } from "antd";
import { SkillService } from "../services/skill.service";
import { GroupService } from "../services/group.service";
import { normalizeSkills } from "../utils/group.utils";


export const useGroupEditForm = ({ group, groupMembers, userInfo, t, setGroup }) => {
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    maxMembers: 5,
    majorId: "",
    topicId: "",
    skills: [],
  });
  const [editErrors, setEditErrors] = useState({});
  const [availableSkills, setAvailableSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(false);

  const validateEditForm = () => {
    const errors = {};
    if (!editForm.name.trim()) {
      errors.name = t("groupName") || "Group name is required";
    }
    // Remove maxMembers validation - let API handle validation
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    if (!group) return;
    setEditForm({
      name: group.title || "",
      description: group.description || "",
      maxMembers: group.maxMembers || (groupMembers?.length ?? 0) || 5,
      majorId: group.majorId || "",
      topicId: group.topicId || "",
      skills: normalizeSkills(group.skills),
    });
  }, [group, groupMembers?.length]);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        setSkillsLoading(true);
        const majorName = userInfo?.majorName || group?.field;

        const params = { pageSize: 100 };
        if (majorName) {
          params.major = majorName;
        }

        const response = await SkillService.list(params);
        const skillsList = Array.isArray(response?.data) ? response.data : [];
        setAvailableSkills(skillsList);
      } catch {
        setAvailableSkills([]);
      } finally {
        setSkillsLoading(false);
      }
    };

    if (editOpen && group) fetchSkills();
  }, [editOpen, group, groupMembers?.length, userInfo?.majorName]);

  const handleEditChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitEdit = async (e) => {
    e?.preventDefault();
    if (!group || !validateEditForm()) return;

    try {
      setEditSubmitting(true);

      const payload = {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        maxMembers: Number(editForm.maxMembers),
      };

      if (editForm.majorId.trim()) payload.majorId = editForm.majorId.trim();
      if (editForm.topicId.trim()) payload.topicId = editForm.topicId.trim();

      if (editForm.skills && editForm.skills.length > 0) {
        payload.skills = editForm.skills;
      }

      await GroupService.updateGroup(group.id, payload);

      notification.success({
        message: t("updateSuccess") || "Group updated successfully.",
      });

      setGroup((prev) =>
        prev
          ? {
              ...prev,
              title: payload.name,
              description: payload.description,
              maxMembers: payload.maxMembers,
              majorId: payload.majorId ?? prev.majorId,
              topicId: payload.topicId ?? prev.topicId,
              skills: payload.skills ?? prev.skills,
            }
          : prev
      );

      setEditOpen(false);
    } catch (error) {
      // Extract error message from API response
      // Handle both object response (error.response.data.message) and string response
      const errorMessage = 
        error?.response?.data?.message || 
        error?.response?.data?.error ||
        (typeof error?.response?.data === "string" ? error.response.data : "") ||
        error?.message || 
        t("error") || 
        "Failed to update group.";
      notification.info({
        message: errorMessage,
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  return {
    editOpen,
    setEditOpen,
    editForm,
    editErrors,
    editSubmitting,
    availableSkills,
    skillsLoading,
    handleEditChange,
    handleSubmitEdit,
  };
};



