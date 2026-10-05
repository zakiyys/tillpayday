import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: ["src/generated/**", ".next/**", ".tools/**", "data/**", "public/sw.js", "coverage/**"] },
];
export default config;
