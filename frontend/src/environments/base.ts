// Shared environment shape — structure only. Single key read by the app.
// VITE_API_BASE_URL must end in /v1.
export interface AppEnvironment {
  production: boolean;
  API_BASE_URL: string;
}

function readBaseUrl(): string {
  const fromVite =
    typeof import.meta !== 'undefined'
      ? ((import.meta as unknown as { env?: Record<string, string | undefined> }).env
          ?.VITE_API_BASE_URL ?? '')
      : '';
  return fromVite || 'http://localhost:3000/v1';
}

export function buildEnvironment(production: boolean): AppEnvironment {
  return { production, API_BASE_URL: readBaseUrl() };
}
