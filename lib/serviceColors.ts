/**
 * @deprecated This file is deprecated. Use serviceConfig.ts instead.
 * Keeping this file for backward compatibility during migration.
 *
 * All service configuration should come from:
 * - Database (source of truth)
 * - serviceConfig.ts (display dictionary)
 * - ServicesContext (merged, enriched data)
 */

// Re-export from serviceConfig for backward compatibility
export { getServiceIcon, getLightBgColor } from './serviceConfig';
