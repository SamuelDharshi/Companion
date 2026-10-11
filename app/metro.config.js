// Metro in a pnpm monorepo.
//
// Two things are required and both are easy to miss: Metro must be allowed to read
// files outside app/ (our workspace packages live at ../packages), and it must resolve
// modules from the root node_modules as well, because pnpm hoists shared deps there.
// Without these, `@thunai/shared` fails to resolve only when bundling, not when
// typechecking, which is a confusing way to lose an hour.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// pnpm uses symlinks; without this Metro follows them to a path it does not watch.
config.resolver.unstable_enableSymlinks = true;
// Hierarchical lookup must stay ON for pnpm. Each package resolves its own dependencies
// through its own nested node_modules (symlinks into the .pnpm store), so disabling the
// upward walk — the usual advice for Yarn/npm monorepos — makes transitive deps such as
// expo-modules-core unresolvable at bundle time only.
config.resolver.disableHierarchicalLookup = false;

// The landing page (frontend/), Foundry output and runtime data live under the same root
// but are not part of the app. Watching them made Metro stall after `pnpm install` in
// frontend/ dropped tens of thousands of files into the watched tree.
config.resolver.blockList = [].concat(config.resolver.blockList ?? [], [
  /[\x5c/]frontend[\x5c/].*/,
  /[\x5c/]contracts[\x5c/](out|cache|broadcast|lib)[\x5c/].*/,
  /[\x5c/]\.data[\x5c/].*/,
]);

module.exports = config;
