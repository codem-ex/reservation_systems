import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useNavigate } from "react-router-dom";

const ApproverDashboardPage = () => {
    const navigate = useNavigate();
    const API_BASE = (process.env.REACT_APP_API_BASE || window.location.origin).replace(/\/$/, "");
    const CLIENT_TZ = "Asia/Bangkok";

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);
    const [errorMsg, setErrorMsg] = useState("");
    const [busyId, setBusyId] = useState(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalAction, setModalAction] = useState(null);
    const [modalApprovalId, setModalApprovalId] = useState(null);
    const [modalNote, setModalNote] = useState("");

    const closeModal = () => {
        setModalOpen(false);
        setModalAction(null);
        setModalApprovalId(null);
        setModalNote("");
    };

    const openActModal = (approvalId, action) => {
        setModalApprovalId(approvalId);
        setModalAction(action);
        setModalNote("");
        setModalOpen(true);
    };

    const badgeStyle = (s) => {
        const base = {
            display: "inline-block",
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 12,
            border: "1px solid #ddd",
        };
        if (s === "APPROVED") return { ...base, borderColor: "#16a34a" };
        if (s === "REJECTED") return { ...base, borderColor: "#dc2626" };
        if (s === "CANCELLED") return { ...base, borderColor: "#6b7280" };
        return { ...base, borderColor: "#f59e0b" };
    };

    const authedFetch = async (url, options = {}) => {
        const { data: sessData } = await supabase.auth.getSession();
        const token = sessData?.session?.access_token;
        if (!token) throw new Error("ไม่พบ access token (กรุณา login ใหม่)");

        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        };

        return fetch(url, { ...options, headers });
    };

    const load = async () => {
        setLoading(true);
        setErrorMsg("");

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            navigate("/login");
            return;
        }

        try {
            const resp = await authedFetch(`${API_BASE}/api/approver/tasks`, { method: "GET" });
            const json = await resp.json().catch(() => null);
            if (!resp.ok || !json?.ok) throw new Error(json?.message || `HTTP ${resp.status}`);

            setRows(json?.tasks || []);
        } catch (e) {
            setErrorMsg(e?.message || String(e));
            setRows([]);
        }

        setLoading(false);
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submitAct = async () => {
        const approvalId = modalApprovalId;
        const action = modalAction;
        const note = (modalNote || "").trim();

        if (!approvalId || !action) return;
        if (action === "REJECTED" && !note) {
            alert("กรุณาใส่เหตุผลที่ไม่อนุมัติ");
            return;
        }

        setBusyId(approvalId);

        try {
            const resp = await authedFetch(`${API_BASE}/api/approvals/act`, {
                method: "POST",
                body: JSON.stringify({
                    approval_id: approvalId,
                    action,
                    note: note || null,
                    client_tz: CLIENT_TZ,
                }),
            });

            const json = await resp.json().catch(() => null);
            if (!resp.ok || !json?.ok) throw new Error(json?.message || `HTTP ${resp.status}`);

            alert(action === "APPROVED" ? "อนุมัติเรียบร้อย" : "ไม่อนุมัติเรียบร้อย");
            closeModal();
            await load();
        } catch (e) {
            alert(`ทำรายการไม่สำเร็จ: ${e?.message || String(e)}`);
        }

        setBusyId(null);
    };

    const pendingCount = useMemo(() => rows.filter((r) => r.status === "PENDING").length, [rows]);

    if (loading) return <p>กำลังโหลด...</p>;

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 1200 }}>
                <h2 className="auth-title">งานที่ต้องอนุมัติ (Approver)</h2>

                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                    API_BASE: <code>{API_BASE}</code>
                    <br />
                    Pending: <b>{pendingCount}</b>
                </div>

                {errorMsg && <p style={{ color: "crimson" }}>โหลดไม่สำเร็จ: {errorMsg}</p>}

                {rows.length === 0 ? (
                    <p>ไม่มีงานที่ต้องอนุมัติ</p>
                ) : (
                    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                        {rows.map((r) => (
                            <div key={r.approval_id} style={{ border: "1px solid #eee", borderRadius: 14, padding: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                    <div style={{ fontWeight: 800 }}>
                                        Stage {r.stage_no} — {r.room_name || "(ไม่พบชื่อห้อง)"}
                                    </div>
                                    <span style={badgeStyle(r.status)}>{r.status}</span>
                                </div>

                                <div style={{ marginTop: 6, opacity: 0.9 }}>
                                    ผู้จอง: <b>{r.reserv_by_name || "-"}</b>
                                </div>

                                <div style={{ marginTop: 6, opacity: 0.9 }}>
                                    ช่วงวัน: <b>{r.reserv_start || "-"}</b> ถึง <b>{r.reserv_end || "-"}</b>
                                </div>

                                <div style={{ marginTop: 6, opacity: 0.9 }}>เหตุผล: {r.reserv_purp || "-"}</div>

                                {r.note && (
                                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                                        หมายเหตุ/เหตุผลล่าสุด: {r.note}
                                    </div>
                                )}

                                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    <button
                                        className="auth-btn"
                                        type="button"
                                        disabled={busyId === r.approval_id || r.status !== "PENDING"}
                                        onClick={() => openActModal(r.approval_id, "APPROVED")}
                                    >
                                        Approve
                                    </button>

                                    <button
                                        className="auth-btn"
                                        type="button"
                                        disabled={busyId === r.approval_id || r.status !== "PENDING"}
                                        onClick={() => openActModal(r.approval_id, "REJECTED")}
                                        style={{ backgroundColor: "#ff4444" }}
                                    >
                                        Reject
                                    </button>

                                    <button
                                        type="button"
                                        className="auth-btn"
                                        onClick={() => navigate(`/reservation/${r.reservation_id}`)}
                                        style={{ backgroundColor: "#111827" }}
                                    >
                                        ดูรายละเอียดใบจอง
                                    </button>

                                    <button
                                        type="button"
                                        className="auth-btn"
                                        onClick={() => navigate(`/reservation/${r.reservation_id}/progress`)}
                                        style={{ backgroundColor: "#0f766e" }}
                                    >
                                        ดู Progress รวม
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {modalOpen && (
                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            background: "rgba(0,0,0,0.35)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 16,
                            zIndex: 9999,
                        }}
                    >
                        <div style={{ width: "100%", maxWidth: 520, background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #eee" }}>
                            <div style={{ fontWeight: 800, marginBottom: 8 }}>
                                {modalAction === "APPROVED" ? "ยืนยันการอนุมัติ" : "ยืนยันการไม่อนุมัติ"}
                            </div>

                            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
                                {modalAction === "APPROVED"
                                    ? "คุณสามารถใส่หมายเหตุเพิ่มเติมได้ (ไม่บังคับ)"
                                    : "กรุณาใส่เหตุผลที่ไม่อนุมัติ (บังคับ)"}
                            </div>

                            <textarea
                                value={modalNote}
                                onChange={(e) => setModalNote(e.target.value)}
                                placeholder={modalAction === "REJECTED" ? "ใส่เหตุผล..." : "หมายเหตุ (ถ้ามี)..."}
                                rows={4}
                                style={{ width: "100%", borderRadius: 12, border: "1px solid #ccc", padding: 10, resize: "vertical" }}
                            />

                            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
                                >
                                    ยกเลิก
                                </button>

                                <button
                                    type="button"
                                    className="auth-btn"
                                    onClick={submitAct}
                                    disabled={busyId === modalApprovalId}
                                    style={modalAction === "REJECTED" ? { backgroundColor: "#ff4444" } : undefined}
                                >
                                    {busyId === modalApprovalId ? "กำลังบันทึก..." : "ยืนยัน"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApproverDashboardPage;
