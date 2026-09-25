// metro.config.js: lets the bundler see the domain packages, which live one
// directory up and are not installed from a registry. Without the watch folder
// Metro cannot resolve them; without extraNodeModules it cannot name them.
// It also points Privy's `jose` at its browser build.

const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const app = __dirname;
const repo = path.resolve(app, "..");
const config = getDefaultConfig(app);

config.watchFolders = [path.join(repo, "core"), path.join(repo, "attestation")];
config.resolver.extraNodeModules = {
  "@knowni/core": path.join(repo, "core", "src", "index.ts"),
  "@knowni/attestation": path.join(repo, "attestation", "src", "index.ts"),
};
config.resolver.sourceExts = [...config.resolver.sourceExts, "ts", "tsx"];
// Files outside app/ are transpiled by the same Babel runtime, and it is
// installed here, so resolution from up there has to find app/node_modules.
config.resolver.nodeModulesPaths = [path.join(app, "node_modules")];

// Privy pulls in `jose`, whose default export map points at its Node build
// (zlib, util). React Native has neither, so `jose` alone resolves as a browser.
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = resolveRequest ?? context.resolveRequest;
  if (moduleName === "jose") {
    return resolve({ ...context, unstable_conditionNames: ["browser"] }, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
