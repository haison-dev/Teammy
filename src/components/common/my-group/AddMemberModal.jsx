import React, { useState, useEffect, useRef } from "react";
import { X, Mail, Search, Plus, UserRound } from "lucide-react";
import { UserService } from "../../../services/user.service";
import { GroupService } from "../../../services/group.service";
import { useParams } from "react-router-dom";
import { notification } from "antd";

export default function AddMemberModal({ open, onClose, onAdd, t }) {
  const { id: groupId } = useParams();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const searchSeqRef = useRef(0);
  const suppressNextSearchRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setSelected(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }
    const value = query.trim();
    if (!value) {
      setResults([]);
      setLoading(false);
      return;
    }

    const seq = ++searchSeqRef.current;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await UserService.list({ email: value });
        if (seq !== searchSeqRef.current) return;
        const data = Array.isArray(res.data) ? res.data : [];

        // Filter out users who already have a group in this semester
        const filteredData = data.filter((u) => u.hasGroupInSemester !== true);

        setResults(
          filteredData.map((u) => ({
            userId: u.userId,
            name: u.displayName,
            email: u.email,
            photoURL: u.avatarUrl,
          }))
        );
      } catch {
        if (seq !== searchSeqRef.current) return;
        setResults([]);
      } finally {
        if (seq === searchSeqRef.current) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, open]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setSelected(null);
  };

  const handleSelect = (user) => {
    suppressNextSearchRef.current = true;
    setSelected(user);
    setQuery(user.email);
    setResults([]);
  };

  const handleAddClick = async () => {
    if (!selected) {
      notification.info({
        message: t("pleaseSelectUser") || "Please select a user first",
      });
      return;
    }
    if (!groupId) {
      notification.info({
        message: t("missingGroupId") || "Missing group id",
      });
      return;
    }

    try {
      setLoading(true);
      await GroupService.inviteMember(groupId, {
        userId: selected.userId,
      });
      if (typeof onAdd === "function") onAdd(selected);
      notification.success({
        message: t("inviteSent") || "Invitation sent",
      });
      onClose();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.response?.data ||
        err.message ||
        t("inviteFailed") ||
        "Failed to send invitation";

      notification.info({
        message:
          typeof errorMessage === "string"
            ? errorMessage
            : t("inviteFailed") || "Failed to send invitation",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="!fixed !inset-0 !bg-black/40 !backdrop-blur-sm !flex !items-center !justify-center !z-50">
      <div className="!bg-white !border !border-gray-200 !shadow-xl !rounded-2xl !p-8 !w-[90%] !max-w-md !relative">
        <button
          onClick={onClose}
          className="!absolute !top-4 !right-4 !text-gray-500 hover:!text-black"
        >
          <X className="!w-5 !h-5" />
        </button>

        <h2 className="!font-bold !text-lg !text-gray-800 !mb-4 !flex !items-center !gap-2">
          <Mail className="!w-4 !h-4 !text-gray-600" />
          {t("addMemberByEmail") || "Add member by email"}
        </h2>

        {/* Input Search */}
        <div className="relative mb-4">
          <div className="!flex !items-center !bg-gray-100 !rounded-lg !px-3 !py-2">
            <Search className="!w-4 !h-4 !text-gray-500 !mr-2" />
            <input
              type="text"
              value={query}
              onChange={handleSearchChange}
              placeholder={t("enterMemberEmail") || "Enter email"}
              className="!bg-transparent !outline-none !w-full !text-gray-700"
            />
          </div>

          {/* Autocomplete list */}
          {loading && (
            <p className="text-sm text-gray-500 mt-2 pl-2">{t("searching")}</p>
          )}
          {!loading && results.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-20">
              {results.map((u) => (
                <div
                  key={u.userId}
                  onClick={() => handleSelect(u)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 cursor-pointer"
                >
                  {u.photoURL ? (
                    <img
                      src={u.photoURL}
                      alt={u.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <UserRound className="w-4 h-4 text-gray-500" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-800">
                      {u.name}
                    </span>
                    <span className="text-xs text-gray-500">{u.email}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="!flex !justify-end !gap-3 mt-4">
          <button
            onClick={onClose}
            className="!px-5 !py-2 !rounded-lg border-gray-300 hover:!border-orange-400 hover:!text-orange-400 transition-all"
          >
            {t("cancel") || "Cancel"}
          </button>
          <button
            onClick={handleAddClick}
            disabled={loading || !selected}
            className="!flex !items-center !gap-2 !bg-[#FF7A00] hover:!opacity-90 !text-white !px-5 !py-2 !rounded-lg !font-semibold !transition"
          >
            <Plus className="!w-4 !h-4" /> {t("add") || "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

