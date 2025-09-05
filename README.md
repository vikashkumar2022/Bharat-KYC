# BharatKYC Lite - Progressive Web App

A production-ready, responsive Progressive Web App (PWA) for document verification and KYC compliance in India. Optimized for low-end Android devices, poor internet connectivity, and users with low digital literacy.

## 🚀 Features

### Core Functionality
- **Document Verification**: Support for Aadhaar, PAN, Driving License, and Voter ID
- **Multiple Capture Methods**: Camera capture with auto-detection or file upload
- **Face Authentication**: Liveness check with guided instructions
- **DigiLocker Integration**: Seamless integration with government digital documents
- **Offline Support**: Works offline with automatic sync when online
- **Multi-language**: English, Hindi, Tamil, Telugu support

### Technical Features
- **PWA**: Full Progressive Web App with offline functionality
- **Responsive Design**: Optimized for mobile devices and low-end hardware
- **Image Compression**: Client-side compression to save bandwidth
- **OCR Processing**: Automatic data extraction from documents
- **Face Matching**: Server-side face verification and liveness detection
- **Security**: End-to-end encryption and secure data handling

## 📱 Device Optimization

### Low-End Device Support
- Minimal bundle size (< 500KB initial load)
- Efficient memory usage
- Battery-optimized camera operations
- Progressive image loading

### Poor Connectivity Handling
- Offline-first architecture
- Resumable uploads
- Intelligent retry mechanisms
- Data compression and optimization

### Digital Literacy Focus
- Voice guidance and instructions
- Simple, intuitive interface
- Visual guidance and animations
- Error prevention and clear messaging

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 16+ and npm 8+
- Modern web browser with camera support
- HTTPS connection (required for camera access)

### Frontend Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/bharatkyc/bharatkyc-lite.git
   cd bharatkyc-lite
   ```

2. Serve the frontend (development):
   ```bash
   # Using Python
   python -m http.server 3000
   
   # Using Node.js
   npx serve . -p 3000
   
   # Using Live Server (VS Code extension)
   # Right-click index.html and select "Open with Live Server"
   ```

3. Access the application:
   ```
   https://localhost:3000
   ```

### Backend Setup
1. Navigate to server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the server:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

### Environment Variables
Create a `.env` file in the server directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
API_SECRET=your-super-secret-key-here

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# DigiLocker Integration
DIGILOCKER_CLIENT_ID=your-digilocker-client-id
DIGILOCKER_CLIENT_SECRET=your-digilocker-client-secret
DIGILOCKER_REDIRECT_URI=https://your-domain.com/api/digilocker/callback

# Database (optional)
MONGODB_URI=mongodb://localhost:27017/bharatkyc
REDIS_URL=redis://localhost:6379

# External Services
OCR_API_KEY=your-ocr-service-key
FACE_API_KEY=your-face-recognition-service-key
```

## 🏗️ Project Structure

```
bharatkyc-lite/
├── index.html              # Main HTML file
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── src/
│   ├── css/
│   │   └── main.css        # Main stylesheet
│   ├── js/
│   │   └── app.js          # Main application logic
│   └── icons/              # App icons and images
├── server/
│   ├── server.js           # Express server
│   ├── package.json        # Server dependencies
│   └── uploads/            # Upload directory
└── README.md
```

## 📋 API Documentation

### Upload Endpoint
```
POST /api/upload
Content-Type: multipart/form-data

Fields:
- document: Image file (required)
- face: Image file (optional)
- data: JSON string with documentType and extractedData

Response:
{
  "success": true,
  "verificationId": "BKL_123456789",
  "status": "VERIFIED",
  "data": {
    "documentType": "aadhaar",
    "extractedData": {...},
    "documentValidation": {...},
    "faceVerification": {...}
  }
}
```

### DigiLocker Integration
```
GET /api/digilocker
Redirects to DigiLocker OAuth flow

GET /api/digilocker/callback?code=...&state=...
Handles DigiLocker callback and processes user data
```

### Verification Status
```
GET /api/verification/:id
Returns verification status and details

GET /api/certificate/:id
Downloads verification certificate
```

## 🔧 Customization

### Adding New Document Types
1. Update `SUPPORTED_DOCUMENTS` in `app.js`
2. Add document card in HTML
3. Update OCR logic in server
4. Add validation rules

### Language Support
1. Add translations to `TRANSLATIONS` object in `app.js`
2. Update language selector options
3. Add voice synthesis support

### Styling
- Modify CSS variables in `:root` for theming
- Update component styles in `main.css`
- Add custom animations and transitions

## 🚀 Deployment

### Frontend (Static Hosting)
```bash
# Build and deploy to any static hosting service
# Netlify, Vercel, GitHub Pages, Firebase Hosting, etc.

# Example with Netlify CLI
netlify deploy --prod --dir .
```

### Backend (Node.js Hosting)
```bash
# Deploy to Heroku, DigitalOcean, AWS, etc.

# Example with Heroku
heroku create bharatkyc-lite-api
git subtree push --prefix server heroku main
heroku config:set NODE_ENV=production
```

### Docker Deployment
```bash
# Build Docker image
docker build -t bharatkyc-lite .

# Run container
docker run -p 3000:3000 -e NODE_ENV=production bharatkyc-lite
```

## 🔒 Security Considerations

### Data Protection
- All uploads are processed and deleted within 5 minutes
- Face biometric data never stored permanently
- End-to-end encryption for sensitive data
- HTTPS enforced in production

### API Security
- Rate limiting on all endpoints
- API key authentication
- Input validation and sanitization
- CORS configured for specific origins

### Privacy Compliance
- GDPR/CCPA compliant data handling
- User consent mechanisms
- Data retention policies
- Audit trail for all operations

## 📈 Performance Optimization

### Bundle Size
- CSS: ~50KB minified
- JavaScript: ~100KB minified
- Total initial load: <200KB

### Loading Performance
- Critical CSS inlined
- Progressive image loading
- Service worker caching
- Resource preloading

### Runtime Performance
- Efficient DOM manipulation
- Memory leak prevention
- Battery usage optimization
- Background processing limits

## 🧪 Testing

### Frontend Testing
```bash
# Manual testing checklist in browser
# - Camera access and capture
# - File upload functionality
# - Offline mode
# - PWA installation
# - Cross-browser compatibility
```

### Backend Testing
```bash
cd server
npm test
```

### Load Testing
```bash
# Use tools like Artillery, JMeter, or k6
# Test upload endpoints with realistic file sizes
# Simulate poor network conditions
```

## 🐛 Troubleshooting

### Common Issues

**Camera not working:**
- Ensure HTTPS connection
- Check browser permissions
- Verify camera hardware support

**Upload failures:**
- Check file size limits
- Verify network connectivity
- Review server logs

**PWA not installing:**
- Verify manifest.json validity
- Check HTTPS requirement
- Review service worker registration

**Offline sync issues:**
- Check IndexedDB storage
- Verify service worker status
- Review background sync registration

### Debug Mode
Enable debug mode by adding `?debug=1` to URL:
```
https://localhost:3000?debug=1
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Ensure mobile compatibility

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Government of India for DigiLocker APIs
- Contributors and testers
- Open source libraries used

## 📞 Support

- Email: support@bharatkyc.in
- Documentation: https://docs.bharatkyc.in
- Issues: https://github.com/bharatkyc/bharatkyc-lite/issues

---

**Made with ❤️ for Digital India**
