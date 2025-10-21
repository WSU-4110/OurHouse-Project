import { useState, useEffect } from 'react';
import axios from 'axios';

const API = 'http://localhost:3000';

export default function ProductHistory({ productId, productName, sku, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  const exportToCSV = () => {
    const dataToExport = filteredTransactions.length > 0 ? filteredTransactions : transactions;
    
    if (dataToExport.length === 0) {
      window.showNotification?.('No transactions to export', 'error');
      return;
    }

    const headers = ['Date/Time', 'Type', 'Quantity', 'Location Details', 'Reference', 'User'];
    
    const rows = dataToExport.map(t => {
      const date = new Date(t.occurred_at).toLocaleString('en-US');
      const type = t.type === 'IN' ? 'RECEIVED' : t.type === 'OUT' ? 'SHIPPED' : 'MOVED';
      const qty = t.qty;
      const location = t.type === 'MOVE' 
        ? `From ${t.from_bin_code} to ${t.to_bin_code}`
        : t.type === 'IN' 
        ? `To bin ${t.to_bin_code}`
        : `From bin ${t.from_bin_code}`;
      const reference = t.reference || '';
      const user = t.performed_by;
      
      return [date, type, qty, location, reference, user];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${sku}_${productName}_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.showNotification?.('Transaction history exported successfully', 'success');
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

  const getFilteredTransactions = () => {
    if (!startDate && !endDate) {
      return transactions;
    }

    return transactions.filter(t => {
      const transactionDate = new Date(t.occurred_at);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;

      if (start && end) {
        return transactionDate >= start && transactionDate <= end;
      } else if (start) {
        return transactionDate >= start;
      } else if (end) {
        return transactionDate <= end;
      }
      return true;
    });
  };

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const filteredTransactions = getFilteredTransactions();

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
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={exportToCSV}
              disabled={loading || transactions.length === 0}
              style={{
                background: '#374151',
                color: '#e5e7eb',
                padding: '8px 16px',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                cursor: loading || transactions.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                opacity: loading || transactions.length === 0 ? 0.5 : 1
              }}
            >
              📥 Export CSV
            </button>
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
        </div>

        <div style={{
          padding: '16px 24px',
          background: '#0d1117',
          borderBottom: '1px solid #262b34',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span style={{ color: '#9ca3af', fontSize: '14px', fontWeight: '600' }}>
            Filter by Date:
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              background: '#13171d',
              border: '1px solid #262b34',
              color: '#d1d5db',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="Start date"
          />
          <span style={{ color: '#6b7280' }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              background: '#13171d',
              border: '1px solid #262b34',
              color: '#d1d5db',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '14px'
            }}
            placeholder="End date"
          />
          {(startDate || endDate) && (
            <button
              onClick={clearDateFilters}
              style={{
                background: '#374151',
                color: '#e5e7eb',
                padding: '6px 12px',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Clear
            </button>
          )}
          <span style={{ color: '#6b7280', fontSize: '13px', marginLeft: 'auto' }}>
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </span>
        </div>

        <div style={{ 
          padding: '24px', 
          overflowY: 'auto',
          flex: 1
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
              Loading transactions...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
              {transactions.length === 0 
                ? 'No transactions found for this product'
                : 'No transactions match the selected date range'
              }
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredTransactions.map(transaction => (
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