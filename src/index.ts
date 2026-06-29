import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import router from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Set HTTP security headers
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.replace(/['"]/g, '').split(',').map(o => o.trim())
  : [process.env.FRONTEND_URL?.replace(/['"]/g, '').trim() || 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Intercept all 500 responses and sanitize raw database/server logs to prevent leakage
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (res.statusCode === 500 && body && body.error) {
      // Log the full detailed error trace internally on the server console
      console.error(`[SERVER ERROR] ${req.method} ${req.url} - Internal Failure:`, body.error);
      // Strip sensitive db trace/filesystem errors and return a clean client message
      body.error = 'Internal server error. Please try again later.';
    }
    return originalJson.call(this, body);
  };
  next();
});

const isProduction = process.env.NODE_ENV === 'production';

// General rate limiter for all API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 10000, // Limit each IP to 100 requests per window (or 10000 in dev)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Strict rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 20 : 1000, // Limit each IP to 20 login/register requests per window (or 1000 in dev)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again after 15 minutes.' },
});

// Apply rate limiting to endpoints
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1', apiLimiter);

app.use('/api/v1', router);

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the InPrep Backend API',
    status: 'healthy',
    timestamp: new Date()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
