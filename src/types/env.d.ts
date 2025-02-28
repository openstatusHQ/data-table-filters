/**
 * Type definitions for environment variables
 * This file provides type safety and autocompletion for environment variables
 */

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * Flag to determine whether to use mock data instead of reading from log file
     * @default "false"
     */
    USE_MOCK_DATA: string;

    /**
     * Path to the access log file containing Traefik logs in JSON format
     * @example "/path/to/access-json.log"
     */
    LOG_FILE_PATH: string;

    /**
     * Next.js environment
     */
    NODE_ENV: "development" | "production" | "test";
  }
}
