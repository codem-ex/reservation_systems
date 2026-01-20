import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "./supabaseClient";

const ReservationProgressPage = () => {
    const navigate = useNavigate();
    const { reservId } = useParams();

    const API_BASE = (process.env.REACT_APP_API_BASE || window.location.origin).replace(/\/$/, "");

    const [loading, setLoading] = useState(true);
    const [errMsg, setErrMsg] = useState("");

    const [reservation, setReservation] = useState(null);
    const [room, setRoom] = useState(null);
    const [stages, setStages] = useState([]);

    const overall = useMemo(() => {
        const st1 = stages.find((s) => s.stage_no === 1);
        const st2 = stages.find((s) => s.stage_no === 2);

        const anyRejected = [st1, st2].some((s) => s?.status === "REJECTED");
        if (anyRejected) return "REJECTED";

        const st2Approved = st2?.status === "APPROVED";
        const hasStage2 = !!st2;

        if (hasStage2) {
            if (st2Approved) return "APPROVED";
            return "PENDING";
        }

        // no stage2 => stage1 decides
        if (st1?.status === "APPROVED") return "APPROVED";
        return "PENDING";
    }, [stages]);

    const statusBadge = (status) => {
        const s = status || "-";
        const style = {
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 12,
            border: "1px solid #ddd",
        };

        if (s === "APPROVED") return <span style={{ ...style, borderColor: "#2e7d32" }}>APPROVED</span>;
        if (s === "REJECTED") return <span style={{ ...style, borderColor: "#c62828" }}>REJECTED</span>;
        if (s === "CANCELLED") return <span style={{ ...style, borderColor: "#555" }}>CANCELLED</span>;
        if (s === "PENDING") return <span style={{ ...style, borderColor: "#666" }}>PENDING</span>;
        return <span style={style}>{s}</span>;
    };

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setErrMsg("");

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate("/login");
                return;
            }

            try {
                const token = session.access_token;
                const resp = await fetch(`${API_BASE}/api/reservations/${reservId}/progress`, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                });

                const json = await resp.json().catch(() => null);
                if (!resp.ok || !json?.ok) {
                    throw new Error(json?.message || `HTTP ${resp.status}`);
                }

                setReservation(json.reservation || null);
                setRoom(json.room || null);
                setStages(json.stages || []);
            } catch (e) {
                setErrMsg(e?.message || String(e));
            }

            setLoading(false);
        };

        run();
    }, [API_BASE, navigate, reservId]);

    if (loading) return <div className="auth-container"><p>กำลังโหลด...</p></div>;

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 980 }}>
                <h2 className="auth-title">สถานะการอนุมัติ (Progress)</h2>

                {errMsg && <p style={{ color: "crimson" }}>{errMsg}</p>}

                {!reservation ? (
                    <p>ไม่พบข้อมูลใบจอง</p>
                ) : (
                    <>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>ใบจอง</div>
                                <div><b>{reservation.reserv_id}</b></div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>ห้อง</div>
                                <div><b>{room?.room_name || reservation.room_id}</b></div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>ช่วงเวลา</div>
                                <div>
                                    <b>{reservation.reserv_start}</b> ถึง <b>{reservation.reserv_end}</b>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>สถานะรวม</div>
                                <div>{statusBadge(overall)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>สถานะห้อง</div>
                                <div>{statusBadge(room?.room_status || "-")}</div>
                            </div>
                        </div>

                        {reservation.google_event_link ? (
                            <div style={{ marginBottom: 12 }}>
                                Google Calendar:{" "}
                                <a href={reservation.google_event_link} target="_blank" rel="noreferrer">
                                    เปิดอีเวนต์
                                </a>
                            </div>
                        ) : null}

                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Stage</th>
                                    <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Status</th>
                                    <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Acted By</th>
                                    <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Acted At</th>
                                    <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(stages || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: 12, opacity: 0.8 }}>
                                            ยังไม่มีข้อมูลการอนุมัติ
                                        </td>
                                    </tr>
                                ) : (
                                    stages.map((s, idx) => (
                                        <tr key={idx}>
                                            <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>Stage {s.stage_no}</td>
                                            <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{statusBadge(s.status)}</td>
                                            <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{s.acted_by_name || "-"}</td>
                                            <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{s.acted_at || "-"}</td>
                                            <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{s.note || "-"}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <Link to={`/reservation/${reservation.reserv_id}`}>กลับหน้ารายละเอียดใบจอง</Link>
                            <span style={{ opacity: 0.5 }}>|</span>
                            <Link to="/my-reservations">ใบจองของฉัน</Link>
                        </div>

                        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                            API_BASE: <code>{API_BASE}</code>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReservationProgressPage;
