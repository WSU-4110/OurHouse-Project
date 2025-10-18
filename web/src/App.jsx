import { useEffect, useState } from 'react';
import axios from 'axios';
import Login from './login.jsx';
import "./App.css";
import AdminPanel from './AdminPanel';
import ActivityLogs from './ActivityLogs';

const API = 'http://localhost:3000';

export default function App() {
  const [stock, setStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [bins, setBins] = useState([]);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [locationId, setLocationId] = useState('');
  const [productId, setProductId] = useState('');
  const [binId, setBinId] = useState('');
  const [qty, setQty] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'sku', direction: 'asc' });
  const [showActivityLogs, setShowActivityLogs] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
    }
    else {
      setLoading(false);}
  }, []);
useEffect(() => {
    if (!user || dataLoaded) {
      return;
    }

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
        setDataLoaded(true);
      } catch (e) {
        console.error(e);
        setErr(e.response?.data?.error || e.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, dataLoaded]);

 const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setDataLoaded(false);
    delete axios.defaults.headers.common['Authorization'];
  };

  const handleLogin = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
  };

    const reloadAllData = async () => {
  try {
    const [stockRes, prodRes, locRes] = await Promise.all([
      axios.get(`${API}/stock`),
      axios.get(`${API}/products`),
      axios.get(`${API}/locations`)
    ]);
    setStock(stockRes.data);
    setProducts(prodRes.data);
    setLocations(locRes.data);
  } catch (e) {
    console.error(e);
  }
};

const handleDelete = async (type, id, name) => {
  if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.\n\n${name}`)) {
    return;
  }

  try {
    await axios.delete(`${API}/admin/${type}s/${id}`);
    alert(`${type} deleted successfully`);
    await reloadAllData();
  } catch (e) {
    alert(e.response?.data?.error || `Failed to delete ${type}`);
  }
};

//CSV Export Button
const handleExport = async () => {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch("http://localhost:3000/export/csv", {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${token}`
      }
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
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Export failed: " + err.message);
  }
};

// CSV Import Button
const handleImport = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const token = localStorage.getItem('token');
    const res = await fetch("http://localhost:3000/import/csv", {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData,
    });

    if (!res.ok) throw new Error("Import failed");
    const data = await res.json();
    alert(`Imported ${data.imported} records successfully`);
    await reloadStock();
  } catch (err) {
    console.error(err);
    alert("Import failed - " + err.message);
  } finally {
    e.target.value = null;
  }
};
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
    try {
      await axios.post(`${API}/transactions/receive`, {
        productId: +productId, binId: +binId, qty: +qty, reference, user: user.name
      });
      await reloadStock();
      setQty(''); setReference('');
    } catch (e) {
      alert(e.response?.data?.error || 'Error');
    }
  };

  const ship = async () => {
    if (!productId || !binId || !qty) return alert('Fill product, bin, qty');
    try {
      await axios.post(`${API}/transactions/ship`, {
        productId: +productId, binId: +binId, qty: +qty, reference, user: user.name
      });
      await reloadStock();
      setQty(''); setReference('');
    } catch (e) {
      alert(e.response?.data?.error || 'Error');
    }
  };
