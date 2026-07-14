const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "expo-router/_ctx" || moduleName === "expo-router/_ctx.js") {
    const plat = platform ?? "ios";
    const file = path.join(projectRoot, `_ctx.${plat}.js`);
    return { type: "sourceFile", filePath: file };
  }
  if (moduleName === "expo-router/_ctx-html" || moduleName === "expo-router/_ctx-html.js") {
    return { type: "sourceFile", filePath: path.join(projectRoot, "_ctx-html.js") };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
