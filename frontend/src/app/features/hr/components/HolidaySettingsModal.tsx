"use client";

import React, { useState, useEffect } from "react";
import { coreApiClient } from "../../../../lib/apiClient";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
  isAdmin?: boolean;
}

export default function HolidaySettingsModal({ isOpen, onClose, onUpdated, isAdmin }: Props) {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [paid, setPaid] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchHolidays();
    }
  }, [isOpen, year]);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const res: any = await coreApiClient.get("/hr/settings/holidays?year=" + year);
      setHolidays(res?.data || res || []);
    } catch (e) {
      console.error("Lỗi fetch holidays:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!date || !name) return;
    setLoading(true);
    try {
      await coreApiClient.post("/hr/settings/holidays", { date, name, paid });
      setDate("");
      setName("");
      fetchHolidays();
      onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Lỗi thêm ngày nghỉ lễ");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xoá ngày nghỉ lễ này?")) return;
    setLoading(true);
    try {
      await coreApiClient.delete("/hr/settings/holidays/" + id);
      fetchHolidays();
      onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Lỗi xoá ngày lễ");
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!confirm("Nạp tự động các ngày nghỉ lễ chuẩn Việt Nam cho năm " + year + "?")) return;
    setLoading(true);
    try {
      await coreApiClient.post("/hr/settings/holidays/seed-defaults", { year });
      fetchHolidays();
      onUpdated?.();
    } catch (e) {
      console.error(e);
      alert("Lỗi nạp ngày lễ");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="glass"
        style={{
          padding: 24,
          width: 540,
          maxWidth: "92%",
          maxHeight: "85vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🏖️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fafafa" }}>
                Lịch Nghỉ Lễ & Công Nghỉ Lễ
              </h3>
              <span style={{ fontSize: 11, color: "#71717a" }}>
                Các ngày lễ được tự động tính vào ngày công hưởng lương
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#a1a1aa",
              cursor: "pointer",
              fontSize: 22,
              padding: "0 4px",
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#a1a1aa" }}>Năm:</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{
                padding: "6px 12px",
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
                borderRadius: 8,
                fontSize: 12,
                outline: "none",
              }}
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y} style={{ background: "#18181b" }}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <button
              onClick={handleSeed}
              disabled={loading}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "rgba(34,197,94,0.15)",
                color: "#4ade80",
                border: "1px solid rgba(34,197,94,0.3)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>⚡</span> Nạp ngày lễ chuẩn VN
            </button>
          )}
        </div>

        {isAdmin && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              background: "rgba(0,0,0,0.25)",
              padding: 12,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ fontSize: 11, color: "#a1a1aa", fontWeight: 600 }}>Thêm ngày nghỉ lễ mới:</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 11,
                }}
              />
              <input
                type="text"
                placeholder="Tên dịp nghỉ lễ..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 160,
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.05)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 11,
                }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 4, color: "#a1a1aa", fontSize: 11, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={paid}
                  onChange={(e) => setPaid(e.target.checked)}
                />
                Hưởng lương
              </label>
              <button
                onClick={handleAdd}
                disabled={loading || !date || !name}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: (!date || !name) ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                  color: (!date || !name) ? "#71717a" : "white",
                  border: "none",
                  cursor: (!date || !name) ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                + Thêm
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          {holidays.length === 0 ? (
            <div style={{ color: "#71717a", fontSize: 12, textAlign: "center", padding: 24 }}>
              Chưa có ngày nghỉ lễ nào cho năm {year}
            </div>
          ) : (
            holidays.map((h, i) => {
              const d = new Date(h.date);
              const formattedDate = !isNaN(d.getTime())
                ? d.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })
                : h.date;
              return (
                <div
                  key={h.id || i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        background: "rgba(168,85,247,0.15)",
                        color: "#c084fc",
                        fontFamily: "monospace",
                        fontSize: 11,
                        fontWeight: 600,
                        border: "1px solid rgba(168,85,247,0.3)",
                      }}
                    >
                      {h.date}
                    </div>
                    <div>
                      <div style={{ color: "#e4e4e7", fontSize: 12, fontWeight: 600 }}>{h.name}</div>
                      <div style={{ color: "#71717a", fontSize: 10 }}>
                        {formattedDate} · {h.paid ? "🎉 Hưởng nguyên lương (Công lễ)" : "Không hưởng lương"}
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(h.id)}
                      disabled={loading}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(239,68,68,0.2)",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: 10,
                        padding: "4px 8px",
                        borderRadius: 4,
                        transition: "all 0.2s",
                      }}
                    >
                      Xoá
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
