/**
 * BharatKYC Lite - Progressive Web App
 * Optimized for low-end Android devices and poor connectivity
 * 
 * Core Features:
 * - Document capture and upload
 * - Face authentication with liveness check
 * - Offline functionality with sync
 * - Multi-language support
 * - Image compression
 * - Error handling and retry mechanisms
 */

// ==========================================
// Global Variables & Configuration
// ==========================================

const CONFIG = {
    // API endpoints
    API_BASE_URL: 'http://localhost:3010', // Local development API
    UPLOAD_ENDPOINT: '/api/upload',
    VERIFY_ENDPOINT: '/api/verify',
    DIGILOCKER_ENDPOINT: '/api/digilocker',
    
    // Image processing
    MAX_IMAGE_SIZE: 2 * 1024 * 1024, // 2MB
    COMPRESSION_QUALITY: 0.8,
    CAPTURE_WIDTH: 1280,
    CAPTURE_HEIGHT: 720,
    
    // Face detection
    FACE_CAPTURE_TIMEOUT: 10000, // 10 seconds
    LIVENESS_ACTIONS: ['blink', 'smile', 'turn_left', 'turn_right'],
    
    // Offline storage
    DB_NAME: 'BharatKYC_DB',
    DB_VERSION: 1,
    
    // Languages
    SUPPORTED_LANGUAGES: ['en', 'hi', 'ta', 'te'],
    DEFAULT_LANGUAGE: 'en'
};

// Global state management
const AppState = {
    currentStep: 0,
    currentScreen: 'loading-screen',
    selectedDocument: null,
    captureMethod: null,
    capturedImage: null,
    extractedData: {},
    faceImage: null,
    isOffline: !navigator.onLine,
    language: CONFIG.DEFAULT_LANGUAGE,
    verificationId: null,
    retryQueue: []
};

// Screen flow configuration
const SCREEN_FLOW = [
    'welcome-screen',
    'document-selection-screen',
    'capture-method-screen',
    'camera-guidance-screen',
    'camera-capture-screen',
    'image-review-screen',
    'data-review-screen',
    'face-guidance-screen',
    'face-capture-screen',
    'processing-screen',
    'result-screen'
];

// Language translations
const TRANSLATIONS = {
    en: {
        welcome_title: 'Welcome to BharatKYC Lite!',
        welcome_subtitle: 'Let\'s get you verified safely and securely',
        get_started: 'Get Started',
        listen_instructions: 'Listen to Instructions',
        select_document: 'Select Your Document',
        aadhaar_card: 'Aadhaar Card',
        pan_card: 'PAN Card',
        driving_license: 'Driving License',
        voter_id: 'Voter ID',
        take_photo: 'Take Photo',
        upload_photo: 'Upload Photo',
        camera_instruction: 'Position document within the frame',
        face_verification: 'Face Verification',
        processing: 'Verifying Your Details',
        success: 'Verification Successful!',
        error: 'Something went wrong',
        retry: 'Try Again',
        offline_message: 'You\'re offline. Data will sync when connection is restored.'
    },
    hi: {
        welcome_title: 'BharatKYC Lite में आपका स्वागत है!',
        welcome_subtitle: 'आइए आपको सुरक्षित रूप से सत्यापित करते हैं',
        get_started: 'शुरू करें',
        listen_instructions: 'निर्देश सुनें',
        select_document: 'अपना दस्तावेज़ चुनें',
        aadhaar_card: 'आधार कार्ड',
        pan_card: 'पैन कार्ड',
        driving_license: 'ड्राइविंग लाइसेंस',
        voter_id: 'वोटर आईडी',
        take_photo: 'फोटो लें',
        upload_photo: 'फोटो अपलोड करें',
        camera_instruction: 'दस्तावेज़ को फ्रेम के अंदर रखें',
        face_verification: 'चेहरा सत्यापन',
        processing: 'आपकी जानकारी सत्यापित की जा रही है',
        success: 'सत्यापन सफल!',
        error: 'कुछ गलत हुआ',
        retry: 'पुनः प्रयास करें',
        offline_message: 'आप ऑफलाइन हैं। कनेक्शन बहाल होने पर डेटा सिंक होगा।'
    }
};

