import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import DarkModeToggle from '../../components/DarkModeToggle';
import { resetPassword } from '../../services/adminAuthService';

const AdminResetPasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const token = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get('token') || '';
  }, [location.search]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Reset token is missing. Please request a new password reset link.');
    }
  }, [token]);

  const passwordsMatch = newPassword === confirmPassword;
  const isFormValid = Boolean(token) && newPassword.length >= 8 && passwordsMatch;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await resetPassword(token, newPassword);
      setSuccess('Password updated. Please login again.');
      setTimeout(() => {
        navigate('/admin/login', { replace: true });
      }, 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reset password. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-coffee-100 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <DarkModeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-coffee-200 bg-white px-8 py-10 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-espresso-900 dark:text-white">Reset Password</h1>
            <p className="mt-2 text-sm text-espresso-600 dark:text-gray-300">
              Enter a new password for your administrator account.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200" role="alert" aria-live="assertive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200" role="status" aria-live="polite">
              <CheckCircle2 className="h-5 w-5" />
              <span>{success}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-espresso-700 dark:text-gray-300">
                New Password
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-coffee-400 dark:text-gray-400" />
                </div>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    if (error) setError(null);
                    if (success) setSuccess(null);
                  }}
                  className="block w-full rounded-lg border border-coffee-300 bg-white py-2 pl-11 pr-3 text-gray-900 shadow-sm placeholder:text-espresso-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                  placeholder="Enter new password"
                />
              </div>
              <p className="mt-2 text-xs text-espresso-500 dark:text-gray-400">Must be at least 8 characters.</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-espresso-700 dark:text-gray-300">
                Confirm Password
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-coffee-400 dark:text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    if (error) setError(null);
                    if (success) setSuccess(null);
                  }}
                  className="block w-full rounded-lg border border-coffee-300 bg-white py-2 pl-11 pr-3 text-gray-900 shadow-sm placeholder:text-espresso-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                  placeholder="Confirm new password"
                />
              </div>
              {!passwordsMatch && confirmPassword.length > 0 && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">Passwords do not match.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="group relative flex w-full items-center justify-center gap-2 rounded-full bg-[#c81e36] px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#b2182e] focus:outline-none focus:ring-2 focus:ring-[#b2182e] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Updating...' : 'Reset Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminResetPasswordPage;
