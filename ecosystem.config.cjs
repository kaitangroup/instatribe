/**
 * PM2 Ecosystem Configuration
 * Usage: pm2 start ecosystem.config.cjs
 *        pm2 reload ecosystem.config.cjs   (zero-downtime reload)
 */
module.exports = {
  apps: [
    {
      name: "kindred",
      script: "dist/index.cjs",
      cwd: "/var/www/kindred",

      // Process management
      instances: "max",            // one process per CPU core
      exec_mode: "cluster",        // share port across instances
      max_memory_restart: "512M",

      // Env
      env_production: {
        NODE_ENV: "production",
      },

      // Logging
      out_file: "/var/log/kindred/app.log",
      error_file: "/var/log/kindred/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // Restart policy
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: "10s",

      // Watch (disabled in prod — use pm2 reload instead)
      watch: false,
    },
  ],
};
