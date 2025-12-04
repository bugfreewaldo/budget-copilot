const baseConfig = require('@budget-copilot/config/tailwind.base.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: ['./src/**/*.{ts,tsx}'],
};
