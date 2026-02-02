import js from "@eslint/js";
import security from "eslint-plugin-security";
import prettier from "eslint-config-prettier";

export default [
  {
    files: ["src/**/*.js"],
    plugins: {
      security,
    },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        // Node.js globals
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        console: "readonly",
        exports: "readonly",
        global: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
        setImmediate: "readonly",
        clearImmediate: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        // Jest globals
        afterAll: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
        jest: "readonly",
        test: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...security.configs.recommended.rules,
    },
  },
  {
    files: ["src/**/*.js"],
    ...prettier,
  },
];
