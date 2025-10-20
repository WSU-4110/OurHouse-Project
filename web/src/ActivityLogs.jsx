import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000';

export default function ActivityLogs({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/admin/logs?limit=200`);
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    const colors = {
      'RECEIVE': '#6b7280',
      'SHIP': '#6b7280',
      'DELETE_PRODUCT': '#991b1b',
      'DELETE_LOCATION': '#991b1b',
      'DELETE_BIN': '#991b1b',
      'ADD_PRODUCT': '#374151',
      'ADD_LOCATION': '#374151',
      'ADD_BIN': '#374151'
    };
    return colors[action] || '#4b5563';
  };

  const getActionIcon = (action) => {
    const icons = {
      'RECEIVE': '📥',
      'SHIP': '📤',
      'DELETE_PRODUCT': '🗑️',
      'DELETE_LOCATION': '🗑️',
      'DELETE_BIN': '🗑️',
      'ADD_PRODUCT': '➕',
      'ADD_LOCATION': '➕',
      'ADD_BIN': '➕'
    };
    return icons[action] || '📝';
  };

  const formatDetails = (action, details) => {
    try {
      const data = typeof details === 'string' ? JSON.parse(details) : details;
      
      switch(action) {
        case 'RECEIVE':
        case 'SHIP':
          return `Product ID: ${data.productId}, Bin ID: ${data.binId}, Qty: ${data.qty}${data.reference ? `, Ref: ${data.reference}` : ''}`;
        
        case 'DELETE_PRODUCT':
          return `Deleted: ${data.sku} - ${data.name}`;
        
        case 'DELETE_LOCATION':
          return `Deleted location: ${data.name}`;
        
        case 'DELETE_BIN':
          return `Deleted bin: ${data.code} in ${data.location_name}`;
        
        default:
          return JSON.stringify(data);
      }
    } catch (e) {
      return String(details);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.action_type.includes(filter.toUpperCase()));

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
        maxWidth: '1000px',
        maxHeight: '90vh',
        overflow: 'hidden',
        border: '1px solid #262b34',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #262b34',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#d1d5db' }}>Activity Logs</h2>
            <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '14px' }}>
              Showing {filteredLogs.length} of {logs.length} activities
            </p>
          </div>
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

        {/* Filter */}
        <div style={{
          padding: '16px 24px',
          background: '#0d1117',
          borderBottom: '1px solid #262b34',
          display: 'flex',
          gap: '8px'
        }}>
          {['all', 'receive', 'ship', 'delete'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '8px 16px',
                border: '1px solid #262b34',
                borderRadius: '6px',
                background: filter === f ? '#374151' : 'transparent',
                color: filter === f ? '#e5e7eb' : '#9ca3af',
                cursor: 'pointer',
                fontSize: '14px',
                textTransform: 'capitalize',
                fontWeight: '600'
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ 
          padding: '24px', 
          overflowY: 'auto',
          flex: 1
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
              Loading logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
              No activity logs found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredLogs.map(log => (
                <div
                  key={log.id}
                  style={{
                    background: '#0d1117',
                    border: '1px solid #262b34',
                    borderRadius: '6px',
                    padding: '16px',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start'
                  }}
                >
                  <div
                    style={{
                      fontSize: '24px',
                      background: getActionColor(log.action_type) + '30',
                      borderRadius: '6px',
                      width: '48px',
                      height: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {getActionIcon(log.action_type)}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          color: getActionColor(log.action_type),
                          fontWeight: '600',
                          fontSize: '14px'
                        }}
                      >
                        {log.action_type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>•</span>
                      <span style={{ color: '#d1d5db', fontSize: '14px' }}>
                        {log.user_name}
                      </span>
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>
                        ({log.user_role})
                      </span>
                    </div>
                    
                    <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '4px' }}>
                      {formatDetails(log.action_type, log.details)}
                    </div>
                    
                    <div style={{ color: '#6b7280', fontSize: '12px' }}>
                      {formatDate(log.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}