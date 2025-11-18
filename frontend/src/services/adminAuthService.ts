import api, { discoverApi } from './api';

export interface AdminLoginResponse {
  success: boolean;
  message?: string;
  data?: {
    requires2FA?: boolean;
    expiresAt?: string;
    debugCode?: string;
    delivery?: string;
  };
}

export interface AdminVerifyOtpResponse {
  success: boolean;
  message?: string;
  data?: {
    token?: string;
    refreshToken?: string;
    refreshExpiresAt?: string;
    expiresAt?: string;
    sessionId?: number | string | null;
    user?: Record<string, unknown>;
    attemptsRemaining?: number;
    delivery?: string;
  };
}

export interface AdminForgotPasswordResponse {
  success: boolean;
  message?: string;
}

export interface AdminResendOtpResponse {
  success: boolean;
  message?: string;
  data?: {
    expiresAt?: string;
    debugCode?: string;
    delivery?: string;
    rateLimit?: {
      remaining?: number;
      locked?: boolean;
      retryAfterMs?: number;
      retryAfterSeconds?: number;
    };
  };
}

export interface AdminResetPasswordResponse {
  success: boolean;
  message?: string;
}

export interface AdminRefreshResponse {
  success: boolean;
  message?: string;
  data?: {
    token: string;
    expiresAt: string;
    refreshToken: string;
    refreshExpiresAt: string;
    user?: Record<string, unknown>;
  };
}

export interface AdminLogoutResponse {
  success: boolean;
  message?: string;
}

export interface AdminSessionResponse {
  success: boolean;
  message?: string;
  data?: {
    token?: string;
    expiresAt?: string | null;
    refreshExpiresAt?: string | null;
    user?: Record<string, unknown>;
  };
}

function extractMessage(error: any, fallback: string): never {
  if (error?.response?.data?.message) {
    throw new Error(error.response.data.message);
  }
  if (error?.response?.status === 401) {
    throw new Error('Invalid email or password.');
  }
  if (error?.request) {
    throw new Error('Unable to reach the server. Please confirm the backend is running.');
  }
  throw new Error(error?.message || fallback);
}

async function ensureApiBase() {
  try {
    await discoverApi({ timeout: 1200 });
  } catch (e) {
    // discovery best-effort; ignore failures
  }
}

export async function login(email: string, password: string): Promise<AdminLoginResponse> {
  await ensureApiBase();
  try {
    const response = await api.post<AdminLoginResponse>('/admin/login', {
      email: email.trim(),
      password,
    });
    return response.data;
  } catch (error: any) {
    extractMessage(error, 'Unable to sign in. Please try again.');
  }
}

export async function verifyOtp(email: string, otp: string): Promise<AdminVerifyOtpResponse> {
  await ensureApiBase();
  try {
    const response = await api.post<AdminVerifyOtpResponse>('/admin/verify-otp', {
      email: email.trim(),
      otp: otp.trim(),
    });
    return response.data;
  } catch (error: any) {
    extractMessage(error, 'Unable to verify the code. Please try again.');
  }
}

export async function forgotPassword(email: string): Promise<AdminForgotPasswordResponse> {
  await ensureApiBase();
  try {
    const response = await api.post<AdminForgotPasswordResponse>('/admin/forgot-password', {
      email: email.trim(),
    });
    return response.data;
  } catch (error: any) {
    extractMessage(error, 'Unable to send the reset link. Please try again.');
  }
}

export async function resendOtp(email: string): Promise<AdminResendOtpResponse> {
  await ensureApiBase();
  try {
    const response = await api.post<AdminResendOtpResponse>('/admin/resend-otp', {
      email: email.trim(),
    });
    return response.data;
  } catch (error: any) {
    extractMessage(error, 'Unable to resend the verification code. Please try again.');
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<AdminResetPasswordResponse> {
  await ensureApiBase();
  try {
    const response = await api.post<AdminResetPasswordResponse>('/admin/reset-password', {
      token: token.trim(),
      password: newPassword,
    });
    return response.data;
  } catch (error: any) {
    extractMessage(error, 'Unable to reset the password. Please try again.');
  }
}

export async function refreshSession(refreshToken: string): Promise<AdminRefreshResponse> {
  await ensureApiBase();
  try {
    const response = await api.post<AdminRefreshResponse>('/admin/refresh', { refreshToken: refreshToken.trim() });
    return response.data;
  } catch (error: any) {
    extractMessage(error, 'Unable to refresh the session. Please log in again.');
  }
}

export async function logoutSession(payload: { refreshToken?: string; token?: string }): Promise<AdminLogoutResponse> {
  await ensureApiBase();
  try {
    const response = await api.post<AdminLogoutResponse>('/admin/logout', payload);
    return response.data;
  } catch (error: any) {
    extractMessage(error, 'Unable to log out at this time.');
  }
}

export async function getSession(token?: string): Promise<AdminSessionResponse> {
  await ensureApiBase();
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const response = await api.get<AdminSessionResponse>('/admin/session', { headers });
    return response.data;
  } catch (error: any) {
    extractMessage(error, 'Unable to validate session.');
  }
}
