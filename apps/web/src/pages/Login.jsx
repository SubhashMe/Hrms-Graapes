import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, ApiError } from '../services/api.js';
import { dashboardForRole } from '../auth/AuthGuard.jsx';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
} from 'lucide-react';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user } = await api('/auth/login', { method: 'POST', body: { email: formData.email, password: formData.password } });
      navigate(location.state?.from || dashboardForRole(user.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <main className="login-page">
      <div className="login-decoration decoration-one" />
      <div className="login-decoration decoration-two" />
      <div className="login-decoration decoration-three" />

      <div className="login-layout">
        {/* LEFT WELCOME SECTION */}
        <section className="login-welcome">
          <div className="company-brand">
            <img
              src="/graapes-logo-transparent.png"
              alt="Graapes Private Limited"
              className="company-logo"
            />
          </div>

          <div className="welcome-content">
            <p className="welcome-eyebrow">
              A SPACE OF YOUR OWN
            </p>

            <h1>
              Good to
              <br />
              have you
              <br />
              <span>back.</span>
            </h1>

            <p className="welcome-description">
              Your people. Your workplace.
              <br />
              One platform.
            </p>
          </div>

          <div className="welcome-footer">
            <strong>Graapes Private Limited</strong>
            <span>Human Resource Management System</span>
          </div>
        </section>

        {/* RIGHT LOGIN FORM */}
        <section className="login-form-section">
          <div className="login-card">
            <div className="login-card-accent" />

            <div className="login-heading">
              <p className="login-label">ACCOUNT ACCESS</p>
              <h2>Welcome back</h2>
              <p className="login-subtitle">
                Sign in to continue to your account.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="form-group">
                <label htmlFor="email">
                  Email address / Employee ID
                </label>

                <div className="input-wrapper">
                  <Mail size={19} />

                  <input
                    id="email"
                    name="email"
                    type="text"
                    placeholder="Enter email or employee ID"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>

                <div className="input-wrapper">
                  <LockKeyhole size={19} />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              <div className="login-options">
                <label className="remember-option">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  className="forgot-password"
                  onClick={() =>
                    alert(
                      'Please contact your HR administrator to reset your password.'
                    )
                  }
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="sign-in-button" disabled={busy}>
                <span>{busy ? 'Signing in…' : 'Sign in'}</span>
                {!busy && <ArrowRight size={19} />}
              </button>
            </form>

            <div className="login-bottom">
              <span className="bottom-line" />
              <p>Secure access to your workplace</p>
              <span className="bottom-line" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}