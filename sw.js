/**
 * BharatKYC Lite - Service Worker
 * Provides offline functionality, caching, and background sync
 * Optimized for low-end devices and poor connectivity
 */

// Service Worker version and cache names
const SW_VERSION = '1.0.0';
const CACHE_PREFIX = 'bharatkyc-lite';
const CACHE_STATIC = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const CACHE_DYNAMIC = `${CACHE_PREFIX}-dynamic-${SW_VERSION}`;
const CACHE_IMAGES = `${CACHE_PREFIX}-images-${SW_VERSION}`;

// Files to cache immediately (App Shell)
const STATIC_CACHE_FILES = [
  '/',
  '/index.html',
  '/src/css/main.css',
  '/src/js/app.js',
  '/manifest.json',
  '/src/icons/icon-192x192.png',
  '/src/icons/icon-512x512.png'
];

// Cache strategies for different types of resources
const CACHE_STRATEGIES = {
  static: 'cache-first',    // HTML, CSS, JS
  images: 'cache-first',    // Icons, images
  api: 'network-first',     // API calls
  documents: 'network-only' // Sensitive document uploads
};

// Maximum cache sizes (in items)
const CACHE_LIMITS = {
  [CACHE_STATIC]: 50,
  [CACHE_DYNAMIC]: 100,
  [CACHE_IMAGES]: 200
};

// Network timeout for fetch requests
const NETWORK_TIMEOUT = 10000; // 10 seconds

// ==========================================
// Service Worker Event Listeners
// ==========================================

/**
 * Install Event - Cache static assets
 */
