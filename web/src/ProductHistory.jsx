import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000';

export default function ProductHistory({ productId, productName, sku, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, [productId]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/products/${productId}/transactions`);
      setTransactions(data);
    } catch (e) {
      console.error(e);
      window.showNotification?.('Failed to load transaction history', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch(type) {
      case 'IN': return '📥';
      case 'OUT': return '📤';
      case 'MOVE': return '🔄';
      default: return '📝';
    }
  };

  const getTransactionColor = (type) => {
    switch(type) {
      case 'IN': return '#065f46';
      case 'OUT': return '#991b1b';
      case 'MOVE': return '#6b7280';
      default: return '#4b5563';
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        background: '#13171d',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        width: '100%',
        maxWidth: '800px',
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
            <h2 style={{ margin: 0, color: '#d1d5db' }}>Transaction History</h2>
            <p style={{ margin: '4px 0 0 0', color: '#9ca3af', fontSize: '14px' }}>
              {sku} - {productName}
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

        {/* Content */}
        <div style={{ 
          padding: '24px', 
          overflowY: 'auto',
          flex: 1
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
              No transactions found for this product
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {transactions.map(transaction => (
                <div
                  key={transaction.id}
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
                      background: getTransactionColor(transaction.type) + '30',
                      borderRadius: '6px',
                      width: '48px',
                      height: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {getTransactionIcon(transaction.type)}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          color: getTransactionColor(transaction.type),
                          fontWeight: '600',
                          fontSize: '14px'
                        }}
                      >
                        {transaction.type === 'IN' ? 'RECEIVED' : transaction.type === 'OUT' ? 'SHIPPED' : 'MOVED'}
                      </span>
                      <span style={{ color: '#6b7280', fontSize: '12px' }}>•</span>
                      <span style={{ color: '#d1d5db', fontSize: '14px', fontWeight: '600' }}>
                        {transaction.qty} units
                      </span>
                    </div>
                    
                    <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '4px' }}>
                      {transaction.type === 'MOVE' 
                        ? `From ${transaction.from_bin_code} to ${transaction.to_bin_code}`
                        : transaction.type === 'IN' 
                        ? `To bin ${transaction.to_bin_code}`
                        : `From bin ${transaction.from_bin_code}`
                      }
                      {transaction.reference && ` • Ref: ${transaction.reference}`}
                    </div>
                    
                    <div style={{ color: '#6b7280', fontSize: '12px' }}>
                      {formatDate(transaction.occurred_at)} • {transaction.performed_by}
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