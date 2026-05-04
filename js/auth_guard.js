// js/auth_guard.js

(function patientGuard() {
    const token = localStorage.getItem('access_token');
    let currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // 1. Not Logged In - Kick out of protected pages
    if (!token) {
        if (currentPage !== 'index.html' && currentPage !== '' && currentPage !== 'home.html' && currentPage !== 'doctors.html') {
            console.warn("Restricted. Redirecting to Patient Login.");
            localStorage.removeItem('currentUser'); 
            window.location.replace('index.html'); 
        }
        return;
    }

    // 2. Logged In Check - Route to correct portals
    try {
        const payload = JSON.parse(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        
        if (payload.role === 'admin') {
            window.location.replace('admin/index.html');
            return;
        }
        if (payload.role !== 'user') {
            window.location.replace('provider/index.html');
            return;
        }

        // Teleport logged-in users away from the login screen
        if (currentPage === 'index.html' || currentPage === '') {
            window.location.replace('home.html');
        }

    } catch (error) {
        // Bad token fallback
        localStorage.removeItem('access_token');
        localStorage.removeItem('currentUser'); 
        if (currentPage !== 'index.html' && currentPage !== '' && currentPage !== 'home.html' && currentPage !== 'doctors.html') {
            window.location.replace('index.html');
        }
    }
})();