//function for sortiing
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
//stock data with product details
  const getEnrichedStock = () => {
    return stock.map(item => {
      const product = products.find(p => p.id === item.product_id);
      return {
        ...item,
        description: product?.description || '',
        unit: product?.unit || 'each'
      };
    });
  };
    //filters and sorts stock
    const getFilteredAndSortedStock = () => {
    let enrichedStock = getEnrichedStock();
    if (searchTerm) { //filters byy search terms
      const term = searchTerm.toLowerCase();
      enrichedStock = enrichedStock.filter(item =>
        item.sku?.toLowerCase().includes(term) ||
        item.product_name?.toLowerCase().includes(term) ||
        item.bin_code?.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term)
      );
    }
    enrichedStock.sort((a, b) => { 
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
if (sortConfig.key === 'qty') {//sorts with numbers
        aVal = Number(aVal);
        bVal = Number(bVal);
      } else {
        //sorts with string
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return enrichedStock;
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };


  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const filteredStock = getFilteredAndSortedStock();


  return (
    <div style={{ maxWidth: 1200, margin: '40px auto', fontFamily: 'system-ui, sans-serif', color: '#eee' }}>

      {/*heading on left, export button on right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1>OurHouse — Inventory</h1>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {/* User info */}
          <span style={{ color: '#94a3b8' }}>
            {user.name} ({user.role})
          </span>
          {/* Admin button */}
          {(user.role === 'Manager' || user.role === 'Admin') && (
            <>
              <button
                onClick={() => setShowActivityLogs(true)}
                style={{
                  background: '#0ea5e9',
                  color: '#fff',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                📊 Activity Logs
              </button>
              <button
                onClick={() => setShowAdminPanel(true)}
                style={{
                  background: '#8b5cf6',
                  color: '#fff',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ⚙️ Admin
              </button>
            </>
          )}
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

          {/* Import CSV */}
          <label
            style={{
              background: '#16a34a',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1em',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            Import CSV
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </label>
          <button onClick={handleLogout}>Logout</button>
        </div>

      </div>

      {!!err && (
        <div style={{ background: '#512', padding: 10, margin: '10px 0', border: '1px solid #a55' }}>
          {err}
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2>Receive / Ship</h2>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr' }}>
          <select value={locationId} onChange={e => onLocationChange(e.target.value)}>
            <option value="">Location…</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select value={productId} onChange={e => setProductId(e.target.value)}>
            <option value="">Product…</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
          <select value={binId} onChange={e => setBinId(e.target.value)}>
            <option value="">Bin…</option>
            {bins.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>
          <input type="number" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} />
          <input type="text" placeholder="Reference (optional)" value={reference} onChange={e => setReference(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={receive}>Receive</button>
            <button onClick={ship}>Ship</button>
          </div>
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Current Stock</h2>
        <input
          type="text"
          placeholder="🔍 Search products, SKU, bin, description..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            padding: '10px 16px',
            background: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#eee',
            width: '400px',
            fontSize: '14px'
          }}
        />
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : filteredStock.length === 0 ? (
        <div>{searchTerm ? 'No results found.' : 'No stock yet.'}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table width="100%" border="1" cellPadding="8" style={{ borderCollapse: 'collapse', background: '#111' }}>
            <thead>
              {(user.role === 'Manager' || user.role === 'Admin') && (
                <th>Actions</th>
              )}
              <tr style={{ background: '#1a1a1a' }}>
                <th 
                  onClick={() => handleSort('sku')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  SKU {getSortIcon('sku')}
                </th>
                <th 
                  onClick={() => handleSort('product_name')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Product {getSortIcon('product_name')}
                </th>
                <th 
                  onClick={() => handleSort('description')}
                  style={{ cursor: 'pointer', userSelect: 'none', minWidth: '200px' }}
                >
                  Description {getSortIcon('description')}
                </th>
                <th 
                  onClick={() => handleSort('unit')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Unit {getSortIcon('unit')}
                </th>
                <th 
                  onClick={() => handleSort('bin_code')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  Bin {getSortIcon('bin_code')}
                </th>
                <th 
                  onClick={() => handleSort('qty')}
                  style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                >
                  Qty {getSortIcon('qty')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStock.map(row => (
                <tr key={`${row.product_id}-${row.bin_id}`}>
                  {(user.role === 'Manager' || user.role === 'Admin') && (
                    <td>
                      <button
                        onClick={() => handleDelete('product', row.product_id, `${row.sku} - ${row.product_name}`)}
                        style={{
                          background: '#ef4444',
                          color: '#fff',
                          padding: '4px 8px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  )}
                  <td>{row.sku}</td>
                  <td style={{ fontWeight: '500' }}>{row.product_name}</td>
                  <td style={{ color: '#94a3b8', fontSize: '14px' }}>{row.description || '—'}</td>
                  <td>{row.unit}</td>
                  <td>{row.bin_code}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{row.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {searchTerm && (
        <div style={{ marginTop: 12, color: '#94a3b8', fontSize: '14px' }}>
          Showing {filteredStock.length} of {stock.length} items
        </div>
      )}

      {showAdminPanel && (
        <AdminPanel
          onClose={() => setShowAdminPanel(false)}
          onUpdate={reloadAllData}
        />
      )}
      {showActivityLogs && (
        <ActivityLogs onClose={() => setShowActivityLogs(false)} />
      )}
    </div>
  );
}