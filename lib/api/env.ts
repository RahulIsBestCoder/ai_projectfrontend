// Environment variable helper supporting Next.js (NEXT_PUBLIC_) and Vite (VITE_)

function getEnv(key: string, defaultValue: string = ''): string {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const metaEnv = (import.meta as any).env;
    if (metaEnv[`VITE_${key}`]) return metaEnv[`VITE_${key}`];
    if (metaEnv[`NEXT_PUBLIC_${key}`]) return metaEnv[`NEXT_PUBLIC_${key}`];
    if (metaEnv[key]) return metaEnv[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[`NEXT_PUBLIC_${key}`]) return process.env[`NEXT_PUBLIC_${key}`]!;
    if (process.env[`VITE_${key}`]) return process.env[`VITE_${key}`]!;
    if (process.env[key]) return process.env[key]!;
  }
  return defaultValue;
}

export const API_BASE_URL = getEnv('API_BASE_URL', 'http://localhost:3000/v1');
