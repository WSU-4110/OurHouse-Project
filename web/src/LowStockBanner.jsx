import { useState, useEffect } from 'react';
import axios from 'axios';

const LowStockBanner = () => {
    const [lowStockItems, setLowStockItems] = useState([]);
    const [isDismissed, setIsDismissed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLowStockItems = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await axios.get('http://localhost:3000/stock/low-stock', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.data.success) setLowStockItems(response.data.lowStockItems);
            } catch (error) {
                console.error('Error fetching low-stock items:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLowStockItems();
    }, []);

    const handleDismiss = () => setIsDismissed(true);

    if (isDismissed || isLoading || lowStockItems.length === 0) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                backgroundColor: '#dc2626',
                color: 'white',
                padding: '16px 20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                borderBottom: '1px solid rgba(255,255,255,0.15)',
            }}
        >
            <button
                onClick={handleDismiss}
                style={{
                    position: 'absolute',
                    top: '12px',
                    right: '16px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: 'white',
                    fontSize: '20px',
                    cursor: 'pointer',
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                }}
                title="Dismiss"
            >
                ×
            </button>

            <div style={{ maxWidth: 1200, margin: '0 auto', paddingRight: '40px' }}>
                <h3
                    style={{
                        margin: '0 0 12px 0',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}
                >
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    Low Stock Alert — {lowStockItems.length}{' '}
                    {lowStockItems.length === 1 ? 'Item' : 'Items'} Below Threshold
                </h3>

                <div
                    style={{
                        display: 'grid',
                        gap: '8px',
                        maxHeight: '160px',
                        overflowY: 'auto',
                        paddingRight: '10px',
                    }}
                >
                    {lowStockItems.map((item, index) => (
                        <div
                            key={index}
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                padding: '10px 12px',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '14px',
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <strong>{item.sku}</strong> — {item.product_name}
                                <span
                                    style={{
                                        marginLeft: '12px',
                                        opacity: 0.9,
                                        fontSize: '13px',
                                    }}
                                >
                                    📍 {item.location_name} / {item.bin_code}
                                </span>
                            </div>
                            <div
                                style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    minWidth: '60px',
                                    textAlign: 'center',
                                }}
                            >
                                Qty: {parseFloat(item.qty).toFixed(0)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LowStockBanner;
