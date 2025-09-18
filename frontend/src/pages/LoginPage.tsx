import React, { useState, useEffect } from 'react';
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { adminAuthService, authService, discoverApi } from '../services/api';
import { AlertCircle, Leaf, Lock, User, ArrowRight } from 'lucide-react';
import DarkModeToggle from '../components/DarkModeToggle';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If there appears to be an authenticated session, verify the token with the backend
  // before performing an automatic redirect. This avoids silently granting access when
  // a stale or unverified token exists in localStorage. Clicking Admin Login will now
  // show the credentials form until the token is verified.
  const navigate = useNavigate();
  const [verifyingToken, setVerifyingToken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function verifyIfNeeded() {
      if (!isAuthenticated) return;
      // read stored user to check for admin role quickly
      let storedUser: any = null;
      try { storedUser = JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { storedUser = null; }
      const isAdmin = storedUser && storedUser.role === 'admin';
      if (!isAdmin) return; // allow form to be shown if not admin

      // Only auto-verify+redirect if the login page was reached due to a ProtectedRoute redirect
      // (ProtectedRoute sets location.state.from). If the user clicked "Admin Login" from the UI
      // we should always show the credential form instead of auto-navigating.
      const intendedFrom = (location.state as any)?.from?.pathname;
      if (!intendedFrom) return;

      setVerifyingToken(true);
      try {
        // verify token with backend; if successful, navigate to intended page
        const verifyResp = await authService.verify();
        if (cancelled) return;
        if (verifyResp && verifyResp.data && verifyResp.data.success && verifyResp.data.data && verifyResp.data.data.user && verifyResp.data.data.user.role === 'admin') {
          const from = intendedFrom || '/admin/dashboard';
          navigate(from, { replace: true });
        }
      } catch (e) {
        // Verification failed; fall through to show login form so admin can re-authenticate
        console.warn('LoginPage: token verify failed during auto-redirect, showing login form');
      } finally {
        if (!cancelled) setVerifyingToken(false);
      }
    }
    verifyIfNeeded();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Pre-flight: check backend health so we can present a clear offline message
      try {
        await api.get('/health', { timeout: 3000 });
      } catch (healthErr: any) {
        console.warn('LoginPage: health check failed', healthErr && (healthErr.message || healthErr));
        // Try discovery (probe common fallback ports) and switch if found
        let discovered = false;
        try {
          const d = await discoverApi({ timeout: 1500 });
          if (d.ok && d.baseURL) {
            console.log('LoginPage: discovered API at', d.baseURL);
            discovered = true;
            // continue and attempt login again using updated api.baseURL
          }
        } catch (e) {
          // ignore discovery failure
        }

        // If discovery didn't find anything, offer a local dev fallback for admin credentials
        if (!discovered) {
          const localUser = (process.env.REACT_APP_LOCAL_ADMIN_USER || 'admin');
          const localPass = (process.env.REACT_APP_LOCAL_ADMIN_PASS || 'admin');
          if (formData.username.trim() === localUser && formData.password === localPass) {
            // Create a local fake token + user and proceed
            const fakeToken = `local-dev-token-${Date.now()}`;
            const user = { id: 'local-admin', username: localUser, role: 'admin', local: true } as any;
            try {
              localStorage.setItem('adminToken', fakeToken);
              localStorage.setItem('token', fakeToken);
              localStorage.setItem('user', JSON.stringify(user));
              console.log('LoginPage: local fallback login applied');
              window.location.href = '/admin/dashboard';
              return;
            } catch (e) {
              console.warn('LoginPage: could not store local fallback token', e);
            }
          }
        }
        // If not handled, let the normal login attempt proceed (it will likely fail) and be handled below
      }

      // Prefer explicit admin login to the admin endpoint to keep UI and backend in sync
      console.log('LoginPage: calling adminAuthService.loginAdmin', { url: (process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000') + '/api/admin/login' });
      const result = await adminAuthService.loginAdmin(formData.username.trim(), formData.password);
      console.log('LoginPage: admin login result', result);
      if (!result.success) {
        setError(result.message || 'Invalid username or password');
        setFormData(prev => ({ ...prev, password: '' }));
        const el = document.getElementById('username') as HTMLInputElement | null;
        if (el) { el.focus(); el.select(); }
      } else {
        // Success - store token, fetch user via /auth/verify, then redirect to admin dashboard
        try {
          localStorage.setItem('adminToken', result.token);
          // Also set the main token key for compatibility with existing auth flows
          localStorage.setItem('token', result.token);
          (window as any).localStorage && console.log('LoginPage: token stored in localStorage (adminToken)');

          // If the login response included a user object (local fallback), use it directly
          if ((result as any).user) {
            try {
              localStorage.setItem('user', JSON.stringify((result as any).user));
              console.log('LoginPage: stored local fallback user');
            } catch (e) { /* ignore */ }
          } else {
            // Verify token and fetch user information so AuthContext can pick up authenticated user
            try {
              const verifyResp = await authService.verify();
              if (verifyResp?.data?.success && verifyResp.data.data?.user) {
                localStorage.setItem('user', JSON.stringify(verifyResp.data.data.user));
                console.log('LoginPage: verified admin token and stored user');
              } else {
                console.warn('LoginPage: token verify did not return user, proceeding to dashboard');
              }
            } catch (verifyErr) {
              // Non-fatal: if verify fails, still attempt to navigate — AuthContext will clear invalid tokens on load
              const msg = verifyErr && (verifyErr as any).message ? (verifyErr as any).message : String(verifyErr);
              console.warn('LoginPage: token verify failed after admin login', msg);
            } finally {
              // Debug: ensure token keys are present and log them
              try {
                console.log('LoginPage: tokens after storage -> token=', localStorage.getItem('token'), 'adminToken=', localStorage.getItem('adminToken'));
              } catch (e) {
                console.warn('LoginPage: failed to read localStorage for debug', e);
              }
            }
          }

          window.location.href = '/admin/dashboard';
        } catch (storeErr) {
          console.error('LoginPage: failed to store token', storeErr);
          setError('Internal error while saving session. Please try again.');
        }
      }
    } catch (err: any) {
      console.error('LoginPage: unexpected error during admin login', err);
      const serverMsg = (err && err.response && err.response.data && err.response.data.message) || err?.message || 'Unable to connect to server. Please try again.';
      const low = (serverMsg || '').toLowerCase();
      const networkKeywords = ['connect', 'network error', 'econnrefused', 'enotfound', 'etimedout', 'server offline', 'unable to reach'];
      const isNetwork = networkKeywords.some(k => low.includes(k));
      setError(isNetwork ? 'Server offline. Please check if the backend is running.' : serverMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.username.trim() && formData.password.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-coffee-100 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      {/* Verification overlay: shown when we are verifying an existing token before auto-redirect */}
      {verifyingToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            <div className="text-sm text-espresso-900 dark:text-white">Verifying session, please wait...</div>
          </div>
        </div>
      )}
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="absolute top-4 right-4">
              <DarkModeToggle />
            </div>
            <div className="bg-primary-600 dark:bg-primary-500 rounded-full p-3">
              <Leaf className="h-8 w-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-espresso-900 dark:text-white">
            BeanToBin
          </h2>
          <p className="mt-2 text-sm text-espresso-600 dark:text-gray-300">
            Admin Sign In - Environmental Monitoring System
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-coffee-200 dark:border-gray-600 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Error Message */}
            {error && (
              <div role="alert" aria-live="assertive" className="bg-danger-50 dark:bg-red-900/30 border border-danger-200 dark:border-red-700 rounded-md p-4 flex items-center">
                <AlertCircle className="h-5 w-5 text-danger-400 dark:text-red-400 mr-3" />
                <span className="text-danger-700 dark:text-red-400 text-sm">{error}</span>
              </div>
            )}

            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-espresso-700 dark:text-gray-300">
                Username
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-coffee-400 dark:text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-coffee-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-espresso-400 dark:placeholder-gray-400 focus:outline-none focus:placeholder-espresso-300 dark:focus:placeholder-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-espresso-700 dark:text-gray-300">
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-coffee-400 dark:text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-2 border border-coffee-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-espresso-400 dark:placeholder-gray-400 focus:outline-none focus:placeholder-espresso-300 dark:focus:placeholder-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting || isLoading}
                className="group relative w-full flex justify-center items-center py-3 px-6 border border-transparent text-sm font-semibold rounded-full text-white bg-[#c81e36] hover:bg-[#b2182e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#b2182e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isSubmitting || isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    <span>Sign in</span>
                  </>
                )}
              </button>
              <div className="mt-2 flex justify-between">
                <button type="button" onClick={async () => {
                  setError('');
                  try {
                    const d = await discoverApi({ timeout: 1500 });
                    if (d.ok) setError(`Backend reachable at ${d.baseURL}`);
                    else setError('No reachable backend found on common ports.');
                  } catch (e:any) { setError('Error checking backend: ' + (e && e.message ? e.message : String(e))); }
                }} className="text-sm text-gray-600 underline">Check backend</button>
                <div className="text-xs text-gray-400">If offline, start backend on port 5000/8000</div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-espresso-500 dark:text-gray-400">
          © 2025 BeanToBin
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
