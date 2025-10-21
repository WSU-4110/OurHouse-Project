import { useState } from "react";

const API = "http://localhost:3000";

export default function ExportMenu({ user, onClose }) {
    const [loading, setLoading] = useState(false);

    const handleExport = async (mode) => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/export/csv?mode=${mode}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error("Export failed");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${mode}_export.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={overlay}>
            <div style={panel}>
                <div style={header}>
                    <h2 style={{ margin: 0, color: "#d1d5db" }}>Export Options</h2>
                    <button onClick={onClose} style={closeBtn}>×</button>
                </div>

                <div style={{ padding: 20 }}>
                    <button style={btn} onClick={() => handleExport("snapshot")} disabled={loading}>
                        📦 Full Snapshot
                    </button>
                    <button style={btn} onClick={() => handleExport("locations")} disabled={loading}>
                        🏭 Locations Overview
                    </button>
                    <button style={btn} onClick={() => handleExport("products")} disabled={loading}>
                        🧾 Product List
                    </button>
                </div>
            </div>
        </div>
    );
}

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const panel = { background: "#13171d", border: "1px solid #262b34", borderRadius: 8, width: 400 };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottom: "1px solid #262b34" };
const closeBtn = { background: "transparent", border: "none", color: "#9ca3af", fontSize: 24, cursor: "pointer" };
const btn = { display: "block", width: "100%", padding: "12px 16px", marginBottom: 10, background: "#374151", border: "1px solid #4b5563", color: "#e5e7eb", borderRadius: 6, fontWeight: 600, cursor: "pointer" };
