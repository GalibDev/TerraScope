import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingIncludes: {
    "/api/vegetation": ["./data/vegetation.json"],
    "/api/scientist": ["./data/vegetation.json"],
  },
};
export default config;
