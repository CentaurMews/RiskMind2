module.exports = {
  apps: [
    {
      name: "riskmind",
      script: "artifacts/api-server/dist/index.cjs",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      node_args: "--env-file /home/dante/RiskMind2/.env",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 10000,
      listen_timeout: 10000,
      error_file: "./logs/riskmind-error.log",
      out_file: "./logs/riskmind-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
