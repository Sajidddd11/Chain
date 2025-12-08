import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const { login, register } = useAuth();
  const [formState, setFormState] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    location: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'user' | 'admin' | 'register'>('user');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (loginMode === 'register') {
        await register({
          fullName: formState.fullName || formState.email.split('@')[0] || 'New User',
          email: formState.email,
          password: formState.password,
          phone: formState.phone || '+8801000000000',
          location: formState.location || null,
        });
      } else {
        await login(formState.email, formState.password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const isAdminMode = loginMode === 'admin';
  const isRegisterMode = loginMode === 'register';

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{
        maxWidth: '450px',
        boxShadow: '0 20px 40px rgba(31, 122, 77, 0.15)',
        border: '1px solid rgba(31, 122, 77, 0.1)',
        position: 'relative'
      }}>
        {/* Login Mode Toggle */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '25px',
          padding: '4px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(0, 0, 0, 0.05)'
        }}>
          {(['user', 'register', 'admin'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setLoginMode(mode)}
              style={{
                padding: '8px 20px',
                borderRadius: '20px',
                border: 'none',
                backgroundColor: loginMode === mode ? '#1f7a4d' : 'transparent',
                color: loginMode === mode ? 'white' : '#6b7280',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '80px',
                textTransform: 'capitalize',
              }}
              onMouseEnter={(e) => {
                if (loginMode !== mode) (e.target as HTMLElement).style.backgroundColor = 'rgba(31, 122, 77, 0.1)';
              }}
              onMouseLeave={(e) => {
                if (loginMode !== mode) (e.target as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              {mode === 'register' ? 'Register' : mode === 'user' ? 'User' : 'Admin'}
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem', marginTop: '1rem' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#1f7a4d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 16px rgba(31, 122, 77, 0.2)',
            padding: '12px'
          }}>
            <img
              src="/green bg white fill.svg"
              alt="Chain Logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
              onError={(e) => {
                console.error('Failed to load logo:', e);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h2 style={{
            margin: '0 0 0.5rem',
            color: '#1f7a4d',
            fontSize: '1.8rem',
            fontWeight: '700'
          }}>
            {isRegisterMode
              ? 'Create an account'
              : isAdminMode
                ? 'Admin Dashboard'
                : 'Food Management'}
          </h2>
          <p style={{
            margin: 0,
            color: 'rgba(0,0,0,0.6)',
            fontSize: '1rem'
          }}>
            {isRegisterMode
              ? 'Join Chain to manage your household pantry'
              : isAdminMode
                ? 'Sign in to access the store admin dashboard'
                : 'Sign in to manage your food inventory and resources'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.25rem' }}>
          {isRegisterMode && (
            <>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Full name
                </label>
                <input
                  required
                  placeholder="Enter your full name"
                  type="text"
                  value={formState.fullName}
                  onChange={(e) => setFormState((prev) => ({ ...prev, fullName: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    fontSize: '1rem',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1f7a4d'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Phone
                </label>
                <input
                  placeholder="+8801XXXXXXXXX"
                  type="tel"
                  value={formState.phone}
                  onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    fontSize: '1rem',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1f7a4d'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Location (optional)
                </label>
                <input
                  placeholder="City, Area"
                  type="text"
                  value={formState.location}
                  onChange={(e) => setFormState((prev) => ({ ...prev, location: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    fontSize: '1rem',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#1f7a4d'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
            </>
          )}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Email Address
            </label>
            <input
              required
              placeholder={isAdminMode ? "Enter admin email" : "Enter your email address"}
              type="email"
              value={formState.email}
              onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                borderRadius: '8px',
                border: '2px solid #e5e7eb',
                fontSize: '1rem',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#1f7a4d'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Password
            </label>
            <input
              required
              placeholder="Enter your password"
              type="password"
              value={formState.password}
              onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                borderRadius: '8px',
                border: '2px solid #e5e7eb',
                fontSize: '1rem',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#1f7a4d'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}>
              {error}
            </div>
          )}

          <button
            className="primary-btn"
            type="submit"
            disabled={loading}
            style={{
              padding: '0.875rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: loading ? '#9ca3af' : '#1f7a4d',
              color: 'white',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              marginTop: '0.5rem'
            }}
            onMouseEnter={(e) => !loading && ((e.target as HTMLElement).style.backgroundColor = '#166534')}
            onMouseLeave={(e) => !loading && ((e.target as HTMLElement).style.backgroundColor = '#1f7a4d')}
          >
            {loading
              ? 'Please wait…'
              : isRegisterMode
                ? 'Create account'
                : `Sign In${isAdminMode ? ' to Dashboard' : ''}`}
          </button>
        </form>

        {/* Demo Credentials */}
        {isAdminMode && (
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: 'rgba(31, 122, 77, 0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(31, 122, 77, 0.1)'
          }}>
            <p style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#1f7a4d'
            }}>
              Admin Access
            </p>
            <p style={{
              margin: 0,
              fontSize: '0.8rem',
              color: '#6b7280',
              fontFamily: 'monospace'
            }}>
              Please contact your administrator for login credentials.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

