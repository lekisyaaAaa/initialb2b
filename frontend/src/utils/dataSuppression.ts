// Central suppression flag for all telemetry/data output
const env = (process.env.REACT_APP_SUPPRESS_PUBLIC_DASHBOARD || '').toString().toLowerCase();
export const DATA_SUPPRESSED = env === 'true' ? true : false;
export const suppressionReason = 'All telemetry and sensor data is intentionally hidden in this deployment.';
