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
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      padding: '40px 20px',
      overflowY: 'auto'
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        width: '100%',
        maxWidth: '440px',
        padding: '48px 40px',
        border: '1px solid #334155'
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
            color: '#f1f5f9',
            marginBottom: '8px'
          }}>OurHouse</h1>
          <p style={{
            margin: 0,
            color: '#94a3b8',
            fontSize: '14px'
          }}>Inventory Management System</p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '32px',
          background: '#0f172a',
          padding: '4px',
          borderRadius: '8px'
        }}>
          <button
            onClick={() => setIsLogin(true)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: '6px',
              background: isLogin ? '#3b82f6' : 'transparent',
              color: isLogin ? '#fff' : '#94a3b8',
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
              borderRadius: '6px',
              background: !isLogin ? '#3b82f6' : 'transparent',
              color: !isLogin ? '#fff' : '#94a3b8',
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
            background: '#7f1d1d',
            border: '1px solid #991b1b',
            color: '#fecaca',
            padding: '12px 16px',
            borderRadius: '8px',
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
                color: '#cbd5e1',
                fontSize: '14px',
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
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#cbd5e1',
              fontSize: '14px',
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
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '15px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
          </div>

          <div style={{ marginBottom: !isLogin ? '20px' : '24px' }}>
            <label style={{
              display: 'block',
              color: '#cbd5e1',
              fontSize: '14px',
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
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f1f5f9',
                fontSize: '15px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
          </div>

          {!isLogin && (
            <div style={{marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: '#cbd5e1',
                fontSize: '14px',
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
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
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
                color: '#cbd5e1',
                fontSize: '14px',
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
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
              <p style={{
                margin: '8px 0 0 0',
                fontSize: '12px',
                color: '#64748b'
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
              background: loading ? '#64748b' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              boxSizing: 'border-box',
              marginBottom: needsSecretCode ? 0 : '0'
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.background = '#2563eb';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.target.style.background = '#3b82f6';
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
          color: '#64748b'
        }}>
          {isLogin ? (
            <p style={{ margin: 0 }}>Need an account? <span
              onClick={() => setIsLogin(false)}
              style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}
            >Register here</span></p>
          ) : (
            <p style={{ margin: 0 }}>Already have an account? <span 
              onClick={() => setIsLogin(true)}
              style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}
            >Login here</span></p>
          )}
        </div>
      </div>
    </div>
  );
}