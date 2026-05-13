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
        ALLOWED_ORIGINS: 'http://150.242.42.161,http://localhost',
        ADMIN_USERNAME: 'burnett'
      }
    }
  ]
}
