// js/config.js
// ==========================================
// 🚨 GLOBAL API ROUTER (LOAD THIS FIRST)
// ==========================================
let API_BASE;

if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
    API_BASE = 'http://127.0.0.1:8000';
    console.log("🔌 Connected to LOCAL Backend");
} else {
    API_BASE = 'https://backend-depolyment-1.onrender.com'; 
    console.log("☁️ Connected to LIVE Cloud Backend");
}