import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { builtinModules } from "node:module";

const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default {
  input: "src/plugin.ts",
  output: {
    file: "bin/plugin.js",
    format: "esm",
    sourcemap: true,
    inlineDynamicImports: true,
  },
  external: nodeBuiltins,
  plugins: [
    json(),
    typescript({
      tsconfig: "./tsconfig.json",
    }),
    resolve({
      browser: false,
      preferBuiltins: true,
      exportConditions: ["node"],
    }),
    commonjs(),
  ],
};
