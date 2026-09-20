module.exports = {
  apps: [{
    name: "kiwi-gateway",
    script: "./services/gateway/kiwi-gateway",
    instances: 1,
    exec_mode: "fork",
    env: {
      PORT: 8080,
      NODE_ENV: "development",
    },
    env_production: {
      PORT: 8080,
      NODE_ENV: "production",
    }
  }]
}
