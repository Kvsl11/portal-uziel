(function disableInspect() {
// Bloqueia clique direito
document.addEventListener('contextmenu', e => e.preventDefault());

// Bloqueia F12, Ctrl+Shift+I/J, Ctrl+U
document.addEventListener('keydown', e => {
    const forbidden =
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I', 'J'].includes(e.key)) ||
    (e.ctrlKey && e.key === 'U');
    if (forbidden) e.preventDefault();
});

// Impede abertura do console pelo DevTools
Object.defineProperty(window, 'console', {
    get() { throw new Error('Acesso ao console bloqueado'); }
});
})();
