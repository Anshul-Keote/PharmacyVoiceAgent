const app = require('./app');
const config = require('./config');
const scheduler = require('./services/scheduler');

const PORT = config.port;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   Pharmacy Voice Agent - Middleware      ║
  ║   Port: ${PORT}                            ║
  ║   Env:  ${config.nodeEnv.padEnd(30)}  ║
  ║   Pharmacy: ${(config.pharmacy.name || 'Not set').padEnd(26)}  ║
  ╚══════════════════════════════════════════╝
  `);

  // Start scheduler
  scheduler.start();
});
