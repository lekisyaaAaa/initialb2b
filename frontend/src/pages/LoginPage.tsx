import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminAuthService } from '../services/api';
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

  // Redirect if already authenticated and user is admin.
  // If the user is authenticated but not an admin, don't silently redirect to admin dashboard.
  // This ensures clicking Admin Access always prompts for admin credentials unless the current user
  // has the admin role.
  if (isAuthenticated) {
    // read user from localStorage to avoid extra hook dependencies; AuthContext keeps this in sync
    let storedUser: any = null;
    try { storedUser = JSON.parse(localStorage.getItem('user') || 'null'); } catch(e) { storedUser = null; }
    const isAdmin = storedUser && storedUser.role === 'admin';
    if (isAdmin) {
  // ProtectedRoute uses location.state.from when redirecting to login.
  // Default to '/admin/dashboard' so users land on the dashboard after successful login.
  const from = (location.state as any)?.from?.pathname || '/admin/dashboard';
      return <Navigate to={from} replace />;
    }
    // If authenticated but not admin, fall through to show the login form so admin credentials can be supplied.
  }

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
        // Success - store token and redirect to admin dashboard
        try {
          localStorage.setItem('adminToken', result.token);
          // Also set Authorization header for api instance so subsequent calls work
          localStorage.setItem('token', result.token);
          (window as any).localStorage && console.log('LoginPage: token stored in localStorage (adminToken)');
          window.location.href = '/admin/dashboard';
        } catch (storeErr) {
          console.error('LoginPage: failed to store token', storeErr);
          setError('Internal error while saving session. Please try again.');
        }
      }
    } catch (err: any) {
      console.error('LoginPage: unexpected error during admin login', err);
      const serverMsg = (err && err.response && err.response.data && err.response.data.message) || err?.message || 'Unable to connect to server. Please try again.';
      setError(serverMsg.includes('connect') ? 'Unable to connect to server. Please try again.' : serverMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.username.trim() && formData.password.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-coffee-100 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
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
