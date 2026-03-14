importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyANn1Y8sPRxRkPUxCJCP9wAw7xFOBYHFnw",
  authDomain: "harmonia-do-altar-467103.firebaseapp.com",
  projectId: "harmonia-do-altar-467103",
  storageBucket: "harmonia-do-altar-467103.firebasestorage.app",
  messagingSenderId: "109615151690",
  appId: "1:109615151690:web:99031c631ccec166f484b3"
});

const messaging = firebase.messaging();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.openWindow(url)
  );
});

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.svg',
    data: { url: payload.data?.url || '/' }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
