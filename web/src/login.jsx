import { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'Worker',
    secretCode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const API = 'http://localhost:3000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
if (onLogin) {
  onLogin(data.user, data.token);
}
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

   const needsSecretCode = !isLogin && (formData.role === 'Admin' || formData.role === 'Manager');

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0e13',
      padding: '40px 20px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: '#13171d',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        width: '100%',
        maxWidth: '440px',
        padding: '48px 40px',
        border: '1px solid #262b34'
      }}>
        {/* Logo/Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '8px'
          }}> 
          </div>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: '700',
            color: '#d1d5db',
            marginBottom: '8px'
          }}>OurHouse</h1>
          <p style={{
            margin: 0,
            color: '#9ca3af',
            fontSize: '14px'
          }}>Inventory Management System</p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '32px',
          background: '#0d1117',
          padding: '4px',
          borderRadius: '6px'
        }}>
          <button
            onClick={() => setIsLogin(true)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '4px',
              background: isLogin ? '#374151' : 'transparent',
              color: isLogin ? '#e5e7eb' : '#9ca3af',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '4px',
              background: !isLogin ? '#374151' : 'transparent',
              color: !isLogin ? '#e5e7eb' : '#9ca3af',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            Register
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#1a1414',
            border: '1px solid #3a1c1c',
            color: '#fca5a5',
            padding: '12px 16px',
            borderRadius: '6px',
            marginBottom: '24px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: '#9ca3af',
                fontSize: '12px',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
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
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6b7280'}
                onBlur={(e) => e.target.style.borderColor = '#262b34'}
              />
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#9ca3af',
              fontSize: '12px',
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
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
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6b7280'}
              onBlur={(e) => e.target.style.borderColor = '#262b34'}
            />
          </div>

          <div style={{ marginBottom: !isLogin ? '20px' : '24px' }}>
            <label style={{
              display: 'block',
              color: '#9ca3af',
              fontSize: '12px',
              fontWeight: '500',
              marginBottom: '8px'
            }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#0d1117',
                border: '1px solid #262b34',
                borderRadius: '6px',
                color: '#d1d5db',
                fontSize: '15px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6b7280'}
              onBlur={(e) => e.target.style.borderColor = '#262b34'}
            />
          </div>

          {!isLogin && (
            <div style={{marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: '#9ca3af',
                fontSize: '12px',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                Role
              </label>
              <select
                name="role"
                value={formData.role}
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
                <option value="Viewer">Viewer</option>
                <option value="Worker">Worker</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          )}

          {needsSecretCode && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                color: '#9ca3af',
                fontSize: '12px',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                Secret Code {formData.role === 'Admin' ? '(Admin)' : '(Manager)'}
              </label>
              <input
                type="password"
                name="secretCode"
                value={formData.secretCode}
                onChange={handleChange}
                required
                placeholder="Enter secret code"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#0d1117',
                  border: '1px solid #262b34',
                  borderRadius: '6px',
                  color: '#d1d5db',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#6b7280'}
                onBlur={(e) => e.target.style.borderColor = '#262b34'}
              />
              <p style={{
                margin: '8px 0 0 0',
                fontSize: '12px',
                color: '#6b7280'
              }}>
                Contact your administrator for the secret code
              </p>
            </div>
          )}

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
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              boxSizing: 'border-box',
              marginBottom: needsSecretCode ? 0 : '0'
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.background = '#4b5563';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.target.style.background = '#374151';
            }}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#6b7280'
        }}>
          {isLogin ? (
            <p style={{ margin: 0 }}>Need an account? <span
              onClick={() => setIsLogin(false)}
              style={{ color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}
            >Register here</span></p>
          ) : (
            <p style={{ margin: 0 }}>Already have an account? <span 
              onClick={() => setIsLogin(true)}
              style={{ color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}
            >Login here</span></p>
          )}
        </div>
      </div>
    </div>
  );
}