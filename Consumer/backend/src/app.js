import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import logRoutes from './routes/logRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import recipeRoutes from './routes/recipeRoutes.js';
import donationRoutes from './routes/donationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import wasteRoutes from './routes/wasteRoutes.js';
import chatbotRoutes from './routes/chatbotRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import sdgRoutes from './routes/sdgRoutes.js';
import nutritionRoutes from './routes/nutritionRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import usageRoutes from './routes/usageRoutes.js';

dotenv.config();

const app = express();

// CORS configuration - allow all origins for development/Wokwi
// For production, set CORS_ALLOW_ALL=false and specify CLIENT_URL
const allowAllOrigins = process.env.CORS_ALLOW_ALL !== 'false';
const allowedOrigins = allowAllOrigins
  ? '*' // Allow all origins (for Wokwi, Postman, etc.)
  : process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((origin) => origin.trim())
    : '*';

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  }),
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Simple test endpoint for AppLink validation
app.get('/api/subscription/test', (_req, res) => {
  res.status(200).json({
    statusCode: 'S1000',
    statusDetail: 'Request was successfully processed',
  });
});

// Direct notification test endpoint (bypasses ngrok warning)
app.post('/api/subscription/notify-test', (req, res) => {
  console.log('Test notification received:', req.body);
  res.status(200).json({
    statusCode: 'S1000',
    statusDetail: 'Request was successfully processed',
    received: req.body,
  });
});

app.get('/api/subscription/notify-test', (req, res) => {
  res.status(200).json({
    statusCode: 'S1000',
    statusDetail: 'Request was successfully processed',
    message: 'Test endpoint is working',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/waste', wasteRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sdg', sdgRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/usage', usageRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || 'Unexpected server error',
  });
});

export default app;

