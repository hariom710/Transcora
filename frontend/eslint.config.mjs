import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Thumbnails are remote YouTube URLs; next/image would need a proxy config.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
