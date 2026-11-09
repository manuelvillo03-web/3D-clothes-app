// El maniquí viaja como binario (.bin) dentro de la app.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('bin');

module.exports = config;
