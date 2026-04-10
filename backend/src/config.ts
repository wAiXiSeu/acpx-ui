export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
export const isTest = config.nodeEnv === 'test';

export const matrixConfig = {
  homeserverUrl: process.env.MATRIX_HOMESERVER_URL || "http://localhost:8008",
  accessToken: process.env.MATRIX_ACCESS_TOKEN || "",
  userId: process.env.MATRIX_USER_ID || "@acpx:localhost",
  managerRoomId: process.env.MATRIX_MANAGER_ROOM_ID || "",
};