// ==========================================
// Utility Functions
// ==========================================

/**
 * Get translated text for current language
 */
function t(key) {
    return TRANSLATIONS[AppState.language]?.[key] || TRANSLATIONS.en[key] || key;
}

/**
 * Show error modal with message
 */
function showError(message, retryCallback = null) {
    const modal = document.getElementById('error-modal');
    const title = document.getElementById('error-title');
    const messageEl = document.getElementById('error-message');
    const retryBtn = document.getElementById('error-retry-btn');
    
    title.textContent = t('error');
    messageEl.textContent = message;
    modal.classList.add('show');
    
    if (retryCallback) {
        retryBtn.onclick = () => {
            modal.classList.remove('show');
            retryCallback();
        };
        retryBtn.style.display = 'block';
    } else {
        retryBtn.style.display = 'none';
    }
}

/**
 * Show/hide loading state
 */
function setLoading(isLoading) {
    const loadingScreen = document.getElementById('loading-screen');
    if (isLoading) {
        loadingScreen.classList.add('active');
    } else {
        loadingScreen.classList.remove('active');
    }
}

/**
 * Navigate to next/previous screen
 */
function navigateToScreen(screenId, updateProgress = true) {
    // Hide current screen
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen) {
        currentScreen.classList.remove('active');
    }
    
    // Show new screen
    const newScreen = document.getElementById(screenId);
    if (newScreen) {
        newScreen.classList.add('active');
        AppState.currentScreen = screenId;
        
        if (updateProgress) {
            updateProgressBar(screenId);
        }
        
        // Trigger screen-specific initialization
        initializeScreen(screenId);
    }
}

/**
 * Update progress bar
 */
function updateProgressBar(screenId) {
    const stepIndex = SCREEN_FLOW.indexOf(screenId);
    if (stepIndex >= 0) {
        AppState.currentStep = stepIndex;
        const progressFill = document.getElementById('progress-fill');
        const stepCounter = document.getElementById('step-counter');
        
        const progress = ((stepIndex + 1) / SCREEN_FLOW.length) * 100;
        progressFill.style.width = `${progress}%`;
        stepCounter.textContent = `Step ${stepIndex + 1} of ${SCREEN_FLOW.length}`;
    }
}

/**
 * Compress image for upload
 */
