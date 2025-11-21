import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000';

export default function AdminPanel({ user, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('products');
  const [formData, setFormData] = useState({
    sku: '',
    productName: '',
    description: '',
    unit: 'each',
    min_qty: 10,           // ADD THIS
    lead_time_days: 0,     // ADD THIS
    locationName: '',
    selectedLocation: '',
    binCode: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [deleteProductId, setDeleteProductId] = useState('');
  const [deleteLocationId, setDeleteLocationId] = useState('');
  const [deleteBinLocationId, setDeleteBinLocationId] = useState('');
  const [deleteBinId, setDeleteBinId] = useState('');
  const [binOptions, setBinOptions] = useState([]);

  useEffect(() => {
    if (activeTab === 'bins' || activeTab === 'remove-location' || activeTab === 'remove-bin') {
      loadLocations();
    }
    if (activeTab === 'remove-product') {
      loadProducts();
    }
  }, [activeTab]);

  const loadLocations = async () => {
    try {
      const { data } = await axios.get(`${API}/locations`);
      setLocations(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadProducts = async () => {
    try {
      const { data } = await axios.get(`${API}/products`);
      setProducts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadBinsForLocation = async (locationId) => {
    if (!locationId) {
      setBinOptions([]);
      return;
    }
    try {
      const { data } = await axios.get(`${API}/locations/${locationId}/bins`);
      setBinOptions(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      productName: '',
      description: '',
      unit: 'each',
      min_qty: 10,          // ADD THIS
      lead_time_days: 0,    // ADD THIS
      locationName: '',
      selectedLocation: '',
      binCode: ''
    });
    setError('');
    setSuccess('');
    setDeleteProductId('');
    setDeleteLocationId('');
    setDeleteBinLocationId('');
    setDeleteBinId('');
    setBinOptions([]);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await axios.post(`${API}/admin/products`, {
        sku: formData.sku,
        name: formData.productName,
        description: formData.description,
        unit: formData.unit,
        min_qty: formData.min_qty,          // ADD THIS
        lead_time_days: formData.lead_time_days  // ADD THIS
      });
      setSuccess('Product added successfully!');
      resetForm();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await axios.post(`${API}/admin/locations`, {
        name: formData.locationName
      });
      setSuccess('Location added successfully!');
      resetForm();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add location');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await axios.post(`${API}/admin/bins`, {
        locationId: formData.selectedLocation,
        code: formData.binCode
      });
      setSuccess('Bin added successfully!');
      resetForm();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add bin');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!deleteProductId) {
      setError('Please select a product to delete.');
      return;
    }
    try {
      await axios.delete(`${API}/admin/products/${deleteProductId}`);
      setSuccess('Product deleted successfully!');
      setDeleteProductId('');
      await loadProducts();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete product');
    }
  };

  const handleDeleteLocation = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!deleteLocationId) {
      setError('Please select a location to delete.');
      return;
    }
    try {
      await axios.delete(`${API}/admin/locations/${deleteLocationId}`);
      setSuccess('Location deleted successfully!');
      setDeleteLocationId('');
      await loadLocations();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete location');
    }
  };

  const handleDeleteBin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!deleteBinId) {
      setError('Please select a bin to delete.');
      return;
    }
    try {
      await axios.delete(`${API}/admin/bins/${deleteBinId}`);
      setSuccess('Bin deleted successfully!');
      setDeleteBinId('');
      await loadBinsForLocation(deleteBinLocationId);
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete bin');
    }
  };

  const tabs = [
    { id: 'products', label: 'Add Product', icon: '📦' },
    { id: 'locations', label: 'Add Location', icon: '🏢' },
    { id: 'bins', label: 'Add Bin', icon: '📍' }
  ];

  const removeTabs = [
    { id: 'remove-product', label: 'Remove Product' },
    { id: 'remove-location', label: 'Remove Location' },
    { id: 'remove-bin', label: 'Remove Bin' }
  ];
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#242938',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        border: '1px solid #3d4559'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #3d4559',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, color: '#f0f4f8' }}>Admin Panel</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#c5cdd8',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              width: '32px',
              height: '32px'
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs - Add */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '16px 24px 8px 24px',
          background: '#202634'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                resetForm();
                if (tab.id === 'bins') loadLocations();
              }}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid #3d4559',
                borderRadius: '6px',
                background: activeTab === tab.id ? '#4a5568' : 'transparent',
                color: activeTab === tab.id ? '#e5e7eb' : '#c5cdd8',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tabs - Remove */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '0 24px 16px 24px',
          background: '#202634',
          borderBottom: '1px solid #3d4559'
        }}>
          {removeTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                resetForm();
              }}
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid #5a2f2f',
                borderRadius: '6px',
                background: activeTab === tab.id ? '#3a1f1f' : 'transparent',
                color: '#fca5a5',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{
              background: '#3a1f1f',
              border: '1px solid #5a2f2f',
              color: '#fca5a5',
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: '#0f1e17',
              border: '1px solid #1a3a2a',
              color: '#86efac',
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {success}
            </div>
          )}
          {/* Add product */}
          {activeTab === 'products' && (
            <form onSubmit={handleAddProduct}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  SKU *
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  required
                  placeholder="e.g., SKU-001"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Product Name *
                </label>
                <input
                  type="text"
                  name="productName"
                  value={formData.productName}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Premium Widget"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* NEW: Min Qty Field */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Minimum Quantity (for alerts) *
                </label>
                <input
                  type="number"
                  name="min_qty"
                  value={formData.min_qty}
                  onChange={handleChange}
                  min="0"
                  placeholder="10"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* NEW: Lead Time Field */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Lead Time (days)
                </label>
                <input
                  type="number"
                  name="lead_time_days"
                  value={formData.lead_time_days}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Optional product description"
                  rows="3"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Unit *
                </label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="each">Each</option>
                  <option value="box">Box</option>
                  <option value="pallet">Pallet</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="lb">Pound (lb)</option>
                  <option value="liter">Liter</option>
                  <option value="gallon">Gallon</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loading ? '#5a6578' : '#4a5568',
                  color: '#e5e7eb',
                  border: '1px solid #5a6578',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Adding...' : 'Add Product'}
              </button>
            </form>
          )}

          {/* Add location */}
          {activeTab === 'locations' && (
            <form onSubmit={handleAddLocation}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Location Name *
                </label>
                <input
                  type="text"
                  name="locationName"
                  value={formData.locationName}
                  onChange={handleChange}
                  required
                  placeholder="e.g., North Warehouse"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loading ? '#5a6578' : '#4a5568',
                  color: '#e5e7eb',
                  border: '1px solid #5a6578',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Adding...' : 'Add Location'}
              </button>
            </form>
          )}

          {/* Add bin */}
          {activeTab === 'bins' && (
            <form onSubmit={handleAddBin}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Location *
                </label>
                <select
                  name="selectedLocation"
                  value={formData.selectedLocation}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Select a location...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Bin Code *
                </label>
                <input
                  type="text"
                  name="binCode"
                  value={formData.binCode}
                  onChange={handleChange}
                  required
                  placeholder="e.g., A3, B1, C5"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !formData.selectedLocation}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loading || !formData.selectedLocation ? '#5a6578' : '#4a5568',
                  color: '#e5e7eb',
                  border: '1px solid #5a6578',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading || !formData.selectedLocation ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Adding...' : 'Add Bin'}
              </button>
            </form>
          )}
          {/* Remove product */}
          {activeTab === 'remove-product' && (
            <form onSubmit={handleDeleteProduct}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Select Product to Remove
                </label>
                <select
                  name="deleteProductId"
                  value={deleteProductId}
                  onChange={e => setDeleteProductId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    marginBottom: '16px'
                  }}
                >
                  <option value="">Select a product...</option>
                  {products.map(prod => (
                    <option key={prod.id} value={prod.id}>
                      {prod.sku} — {prod.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#3a1f1f',
                  color: '#fca5a5',
                  border: '1px solid #5a2f2f',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Delete Product
              </button>
            </form>
          )}

          {/* Remove location */}
          {activeTab === 'remove-location' && (
            <form onSubmit={handleDeleteLocation}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Select Location to Remove
                </label>
                <select
                  name="deleteLocationId"
                  value={deleteLocationId}
                  onChange={e => setDeleteLocationId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    marginBottom: '16px'
                  }}
                >
                  <option value="">Select a location...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '14px',
                  background: '#3a1f1f',
                  color: '#fca5a5',
                  border: '1px solid #5a2f2f',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Delete Location
              </button>
            </form>
          )}

          {/* Remove bin */}
          {activeTab === 'remove-bin' && (
            <form onSubmit={handleDeleteBin}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Select Location
                </label>
                <select
                  name="deleteBinLocationId"
                  value={deleteBinLocationId}
                  onChange={e => {
                    const val = e.target.value;
                    setDeleteBinLocationId(val);
                    loadBinsForLocation(val);
                    setDeleteBinId('');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    marginBottom: '16px'
                  }}
                >
                  <option value="">Select a location...</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Select Bin to Remove
                </label>
                <select
                  name="deleteBinId"
                  value={deleteBinId}
                  onChange={e => setDeleteBinId(e.target.value)}
                  disabled={!deleteBinLocationId}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#202634',
                    border: '1px solid #3d4559',
                    borderRadius: '6px',
                    color: '#f0f4f8',
                    fontSize: '15px',
                    outline: 'none',
                    cursor: !deleteBinLocationId ? 'not-allowed' : 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">
                    {deleteBinLocationId ? 'Select a bin...' : 'Select a location first'}
                  </option>
                  {binOptions.map(bin => (
                    <option key={bin.id} value={bin.id}>
                      {bin.code}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!deleteBinId}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: !deleteBinId ? '#5a6578' : '#3a1f1f',
                  color: '#fca5a5',
                  border: '1px solid #5a2f2f',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: !deleteBinId ? 'not-allowed' : 'pointer'
                }}
              >
                Delete Bin
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
