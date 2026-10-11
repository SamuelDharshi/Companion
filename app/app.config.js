/**
 * app.json stays the source of truth. This only adds the one thing that depends on where the app is served.
 *
 * Set EXPO_BASE_URL=/app when the app is exported to live inside the landing site at /app. Left blank (the
 * normal `expo start`), the app is served from the root exactly as before.
 */
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments ?? {}),
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
