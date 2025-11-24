const rawFlag = (
  process.env.REACT_APP_SUPPRESS_DATA ||
  process.env.REACT_APP_TELEMETRY_DISABLED ||
  process.env.REACT_APP_DASHBOARD_LOCKDOWN ||
  ''
)
  .toString()
  .trim()
  .toLowerCase();

export const DATA_SUPPRESSED = rawFlag === 'true';

export const suppressionReason =
  process.env.REACT_APP_SUPPRESS_DATA_REASON ||
  'Telemetry output has been intentionally disabled for this deployment.';
