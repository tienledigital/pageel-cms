export const ErrorCodes = {
  PLUGINS_SAVE_FAILED: 'PLUGINS_SAVE_FAILED',
  PLUGINS_LOAD_FAILED: 'PLUGINS_LOAD_FAILED',
} as const;

export const ErrorMessages = {
  [ErrorCodes.PLUGINS_SAVE_FAILED]: 'Failed to save plugin configuration. Please check repository connection.',
  [ErrorCodes.PLUGINS_LOAD_FAILED]: 'Unable to load plugin configuration interface.',
} as const;
