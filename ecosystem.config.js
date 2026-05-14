module.exports = {
  apps: [
    {
      name: 'nova-backend',
      script: 'server.js',
      cwd: '/home/ubuntu/matauranga-nova-v2/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 10000,
        OLLAMA_MODEL: 'phi3:mini',
        OLLAMA_KEEP_ALIVE: '2h',
        ALLOWED_ORIGINS: 'https://matauranga-nova.duckdns.org',
        ADMIN_USERNAME: 'burnett'
      }
    }
  ]
}
