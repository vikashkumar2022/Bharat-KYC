/**
 * BharatKYC Lite - Express Server
 * Handles file uploads, document verification, and DigiLocker integration
 * Optimized for high-throughput and low-latency processing
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// Environment configuration
const PORT = process.env.PORT || 3010;
const NODE_ENV = process.env.NODE_ENV || 'development';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const API_SECRET = process.env.API_SECRET || 'your-secret-key';

// Initialize Express app
const app = express();

// ==========================================
// Middleware Configuration
// ==========================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://api.bharatkyc.in"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
}));

// Compression for better performance
app.use(compression());

// CORS configuration
app.use(cors({
  origin: NODE_ENV === 'production' 
    ? ['https://bharatkyc.in', 'https://lite.bharatkyc.in']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit uploads to 10 per minute per IP
  message: {
    error: 'Too many upload attempts, please try again later.'
  }
});

app.use('/api/', limiter);
app.use('/api/upload', uploadLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// File Upload Configuration
// ==========================================

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 2, // Maximum 2 files (document + face)
  }
});

// ==========================================
// Utility Functions
// ==========================================

/**
 * Generate secure verification ID
 */
function generateVerificationId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `BKL_${timestamp}_${random}`.toUpperCase();
}

/**
 * Validate API request authentication
 */
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.body.apiKey;
  
  if (!apiKey || apiKey !== API_SECRET) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing API key'
    });
  }
  
  next();
}

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum 2 files allowed.'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
}

/**
 * Mock OCR function (replace with actual OCR service)
 */
async function performOCR(imagePath, documentType) {
  // Simulate OCR processing time
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  
  // Mock extracted data based on document type
  const mockData = {
    aadhaar: {
      name: 'Raj Kumar Sharma',
      dob: '15/08/1990',
      number: '1234 5678 9012',
      address: '123 Gandhi Nagar, New Delhi, 110001',
      confidence: 0.92
    },
    pan: {
      name: 'Raj Kumar Sharma',
      dob: '15/08/1990',
      number: 'ABCDE1234F',
      fatherName: 'Shyam Kumar Sharma',
      confidence: 0.88
    },
    'driving-license': {
      name: 'Raj Kumar Sharma',
      dob: '15/08/1990',
      number: 'DL-1420110012345',
      address: '123 Gandhi Nagar, New Delhi, 110001',
      licenseClass: 'LMV',
      validUpto: '15/08/2025',
      confidence: 0.85
    },
    'voter-id': {
      name: 'Raj Kumar Sharma',
      dob: '15/08/1990',
      number: 'ABC1234567',
      address: '123 Gandhi Nagar, New Delhi, 110001',
      constituency: 'New Delhi',
      confidence: 0.90
    }
  };
  
  return mockData[documentType] || mockData.aadhaar;
}

/**
 * Mock face verification function (replace with actual face matching service)
 */
async function performFaceVerification(documentImagePath, faceImagePath) {
  // Simulate face verification processing time
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
  
  // Mock verification result
  const confidence = 0.75 + Math.random() * 0.2; // 75-95% confidence
  const isMatch = confidence > 0.8;
  
  return {
    isMatch,
    confidence,
    livenessScore: 0.85 + Math.random() * 0.1
  };
}

/**
 * Mock document validation function
 */
async function validateDocument(imagePath, documentType, extractedData) {
  // Simulate validation processing time
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Mock validation results
  const validationChecks = {
    imageQuality: Math.random() > 0.1, // 90% pass rate
    documentAuthenticity: Math.random() > 0.05, // 95% pass rate
    dataConsistency: Math.random() > 0.1, // 90% pass rate
    securityFeatures: Math.random() > 0.15 // 85% pass rate
  };
  
  const allPassed = Object.values(validationChecks).every(check => check);
  
  return {
    isValid: allPassed,
    checks: validationChecks,
    riskScore: allPassed ? Math.random() * 0.2 : 0.3 + Math.random() * 0.7
  };
}

// ==========================================
// API Routes
// ==========================================

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * Document upload and verification endpoint
 */
