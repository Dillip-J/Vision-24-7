// medicines.js
// ==========================================
// 🚨 SMART API ROUTER
// ==========================================
// let API_BASE;

// if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
//     // 💻 LOCAL MODE: You are testing on your laptop
//     API_BASE = 'http://127.0.0.1:8000';
//     console.log("🔌 Connected to LOCAL Backend");
// } else {
//     // 🌍 LIVE MODE: You are on the real internet
//     API_BASE = 'https://backend-depolyment-1.onrender.com'; 
//     console.log("☁️ Connected to LIVE Cloud Backend");
// }

document.addEventListener('DOMContentLoaded', () => {
    const pharmacyList = document.getElementById('pharmacy-list');
    const searchInput = document.getElementById('pharmacy-search');
    const countDisplay = document.getElementById('pharmacy-count');

    // --- 1. CATCH DATA FROM HOME PAGE SEARCH ---
    const autoQuery = localStorage.getItem('autoSearchQuery');
    if (autoQuery && searchInput) {
        searchInput.value = autoQuery.trim(); 
        localStorage.removeItem('autoSearchQuery'); 
    }

    // --- 2. THE RENDER ENGINE ---
    async function renderPharmacies() {
        let providers = [];
        try {
            const response = await fetch(`${API_BASE}/home/nearest?lat=0&lon=0&category=Pharmacy`);
            if (!response.ok) throw new Error("API Offline");
            
            providers = await response.json();
            localStorage.setItem('eterna_cache_pharmacies', JSON.stringify(providers)); // Cache it!

        } catch (err) {
            console.warn("Network Error: Loading pharmacies from cache.");
            const cachedData = localStorage.getItem('eterna_cache_pharmacies');
            providers = cachedData ? JSON.parse(cachedData) : []; // Use cache or empty array
        }
        
        // Step B: Filter Logic (Supporting both backend 'provider_type' and mock 'type')
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const filtered = providers.filter(p => {
            const isPharmacy = (p.provider_type === 'Pharmacy' || p.type === 'Pharmacy');
            const name = (p.name || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            return isPharmacy && (searchTerm === '' || name.includes(searchTerm) || category.includes(searchTerm));
        });

        if(countDisplay) countDisplay.textContent = filtered.length;
        
        if (filtered.length === 0) {
            pharmacyList.innerHTML = `
                <div class="no-results-state">
                    <i class="fa-solid fa-store"></i>
                    <h3>No pharmacies found</h3>
                    <p>We are expanding our pharmacy network. Check back soon!</p>
                </div>`;
            return;
        }

        pharmacyList.innerHTML = '';
        
        filtered.forEach(pharm => {
            // Map Backend names to Frontend
            const imgUrl = pharm.profile_photo_url ? `${API_BASE}${pharm.profile_photo_url}` : (pharm.profilePic || "");
            const displayCategory = pharm.category || 'Medicines & Equipment';
            const providerId = pharm.provider_id || pharm.id; // Support both UUID and Mock ID

            const card = `
                <div class="doctor-card">
                    <div class="doc-avatar">
                        ${imgUrl ? `<img src="${imgUrl}" alt="${pharm.name}">` : `<i class="fa-solid fa-shop"></i>`}
                    </div>
                    <div class="doc-info">
                        <div class="doc-title-row">
                            <h2>${pharm.name}</h2>
                            <span class="exp-badge"><i class="fa-solid fa-check"></i> Licensed Shop</span>
                        </div>
                        <div class="doc-specialty">${displayCategory}</div>
                        <div class="doc-stats">
                            <span class="rating"><i class="fa-solid fa-motorcycle"></i> Same-Day Delivery Available</span>
                        </div>
                        <div class="doc-actions">
                            <button class="btn-primary" onclick="initiateMedicineOrder('${providerId}', '${pharm.name}', '${imgUrl}')">
                                <i class="fa-solid fa-bag-shopping"></i> Request Medicines
                            </button>
                        </div>
                    </div>
                </div>
            `;
            pharmacyList.insertAdjacentHTML('beforeend', card);
        });
    }

    if (searchInput) searchInput.addEventListener('input', renderPharmacies);
    renderPharmacies();
});

// ==========================================
// --- Global Routing & Auth Guard ---
// ==========================================
window.initiateMedicineOrder = function(pharmId, pharmName, pharmImg) {
    const defaultImg = "https://images.unsplash.com/photo-1587854692152-cbe668df9731?q=80&w=200&auto=format&fit=crop";

    // Build the "Cart" object for book.html and payment.html
    const bookingData = {
        provider_id: pharmId, // CRITICAL: Use the UUID for the backend
        doctorName: pharmName, 
        doctorSpecialty: "Prescription / Medicine Order", 
        visitType: "Delivery",
        doctorImage: pharmImg || defaultImg, 
        consultationFee: 0, // No "fee" to talk to a pharmacy
        visitCharge: 50,    // Delivery Charge
        platformFee: 15
    };

    localStorage.setItem('pendingBooking', JSON.stringify(bookingData));

    // SECURE JWT CHECK
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert("Please log in to order medicines.");
        localStorage.setItem('redirectAfterAuth', 'book.html');
        window.location.href = 'index.html'; 
        return;
    }
    
    window.location.href = 'book.html'; 
};