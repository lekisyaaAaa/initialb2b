module.exports = function override(config) {
  config.ignoreWarnings = Array.isArray(config.ignoreWarnings) ? config.ignoreWarnings : [];
  config.ignoreWarnings.push(/Failed to parse source map/);
  return config;
};