self.addEventListener('install', (event) => {
  console.log(`[SW ${SW_VERSION}] Installing...`);
  
  event.waitUntil(
    Promise.all([
      cacheStaticAssets(),
      self.skipWaiting() // Activate immediately
    ])
  );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activating...`);
  
  event.waitUntil(
    Promise.all([
      cleanupOldCaches(),
      self.clients.claim() // Control all clients immediately
    ])
  );
});

/**
 * Fetch Event - Handle all network requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and different origins (except API)
  if (request.method !== 'GET' && !isApiRequest(url)) {
    return;
  }
  
  // Handle POST requests for API calls
  if (request.method === 'POST' && isApiRequest(url)) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Route different types of requests
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isImageRequest(url)) {
    event.respondWith(handleImageRequest(request));
  } else if (isApiRequest(url)) {
    event.respondWith(handleApiRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

/**
 * Background Sync Event - Retry failed requests
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'background-upload') {
    event.waitUntil(handleBackgroundUpload());
  }
});

/**
 * Push Event - Handle push notifications (future feature)
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event.data?.text());
  
  const options = {
    body: event.data?.text() || 'Verification update available',
    icon: '/src/icons/icon-192x192.png',
    badge: '/src/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'bharatkyc-notification',
    actions: [
      {
        action: 'view',
        title: 'View Details',
        icon: '/src/icons/action-view.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/src/icons/action-dismiss.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('BharatKYC Lite', options)
  );
});

/**
 * Notification Click Event
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      self.clients.openWindow('/')
    );
  }
});

/**
 * Message Event - Handle messages from main thread
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_URLS':
      event.waitUntil(cacheUrls(data.urls));
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(clearCache(data.cacheName));
      break;
      
    case 'GET_CACHE_INFO':
      event.waitUntil(getCacheInfo().then(info => {
        event.ports[0].postMessage(info);
      }));
      break;
  }
});

// ==========================================
// Cache Management Functions
// ==========================================

/**
 * Cache static assets during install
 */
async function cacheStaticAssets() {
  try {
    const cache = await caches.open(CACHE_STATIC);
    
    // Cache files one by one to handle failures gracefully
    const cachePromises = STATIC_CACHE_FILES.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          console.log(`[SW] Cached: ${url}`);
        }
      } catch (error) {
        console.warn(`[SW] Failed to cache: ${url}`, error);
      }
    });
    
    await Promise.allSettled(cachePromises);
    console.log('[SW] Static assets cached');
    
  } catch (error) {
    console.error('[SW] Failed to cache static assets:', error);
  }
}

/**
 * Clean up old caches
 */
async function cleanupOldCaches() {
  try {
    const cacheNames = await caches.keys();
    const currentCaches = [CACHE_STATIC, CACHE_DYNAMIC, CACHE_IMAGES];
    
    const deletePromises = cacheNames
      .filter(cacheName => 
        cacheName.startsWith(CACHE_PREFIX) && 
        !currentCaches.includes(cacheName)
      )
      .map(cacheName => {
        console.log(`[SW] Deleting old cache: ${cacheName}`);
        return caches.delete(cacheName);
      });
    
    await Promise.all(deletePromises);
    console.log('[SW] Old caches cleaned');
    
  } catch (error) {
    console.error('[SW] Failed to cleanup old caches:', error);
  }
}

/**
 * Cache additional URLs
 */
async function cacheUrls(urls) {
  try {
    const cache = await caches.open(CACHE_DYNAMIC);
    
    const cachePromises = urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.warn(`[SW] Failed to cache URL: ${url}`, error);
      }
    });
    
    await Promise.allSettled(cachePromises);
    
  } catch (error) {
    console.error('[SW] Failed to cache URLs:', error);
  }
}

/**
 * Clear specific cache
 */
async function clearCache(cacheName) {
  try {
    await caches.delete(cacheName);
    console.log(`[SW] Cache cleared: ${cacheName}`);
  } catch (error) {
    console.error(`[SW] Failed to clear cache: ${cacheName}`, error);
  }
}

/**
 * Get cache information
 */
async function getCacheInfo() {
  try {
    const cacheNames = await caches.keys();
    const cacheInfo = {};
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      cacheInfo[cacheName] = {
        count: keys.length,
        urls: keys.map(req => req.url)
      };
    }
    
    return cacheInfo;
    
  } catch (error) {
    console.error('[SW] Failed to get cache info:', error);
    return {};
  }
}

/**
 * Limit cache size
 */
async function limitCacheSize(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxItems) {
      // Delete oldest entries (FIFO)
      const deleteCount = keys.length - maxItems;
      const deletePromises = keys
        .slice(0, deleteCount)
        .map(key => cache.delete(key));
      
      await Promise.all(deletePromises);
      console.log(`[SW] Trimmed cache ${cacheName}: removed ${deleteCount} items`);
    }
    
  } catch (error) {
    console.error(`[SW] Failed to limit cache size: ${cacheName}`, error);
  }
}

// ==========================================
// Request Handlers
// ==========================================

/**
 * Handle static asset requests (HTML, CSS, JS)
 */
async function handleStaticAsset(request) {
  try {
    // Try cache first
    const cache = await caches.open(CACHE_STATIC);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback to network with timeout
    const networkResponse = await fetchWithTimeout(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      await limitCacheSize(CACHE_STATIC, CACHE_LIMITS[CACHE_STATIC]);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.warn('[SW] Static asset failed:', request.url, error);
    
    // Return offline fallback for HTML requests
    if (request.destination === 'document') {
      return createOfflinePage();
    }
    
    throw error;
  }
}

/**
 * Handle image requests
 */
async function handleImageRequest(request) {
  try {
    const cache = await caches.open(CACHE_IMAGES);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetchWithTimeout(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      await limitCacheSize(CACHE_IMAGES, CACHE_LIMITS[CACHE_IMAGES]);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.warn('[SW] Image request failed:', request.url, error);
    
    // Return placeholder image
    return createPlaceholderImage();
  }
}

/**
 * Handle API requests
 */
async function handleApiRequest(request) {
  try {
    // Always try network first for API calls
    const networkResponse = await fetchWithTimeout(request, 5000);
    
    // Cache GET responses only
    if (request.method === 'GET' && networkResponse.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.warn('[SW] API request failed:', request.url, error);
    
    // For GET requests, try cache fallback
    if (request.method === 'GET') {
      const cache = await caches.open(CACHE_DYNAMIC);
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        // Add offline indicator header
        const headers = new Headers(cachedResponse.headers);
        headers.set('X-Served-By', 'cache-offline');
        
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers
        });
      }
    }
    
    // For POST requests, queue for background sync
    if (request.method === 'POST') {
      await queueBackgroundSync(request);
      
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Request queued for background sync',
          offline: true
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    throw error;
  }
}

/**
 * Handle dynamic requests (other resources)
 */
async function handleDynamicRequest(request) {
  try {
    const networkResponse = await fetchWithTimeout(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      await limitCacheSize(CACHE_DYNAMIC, CACHE_LIMITS[CACHE_DYNAMIC]);
    }
    
    return networkResponse;
    
  } catch (error) {
    // Try cache fallback
    const cache = await caches.open(CACHE_DYNAMIC);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// ==========================================
// Background Sync
// ==========================================

/**
 * Queue request for background sync
 */
async function queueBackgroundSync(request) {
  try {
    // Store request details in IndexedDB
    const db = await openDB('bharatkyc-sync', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('requests')) {
          db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
        }
      }
    });
    
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now()
    };
    
    const tx = db.transaction('requests', 'readwrite');
    await tx.store.add(requestData);
    
    // Register background sync
    await self.registration.sync.register('background-upload');
    
    console.log('[SW] Request queued for background sync:', request.url);
    
  } catch (error) {
    console.error('[SW] Failed to queue background sync:', error);
  }
}

/**
 * Handle background upload sync
 */
async function handleBackgroundUpload() {
  try {
    const db = await openDB('bharatkyc-sync', 1);
    const tx = db.transaction('requests', 'readonly');
    const requests = await tx.store.getAll();
    
    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          // Remove from queue on success
          const deleteTx = db.transaction('requests', 'readwrite');
          await deleteTx.store.delete(requestData.id);
          
          console.log('[SW] Background sync successful:', requestData.url);
          
          // Notify main thread
          await notifyClients({
            type: 'SYNC_SUCCESS',
            data: { url: requestData.url }
          });
        }
        
      } catch (error) {
        console.warn('[SW] Background sync failed:', requestData.url, error);
      }
    }
    
  } catch (error) {
    console.error('[SW] Background upload handler failed:', error);
  }
}

// ==========================================
// Utility Functions
// ==========================================

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(request, timeout = NETWORK_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(request, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Check if request is for static asset
 */
function isStaticAsset(url) {
  const pathname = url.pathname;
  return (
    pathname.endsWith('.html') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.json') ||
    pathname === '/'
  );
}

/**
 * Check if request is for image
 */
function isImageRequest(url) {
  const pathname = url.pathname;
  return (
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  );
}

/**
 * Check if request is for API
 */
function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname;
}

/**
 * Create offline fallback page
 */
function createOfflinePage() {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BharatKYC Lite - Offline</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #f5f5f5;
          color: #333;
        }
        .offline-container {
          text-align: center;
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-width: 400px;
        }
        .offline-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        h1 {
          color: #2E7D32;
          margin-bottom: 1rem;
        }
        .retry-btn {
          background: #2E7D32;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          margin-top: 1rem;
        }
        .retry-btn:hover {
          background: #1B5E20;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📱</div>
        <h1>You're Offline</h1>
        <p>BharatKYC Lite is currently offline. Please check your internet connection and try again.</p>
        <p>Your verification data is safely stored and will sync when you're back online.</p>
        <button class="retry-btn" onclick="window.location.reload()">
          Try Again
        </button>
      </div>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

/**
 * Create placeholder image
 */
function createPlaceholderImage() {
  // Create a simple SVG placeholder
  const svg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#f0f0f0"/>
      <text x="100" y="100" text-anchor="middle" dy="0.3em" font-family="Arial" font-size="14" fill="#999">
        Image Unavailable
      </text>
    </svg>
  `;
  
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' }
  });
}

/**
 * Notify all clients
 */
async function notifyClients(message) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage(message);
  });
}

/**
 * Simple IndexedDB wrapper
 */
function openDB(name, version, upgradeCallback) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      if (upgradeCallback) {
        upgradeCallback(event.target.result, event);
      }
    };
  });
}

// ==========================================
// Error Handling
// ==========================================

/**
 * Global error handler
 */
self.addEventListener('error', (event) => {
  console.error('[SW] Error:', event.error);
});

/**
 * Unhandled promise rejection handler
 */
self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

console.log(`[SW ${SW_VERSION}] Service Worker loaded`);
