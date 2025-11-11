/**
 * Service Factory Utility
 * Helper functions to create service instances from environment variables
 */

import {PostgresVectorService} from '../services';
import {
  getRequiredEnv,
  getRequiredEnvAsNumber,
} from './env-validator.util';

/**
 * Create PostgreSQL Vector Store Service from environment variables
 */
export function createVectorStoreService(): PostgresVectorService {
  const config = {
    host: getRequiredEnv('DATABASE_HOST', 'PostgreSQL host'),
    port: getRequiredEnvAsNumber('DATABASE_PORT', 'PostgreSQL port'),
    database: getRequiredEnv('DATABASE_NAME', 'PostgreSQL database name'),
    user: getRequiredEnv('DATABASE_USER', 'PostgreSQL user'),
    password: getRequiredEnv('DATABASE_PASSWORD', 'PostgreSQL password'),
  };

  return new PostgresVectorService(config);
}
