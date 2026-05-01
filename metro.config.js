const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

let withRorkMetro = (config) => config;
try {
  const rorkMetro = require("@rork-ai/toolkit-sdk/metro");
  if (rorkMetro && typeof rorkMetro.withRorkMetro === "function") {
    withRorkMetro = rorkMetro.withRorkMetro;
  }
} catch (error) {
  // Optional dependency: fall back to default Metro config if not installed.
}

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, "packages")];

module.exports = withRorkMetro(config);
