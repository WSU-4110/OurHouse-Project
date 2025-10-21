import { useState } from "react";

const API = "http://localhost:3000";

export default function ImportMenu({ user, onClose, onImported }) {
    const [type, setType] = useState("shipment");
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);

    const isManagerPlus = user?.role === "Manager" || user?.role === "Admin";

    const handleImport = async () => {
        if (!file) return alert("Please choose a CSV file first.");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);

        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/import/csv`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Import failed");

            alert("Import complete");
            onImported?.();
            onClose();
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
                    <h2 style={{ margin: 0, color: "#d1d5db" }}>Import Options</h2>
                    <button onClick={onClose} style={closeBtn}>×</button>
                </div>

                <div style={{ padding: 20 }}>
                    <label style={label}>Import Type</label>
                    <select value={type} onChange={(e) => setType(e.target.value)} style={select}>
                        <option value="shipment">Shipment Receiving (Add Stock)</option>
                        {isManagerPlus && <option value="reconcile">Inventory Reconciliation (Set Levels)</option>}
                        {isManagerPlus && <option value="catalog">New Product Upload</option>}
                    </select>

                    <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginTop: 16, color: "#d1d5db" }} />

                    <div style={footerBtns}>
                        <button onClick={onClose} style={btnSecondary}>Cancel</button>
                        <button onClick={handleImport} disabled={loading || !file} style={btnPrimary}>
                            {loading ? "Importing…" : "Import"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const panel = { background: "#13171d", border: "1px solid #262b34", borderRadius: 8, width: 480 };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottom: "1px solid #262b34" };
const closeBtn = { background: "transparent", border: "none", color: "#9ca3af", fontSize: 24, cursor: "pointer" };
const label = { display: "block", color: "#9ca3af", fontSize: 12, marginBottom: 6 };
const select = { width: "100%", padding: "12px 14px", background: "#0d1117", color: "#d1d5db", border: "1px solid #262b34", borderRadius: 6, outline: "none" };
const footerBtns = { marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 };
const btnSecondary = { background: "#1a1f27", color: "#d1d5db", border: "1px solid #374151", borderRadius: 6, padding: "10px 16px", fontWeight: 600, cursor: "pointer" };
const btnPrimary = { background: "#374151", color: "#e5e7eb", border: "1px solid #4b5563", borderRadius: 6, padding: "10px 16px", fontWeight: 600, cursor: "pointer" };
