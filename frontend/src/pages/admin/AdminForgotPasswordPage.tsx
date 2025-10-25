import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import DarkModeToggle from '../../components/DarkModeToggle';
import { forgotPassword } from '../../services/adminAuthService';

const AdminForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = useMemo(() => {
    const state = (location.state as { email?: string }) || {};
    return state.email || '';
  }, [location.state]);

  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isFormValid = email.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await forgotPassword(email);
      setSuccess('A password reset link has been sent to your email.');
      setEmail('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send reset link. Please try again later.';
      setError(message);
    } finally {
      setIsSubmitting(false);
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
            <h1 className="text-3xl font-bold text-espresso-900 dark:text-white">Forgot Password</h1>
            <p className="mt-2 text-sm text-espresso-600 dark:text-gray-300">
              Enter your administrator email to receive a password reset link.
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
              <label htmlFor="email" className="block text-sm font-medium text-espresso-700 dark:text-gray-300">
                Email
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-coffee-400 dark:text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError(null);
                    if (success) setSuccess(null);
                  }}
                  className="block w-full rounded-lg border border-coffee-300 bg-white py-2 pl-11 pr-3 text-gray-900 shadow-sm placeholder:text-espresso-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="group relative flex w-full items-center justify-center gap-2 rounded-full bg-[#c81e36] px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#b2182e] focus:outline-none focus:ring-2 focus:ring-[#b2182e] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/admin/login')}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminForgotPasswordPage;
