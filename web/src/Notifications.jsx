import { useState, useEffect } from 'react';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    const notification = { id, message, type };
    setNotifications(prev => [...prev, notification]);
    
    //auto removes after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  //exposes globally
  useEffect(() => {
    window.showNotification = addNotification;
  }, []);

  const getNotificationStyle = (type) => {
    const base = {
      padding: '12px 16px',
      borderRadius: '6px',
      marginBottom: '8px',
      fontSize: '14px',
      fontWeight: '500',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      animation: 'slideIn 0.3s ease'
    };

    switch (type) {
      case 'error':
        return { ...base, background: '#1a1414', border: '1px solid #3a1c1c', color: '#fca5a5' };
      case 'success':
        return { ...base, background: '#0f1e17', border: '1px solid #1a3a2a', color: '#86efac' };
      case 'warning':
        return { ...base, background: '#1a1508', border: '1px solid #3a2f0a', color: '#fcd34d' };
      default:
        return { ...base, background: '#0d1117', border: '1px solid #262b34', color: '#9ca3af' };
    }
  };

  if (notifications.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 2000,
        width: '350px',
        maxWidth: 'calc(100vw - 40px)'
      }}>
        {notifications.map(notification => (
          <div key={notification.id} style={getNotificationStyle(notification.type)}>
            <span>{notification.message}</span>
            <button
              onClick={() => removeNotification(notification.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0 0 0 10px'
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}