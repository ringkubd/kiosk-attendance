const { withMainApplication } = require("@expo/config-plugins");

module.exports = function withOnnxruntimePackage(config) {
  return withMainApplication(config, (config) => {
    let src = config.modResults.contents;

    // 1) Import add
    if (!src.includes("ai.onnxruntime.reactnative.OnnxruntimePackage")) {
      src = src.replace(
        /import\s+com\.facebook\.react\.ReactPackage\s*\n/,
        (m) => m + "import ai.onnxruntime.reactnative.OnnxruntimePackage\n",
      );
    }

    // 2) PackageList apply block এ add(OnnxruntimePackage()) ঢোকানো
    if (!src.includes("add(OnnxruntimePackage())")) {
      src = src.replace(
        /PackageList\(this\)\.packages\.apply\s*\{\s*\n/,
        (m) => m + "          add(OnnxruntimePackage())\n",
      );
    }

    config.modResults.contents = src;
    return config;
  });
};
