module.exports = {
  apps: [
    {
      name: 'nova-backend',
      script: 'server.js',
      cwd: '/home/ubuntu/matauranga-nova-v2/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 10000,
        OLLAMA_MODEL: 'mistral',
        OLLAMA_KEEP_ALIVE: '2h',
        OLLAMA_NUM_CTX: '2048',
        OLLAMA_NUM_PREDICT: '80',
        ALLOWED_ORIGINS: 'https://matauranga-nova.duckdns.org',
        ADMIN_USERNAME: 'nova',
        HANDSHAKE_TIMEOUT_MS: '300000',
        STREAM_HARD_TIMEOUT_MS: '600000',
        QUEUE_TIMEOUT_MS: '900000'
      }
    }
  ]
}
