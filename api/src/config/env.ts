import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/group-purchase',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  payplus: {
    apiKey: process.env.PAYPLUS_API_KEY || '',
    secretKey: process.env.PAYPLUS_SECRET_KEY || '',
  },
  grow: {
    apiKey: process.env.GROW_API_KEY || '',
    secretKey: process.env.GROW_SECRET_KEY || '',
  },
  tranzila: {
    terminalName: process.env.TRANZILA_TERMINAL || '',
    password: process.env.TRANZILA_PASSWORD || '', // TranzilaPW
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:8081',
};
