// Structure-only barrel — mirrors old src/lib/api/index.ts surface.
// Re-exports http primitives + auth + all domain services. No logic.
export * from '@core/http/env';
export * from '@core/http/http';
export * from '@core/auth/auth';
export * from '@core/http/case';
export * from '@core/http/enums';
export * from './chatMemory';
export * from './projects';
export * from './organizations';
export * from './departments';
export * from './plans';
export * from './workItems';
export * from './sprints';
export * from './integrations';
export * from './gitIntelligence';
export * from './analytics';
export * from './risk';
export * from './ai';
export * from './features';
export * from './reports';
export * from './notifications';
export * from './portfolio';
export * from './taigaBoard';
