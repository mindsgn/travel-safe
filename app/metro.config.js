const { getDefaultConfig } = require("@expo/metro-config");
/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push("sql");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  //if (moduleName === "xlsx") {
  //  return context.resolveRequest(context, "xlsx/dist/xlsx.full.min.js", platform);
  //}
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
