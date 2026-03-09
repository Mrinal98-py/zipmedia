// PM2 cluster config — uses all available CPU cores for zero-downtime restarts.
// Usage:
//   npm install -g pm2
//   pm2 start ecosystem.config.js --env production
//   pm2 save && pm2 startup

module.exports = {
    apps: [
        {
            name: 'zipmedia',
            script: 'server.js',

            // Cluster mode — one process per CPU core
            instances: 'max',
            exec_mode: 'cluster',

            // Restart behaviour
            watch: false,
            max_memory_restart: '512M',
            restart_delay: 1000,

            env: {
                NODE_ENV: 'development',
                PORT: 3000,
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000,
            },

            // Logging
            error_file: 'logs/error.log',
            out_file: 'logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        },
    ],
};