async function compressImage(file, maxSizeMB = 2, quality = 0.8) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Calculate new dimensions
            let { width, height } = img;
            const maxDimension = 1280;
            
            if (width > height && width > maxDimension) {
                height = (height * maxDimension) / width;
                width = maxDimension;
            } else if (height > maxDimension) {
                width = (width * maxDimension) / height;
                height = maxDimension;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

/**
 * Convert blob to base64
 */
function blobToBase64(blob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

/**
 * Detect if device has good camera support
 */
function hasGoodCameraSupport() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Check network connectivity
 */
function updateNetworkStatus() {
    const wasOffline = AppState.isOffline;
    AppState.isOffline = !navigator.onLine;
    
    const offlineBanner = document.getElementById('offline-banner');
    
    if (AppState.isOffline) {
        offlineBanner.classList.add('show');
    } else {
        offlineBanner.classList.remove('show');
        
        // If coming back online, try to sync queued data
        if (wasOffline && AppState.retryQueue.length > 0) {
            processRetryQueue();
        }
    }
}

// ==========================================
// IndexedDB Operations
// ==========================================

let db = null;

/**
 * Initialize IndexedDB
 */
async function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            // Create object stores
            if (!db.objectStoreNames.contains('verifications')) {
                const verificationStore = db.createObjectStore('verifications', { keyPath: 'id', autoIncrement: true });
                verificationStore.createIndex('timestamp', 'timestamp', { unique: false });
                verificationStore.createIndex('status', 'status', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('retry_queue')) {
                db.createObjectStore('retry_queue', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

/**
 * Store verification data offline
 */
async function storeVerificationOffline(data) {
    if (!db) return;
    
    const transaction = db.transaction(['verifications'], 'readwrite');
    const store = transaction.objectStore('verifications');
    
    const verificationData = {
        ...data,
        timestamp: Date.now(),
        status: 'pending',
        offline: true
    };
    
    return new Promise((resolve, reject) => {
        const request = store.add(verificationData);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Add item to retry queue
 */
async function addToRetryQueue(data) {
    if (!db) return;
    
    const transaction = db.transaction(['retry_queue'], 'readwrite');
    const store = transaction.objectStore('retry_queue');
    
    return new Promise((resolve, reject) => {
        const request = store.add({
            data,
            timestamp: Date.now(),
            retries: 0
        });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ==========================================
// Camera & Media Functions
// ==========================================

let currentStream = null;
let currentCamera = 'environment'; // 'user' for front camera

/**
 * Get camera stream
 */
async function getCameraStream(facingMode = 'environment') {
    try {
        const constraints = {
            video: {
                facingMode,
                width: { ideal: CONFIG.CAPTURE_WIDTH },
                height: { ideal: CONFIG.CAPTURE_HEIGHT }
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return stream;
    } catch (error) {
        throw new Error('Camera access denied or not available');
    }
}

/**
 * Stop current camera stream
 */
function stopCameraStream() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

/**
 * Initialize document camera
 */
async function initDocumentCamera() {
    try {
        setLoading(true);
        currentStream = await getCameraStream('environment');
        
        const video = document.getElementById('camera-video');
        video.srcObject = currentStream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
        });
        
        setLoading(false);
        navigateToScreen('camera-capture-screen');
        
        // Start auto-detection
        startDocumentDetection();
        
    } catch (error) {
        setLoading(false);
        showError('Camera not available. Please check permissions.', () => {
            navigateToScreen('capture-method-screen');
        });
    }
}

/**
 * Initialize face camera
 */
async function initFaceCamera() {
    try {
        setLoading(true);
        currentStream = await getCameraStream('user');
        
        const video = document.getElementById('face-camera-video');
        video.srcObject = currentStream;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
        });
        
        setLoading(false);
        navigateToScreen('face-capture-screen');
        
        // Start face detection and liveness check
        startLivenessCheck();
        
    } catch (error) {
        setLoading(false);
        showError('Front camera not available. Please check permissions.', () => {
            navigateToScreen('face-guidance-screen');
        });
    }
}

/**
 * Capture image from video stream
 */
function captureImage(videoId, canvasId) {
    const video = document.getElementById(videoId);
    const canvas = document.getElementById(canvasId);
    
    if (!video || !canvas) return null;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', CONFIG.COMPRESSION_QUALITY);
    });
}

/**
 * Basic document detection (placeholder for actual ML model)
 */
function startDocumentDetection() {
    const instructionText = document.getElementById('camera-instruction-text');
    const focusIndicator = document.getElementById('focus-indicator');
    
    // Simulate document detection
    let detectionState = 'searching';
    
    const checkDetection = () => {
        switch (detectionState) {
            case 'searching':
                instructionText.textContent = 'Searching for document...';
                focusIndicator.innerHTML = '<span class="status-icon">🔍</span><span class="status-text">Searching...</span>';
                detectionState = 'found';
                break;
                
            case 'found':
                instructionText.textContent = 'Document found! Hold steady...';
                focusIndicator.innerHTML = '<span class="status-icon">📄</span><span class="status-text">Document detected</span>';
                detectionState = 'focused';
                break;
                
            case 'focused':
                instructionText.textContent = 'Perfect! Auto-capturing...';
                focusIndicator.innerHTML = '<span class="status-icon">✓</span><span class="status-text">Ready to capture</span>';
                
                // Auto-capture after 2 seconds
                setTimeout(async () => {
                    await handleDocumentCapture();
                }, 2000);
                return; // Stop the cycle
        }
        
        setTimeout(checkDetection, 1500);
    };
    
    checkDetection();
}

/**
 * Start liveness check sequence
 */
function startLivenessCheck() {
    const titleEl = document.getElementById('liveness-instruction-title');
    const textEl = document.getElementById('liveness-instruction-text');
    const countdown = document.getElementById('countdown-timer');
    
    let currentAction = 0;
    const actions = [
        { title: 'Position your face', text: 'Center your face in the oval', action: 'position' },
        { title: 'Please blink your eyes', text: 'Blink naturally once', action: 'blink' },
        { title: 'Please smile', text: 'Give us a natural smile', action: 'smile' },
        { title: 'Perfect!', text: 'Capturing your photo...', action: 'capture' }
    ];
    
    function nextAction() {
        if (currentAction >= actions.length) return;
        
        const action = actions[currentAction];
        titleEl.textContent = action.title;
        textEl.textContent = action.text;
        
        // Countdown for each action
        let timeLeft = 3;
        countdown.textContent = timeLeft;
        
        const countdownInterval = setInterval(() => {
            timeLeft--;
            countdown.textContent = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                countdown.textContent = '';
                
                if (action.action === 'capture') {
                    handleFaceCapture();
                } else {
                    currentAction++;
                    setTimeout(nextAction, 1000);
                }
            }
        }, 1000);
    }
    
    // Start face detection status
    updateFaceDetectionStatus();
    
    // Begin liveness sequence
    setTimeout(nextAction, 1000);
}

/**
 * Update face detection indicators
 */
function updateFaceDetectionStatus() {
    const indicators = {
        'face-detected-indicator': 'active',
        'positioning-indicator': 'active',
        'lighting-indicator': 'warning'
    };
    
    Object.entries(indicators).forEach(([id, status]) => {
        const el = document.getElementById(id);
        if (el) {
            el.className = `indicator ${status}`;
        }
    });
}

// ==========================================
// OCR & Data Extraction
// ==========================================

/**
 * Extract data from document image (placeholder for actual OCR)
 */
async function extractDocumentData(imageBlob) {
    // Simulate OCR processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock extracted data based on document type
    const mockData = {
        aadhaar: {
            name: 'Raj Kumar Sharma',
            dob: '15/08/1990',
            number: '1234 5678 9012',
            address: '123 Gandhi Nagar, New Delhi, 110001'
        },
        pan: {
            name: 'Raj Kumar Sharma',
            dob: '15/08/1990',
            number: 'ABCDE1234F',
            address: ''
        },
        'driving-license': {
            name: 'Raj Kumar Sharma',
            dob: '15/08/1990',
            number: 'DL-1420110012345',
            address: '123 Gandhi Nagar, New Delhi, 110001'
        },
        'voter-id': {
            name: 'Raj Kumar Sharma',
            dob: '15/08/1990',
            number: 'ABC1234567',
            address: '123 Gandhi Nagar, New Delhi, 110001'
        }
    };
    
    const data = mockData[AppState.selectedDocument] || mockData.aadhaar;
    
    // Simulate confidence score
    const confidence = Math.random() * 30 + 70; // 70-100%
    
    return {
        ...data,
        confidence: Math.round(confidence)
    };
}

/**
 * Populate extracted data form
 */
function populateExtractedData(data) {
    document.getElementById('extracted-name').value = data.name || '';
    document.getElementById('extracted-dob').value = data.dob || '';
    document.getElementById('extracted-number').value = data.number || '';
    document.getElementById('extracted-address').value = data.address || '';
    
    // Update confidence indicator
    const confidenceFill = document.getElementById('confidence-fill');
    const confidenceText = document.getElementById('confidence-percentage');
    
    confidenceFill.style.width = `${data.confidence}%`;
    confidenceText.textContent = `${data.confidence}%`;
    
    // Store extracted data
    AppState.extractedData = data;
}

// ==========================================
// API & Network Functions
// ==========================================

/**
 * Upload verification data to server
 */
async function uploadVerificationData(data) {
    const formData = new FormData();
    
    // Add document image
    if (data.documentImage) {
        formData.append('document', data.documentImage, 'document.jpg');
    }
    
    // Add face image
    if (data.faceImage) {
        formData.append('face', data.faceImage, 'face.jpg');
    }
    
    // Add extracted data
    formData.append('data', JSON.stringify({
        documentType: data.documentType,
        extractedData: data.extractedData,
        timestamp: Date.now()
    }));
    
    const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.UPLOAD_ENDPOINT}`, {
        method: 'POST',
        body: formData,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
    }
    
    return response.json();
}

/**
 * Process retry queue when online
 */
async function processRetryQueue() {
    if (!db || AppState.isOffline) return;
    
    const transaction = db.transaction(['retry_queue'], 'readonly');
    const store = transaction.objectStore('retry_queue');
    
    return new Promise((resolve) => {
        const request = store.getAll();
        
        request.onsuccess = async () => {
            const items = request.result;
            
            for (const item of items) {
                try {
                    await uploadVerificationData(item.data);
                    
                    // Remove from queue on success
                    const deleteTransaction = db.transaction(['retry_queue'], 'readwrite');
                    const deleteStore = deleteTransaction.objectStore('retry_queue');
                    deleteStore.delete(item.id);
                    
                } catch (error) {
                    console.error('Retry failed:', error);
                    
                    // Update retry count
                    item.retries = (item.retries || 0) + 1;
                    
                    if (item.retries < 3) {
                        const updateTransaction = db.transaction(['retry_queue'], 'readwrite');
                        const updateStore = updateTransaction.objectStore('retry_queue');
                        updateStore.put(item);
                    } else {
                        // Remove after 3 failed retries
                        const deleteTransaction = db.transaction(['retry_queue'], 'readwrite');
                        const deleteStore = deleteTransaction.objectStore('retry_queue');
                        deleteStore.delete(item.id);
                    }
                }
            }
            
            resolve();
        };
    });
}

// ==========================================
// Event Handlers
// ==========================================

/**
 * Handle document capture
 */
async function handleDocumentCapture() {
    try {
        setLoading(true);
        
        const imageBlob = await captureImage('camera-video', 'camera-canvas');
        if (!imageBlob) {
            throw new Error('Failed to capture image');
        }
        
        // Compress image
        const compressedBlob = await compressImage(imageBlob);
        AppState.capturedImage = compressedBlob;
        
        // Display captured image
        const capturedImg = document.getElementById('captured-image');
        capturedImg.src = URL.createObjectURL(compressedBlob);
        
        // Stop camera
        stopCameraStream();
        
        setLoading(false);
        navigateToScreen('image-review-screen');
        
        // Start quality check
        performImageQualityCheck();
        
    } catch (error) {
        setLoading(false);
        showError('Failed to capture image. Please try again.', handleDocumentCapture);
    }
}

/**
 * Handle face capture
 */
async function handleFaceCapture() {
    try {
        setLoading(true);
        
        const imageBlob = await captureImage('face-camera-video', 'face-canvas');
        if (!imageBlob) {
            throw new Error('Failed to capture face image');
        }
        
        // Compress face image
        const compressedBlob = await compressImage(imageBlob, 1, 0.9); // Higher quality for face
        AppState.faceImage = compressedBlob;
        
        // Stop camera
        stopCameraStream();
        
        setLoading(false);
        navigateToScreen('processing-screen');
        
        // Start verification process
        await processVerification();
        
    } catch (error) {
        setLoading(false);
        showError('Failed to capture face image. Please try again.', () => {
            navigateToScreen('face-guidance-screen');
        });
    }
}

/**
 * Perform image quality check
 */
async function performImageQualityCheck() {
    const checks = [
        { id: 'clarity-check', name: 'Clarity', delay: 1000 },
        { id: 'lighting-check', name: 'Lighting', delay: 1500 },
        { id: 'completeness-check', name: 'Completeness', delay: 2000 }
    ];
    
    for (const check of checks) {
        setTimeout(() => {
            const icon = document.getElementById(check.id);
            // Simulate random quality check results
            const isGood = Math.random() > 0.2; // 80% success rate
            
            if (isGood) {
                icon.textContent = '✓';
                icon.className = 'quality-icon success';
            } else {
                icon.textContent = '⚠️';
                icon.className = 'quality-icon warning';
            }
        }, check.delay);
    }
}

/**
 * Process complete verification
 */
async function processVerification() {
    try {
        // Update processing steps
        updateProcessingStep('step-document-validation', 'processing');
        
        // Extract document data
        const extractedData = await extractDocumentData(AppState.capturedImage);
        
        updateProcessingStep('step-document-validation', 'completed');
        updateProcessingStep('step-face-verification', 'processing');
        
        // Simulate face verification
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        updateProcessingStep('step-face-verification', 'completed');
        updateProcessingStep('step-final-check', 'processing');
        
        // Prepare verification data
        const verificationData = {
            documentType: AppState.selectedDocument,
            documentImage: AppState.capturedImage,
            faceImage: AppState.faceImage,
            extractedData
        };
        
        let result;
        
        if (AppState.isOffline) {
            // Store offline
            await storeVerificationOffline(verificationData);
            await addToRetryQueue(verificationData);
            
            result = {
                success: true,
                verificationId: `OFFLINE_${Date.now()}`,
                message: 'Verification completed offline. Will sync when online.'
            };
        } else {
            // Upload to server
            result = await uploadVerificationData(verificationData);
        }
        
        updateProcessingStep('step-final-check', 'completed');
        
        // Store verification ID
        AppState.verificationId = result.verificationId;
        
        // Show result
        showVerificationResult(result);
        
    } catch (error) {
        updateProcessingStep('step-final-check', 'error');
        showVerificationError(error.message);
    }
}

/**
 * Update processing step status
 */
function updateProcessingStep(stepId, status) {
    const step = document.getElementById(stepId);
    if (!step) return;
    
    const icon = step.querySelector('.step-icon');
    
    step.className = `step-item ${status}`;
    
    switch (status) {
        case 'processing':
            icon.textContent = '⌛';
            break;
        case 'completed':
            icon.textContent = '✓';
            break;
        case 'error':
            icon.textContent = '✗';
            break;
    }
}

/**
 * Show verification result
 */
function showVerificationResult(result) {
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    const verificationIdEl = document.getElementById('verification-id');
    const completionTimeEl = document.getElementById('completion-time');
    
    if (result.success) {
        resultIcon.innerHTML = '<div class="success-icon">✅</div>';
        resultTitle.textContent = t('success');
        resultMessage.textContent = result.message || 'Your identity has been verified successfully';
        
        verificationIdEl.textContent = result.verificationId || AppState.verificationId;
        completionTimeEl.textContent = new Date().toLocaleString();
    } else {
        resultIcon.innerHTML = '<div class="error-icon">❌</div>';
        resultTitle.textContent = 'Verification Failed';
        resultMessage.textContent = result.message || 'Verification could not be completed';
    }
    
    navigateToScreen('result-screen');
}

/**
 * Show verification error
 */
function showVerificationError(message) {
    showVerificationResult({
        success: false,
        message
    });
}

/**
 * Initialize screen-specific functionality
 */
function initializeScreen(screenId) {
    switch (screenId) {
        case 'welcome-screen':
            // Update language-specific content
            updateLanguageContent();
            break;
            
        case 'document-selection-screen':
            // Highlight recommended document
            highlightRecommendedDocument();
            break;
            
        case 'camera-guidance-screen':
            // Show document-specific tips
            updateCameraTips();
            break;
            
        case 'data-review-screen':
            // Start data extraction
            startDataExtraction();
            break;
    }
}

/**
 * Update content based on selected language
 */
function updateLanguageContent() {
    // Update key elements with translations
    const elements = {
        'welcome-title': 'welcome_title',
        'welcome-subtitle': 'welcome_subtitle'
    };
    
    Object.entries(elements).forEach(([elementId, translationKey]) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = t(translationKey);
        }
    });
}

/**
 * Start data extraction process
 */
async function startDataExtraction() {
    if (!AppState.capturedImage) return;
    
    try {
        setLoading(true);
        
        const extractedData = await extractDocumentData(AppState.capturedImage);
        populateExtractedData(extractedData);
        
        setLoading(false);
        
        // Hide extraction status
        const extractionStatus = document.querySelector('.extraction-status');
        if (extractionStatus) {
            extractionStatus.style.display = 'none';
        }
        
    } catch (error) {
        setLoading(false);
        showError('Failed to extract document data. Please review manually.');
    }
}

// ==========================================
// PWA Service Worker
// ==========================================

/**
 * Register service worker
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered successfully');
            
            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Show update notification
                        if (confirm('App update available. Refresh to get the latest version?')) {
                            window.location.reload();
                        }
                    }
                });
            });
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}

// ==========================================
// Initialization & Event Listeners
// ==========================================

/**
 * Initialize the application
 */
async function initApp() {
    console.log('🚀 Starting app initialization...');
    
    // Skip database and service worker for now - direct navigation
    console.log('⚡ Quick start mode - skipping advanced features');
    
    // Set up event listeners
    console.log('🎧 Setting up event listeners...');
    try {
        setupEventListeners();
        console.log('✅ Event listeners set up');
    } catch (e) {
        console.error('Event listener setup failed:', e);
    }
    
    // Hide loading screen and show welcome immediately
    console.log('🎬 Navigating to welcome screen...');
    setTimeout(() => {
        try {
            setLoading(false);
            navigateToScreen('welcome-screen');
            console.log('✅ App initialization complete!');
        } catch (e) {
            console.error('Navigation failed:', e);
        }
    }, 500);
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Network status
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    // Welcome screen
    document.getElementById('get-started-btn')?.addEventListener('click', () => {
        navigateToScreen('document-selection-screen');
    });
    
    document.getElementById('listen-instructions-btn')?.addEventListener('click', () => {
        // Implement voice instructions
        speakText(t('welcome_subtitle'));
    });
    
    // Language selector
    document.getElementById('language-select')?.addEventListener('change', (e) => {
        AppState.language = e.target.value;
        updateLanguageContent();
    });
    
    // Document selection
    document.querySelectorAll('.document-card').forEach(card => {
        card.addEventListener('click', () => {
            // Remove previous selection
            document.querySelectorAll('.document-card').forEach(c => c.classList.remove('selected'));
            
            // Select current
            card.classList.add('selected');
            AppState.selectedDocument = card.dataset.docType;
            
            // Navigate to method selection
            setTimeout(() => {
                navigateToScreen('capture-method-screen');
            }, 500);
        });
    });
    
    // DigiLocker integration
    document.getElementById('digilocker-btn')?.addEventListener('click', () => {
        // Implement DigiLocker flow
        window.location.href = `${CONFIG.API_BASE_URL}${CONFIG.DIGILOCKER_ENDPOINT}`;
    });
    
    // Capture method selection
    document.getElementById('camera-capture-option')?.addEventListener('click', () => {
        AppState.captureMethod = 'camera';
        navigateToScreen('camera-guidance-screen');
    });
    
    document.getElementById('file-upload-option')?.addEventListener('click', () => {
        AppState.captureMethod = 'upload';
        document.getElementById('file-upload-input').click();
    });
    
    // File upload
    document.getElementById('file-upload-input')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                setLoading(true);
                
                // Compress uploaded image
                const compressedBlob = await compressImage(file);
                AppState.capturedImage = compressedBlob;
                
                // Display image
                const capturedImg = document.getElementById('captured-image');
                capturedImg.src = URL.createObjectURL(compressedBlob);
                
                setLoading(false);
                navigateToScreen('image-review-screen');
                performImageQualityCheck();
                
            } catch (error) {
                setLoading(false);
                showError('Failed to process uploaded image.');
            }
        }
    });
    
    // Camera guidance
    document.getElementById('open-camera-btn')?.addEventListener('click', initDocumentCamera);
    
    document.getElementById('watch-demo-btn')?.addEventListener('click', () => {
        // Show demo video or animation
        alert('Demo video would play here');
    });
    
    // Camera controls
    document.getElementById('capture-btn')?.addEventListener('click', handleDocumentCapture);
    
    document.getElementById('close-camera-btn')?.addEventListener('click', () => {
        stopCameraStream();
        navigateToScreen('camera-guidance-screen');
    });
    
    document.getElementById('flash-toggle-btn')?.addEventListener('click', () => {
        // Toggle flash if supported
        toggleFlash();
    });
    
    // Image review
    document.getElementById('retake-photo-btn')?.addEventListener('click', () => {
        if (AppState.captureMethod === 'camera') {
            initDocumentCamera();
        } else {
            document.getElementById('file-upload-input').click();
        }
    });
    
    document.getElementById('confirm-image-btn')?.addEventListener('click', () => {
        navigateToScreen('data-review-screen');
    });
    
    // Data review
    document.getElementById('confirm-data-btn')?.addEventListener('click', () => {
        navigateToScreen('face-guidance-screen');
    });
    
    document.getElementById('edit-manually-btn')?.addEventListener('click', () => {
        // Enable editing of form fields
        document.querySelectorAll('.form-input').forEach(input => {
            input.removeAttribute('readonly');
            input.style.background = '#fff';
        });
    });
    
    // Edit buttons for individual fields
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const field = e.target.dataset.field;
            const input = document.getElementById(`extracted-${field}`);
            if (input) {
                input.removeAttribute('readonly');
                input.style.background = '#fff';
                input.focus();
            }
        });
    });
    
    // Face verification
    document.getElementById('start-face-scan-btn')?.addEventListener('click', initFaceCamera);
    
    // Face camera controls
    document.getElementById('close-face-camera-btn')?.addEventListener('click', () => {
        stopCameraStream();
        navigateToScreen('face-guidance-screen');
    });
    
    document.getElementById('switch-camera-btn')?.addEventListener('click', () => {
        // Switch between front and back camera
        currentCamera = currentCamera === 'user' ? 'environment' : 'user';
        initFaceCamera();
    });
    
    // Result screen
    document.getElementById('start-new-verification-btn')?.addEventListener('click', () => {
        // Reset app state
        resetAppState();
        navigateToScreen('welcome-screen');
    });
    
    document.getElementById('download-certificate-btn')?.addEventListener('click', () => {
        // Generate and download verification certificate
        downloadCertificate();
    });
    
    // Error modal
    document.getElementById('close-error-modal')?.addEventListener('click', () => {
        document.getElementById('error-modal').classList.remove('show');
    });
    
    // Offline retry
    document.getElementById('retry-sync-btn')?.addEventListener('click', () => {
        if (!AppState.isOffline) {
            processRetryQueue();
        }
    });
}

/**
 * Reset application state for new verification
 */
function resetAppState() {
    AppState.currentStep = 0;
    AppState.selectedDocument = null;
    AppState.captureMethod = null;
    AppState.capturedImage = null;
    AppState.extractedData = {};
    AppState.faceImage = null;
    AppState.verificationId = null;
    
    // Clear form data
    document.querySelectorAll('.form-input').forEach(input => {
        input.value = '';
        input.setAttribute('readonly', true);
        input.style.background = '#f5f5f5';
    });
    
    // Reset document selection
    document.querySelectorAll('.document-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    updateProgressBar('welcome-screen');
}

/**
 * Toggle camera flash
 */
function toggleFlash() {
    if (!currentStream) return;
    
    const track = currentStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    
    if (capabilities.torch) {
        const settings = track.getSettings();
        track.applyConstraints({
            advanced: [{ torch: !settings.torch }]
        });
    }
}

/**
 * Speak text using Web Speech API
 */
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = AppState.language === 'hi' ? 'hi-IN' : 'en-IN';
        speechSynthesis.speak(utterance);
    }
}

/**
 * Download verification certificate
 */
function downloadCertificate() {
    // Generate a simple certificate
    const certificate = {
        verificationId: AppState.verificationId,
        documentType: AppState.selectedDocument,
        verifiedData: AppState.extractedData,
        timestamp: new Date().toISOString(),
        status: 'VERIFIED'
    };
    
    const blob = new Blob([JSON.stringify(certificate, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `bharatkyc-certificate-${AppState.verificationId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
}

// ==========================================
// Start Application
// ==========================================

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Emergency bypass - force navigation after 3 seconds
setTimeout(() => {
    console.log('⚡ Emergency bypass activated');
    const loadingScreen = document.getElementById('loading-screen');
    const welcomeScreen = document.getElementById('welcome-screen');
    
    if (loadingScreen && welcomeScreen) {
        loadingScreen.classList.remove('active');
        welcomeScreen.classList.add('active');
        console.log('✅ Manual navigation complete');
    } else {
        console.error('❌ Screen elements not found');
        console.log('Loading screen:', loadingScreen);
        console.log('Welcome screen:', welcomeScreen);
    }
}, 3000);
