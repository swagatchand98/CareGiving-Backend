import http from 'http';
import App from './app';
import { config } from './config/env';

class Server {
  private app: App;
  private server: http.Server;

  constructor() {
    this.app = new App();
    this.server = http.createServer(this.app.express);
  }

  private normalizePort(val: string): number | string | boolean {
    const port = parseInt(val, 10);
    
    if (isNaN(port)) return val;
    if (port >= 0) return port;
    
    return false;
  }

  private onError(error: NodeJS.ErrnoException): void {
    if (error.syscall !== 'listen') {
      throw error;
    }

    const bind = typeof config.PORT === 'string'
      ? 'Pipe ' + config.PORT
      : 'Port ' + config.PORT;

    switch (error.code) {
      case 'EACCES':
        console.error(`${bind} requires elevated privileges`);
        process.exit(1);
      case 'EADDRINUSE':
        console.error(`${bind} is already in use`);
        process.exit(1);
      default:
        throw error;
    }
  }

  private onListening(): void {
    const addr = this.server.address();
    const bind = typeof addr === 'string'
      ? `pipe ${addr}`
      : `port ${addr?.port}`;
    
    console.log(`🚀 Server running on ${bind}`);
    console.log(`🌐 Environment: ${config.NODE_ENV}`);
  }

  public async start() {
    // Initialize application dependencies
    await this.app.initialize();

    // Set port
    const port = this.normalizePort(config.PORT || '5000');
    this.app.express.set('port', port);

    // Start server
    this.server.listen(port);
    this.server.on('error', this.onError);
    this.server.on('listening', this.onListening);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received. Shutting down gracefully');
      this.server.close(() => {
        console.log('💻 Process terminated');
        process.exit(0);
      });
    });
  }
}

// Start the server
const server = new Server();
server.start().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});