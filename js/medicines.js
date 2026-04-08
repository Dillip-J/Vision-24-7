// js/medicines.js

document.addEventListener('DOMContentLoaded', () => {
    const pharmacyList = document.getElementById('pharmacy-list');
    const searchInput = document.getElementById('pharmacy-search');
    const countDisplay = document.getElementById('pharmacy-count');
    
    // UI Elements for Location Banner (If you added them to your HTML)
    const locationText = document.getElementById('current-location-text');
    const updateLocBtn = document.getElementById('btn-update-location');

    // ==========================================
    // --- 1. GLOBAL MEMORY (Get Lat/Lon) ---
    // ==========================================
    let userLat = parseFloat(localStorage.getItem('user_lat')) || 0.0;
    let userLon = parseFloat(localStorage.getItem('user_lon')) || 0.0;
    let userAddress = localStorage.getItem('user_address') || "Location not set";

    const updateLocationUI = () => {
        if (!locationText) return;
        if (userLat === 0.0) {
            locationText.innerHTML = "<strong>Location not set</strong> - ETAs are estimated.";
        } else {
            locationText.innerHTML = `Delivering to: <strong>${userAddress}</strong>`;
        }
    };

    updateLocationUI();

    // ==========================================
    // --- 2. GPS CAPTURE & CLOUD SYNC ---
    // ==========================================
    if (updateLocBtn) {
        updateLocBtn.addEventListener('click', async () => {
            const originalText = updateLocBtn.innerHTML;
            updateLocBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
            updateLocBtn.disabled = true;

            if (!navigator.geolocation) {
                alert("Your browser does not support geolocation.");
                resetLocBtn(originalText);
                return;
            }

            navigator.geolocation.getCurrentPosition(async (position) => {
                userLat = position.coords.latitude;
                userLon = position.coords.longitude;
                userAddress = "Current GPS Location"; 

                // Save locally for instant load next time
                localStorage.setItem('user_lat', userLat);
                localStorage.setItem('user_lon', userLon);
                localStorage.setItem('user_address', userAddress);

                updateLocationUI();

                // 🚨 SYNC TO CLOUD
                const token = localStorage.getItem('access_token');
                if (token) {
                    try {
                        await fetch(`${API_BASE}/users/me/location`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ latitude: userLat, longitude: userLon, address: userAddress })
                        });
                    } catch (e) {
                        console.warn("Could not sync location to cloud, but saved locally.");
                    }
                }

                // Reload the pharmacies with the NEW accurate distance math!
                renderPharmacies();
                resetLocBtn(originalText);

            }, (error) => {
                alert("Location access denied. Please enable GPS permissions.");
                resetLocBtn(originalText);
            });
        });
    }

    const resetLocBtn = (text) => {
        if(updateLocBtn) {
            updateLocBtn.innerHTML = text;
            updateLocBtn.disabled = false;
        }
    }

    // ==========================================
    // --- 3. SEARCH ENGINE ---
    // ==========================================
    const autoQuery = localStorage.getItem('autoSearchQuery');
    if (autoQuery && searchInput) {
        searchInput.value = autoQuery.trim(); 
        localStorage.removeItem('autoSearchQuery'); 
    }

    // ==========================================
    // --- 4. THE RENDER ENGINE ---
    // ==========================================
    async function renderPharmacies() {
        let providers = [];
        try {
            // 🚨 Send the GPS math to the backend!
            const response = await fetch(`${API_BASE}/home/nearest?lat=${userLat}&lon=${userLon}&category=Pharmacy`);
            if (!response.ok) throw new Error("API Offline");
            
            providers = await response.json();
            localStorage.setItem('eterna_cache_pharmacies', JSON.stringify(providers)); 

        } catch (err) {
            const cachedData = localStorage.getItem('eterna_cache_pharmacies');
            providers = cachedData ? JSON.parse(cachedData) : []; 
        }
        
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const filtered = providers.filter(p => {
            const isPharmacy = (p.provider_type === 'Pharmacy' || p.type === 'Pharmacy');
            const name = (p.name || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            return isPharmacy && (searchTerm === '' || name.includes(searchTerm) || category.includes(searchTerm));
        });

        if(countDisplay) countDisplay.textContent = filtered.length;
        
        if (filtered.length === 0) {
            if(pharmacyList) {
                pharmacyList.innerHTML = `
                    <div class="no-results-state" style="text-align: center; padding: 60px 20px; background: var(--card-bg); border-radius: 12px; border: 1px dashed var(--border-color);">
                        <i class="fa-solid fa-store" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 16px;"></i>
                        <h3 style="color: var(--text-primary); margin-bottom: 8px;">No pharmacies found</h3>
                        <p style="color: var(--text-secondary);">We are expanding our pharmacy network. Check back soon!</p>
                    </div>`;
            }
            return;
        }

        if(pharmacyList) pharmacyList.innerHTML = '';
        
        filtered.forEach(pharm => {
            const imgUrl = pharm.profile_photo_url ? `${API_BASE}${pharm.profile_photo_url}` : (pharm.profilePic || "");
            const displayCategory = pharm.category || 'Medicines & Equipment';
            const providerId = pharm.provider_id || pharm.id; 

            // 🚨 FETCH DYNAMIC ETA & DISTANCE FROM BACKEND
            const eta = pharm.eta_string || "45-60 mins";
            const distance = pharm.distance_km !== "Unknown" ? `${pharm.distance_km} km away` : "";
            const deliveryCharge = parseFloat(pharm.delivery_charge) || 50;
            const platformFee = 15;

            const card = `
                <div class="doctor-card">
                    <div class="doc-avatar">
                        ${imgUrl ? `<img src="${imgUrl}" alt="${pharm.name}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">` : `<div style="background: #ECFDF5; color: #10B981; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size: 2rem; border-radius:12px;"><i class="fa-solid fa-shop"></i></div>`}
                    </div>
                    <div class="doc-info">
                        <div class="doc-title-row">
                            <h2>${pharm.name}</h2>
                            <span class="text-secondary" style="font-size: 0.85rem;"><i class="fa-solid fa-location-dot"></i> ${distance}</span>
                        </div>
                        <div class="doc-specialty">${displayCategory}</div>
                        <div class="doc-stats">
                            <span class="rating" style="color: #10B981; background: #ECFDF5; border-color: #A7F3D0; padding: 4px 8px; border-radius: 4px;">
                                <i class="fa-solid fa-bolt"></i> Delivery in ${eta}
                            </span>
                        </div>
                        <div class="doc-actions">
                            <button class="btn-primary" onclick="initiateMedicineOrder('${providerId}', '${pharm.name}', '${imgUrl}', ${deliveryCharge}, ${platformFee}, '${eta}')">
                                <i class="fa-solid fa-bag-shopping"></i> Request (Delivery: ₹${deliveryCharge})
                            </button>
                        </div>
                    </div>
                </div>
            `;
            pharmacyList.insertAdjacentHTML('beforeend', card);
        });
    }

    if (searchInput) searchInput.addEventListener('input', renderPharmacies);
    
    // Initial Load
    renderPharmacies();
});

// ==========================================
// --- 5. GLOBAL ROUTING & AUTH GUARD ---
// ==========================================
window.initiateMedicineOrder = function(pharmId, pharmName, pharmImg, deliveryCharge, platFee, eta) {
    const defaultImg = "https://images.unsplash.com/photo-1587854692152-cbe668df9731?q=80&w=200&auto=format&fit=crop";

    // 🚨 Passing the exact ETA and saved address to the Checkout!
    const bookingData = {
        provider_id: pharmId, 
        doctorName: pharmName, 
        doctorSpecialty: `Prescription Order (ETA: ${eta})`, 
        visitType: "Delivery",
        doctorImage: pharmImg || defaultImg, 
        consultationFee: 0, 
        visitCharge: deliveryCharge,    
        platformFee: platFee,
        address: localStorage.getItem('user_address') || "Current Location" 
    };

    localStorage.setItem('pendingBooking', JSON.stringify(bookingData));

    const token = localStorage.getItem('access_token');
    if (!token) {
        alert("Please log in to order medicines.");
        localStorage.setItem('redirectAfterAuth', 'book.html');
        window.location.href = 'index.html'; 
        return;
    }
    
    window.location.href = 'book.html'; 
};