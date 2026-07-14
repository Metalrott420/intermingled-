export const ctx = require.context(
  './app',
  false,
  /\+html\.[tj]sx?$/,
  'sync'
);
