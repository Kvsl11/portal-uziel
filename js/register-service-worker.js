// Este código registra o Service Worker para o PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then(registration => {
      console.log('Service Worker registrado com sucesso!');
    }).catch(err => {
      console.log('Falha ao registrar o Service Worker: ', err);
    });
  });
}
