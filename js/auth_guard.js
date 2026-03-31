// js/patient/auth_guard.js

(function patientGuard() {
    const token = localStorage.getItem('access_token');
    let currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // 1. Not Logged In
    if (!token) {
        if (currentPage !== 'index.html') {
            console.warn("Restricted. Redirecting to Patient Login.");
            // 🚨 FIX: Added dot-slash for GitHub Pages compatibility
            window.location.replace('./index.html'); 
        }
        return;
    }

    // 2. Logged In Check
    try {
        const payload = JSON.parse(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        
        // Kick intruders to their correct portals
        if (payload.role === 'admin') {
            window.location.replace('../admin/index.html');
            return;
        }
        if (payload.role !== 'user') {
            window.location.replace('../provider/index.html');
            return;
        }

        // Teleport logged-in users away from the login screen
        if (currentPage === 'index.html') {
            // 🚨 FIX: Added dot-slash for GitHub Pages compatibility
            window.location.replace('./home.html');
        }

    } catch (error) {
        localStorage.removeItem('access_token');
        window.location.replace('./index.html');
    }
})();

// UI Updater for Navbar
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('access_token')) {
        const navLoginBtn = document.getElementById('nav-login-btn');
        if (navLoginBtn) {
            navLoginBtn.textContent = 'My Dashboard';
            navLoginBtn.href = 'profile.html'; 
        }
    }
});