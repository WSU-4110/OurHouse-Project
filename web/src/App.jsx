import { useEffect, useState } from 'react';
import axios from 'axios';
import Login from './login.jsx';
import "./App.css";
import AdminPanel from './AdminPanel';
import ActivityLogs from './ActivityLogs';
import ExportMenu from './ExportMenu.jsx';
import ImportMenu from './ImportMenu.jsx';
import LowStockBanner from './LowStockBanner';
import Notifications from './Notifications';
import ProductHistory from './ProductHistory';
import StockTransfer from './StockTransfer';

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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [showActivityLogs, setShowActivityLogs] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showProductHistory, setShowProductHistory] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showStockTransfer, setShowStockTransfer] = useState(false);

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
    window.showNotification?.(`${type} deleted successfully`, 'success');
    await reloadAllData();
  } catch (e) {
    window.showNotification?.(e.response?.data?.error || `Failed to delete ${type}`, 'error');
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
    if (!productId || !binId || !qty) {
      window.showNotification?.('Please fill in product, bin, and quantity', 'error');
      return;
    }
    try {
      await axios.post(`${API}/transactions/receive`, {
        productId: +productId, binId: +binId, qty: +qty, user: user.name
      });
      await reloadStock();
      setQty('');
      window.showNotification?.('Stock received successfully', 'success');
    } catch (e) {
      window.showNotification?.(e.response?.data?.error || 'Receive failed', 'error');
    }
  };

  const ship = async () => {
    if (!productId || !binId || !qty) {
      window.showNotification?.('Please fill in product, bin, and quantity', 'error');
      return;
    }
    try {
      await axios.post(`${API}/transactions/ship`, {
        productId: +productId, binId: +binId, qty: +qty, user: user.name
      });
      await reloadStock();
      setQty('');
      window.showNotification?.('Stock shipped successfully', 'success');
    } catch (e) {
      window.showNotification?.(e.response?.data?.error || 'Ship failed', 'error');
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
        item.description?.toLowerCase().includes(term) ||
        item.location_name?.toLowerCase().includes(term)
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
    if (sortConfig.key !== key) return ' ↕';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const handleProductClick = (row) => {
    setSelectedProduct({
      id: row.product_id,
      name: row.product_name,
      sku: row.sku
    });
    setShowProductHistory(true);
  };
  
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const filteredStock = getFilteredAndSortedStock();


  return (
    <>
    <Notifications />
      <div style={{ maxWidth: 1200, margin: '100px auto 40px', fontFamily: 'system-ui, sans-serif', color: '#eee' }}>

      <LowStockBanner />

      {/*heading on left, export button on right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ color: '#d1d5db' }}>OurHouse — Inventory</h1>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* User info */}
          <span style={{ color: '#9ca3af' }}>
            {user.name} ({user.role})
          </span>
          {/* Admin button */}
            {/* Admin & Manager only */}
            {(user.role === 'Manager' || user.role === 'Admin') && (
                <>
                    <button
                        onClick={() => setShowActivityLogs(true)}
                        style={{
                            background: '#374151',
                            color: '#e5e7eb',
                            padding: '8px 16px',
                            border: '1px solid #4b5563',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px'
                        }}
                    >
                        📊 Activity Logs
                    </button>
                    <button
                        onClick={() => setShowAdminPanel(true)}
                        style={{
                            background: '#374151',
                            color: '#e5e7eb',
                            padding: '8px 16px',
                            border: '1px solid #4b5563',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px'
                        }}
                    >
                        ⚙️ Admin
                    </button>
                </>
            )}

            {/* Import/Export visible to all roles */}
            <button
                onClick={() => setShowExportMenu(true)}
                style={{
                    background: '#374151',
                    color: '#e5e7eb',
                    padding: '8px 16px',
                    border: '1px solid #4b5563',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                }}
            >
                📤 Export
            </button>

            <button
                onClick={() => setShowImportMenu(true)}
                style={{
                    background: '#374151',
                    color: '#e5e7eb',
                    padding: '8px 16px',
                    border: '1px solid #4b5563',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                }}
            >
                📥 Import
            </button>
          
          <button 
            onClick={handleLogout}
            style={{
              background: '#1a1f27',
              color: '#d1d5db',
              padding: '8px 16px',
              border: '1px solid #374151',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            Logout
          </button>
        </div>

      </div>

      {!!err && (
        <div style={{ background: '#1a1414', padding: 10, margin: '10px 0', border: '1px solid #3a1c1c', borderRadius: '6px', color: '#fca5a5' }}>
          {err}
        </div>
      )}
      
      <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ color: '#d1d5db' }}>Receive / Ship</h2>
            <button
              onClick={() => setShowStockTransfer(true)}
              style={{
                background: '#374151',
                color: '#e5e7eb',
                padding: '8px 16px',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              🔄 Transfer Stock
            </button>
          </div>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr 1fr auto auto' }}>
            <select 
              value={locationId} 
              onChange={e => onLocationChange(e.target.value)}
              style={{
                background: '#0d1117',
                border: '1px solid #262b34',
                color: '#d1d5db',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">Location…</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <select 
              value={productId} 
              onChange={e => setProductId(e.target.value)}
              style={{
                background: '#0d1117',
                border: '1px solid #262b34',
                color: '#d1d5db',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">Product…</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </select>
            <select 
              value={binId} 
              onChange={e => setBinId(e.target.value)}
              style={{
                background: '#0d1117',
                border: '1px solid #262b34',
                color: '#d1d5db',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">Bin…</option>
              {bins.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
            </select>
            <input 
              type="number" 
              placeholder="Qty" 
              value={qty} 
              onChange={e => setQty(e.target.value)}
              style={{
                background: '#0d1117',
                border: '1px solid #262b34',
                color: '#d1d5db',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <button 
              onClick={receive}
              style={{
                background: '#374151',
                color: '#e5e7eb',
                padding: '10px 16px',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              Receive
            </button>
            <button 
              onClick={ship}
              style={{
                background: '#374151',
                color: '#e5e7eb',
                padding: '10px 16px',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px'
              }}
            >
              Ship
            </button>
          </div>
        </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: '#d1d5db' }}>Current Stock</h2>
        <input
          type="text"
          placeholder="🔍 Search products, SKU, bin, description..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            padding: '10px 16px',
            background: '#0d1117',
            border: '1px solid #262b34',
            borderRadius: '6px',
            color: '#d1d5db',
            width: '400px',
            fontSize: '14px'
          }}
        />
      </div>

      {loading ? (
        <div style={{ color: '#9ca3af' }}>Loading…</div>
      ) : filteredStock.length === 0 ? (
        <div style={{ color: '#9ca3af' }}>{searchTerm ? 'No results found.' : 'No stock yet.'}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table width="100%" border="1" cellPadding="8" style={{ borderCollapse: 'collapse', background: '#13171d', border: '1px solid #262b34' }}>
            <thead>
              <tr style={{ background: '#0d1117' }}>
                {(user.role === 'Manager' || user.role === 'Admin') && (
                  <th style={{ color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #262b34', padding: '12px' }}>
                    Actions
                  </th>
                )}
                <th 
                  onClick={() => handleSort('location_name')}
                  style={{ cursor: 'pointer', userSelect: 'none', color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #262b34', padding: '12px' }}
                >
                  Location {getSortIcon('location_name')}
                </th>
                <th
                  onClick={() => handleSort('sku')}
                  style={{ cursor: 'pointer', userSelect: 'none', color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #262b34', padding: '12px' }}
                >
                  SKU {getSortIcon('sku')}
                </th>
                <th 
                  onClick={() => handleSort('product_name')}
                  style={{ cursor: 'pointer', userSelect: 'none', color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #262b34', padding: '12px' }}
                >
                  Product {getSortIcon('product_name')}
                </th>
                <th 
                  onClick={() => handleSort('description')}
                  style={{ cursor: 'pointer', userSelect: 'none', minWidth: '200px', color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #262b34', padding: '12px' }}
                >
                  Description {getSortIcon('description')}
                </th>
                <th 
                  onClick={() => handleSort('unit')}
                  style={{ cursor: 'pointer', userSelect: 'none', color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #262b34', padding: '12px' }}
                >
                  Unit {getSortIcon('unit')}
                </th>
                <th 
                  onClick={() => handleSort('bin_code')}
                  style={{ cursor: 'pointer', userSelect: 'none', color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #262b34', padding: '12px' }}
                >
                  Bin {getSortIcon('bin_code')}
                </th>
                <th 
                  onClick={() => handleSort('qty')}
                  style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid #262b34', padding: '12px' }}
                >
                  Qty {getSortIcon('qty')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStock.map(row => (
                <tr key={`${row.product_id}-${row.bin_id}`} style={{ borderBottom: '1px solid #262b34' }}>
                  {(user.role === 'Manager' || user.role === 'Admin') && (
                    <td>
                      <button
                        onClick={() => handleDelete('product', row.product_id, `${row.sku} - ${row.product_name}`)}
                        style={{
                          background: '#1a1414',
                          color: '#fca5a5',
                          padding: '6px 10px',
                          border: '1px solid #3a1c1c',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  )}
                  <td style={{ color: '#d1d5db' }}>{row.location_name}</td>
                    <td style={{ color: '#d1d5db' }}>{row.sku}</td>
                    <td 
                      style={{ 
                        fontWeight: '500', 
                        color: '#6b7280', 
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                      onClick={() => handleProductClick(row)}
                      title="Click to view transaction history"
                    >
                      {row.product_name}
                    </td>
                    <td style={{ color: '#9ca3af', fontSize: '14px' }}>{row.description || '—'}</td>
                    <td style={{ color: '#d1d5db' }}>{row.unit}</td>
                    <td style={{ color: '#d1d5db' }}>{row.bin_code}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600', color: '#d1d5db' }}>{row.qty}</td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

      {searchTerm && (
        <div style={{ marginTop: 12, color: '#9ca3af', fontSize: '14px' }}>
          Showing {filteredStock.length} of {stock.length} items
        </div>
      )}

        {showAdminPanel && (
            <AdminPanel
                user={user}
                onClose={() => setShowAdminPanel(false)}
                onUpdate={reloadAllData}
            />
        )}

        {showActivityLogs && (
            <ActivityLogs onClose={() => setShowActivityLogs(false)} />
        )}

        {showExportMenu && (
            <ExportMenu
                user={user}
                onClose={() => setShowExportMenu(false)}
            />
        )}

        {showImportMenu && (
            <ImportMenu
                user={user}
                onClose={() => setShowImportMenu(false)}
                onImported={reloadAllData}
            />
        )}

        {showProductHistory && selectedProduct && (
            <ProductHistory
                productId={selectedProduct.id}
                productName={selectedProduct.name}
                sku={selectedProduct.sku}
                onClose={() => setShowProductHistory(false)}
            />
        )}

        {showStockTransfer && (
            <StockTransfer
                user={user}
                onClose={() => setShowStockTransfer(false)}
                onUpdate={reloadAllData}
            />
        )}

      </div>
      </>
  );
}