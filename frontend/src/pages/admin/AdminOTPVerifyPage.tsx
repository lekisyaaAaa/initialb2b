import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, KeyRound } from 'lucide-react';
import DarkModeToggle from '../../components/DarkModeToggle';
import { useAuth } from '../../contexts/AuthContext';
import { resendOtp, verifyOtp } from '../../services/adminAuthService';

interface LocationState {
  email?: string;
  debugCode?: string | null;
  delivery?: string | null;
}

const AdminOTPVerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuth();
  const locationState = (location.state as LocationState) || {};
  const [email] = useState<string>(locationState.email || '');
  const [debugCode, setDebugCode] = useState<string | null>(locationState.debugCode ?? null);
  const [delivery, setDelivery] = useState<string | null>(locationState.delivery ?? null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const formattedEmail = useMemo(() => email.trim(), [email]);

  useEffect(() => {
    if (!formattedEmail) {
      navigate('/admin/login', { replace: true });
    }
  }, [formattedEmail, navigate]);

  const isFormValid = otp.trim().length === 6 && /^\d{6}$/.test(otp.trim());

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid || isSubmitting || !formattedEmail) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await verifyOtp(formattedEmail, otp.trim());
      const token = response?.data?.token;

      if (!token) {
        setError('Unexpected response from the server.');
        return;
      }

      const user = response?.data?.user || null;

      if (typeof setAuth === 'function') {
        if (user) {
          setAuth(token, user);
        } else {
          setAuth(token);
        }
      }

      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }

      localStorage.setItem('adminToken', token);
      localStorage.setItem('token', token);

      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to verify the code. Please try again.';
      setError(message);
      setOtp('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!formattedEmail || isResending) {
      return;
    }

    setError(null);
    setInfoMessage(null);
    setIsResending(true);

    try {
      const response = await resendOtp(formattedEmail);
      const nextDebug = response?.data?.debugCode ?? null;
      const nextDelivery = response?.data?.delivery ?? null;

      setDebugCode(nextDebug);
      setDelivery(nextDelivery);

      if (response?.message) {
        setInfoMessage(response.message);
      } else {
        setInfoMessage('A new verification code has been issued.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to resend the code. Please try again.';
      setError(message);
    } finally {
      setIsResending(false);
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
            <h1 className="text-3xl font-bold text-espresso-900 dark:text-white">Verify OTP</h1>
            <p className="mt-2 text-sm text-espresso-600 dark:text-gray-300">
              Enter the 6-digit code we sent to {formattedEmail || 'your email'}.
            </p>
            {debugCode && (
              <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">
                Email delivery failed in development; use debug code <span className="font-mono">{debugCode}</span> shown here.
              </p>
            )}
            {delivery === 'email_failed' && !debugCode && (
              <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">
                Email delivery failed. Check the backend logs for the one-time code.
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
            >
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && !error && (
            <div
              role="status"
              aria-live="polite"
              className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200"
            >
              {infoMessage}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-espresso-700 dark:text-gray-300">
                One-Time Passcode
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <KeyRound className="h-5 w-5 text-coffee-400 dark:text-gray-400" />
                </div>
                <input
                  id="otp"
                  name="otp"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoFocus
                  required
                  value={otp}
                  onChange={(event) => {
                    const value = event.target.value.replace(/[^0-9]/g, '');
                    setOtp(value);
                    if (error) setError(null);
                  }}
                  className="block w-full rounded-lg border border-coffee-300 bg-white py-2 pl-11 pr-3 text-gray-900 shadow-sm placeholder:text-espresso-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400"
                  placeholder="Enter 6-digit code"
                />
              </div>
              <p className="mt-2 text-xs text-espresso-500 dark:text-gray-400">
                The code expires in a few minutes. Request a new one from the login screen if needed.
              </p>
            </div>

            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="group relative flex w-full items-center justify-center gap-2 rounded-full bg-[#c81e36] px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#b2182e] focus:outline-none focus:ring-2 focus:ring-[#b2182e] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-white"></span>
                  Verifying...
                </span>
              ) : (
                'Verify OTP'
              )}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={!formattedEmail || isResending}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-coffee-300 px-6 py-3 text-sm font-semibold text-espresso-700 transition-colors duration-200 hover:border-coffee-400 hover:text-espresso-900 focus:outline-none focus:ring-2 focus:ring-coffee-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:text-white"
            >
              {isResending ? 'Resending…' : 'Resend Code'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminOTPVerifyPage;
