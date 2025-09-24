const app = require('./src/app');
const config = require('./src/config/config');
const database = require('./src/config/database');
const { handleUnhandledRejection, handleUncaughtException } = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');

// Handle unhandled promise rejections
handleUnhandledRejection();

// Handle uncaught exceptions
handleUncaughtException();

// Connect to database
const startServer = async () => {
  try {
    // Connect to MongoDB
    await database.connect();
    
    // Start server
    const server = app.listen(config.port, () => {
      logger.logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      console.log(`🚀 Xerago Community API is running on port ${config.port}`);
      console.log(`📊 Environment: ${config.nodeEnv}`);
      console.log(`🗄️  Database: Connected`);
      console.log(`🌐 Health check: http://localhost:${config.port}/health`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.logger.error(`Port ${config.port} is already in use`);
        console.error(`❌ Port ${config.port} is already in use`);
        process.exit(1);
      } else {
        logger.logger.error('Server error:', error);
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.logger.info(`${signal} received. Shutting down gracefully...`);
      console.log(`\n${signal} received. Shutting down gracefully...`);
      
      server.close(async () => {
        try {
          await database.disconnect();
          logger.logger.info('Server closed successfully');
          console.log('✅ Server closed successfully');
          process.exit(0);
        } catch (error) {
          logger.logger.error('Error during shutdown:', error);
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.logger.error('Failed to start server:', error);
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
