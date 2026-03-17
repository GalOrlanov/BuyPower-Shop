import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { connectDB } from './config/db';
import { swaggerSpec } from './api/swagger/swagger.config';
import { apiLimiter } from './api/middleware/rateLimiter.middleware';
import routes from './api/routes';
import { closeExpiredPurchases } from './services/groupPurchase.service';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api', apiLimiter);

// Swagger docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const start = async (): Promise<void> => {
  await connectDB();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
    console.log(`Swagger docs: http://localhost:${env.port}/api-docs`);
  });

  // Run expired purchases check every 5 minutes
  setInterval(closeExpiredPurchases, 5 * 60 * 1000);
};

start().catch(console.error);

export default app;
