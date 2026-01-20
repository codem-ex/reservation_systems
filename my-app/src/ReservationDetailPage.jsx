import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useNavigate, useParams } from "react-router-dom";

const ReservationDetailPage = () => {
    const navigate = useNavigate();
    const { reservId } = useParams();

    const [loading, setLoading] = useState(true);
    const [reservation, setReservation] = useState(null);
    const [stagesRaw, setStagesRaw] = useState([]);
    const [errorMsg, setErrorMsg] = useState("");

    // ทำให้มี 2 stage เสมอ (ถ้าขาด stage ใดให้เติม placeholder)
    const stages = useMemo(() => {
        const map = new Map();
        (stagesRaw || []).forEach((r) => {
            if (r?.stage_no != null) map.set(Number(r.stage_no), r);
        });

        const s1 = map.get(1) || {
            stage_no: 1,
            status: "PENDING",
            acted_at: null,
            note: null,
            approver_name: null,
            approver_pos: null,
            approver_id: null,
            acted_by_name: null,
        };

        const s2 = map.get(2) || {
            stage_no: 2,
            status: "PENDING",
            acted_at: null,
            note: null,
            approver_name: null,
            approver_pos: null,
            approver_id: null,
            acted_by_name: null,
        };

        return [s1, s2];
    }, [stagesRaw]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setErrorMsg("");

            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                navigate("/login");
                return;
            }

            // 1) โหลดใบจอง
            const { data: r, error: rErr } = await supabase
                .from("reservation_info")
                .select("reserv_id, room_id, reserv_start, reserv_end, reserv_purp, approval_status")
                .eq("reserv_id", reservId)
                .single();

            if (rErr) {
                setErrorMsg(rErr.message);
                setReservation(null);
                setStagesRaw([]);
                setLoading(false);
                return;
            }

            // 2) โหลด stage จาก view (สำคัญ: filter ต้องใช้ reserv_id ไม่ใช่ reservation_id)
            const { data: s, error: sErr } = await supabase
                .from("v_reservation_approval_stages")
                .select(
                    [
                        "reserv_id",
                        "approval_id",
                        "stage_no",
                        "status",
                        "stage_status",
                        "acted_at",
                        "note",
                        "approver_name",
                        "approver_pos",
                        "approver_id",
                        "acted_by_name",
                        "acted_by_id",
                    ].join(",")
                )
                .eq("reserv_id", reservId)
                .order("stage_no", { ascending: true });

            setReservation(r);
            setStagesRaw(sErr ? [] : s || []);
            if (sErr) setErrorMsg((prev) => (prev ? prev : sErr.message));

            setLoading(false);
        };

        load();
    }, [navigate, reservId]);

    const stageCardStyle = (status) => {
        const base = { border: "1px solid #eee", borderRadius: 14, padding: 12 };
        if (status === "APPROVED") return { ...base, borderColor: "#16a34a" };
        if (status === "REJECTED") return { ...base, borderColor: "#dc2626" };
        if (status === "CANCELLED") return { ...base, borderColor: "#6b7280" };
        return { ...base, borderColor: "#f59e0b" };
    };

    const statusLabel = (s) => s || "PENDING";

    if (loading) return <p>กำลังโหลด...</p>;

    if (!reservation) {
        return (
            <div className="auth-container">
                <div className="auth-card">
                    <h2 className="auth-title">รายละเอียดใบจอง</h2>
                    <p style={{ color: "crimson" }}>โหลดไม่สำเร็จ: {errorMsg || "ไม่พบข้อมูล"}</p>
                </div>
            </div>
        );
    }

    const hasBothStagesFromDb = (stagesRaw || []).length >= 2;

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 1100 }}>
                <h2 className="auth-title">รายละเอียดใบจอง</h2>

                <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                    <div>
                        <b>Reserv ID:</b> {reservation.reserv_id}
                    </div>
                    <div>
                        <b>ช่วงวัน:</b> {String(reservation.reserv_start)} ถึง {String(reservation.reserv_end)}
                    </div>
                    <div>
                        <b>เหตุผล:</b> {reservation.reserv_purp}
                    </div>
                    <div>
                        <b>สถานะรวม:</b> {reservation.approval_status || "PENDING"}
                    </div>
                </div>

                <h3 style={{ marginTop: 10 }}>Stage การอนุมัติ (2 ขั้น)</h3>

                {!hasBothStagesFromDb && (
                    <p style={{ color: "#b45309" }}>
                        ระบบยังไม่มี Stage ครบ 2 ขั้น (ตรวจว่ามีการ seed ข้อมูลใน <b>reservation_approvals</b> ครบ Stage 1–2
                        หรือยัง)
                    </p>
                )}

                <div style={{ display: "grid", gap: 10 }}>
                    {stages.map((s) => (
                        <div key={s.stage_no} style={stageCardStyle(s.status)}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                <div style={{ fontWeight: 800 }}>Stage {s.stage_no}</div>
                                <div style={{ fontWeight: 700 }}>{statusLabel(s.status)}</div>
                            </div>

                            <div style={{ marginTop: 6 }}>
                                <b>ผู้อนุมัติ (ตามระบบ):</b>{" "}
                                {s.approver_name || "(ไม่ระบุชื่อ)"} {s.approver_pos ? `(${s.approver_pos})` : ""}
                            </div>

                            <div style={{ marginTop: 6, opacity: 0.9 }}>
                                <b>ผู้ที่กดอนุมัติ:</b> {s.acted_by_name ? s.acted_by_name : "-"}
                            </div>

                            <div style={{ marginTop: 6, opacity: 0.9 }}>
                                <b>เวลาอนุมัติ:</b> {s.acted_at ? String(s.acted_at) : "-"}
                            </div>

                            {s.note && (
                                <div style={{ marginTop: 6, opacity: 0.9 }}>
                                    <b>หมายเหตุ/เหตุผล:</b> {s.note}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {errorMsg && (
                    <p style={{ marginTop: 12, color: "crimson" }}>
                        หมายเหตุ: {errorMsg}
                    </p>
                )}

                <button
                    className="auth-btn"
                    type="button"
                    style={{ marginTop: 16 }}
                    onClick={() => navigate("/my-reservations")}
                >
                    กลับไปหน้าใบจองของฉัน
                </button>
            </div>
        </div>
    );
};

export default ReservationDetailPage;
