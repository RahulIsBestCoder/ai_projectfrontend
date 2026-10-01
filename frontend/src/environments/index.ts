// Structure-only barrel. Re-exports the shared environment shape.
// Mode-specific files (development/staging/uat/production) all delegate here.
export * from './base';
export { environment } from './development';
