import { useEffect, useState } from 'react';
import axios from 'axios';
import "./App.css";

const API = 'http://localhost:3000';

export default function App() {
  const [stock, setStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [bins, setBins] = useState([]);

  const [locationId, setLocationId] = useState('');
  const [productId, setProductId] = useState('');
  const [binId, setBinId] = useState('');
  const [qty, setQty] = useState('');
  const [reference, setReference] = useState('');

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');




//CSV Export Button
const handleExport = async () => {
  try {
    const res = await fetch("http://localhost:3000/export/csv", {
      method: "GET",
      credentials: "include", // keep if you use cookies for auth
    });

    if (!res.ok) throw new Error("Failed to download");

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    console.error(err);
    alert("Export failed");
  }
};





  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [stockRes, prodRes, locRes] = await Promise.all([
          axios.get(`${API}/stock`),
          axios.get(`${API}/products`),
          axios.get(`${API}/locations`)
        ]);
        setStock(stockRes.data);
        setProducts(prodRes.data);
        setLocations(locRes.data);
        if (locRes.data[0]) {
          const first = locRes.data[0].id;
          setLocationId(first.toString());
          const binsRes = await axios.get(`${API}/locations/${first}/bins`);
          setBins(binsRes.data);
        }
        setErr('');
      } catch (e) {
        console.error(e);
        setErr(e.response?.data?.error || e.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // when location changes, refresh its bins
  const onLocationChange = async (id) => {
    setLocationId(id);
    setBinId('');
    if (!id) return setBins([]);
    try {
      const { data } = await axios.get(`${API}/locations/${id}/bins`);
      setBins(data);
    } catch (e) {
      console.error(e);
      setErr('Failed to load bins');
    }
  };

  const reloadStock = async () => {
    const { data } = await axios.get(`${API}/stock`);
    setStock(data);
  };

  const receive = async () => {
    if (!productId || !binId || !qty) return alert('Fill product, bin, qty');
    await axios.post(`${API}/transactions/receive`, {
      productId:+productId, binId:+binId, qty:+qty, reference
    });
    await reloadStock();
    setQty(''); setReference('');
  };

  const ship = async () => {
    if (!productId || !binId || !qty) return alert('Fill product, bin, qty');
    try {
      await axios.post(`${API}/transactions/ship`, {
        productId:+productId, binId:+binId, qty:+qty, reference
      });
      await reloadStock();
      setQty(''); setReference('');
    } catch (e) {
      alert(e.response?.data?.error || 'Error');
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '40px auto', fontFamily: 'system-ui, sans-serif', color: '#eee' }}>
      
      {/* Top row: heading on left, export button on right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1>OurHouse — Inventory</h1>
        <button
          onClick={handleExport}
          style={{
            background: '#16a34a',
            color: '#fff',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Export CSV
        </button>
      </div>

      {!!err && (
        <div style={{ background:'#512', padding:10, margin:'10px 0', border:'1px solid #a55' }}>
          {err}
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2>Receive / Ship</h2>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }}>
          <select value={locationId} onChange={e=>onLocationChange(e.target.value)}>
            <option value="">Location…</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>

          <select value={productId} onChange={e=>setProductId(e.target.value)}>
            <option value="">Product…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>

          <select value={binId} onChange={e=>setBinId(e.target.value)}>
            <option value="">Bin…</option>
            {bins.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>

          <input type="number" placeholder="Qty" value={qty} onChange={e=>setQty(e.target.value)} />
          <input type="text" placeholder="Reference (optional)" value={reference} onChange={e=>setReference(e.target.value)} />
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={receive}>Receive</button>
            <button onClick={ship}>Ship</button>
          </div>
        </div>
      </section>

      <h2>Current Stock</h2>
      {loading ? (
        <div>Loading…</div>
      ) : stock.length === 0 ? (
        <div>No stock yet.</div>
      ) : (
        <table width="100%" border="1" cellPadding="6" style={{ borderCollapse:'collapse', background:'#111' }}>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Bin</th>
              <th style={{ textAlign:'right' }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {stock.map(row => (
              <tr key={`${row.product_id}-${row.bin_id}`}>
                <td>{row.sku}</td>
                <td>{row.product_name}</td>
                <td>{row.bin_code}</td>
                <td style={{ textAlign:'right' }}>{row.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
