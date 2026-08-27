/**
 * ESLint flat config.
 *
 * Next 16 removed `next lint`, so this is run by `npm run lint` → `eslint .`
 * directly. eslint-config-next now ships real flat configs, which is why the
 * old @eslint/eslintrc FlatCompat shim is gone — spreading these is enough.
 */
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  // `next lint` used to skip these for us; running eslint directly does not.
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "public/sw.js",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      /*
        New in eslint-plugin-react-hooks 7 (shipped with Next 16). It flags
        every synchronous setState inside an effect, which is right for
        derived state but wrong for the one thing this app uses it for:
        reading browser-only state — localStorage, window.location.search —
        AFTER mount so the first client render still matches the
        server-rendered HTML. Doing that during render is precisely the
        hydration mismatch the effect exists to avoid, so there is no
        rewrite that satisfies the rule and keeps the behaviour.

        Kept as a warning rather than switched off: a genuine
        derived-state-in-an-effect mistake is still worth seeing.
      */
      "react-hooks/set-state-in-effect": "warn",

      /*
        The admin routes strip Mongoose's bookkeeping fields by destructuring
        them out — `const { _id, __v, ...rest } = doc` — which is the whole
        point of naming them and never reading them. ignoreRestSiblings makes
        that idiom legal; the underscore patterns cover deliberate throwaways
        elsewhere.
      */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default eslintConfig;
