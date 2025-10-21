import { useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000';

export default function AdminPanel({ user, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('products');
  const [formData, setFormData] = useState({
    sku: '',
    productName: '',
    description: '',
    unit: 'each',
    locationName: '',
    selectedLocation: '',
    binCode: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (activeTab === 'bins') {
      loadLocations();
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
      locationName: '',
      selectedLocation: '',
      binCode: ''
    });
    setError('');
    setSuccess('');
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
        unit: formData.unit
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

  const tabs = [
    { id: 'products', label: 'Add Product', icon: '📦' },
    { id: 'locations', label: 'Add Location', icon: '🏢' },
    { id: 'bins', label: 'Add Bin', icon: '📍' }
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
        background: '#13171d',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        border: '1px solid #262b34'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #262b34',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, color: '#d1d5db' }}>Admin Panel</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
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

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '16px 24px',
          background: '#0d1117',
          borderBottom: '1px solid #262b34'
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
                border: '1px solid #262b34',
                borderRadius: '6px',
                background: activeTab === tab.id ? '#374151' : 'transparent',
                color: activeTab === tab.id ? '#e5e7eb' : '#9ca3af',
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

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{
              background: '#1a1414',
              border: '1px solid #3a1c1c',
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
                  color: '#9ca3af',
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
                  placeholder="e.g., SKU-003"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0d1117',
                    border: '1px solid #262b34',
                    borderRadius: '6px',
                    color: '#d1d5db',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#9ca3af',
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
                    background: '#0d1117',
                    border: '1px solid #262b34',
                    borderRadius: '6px',
                    color: '#d1d5db',
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#9ca3af',
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
                    background: '#0d1117',
                    border: '1px solid #262b34',
                    borderRadius: '6px',
                    color: '#d1d5db',
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
                  color: '#9ca3af',
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
                    background: '#0d1117',
                    border: '1px solid #262b34',
                    borderRadius: '6px',
                    color: '#d1d5db',
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
                  background: loading ? '#4b5563' : '#374151',
                  color: '#e5e7eb',
                  border: '1px solid #4b5563',
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
                  color: '#9ca3af',
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
                    background: '#0d1117',
                    border: '1px solid #262b34',
                    borderRadius: '6px',
                    color: '#d1d5db',
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
                  background: loading ? '#4b5563' : '#374151',
                  color: '#e5e7eb',
                  border: '1px solid #4b5563',
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
                  color: '#9ca3af',
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
                    background: '#0d1117',
                    border: '1px solid #262b34',
                    borderRadius: '6px',
                    color: '#d1d5db',
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
                  color: '#9ca3af',
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
                    background: '#0d1117',
                    border: '1px solid #262b34',
                    borderRadius: '6px',
                    color: '#d1d5db',
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
                  background: loading || !formData.selectedLocation ? '#4b5563' : '#374151',
                  color: '#e5e7eb',
                  border: '1px solid #4b5563',
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
        </div>
      </div>
    </div>
  );
}