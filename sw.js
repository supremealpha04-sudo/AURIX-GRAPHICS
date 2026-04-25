const CACHE_NAME = 'aurex-cache-v3';
const OFFLINE_URL = '/offline.html';

const urlsToCache = [
  '/',
  '/index.html',
  '/privacy.html',
  '/terms.html',
  '/offline.html',
  '/manifest.json',
  '/IMG-20260403-WA0021(1).jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Poppins:wght@300;400;500;600;700&display=swap'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing AUREX PWA...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching core assets');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('[Service Worker] Cache failed:', err);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating AUREX PWA...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - offline-first strategy
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // For HTML pages - network first with fallback to cache
  if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the new version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) return cachedResponse;
              // If no cache, show offline page
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }
  
  // For images, CSS, JS - cache first (stale-while-revalidate)
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        const fetchPromise = fetch(request)
          .then(networkResponse => {
            // Update cache with new version
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, networkResponse.clone());
            });
            return networkResponse;
          })
          .catch(() => {
            // If network fails and no cache, return placeholder for images
            if (request.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) {
              // Try to return the cached logo if available
              return caches.match('/IMG-20260403-WA0021(1).jpg')
                .then(logoCache => {
                  if (logoCache) return logoCache;
                  return new Response('Image offline', { 
                    status: 200, 
                    headers: { 'Content-Type': 'text/plain' } 
                  });
                });
            }
            return cachedResponse;
          });
        
        return cachedResponse || fetchPromise;
      })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-forms') {
    event.waitUntil(syncForms());
  }
});

function syncForms() {
  return caches.open('form-data').then(cache => {
    return cache.keys().then(requests => {
      return Promise.all(
        requests.map(async request => {
          const formData = await cache.match(request);
          if (formData) {
            const data = await formData.json();
            console.log('[Service Worker] Syncing form data:', data);
            // Here you could send to an API endpoint
            await cache.delete(request);
          }
        })
      );
    });
  });
}

// Push notification handler
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New update from AUREX!',
    icon: '/IMG-20260403-WA0021(1).jpg',
    badge: '/IMG-20260403-WA0021(1).jpg',
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };
  
  event.waitUntil(
    self.registration.showNotification('AUREX Studio', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// Handle message from client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
