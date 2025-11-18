import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000';

export default function StockTransfer({ user, onClose, onUpdate }) {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [bins, setBins] = useState([]);
  const [fromBins, setFromBins] = useState([]);
  const [toBins, setToBins] = useState([]);
  
  const [formData, setFormData] = useState({
    productId: '',
    fromLocationId: '',
    toLocationId: '',
    fromBinId: '',
    toBinId: '',
    qty: '',
    reference: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [availableQty, setAvailableQty] = useState(0);

  useEffect(() => {
    loadInitialData();
  }, []);

    const loadInitialData = async () => {
    try {
        const [prodRes, locRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/locations`)
        ]);
        setProducts(prodRes.data);
        setLocations(locRes.data);
    } catch (e) {
        console.error(e);
        window.showNotification?.('Failed to load data', 'error');
    }
    };

    const loadBins = async (locationId, setBinsState) => {
    try {
        const { data } = await axios.get(`${API}/locations/${locationId}/bins`);
        setBinsState(data);
    } catch (e) {
        console.error(e);
        window.showNotification?.('Failed to load bins', 'error');
    }
    };

    const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'fromLocationId' && value) {
        loadBins(value, setFromBins);
        setFormData(prev => ({ 
        ...prev, 
        fromLocationId: value,
        fromBinId: '' 
        }));
        setAvailableQty(0);
        return;  
    }
    
    if (name === 'toLocationId' && value) {
        loadBins(value, setToBins);
        setFormData(prev => ({ 
        ...prev, 
        toLocationId: value,
        toBinId: ''  
        }));
        return;  
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    const checkProductId = name === 'productId' ? value : formData.productId;
    const checkFromBinId = name === 'fromBinId' ? value : formData.fromBinId;
    
    if (checkProductId && checkFromBinId) {
        checkAvailableQty(checkProductId, checkFromBinId);
    } else if (name === 'productId' || name === 'fromBinId') {
        setAvailableQty(0);
    }
};

    const checkAvailableQty = async (productId, binId) => {
    try {
        console.log('Checking qty for product:', productId, 'bin:', binId); // DEBUG
        const { data } = await axios.get(`${API}/stock/check/${productId}/${binId}`);
        console.log('Available qty:', data.qty); // DEBUG
        setAvailableQty(data.qty || 0);
    } catch (e) {
        console.error('Failed to check available qty:', e); // DEBUG
        console.error('Response:', e.response?.data); // DEBUG
        setAvailableQty(0);
        window.showNotification?.('Failed to check available stock', 'error');
    }
    };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.fromBinId === formData.toBinId) {
      window.showNotification?.('Cannot transfer to the same bin', 'error');
      return;
    }
    
    if (Number(formData.qty) > availableQty) {
      window.showNotification?.(`Only ${availableQty} units available`, 'error');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/transactions/transfer`, {
        productId: Number(formData.productId),
        fromBinId: Number(formData.fromBinId),
        toBinId: Number(formData.toBinId),
        qty: Number(formData.qty),
        reference: formData.reference,
        user: user.name
      });
      
      window.showNotification?.('Stock transferred successfully', 'success');
      if (onUpdate) onUpdate();
      onClose();
    } catch (e) {
      window.showNotification?.(e.response?.data?.error || 'Transfer failed', 'error');
    } finally {
      setLoading(false);
    }
  };

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
          <h2 style={{ margin: 0, color: '#f0f4f8' }}>Transfer Stock</h2>
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

        {/* Form */}
        <div style={{ padding: '24px' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: '#c5cdd8',
                fontSize: '12px',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                Product *
              </label>
              <select
                name="productId"
                value={formData.productId}
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
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  From Location *
                </label>
                <select
                  name="fromLocationId"
                  value={formData.fromLocationId}
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
                  <option value="">Select location...</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  To Location *
                </label>
                <select
                  name="toLocationId"
                  value={formData.toLocationId}
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
                  <option value="">Select location...</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  From Bin *
                </label>
                <select
                  name="fromBinId"
                  value={formData.fromBinId}
                  onChange={handleChange}
                  required
                  disabled={!formData.fromLocationId}
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
                    opacity: formData.fromLocationId ? 1 : 0.5
                  }}
                >
                  <option value="">Select bin...</option>
                  {fromBins.map(b => (
                    <option key={b.id} value={b.id}>{b.code}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  color: '#c5cdd8',
                  fontSize: '12px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  To Bin *
                </label>
                <select
                  name="toBinId"
                  value={formData.toBinId}
                  onChange={handleChange}
                  required
                  disabled={!formData.toLocationId}
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
                    opacity: formData.toLocationId ? 1 : 0.5
                  }}
                >
                  <option value="">Select bin...</option>
                  {toBins.map(b => (
                    <option key={b.id} value={b.id}>{b.code}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: '#c5cdd8',
                fontSize: '12px',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                Quantity * {availableQty > 0 && <span style={{color: '#8b95a8'}}>({availableQty} available)</span>}
              </label>
              <input
                type="number"
                name="qty"
                value={formData.qty}
                onChange={handleChange}
                required
                min="1"
                max={availableQty > 0 ? availableQty : undefined}
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

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                color: '#c5cdd8',
                fontSize: '12px',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                Reference (optional)
              </label>
              <input
                type="text"
                name="reference"
                value={formData.reference}
                onChange={handleChange}
                placeholder="Transfer reason or reference"
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
              {loading ? 'Transferring...' : 'Transfer Stock'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}