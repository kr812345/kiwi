const path = require("path");

module.exports = {
  apps: [
    {
      name: "kiwi-gateway",
      script: path.resolve(__dirname, "services/gateway/kiwi-gateway"),
      cwd: path.resolve(__dirname),
      instances: 1,
      exec_mode: "fork",
      env: {
        PORT: 8080,
        NODE_ENV: "development",
        BRAIN_URL: "http://127.0.0.1:9100",
        API_TOKEN: process.env.API_TOKEN || "kiwi_secret_token_dev",
        DATABASE_URL: process.env.DATABASE_URL || ""
      },
      env_production: {
        PORT: 8080,
        NODE_ENV: "production",
        BRAIN_URL: "http://127.0.0.1:9100",
        API_TOKEN: process.env.API_TOKEN || "kiwi_secret_token_dev",
        DATABASE_URL: process.env.DATABASE_URL || ""
      }
    },
    {
      name: "kiwi-brain",
      script: path.resolve(__dirname, "services/orchestrator/.venv/bin/uvicorn"),
      args: "api.server:app --host 127.0.0.1 --port 9100",
      cwd: path.resolve(__dirname, "services/orchestrator"),
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      env: {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
        DATABASE_URL: process.env.DATABASE_URL || ""
      }
    }
  ]
};
