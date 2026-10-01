import { http, storeTokens, getAccess, getRefresh, clearAuth } from '@core/http/http';

export { getAccess, getRefresh, clearAuth };

export interface AuthUser {
  user_id?: string;
  id?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

/**
 * 2-step OAuth-code style login flow:
 * 1. POST /user/login -> { authorization_code }
 * 2. POST /user/generateToken -> { access_token, refresh_token, user }
 */
export async function login(email: string, password: string): Promise<AuthUser> {
  const step1 = (await http.post('/user/login', {
    email,
    password,
    login_type: 1,
  })).data;

  const authorizationCode = step1.authorization_code || step1.authorizationCode;
  if (!authorizationCode) {
    throw new Error('Authorization code not returned from login');
  }

  const step2 = (await http.post('/user/generateToken', {
    authorization_code: authorizationCode,
  })).data;

  const accessToken = step2.access_token || step2.accessToken;
  const refreshToken = step2.refresh_token || step2.refreshToken;

  if (accessToken && refreshToken) {
    storeTokens(accessToken, refreshToken);
  }

  return step2.user ?? { email };
}

export async function forgotPassword(email: string) {
  return (await http.post('/user/forgotPassword', { email })).data;
}

export async function verifyOtp(email: string, otp: string) {
  return (await http.post('/user/verifyOtp', { email, otp })).data;
}

export async function resetPassword(email: string, password: string) {
  return (await http.post('/user/resetPassword', {
    email,
    password,
    confirm_password: password,
  })).data;
}
