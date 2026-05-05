import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Ban third-party UI libraries — Shadcn/UI is the only allowed UI source
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@mui/*", "@emotion/*"],
              message: "Use Shadcn/UI components instead.",
            },
            {
              group: ["antd", "antd/*"],
              message: "Use Shadcn/UI components instead.",
            },
            {
              group: ["@chakra-ui/*"],
              message: "Use Shadcn/UI components instead.",
            },
            {
              group: ["@mantine/*"],
              message: "Use Shadcn/UI components instead.",
            },
            {
              group: ["react-bootstrap", "reactstrap"],
              message: "Use Shadcn/UI components instead.",
            },
          ],
        },
      ],
      // Ban CSS/SCSS module imports
      "import/no-unassigned-import": [
        "error",
        {
          allow: [
            "**/*.css",
            "tailwindcss/**",
            "shadcn/**",
            "tw-animate-css",
          ],
        },
      ],
    },
  },
])

export default eslintConfig
