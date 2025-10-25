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

export interface AdminResendOtpResponse {
  success: boolean;
  message?: string;
  data?: {
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
    user?: Record<string, unknown>;
  };
}

export interface AdminForgotPasswordResponse {
  success: boolean;
  message?: string;
}

export interface AdminResetPasswordResponse {
  success: boolean;
  message?: string;
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
