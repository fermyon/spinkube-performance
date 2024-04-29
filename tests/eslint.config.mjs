import pluginJs from "@eslint/js";

export default [
  {
    languageOptions: {
      globals: {
        console: "readonly",
        __ENV: "readonly"
      }
    }
  },
  pluginJs.configs.recommended,
];