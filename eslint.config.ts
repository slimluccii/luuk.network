import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import css from "@eslint/css";
import astro from 'eslint-plugin-astro';

export default defineConfig([
  js.configs.recommended,
  ts.configs.recommended,
  css.configs.recommended,
  astro.configs['flat/all'],
  astro.configs["flat/jsx-a11y-strict"]
]);
