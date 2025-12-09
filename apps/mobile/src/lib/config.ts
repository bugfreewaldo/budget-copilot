import Constants from 'expo-constants';

/**
 * App configuration
 * Values come from app.json extra field or environment
 */
export const config = {
  // API configuration
  apiUrl:
    Constants.expoConfig?.extra?.apiUrl || 'https://budgetcopilot.app/api/v1',

  // App info
  appName: Constants.expoConfig?.name || 'Budget Copilot',
  appVersion: Constants.expoConfig?.version || '0.1.0',

  // Feature flags
  features: {
    biometricAuth: true,
    pushNotifications: true,
    darkMode: true,
  },
} as const;
