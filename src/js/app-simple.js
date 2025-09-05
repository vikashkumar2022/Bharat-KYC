/**
 * BharatKYC Lite - Simplified Progressive Web App
 * Basic functionality without complex database and service worker setup
 */

console.log('🚀 BharatKYC Lite - Loading...');

// Configuration
const CONFIG = {
    API_BASE_URL: 'http://localhost:3010',
    UPLOAD_ENDPOINT: '/api/upload',
    VERIFY_ENDPOINT: '/api/verify',
    DIGILOCKER_ENDPOINT: '/api/digilocker'
};

// Global state
const AppState = {
    currentStep: 0,
    currentScreen: 'loading-screen',
    selectedDocument: null,
    language: 'en'
};

// Navigation functions
function showScreen(screenId) {
    console.log('📱 Navigating to:', screenId);
    
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        AppState.currentScreen = screenId;
        console.log('✅ Screen shown:', screenId);
    } else {
        console.error('❌ Screen not found:', screenId);
    }
}

function nextScreen() {
    const screens = [
        'loading-screen',
        'welcome-screen', 
        'document-selection-screen',
        'capture-method-screen',
        'capture-guidance-screen',
        'camera-screen',
        'document-preview-screen',
        'face-capture-screen',
        'processing-screen',
        'verification-screen',
        'success-screen'
    ];
    
    const currentIndex = screens.indexOf(AppState.currentScreen);
    if (currentIndex < screens.length - 1) {
        showScreen(screens[currentIndex + 1]);
    }
}

function previousScreen() {
    const screens = [
        'loading-screen',
        'welcome-screen', 
        'document-selection-screen',
        'capture-method-screen',
        'capture-guidance-screen',
        'camera-screen',
        'document-preview-screen',
        'face-capture-screen',
        'processing-screen',
        'verification-screen',
        'success-screen'
    ];
    
    const currentIndex = screens.indexOf(AppState.currentScreen);
    if (currentIndex > 1) { // Don't go back to loading
        showScreen(screens[currentIndex - 1]);
    }
}

// Event handlers
function setupEventListeners() {
    console.log('🎧 Setting up event listeners...');
    
    // Welcome screen
    const startBtn = document.getElementById('start-verification-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => nextScreen());
    }
    
    const learnMoreBtn = document.getElementById('learn-more-btn');
    if (learnMoreBtn) {
        learnMoreBtn.addEventListener('click', () => {
            alert('BharatKYC Lite provides secure document verification for Indian citizens.');
        });
    }
    
    // Document selection
    document.querySelectorAll('.document-card').forEach(card => {
        card.addEventListener('click', () => {
            // Remove previous selection
            document.querySelectorAll('.document-card').forEach(c => c.classList.remove('selected'));
            
            // Select this card
            card.classList.add('selected');
            AppState.selectedDocument = card.dataset.doc;
            console.log('📄 Selected document:', AppState.selectedDocument);
            
            // Enable next button
            setTimeout(() => nextScreen(), 500);
        });
    });
    
    // Method selection
    document.querySelectorAll('.method-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            const method = card.dataset.method;
            console.log('📸 Selected method:', method);
            
            setTimeout(() => nextScreen(), 500);
        });
    });
    
    // Navigation buttons
    document.querySelectorAll('.next-btn').forEach(btn => {
        btn.addEventListener('click', nextScreen);
    });
    
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', previousScreen);
    });
    
    // Camera simulation
    const captureBtn = document.getElementById('capture-btn');
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            console.log('📸 Capturing image...');
            // Simulate capture
            setTimeout(() => nextScreen(), 1000);
        });
    }
    
    // Final actions
    const downloadBtn = document.getElementById('download-certificate-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            alert('Certificate downloaded successfully!');
        });
    }
    
    const verifyAnotherBtn = document.getElementById('verify-another-btn');
    if (verifyAnotherBtn) {
        verifyAnotherBtn.addEventListener('click', () => {
            showScreen('welcome-screen');
        });
    }
    
    const digilockerBtn = document.getElementById('digilocker-btn');
    if (digilockerBtn) {
        digilockerBtn.addEventListener('click', () => {
            alert('DigiLocker integration would open here!');
        });
    }
    
    // Language selector
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            AppState.language = e.target.value;
            console.log('🌐 Language changed to:', AppState.language);
        });
    }
    
    console.log('✅ Event listeners set up');
}

// Test API connection
async function testAPI() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`);
        const data = await response.json();
        console.log('✅ API connection successful:', data);
        return true;
    } catch (error) {
        console.warn('⚠️ API connection failed:', error.message);
        return false;
    }
}

// Initialize application
async function initApp() {
    console.log('🎬 Initializing BharatKYC Lite...');
    
    try {
        // Test API connection
        console.log('🌐 Testing API connection...');
        await testAPI();
        
        // Set up event listeners
        setupEventListeners();
        
        // Show welcome screen after brief loading
        setTimeout(() => {
            showScreen('welcome-screen');
            console.log('✅ BharatKYC Lite ready!');
        }, 2000);
        
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        // Still show welcome screen even if some features fail
        setTimeout(() => {
            showScreen('welcome-screen');
        }, 2000);
    }
}

// Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

console.log('📱 BharatKYC Lite JavaScript loaded');
