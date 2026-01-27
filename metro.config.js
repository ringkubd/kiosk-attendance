// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add .onnx to asset extensions so Metro treats the model file as an asset
const { resolver } = config;
config.resolver = {
  ...resolver,
  assetExts: Array.from(new Set([...(resolver.assetExts || []), "onnx"])),
};

module.exports = config;