app.post('/api/upload', upload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'face', maxCount: 1 }
]), async (req, res) => {
  try {
    const { data } = req.body;
    const files = req.files;
    
    if (!files || !files.document) {
      return res.status(400).json({
        success: false,
        error: 'Document image is required'
      });
    }
    
    const documentFile = files.document[0];
    const faceFile = files.face?.[0];
    
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid data format'
      });
    }
    
    const { documentType, extractedData } = parsedData;
    
    if (!documentType) {
      return res.status(400).json({
        success: false,
        error: 'Document type is required'
      });
    }
    
    // Generate verification ID
    const verificationId = generateVerificationId();
    
    // Perform OCR if no extracted data provided
    let ocrData = extractedData;
    if (!ocrData || Object.keys(ocrData).length === 0) {
      ocrData = await performOCR(documentFile.path, documentType);
    }
    
    // Validate document
    const documentValidation = await validateDocument(
      documentFile.path, 
      documentType, 
      ocrData
    );
    
    let faceVerification = null;
    
    // Perform face verification if face image provided
    if (faceFile) {
      faceVerification = await performFaceVerification(
        documentFile.path,
        faceFile.path
      );
    }
    
    // Determine overall verification status
    const verificationStatus = documentValidation.isValid && 
      (!faceVerification || faceVerification.isMatch);
    
    // Clean up uploaded files (in production, you might want to store them)
    setTimeout(async () => {
      try {
        await fs.unlink(documentFile.path);
        if (faceFile) {
          await fs.unlink(faceFile.path);
        }
      } catch (error) {
        console.error('Error cleaning up files:', error);
      }
    }, 5000);
    
    // Prepare response
    const response = {
      success: true,
      verificationId,
      status: verificationStatus ? 'VERIFIED' : 'FAILED',
      timestamp: new Date().toISOString(),
      data: {
        documentType,
        extractedData: ocrData,
        documentValidation,
        faceVerification,
        overallScore: verificationStatus ? 0.85 + Math.random() * 0.1 : 0.3 + Math.random() * 0.4
      }
    };
    
    // Log verification attempt
    console.log(`Verification ${verificationId}: ${response.status}`);
    
    res.json(response);
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification processing failed'
    });
  }
});

/**
 * DigiLocker integration endpoint
 */
app.get('/api/digilocker', (req, res) => {
  // In a real implementation, this would redirect to DigiLocker OAuth
  const state = crypto.randomBytes(16).toString('hex');
  const clientId = process.env.DIGILOCKER_CLIENT_ID || 'your-client-id';
  const redirectUri = encodeURIComponent(
    `${req.protocol}://${req.get('host')}/api/digilocker/callback`
  );
  
  const digilockerUrl = `https://api.digitallocker.gov.in/public/oauth2/1/authorize?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${redirectUri}&` +
    `state=${state}&` +
    `scope=openid profile aadhaar`;
  
  // Store state for verification (use Redis/database in production)
  req.session = req.session || {};
  req.session.digilockerState = state;
  
  res.redirect(digilockerUrl);
});

/**
 * DigiLocker callback endpoint
 */
app.get('/api/digilocker/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Verify state parameter
    if (!state || state !== req.session?.digilockerState) {
      return res.status(400).json({
        success: false,
        error: 'Invalid state parameter'
      });
    }
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code not received'
      });
    }
    
    // Exchange code for access token (mock implementation)
    const mockUserData = {
      name: 'Raj Kumar Sharma',
      dob: '15/08/1990',
      aadhaar: '1234 5678 9012',
      address: '123 Gandhi Nagar, New Delhi, 110001',
      verified: true
    };
    
    const verificationId = generateVerificationId();
    
    // Redirect back to frontend with verification data
    const frontendUrl = `${req.protocol}://${req.get('host')}` +
      `/?digilocker=success&verificationId=${verificationId}`;
    
    res.redirect(frontendUrl);
    
  } catch (error) {
    console.error('DigiLocker callback error:', error);
    const frontendUrl = `${req.protocol}://${req.get('host')}` +
      `/?digilocker=error&message=${encodeURIComponent('DigiLocker authentication failed')}`;
    
    res.redirect(frontendUrl);
  }
});

/**
 * Get verification status endpoint
 */
app.get('/api/verification/:id', (req, res) => {
  const { id } = req.params;
  
  // Mock verification lookup
  const mockVerification = {
    id,
    status: 'VERIFIED',
    timestamp: new Date().toISOString(),
    documentType: 'aadhaar',
    confidence: 0.92
  };
  
  res.json({
    success: true,
    data: mockVerification
  });
});

/**
 * Download verification certificate endpoint
 */
app.get('/api/certificate/:id', (req, res) => {
  const { id } = req.params;
  
  // Generate certificate data
  const certificate = {
    verificationId: id,
    issuer: 'BharatKYC Lite',
    issuedAt: new Date().toISOString(),
    status: 'VERIFIED',
    digitalSignature: crypto
      .createHash('sha256')
      .update(id + API_SECRET)
      .digest('hex')
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="certificate-${id}.json"`);
  res.json(certificate);
});

// ==========================================
// Static File Serving
// ==========================================

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../')));

// Catch-all handler for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// ==========================================
// Error Handling
// ==========================================

app.use(errorHandler);

// ==========================================
// Server Startup
// ==========================================

async function startServer() {
  try {
    await ensureUploadDir();
    
    app.listen(PORT, () => {
      console.log(`🚀 BharatKYC Lite server running on port ${PORT}`);
      console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      
      if (NODE_ENV === 'development') {
        console.log(`🔗 Local URL: http://localhost:${PORT}`);
        console.log(`📋 API Health: http://localhost:${PORT}/api/health`);
      }
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

module.exports = app;
