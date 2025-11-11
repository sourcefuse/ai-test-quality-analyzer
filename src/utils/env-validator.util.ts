/**
 * Environment Variable Validator Utility
 * Validates required environment variables and throws descriptive errors if missing
 */

export interface EnvValidationRule {
  name: string;
  required: boolean;
  description?: string;
}

/**
 * Validate a single environment variable
 * @param name - Environment variable name
 * @param description - Optional description for better error messages
 * @throws Error if the environment variable is not set or empty
 */
export function validateEnvVar(name: string, description?: string): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    const errorMessage = `Missing required environment variable: ${name}${
      description ? ` (${description})` : ''
    }`;
    console.error(`\n❌ ${errorMessage}`);
    console.error(`   Please set ${name} in your .env file\n`);
    throw new Error(errorMessage);
  }

  return value;
}

/**
 * Validate multiple environment variables at once
 * @param rules - Array of validation rules
 * @throws Error if any required environment variable is missing
 */
export function validateEnvVars(rules: EnvValidationRule[]): void {
  const missingVars: string[] = [];

  for (const rule of rules) {
    if (rule.required) {
      const value = process.env[rule.name];
      if (!value || value.trim() === '') {
        missingVars.push(
          `  - ${rule.name}${rule.description ? ` (${rule.description})` : ''}`
        );
      }
    }
  }

  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables:\n${missingVars.join('\n')}`;
    console.error(`\n❌ ${errorMessage}`);
    console.error(`\n   Please set these variables in your .env file\n`);
    throw new Error(errorMessage);
  }
}

/**
 * Get required environment variable as string
 * @param name - Environment variable name
 * @param description - Optional description
 * @returns The environment variable value
 */
export function getRequiredEnv(name: string, description?: string): string {
  return validateEnvVar(name, description);
}

/**
 * Get optional environment variable with default value
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The environment variable value or default
 */
export function getOptionalEnv(
  name: string,
  defaultValue: string
): string {
  return process.env[name] || defaultValue;
}

/**
 * Get required environment variable as number
 * @param name - Environment variable name
 * @param description - Optional description
 * @returns The environment variable value as number
 */
export function getRequiredEnvAsNumber(
  name: string,
  description?: string
): number {
  const value = validateEnvVar(name, description);
  const numValue = parseInt(value);

  if (isNaN(numValue)) {
    const errorMessage = `Environment variable ${name} must be a valid number, got: ${value}`;
    console.error(`\n❌ ${errorMessage}\n`);
    throw new Error(errorMessage);
  }

  return numValue;
}

/**
 * Get optional environment variable as number with default
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The environment variable value as number or default
 */
export function getOptionalEnvAsNumber(
  name: string,
  defaultValue: number
): number {
  const value = process.env[name];
  if (!value) return defaultValue;

  const numValue = parseInt(value);
  if (isNaN(numValue)) {
    console.warn(
      `⚠️  Warning: ${name} has invalid number value "${value}", using default: ${defaultValue}`
    );
    return defaultValue;
  }

  return numValue;
}

/**
 * Get required environment variable as boolean
 * @param name - Environment variable name
 * @param description - Optional description
 * @returns The environment variable value as boolean
 */
export function getRequiredEnvAsBoolean(
  name: string,
  description?: string
): boolean {
  const value = validateEnvVar(name, description);
  return value === 'true' || value === '1';
}

/**
 * Get optional environment variable as boolean with default
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The environment variable value as boolean or default
 */
export function getOptionalEnvAsBoolean(
  name: string,
  defaultValue: boolean
): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;

  return value === 'true' || value === '1';
}
