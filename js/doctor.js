// js/doctors.js
document.addEventListener('DOMContentLoaded', () => {
    
    // 🚨 THE SAFETY NET: Try to use config.js, but if it fails/404s, use the live Render URL!
    const API_BASE = window.API_BASE || 'https://backend-depolyment-3.onrender.com';
    
    if (!API_BASE) {
        console.error("FATAL: API_BASE is missing.");
        return;
    }

    const doctorList = document.getElementById('doctor-list');
    const doctorCountDisplay = document.getElementById('doctor-count');
    const searchInput = document.getElementById('doctor-search');
    const filterSpecialty = document.getElementById('filter-specialty');
    const filterTypeDropdown = document.getElementById('filter-type');

    let userLat = parseFloat(localStorage.getItem('user_lat')) || 0.0;
    let userLon = parseFloat(localStorage.getItem('user_lon')) || 0.0;
    const MAX_HOME_VISIT_RADIUS_KM = 15; 

    function calculateDistanceKM(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity; 
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; 
    }

    // ==========================================
    // --- 1. THE MESSENGER (Grabs Home Page Clicks) ---
    // ==========================================
    const autoSpecialty = localStorage.getItem('autoSearchSpecialty');
    if (autoSpecialty && filterSpecialty) {
        const searchStr = autoSpecialty.trim().toLowerCase();
        let matchFound = Array.from(filterSpecialty.options).find(opt => opt.value.trim().toLowerCase() === searchStr);
        
        if (matchFound) {
            filterSpecialty.value = matchFound.value; 
        } else {
            filterSpecialty.add(new Option(autoSpecialty.trim(), autoSpecialty.trim()));
            filterSpecialty.value = autoSpecialty.trim();
        }
        localStorage.removeItem('autoSearchSpecialty');
    }
    
    const autoQuery = localStorage.getItem('autoSearchQuery');
    if (autoQuery && searchInput) {
        searchInput.value = autoQuery.trim(); 
        localStorage.removeItem('autoSearchQuery');
    }

    // ==========================================
    // --- 2. GPS & DATA FETCH SEQUENCE ---
    // ==========================================
    let rawDoctorData = [];

    async function fetchDoctorsWithLocation(lat, lon) {
        if (doctorList) doctorList.innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin fa-2x loading-icon"></i><p class="loading-text">Loading Providers...</p></div>`;
        
        try {
            // If we have GPS, ask for nearest. If not, just get everyone.
            let fetchUrl = `${API_BASE}/home/nearest?category=Doctor`;
            if (lat !== 0 && lon !== 0) {
                fetchUrl = `${API_BASE}/home/nearest?lat=${lat}&lon=${lon}&category=Doctor`;
            }

            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error("API Offline");
            
            const freshData = await response.json();
            
            rawDoctorData = freshData.filter(p => p.provider_type === 'Doctor' || p.type === 'Doctor' || (!p.provider_type && !p.type));
            localStorage.setItem('eterna_cache_doctors', JSON.stringify(rawDoctorData));
            
            renderDoctors();

        } catch (err) {
            console.warn("Network Error: Loading real doctors from local cache...");
            const cachedData = localStorage.getItem('eterna_cache_doctors');
            rawDoctorData = cachedData ? JSON.parse(cachedData) : []; 
            renderDoctors();
        }
    }

    // 🚨 THE LOCATION TRIGGER 🚨
    function initializeData() {
        if (doctorList) doctorList.innerHTML = `<div class="loading-state"><i class="fa-solid fa-location-crosshairs fa-fade fa-2x loading-icon"></i><p class="loading-text">Locating you...</p></div>`;

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    userLat = position.coords.latitude;
                    userLon = position.coords.longitude;
                    localStorage.setItem('user_lat', userLat);
                    localStorage.setItem('user_lon', userLon);
                    fetchDoctorsWithLocation(userLat, userLon);
                },
                (error) => {
                    console.warn("Location denied or unavailable. Fetching all doctors without GPS filtering.");
                    userLat = 0.0;
                    userLon = 0.0;
                    fetchDoctorsWithLocation(0.0, 0.0); 
                },
                { timeout: 5000 } 
            );
        } else {
            console.warn("Browser does not support geolocation.");
            fetchDoctorsWithLocation(0.0, 0.0);
        }
    }

    // ==========================================
    // --- 3. DYNAMIC RENDER & FILTER ---
    // ==========================================
    function renderDoctors() {
        
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedSpecialty = filterSpecialty ? filterSpecialty.value.trim().toLowerCase() : 'all';
        const filterType = filterTypeDropdown ? filterTypeDropdown.value : 'all';

        const filtered = rawDoctorData.filter(doc => {
            const docName = (doc.name || '').trim().toLowerCase();
            const docCat = (doc.category || '').trim().toLowerCase();
            
            const nameMatch = searchTerm === '' || docName.includes(searchTerm) || docCat.includes(searchTerm);
            const specMatch = selectedSpecialty === 'all' || docCat === selectedSpecialty;
            
            let distMatch = true;
            if (filterType === 'home') {
                const docLat = parseFloat(doc.latitude);
                const docLon = parseFloat(doc.longitude);
                
                if (userLat !== 0 && userLon !== 0 && docLat && docLon) {
                    const distance = calculateDistanceKM(userLat, userLon, docLat, docLon);
                    if (distance > MAX_HOME_VISIT_RADIUS_KM) {
                        distMatch = false; 
                    }
                } 
            }
            
            return nameMatch && specMatch && distMatch;
        });

        if(doctorCountDisplay) doctorCountDisplay.textContent = filtered.length;
        
        if (filtered.length === 0) {
            if(doctorList) {
                doctorList.innerHTML = `
                    <div class="empty-state-box">
                        <i class="fa-solid fa-user-doctor empty-icon"></i>
                        <h3 class="empty-title">No providers found</h3>
                        <p class="empty-desc">Try adjusting your search filters or check your internet connection.</p>
                    </div>`;
            }
            return;
        }

        if(doctorList) doctorList.innerHTML = '';
        
        filtered.forEach(doc => {
            let imgUrl = "images/default-avatar.png"; 
            if (doc.profile_photo_url) {
                imgUrl = doc.profile_photo_url.startsWith('http') 
                    ? doc.profile_photo_url 
                    : `${API_BASE}${doc.profile_photo_url}`;
            }

            const providerId = doc.provider_id || doc.id; 
            const displayCategory = doc.category || 'Specialist';
            
            let displayDistance = "";
            if (userLat !== 0 && userLon !== 0 && doc.latitude && doc.longitude) {
                const dist = calculateDistanceKM(userLat, userLon, parseFloat(doc.latitude), parseFloat(doc.longitude));
                if (dist !== Infinity) displayDistance = `${dist.toFixed(1)} km away`;
            } else if (doc.distance_km && doc.distance_km !== "Unknown") {
                displayDistance = `${doc.distance_km} km away`;
            }

            let consultFee = parseFloat(doc.price) || 500;
            let visitCharge = parseFloat(doc.home_visit_charge) || 200;
            const platformFee = 15; 
            
            let showVideo = true;
            let showHome = true;
            let actionButtons = '';
            
            if (filterType === 'home' && showHome) {
                actionButtons += `<button class="btn-outline" onclick="initiateDocBooking('${providerId}', 'Home Visit', '${doc.name}', '${displayCategory}', '${imgUrl}', ${consultFee}, ${visitCharge}, ${platformFee})"><i class="fa-solid fa-location-dot"></i> Home - ₹${consultFee + visitCharge}</button>`;
            } 
            else if (filterType === 'video' && showVideo) {
                actionButtons += `<button class="btn-primary" onclick="initiateDocBooking('${providerId}', 'Video Consult', '${doc.name}', '${displayCategory}', '${imgUrl}', ${consultFee}, 0, ${platformFee})"><i class="fa-solid fa-video"></i> Video - ₹${consultFee}</button>`;
            } 
            else {
                if (showVideo) actionButtons += `<button class="btn-primary" onclick="initiateDocBooking('${providerId}', 'Video Consult', '${doc.name}', '${displayCategory}', '${imgUrl}', ${consultFee}, 0, ${platformFee})"><i class="fa-solid fa-video"></i> Video - ₹${consultFee}</button>`;
                if (showHome) actionButtons += `<button class="btn-outline" onclick="initiateDocBooking('${providerId}', 'Home Visit', '${doc.name}', '${displayCategory}', '${imgUrl}', ${consultFee}, ${visitCharge}, ${platformFee})"><i class="fa-solid fa-location-dot"></i> Home - ₹${consultFee + visitCharge}</button>`;
            }

            // Fallback if provider has no services
            if (!showVideo && !showHome) {
                actionButtons = `<button class="btn-outline btn-disabled" disabled><i class="fa-solid fa-ban"></i> No Services</button>`;
            }

            const card = `
                <div class="doctor-card">
                    <div class="doc-avatar">
                        <img src="${imgUrl}" onerror="this.src='images/default-avatar.png'" alt="${doc.name}" class="doc-profile-img">
                        <div class="verified-badge"><i class="fa-solid fa-check"></i></div>
                    </div>
                    <div class="doc-info">
                        <div class="doc-title-row">
                            <h2>${doc.name.includes('Dr.') ? doc.name : 'Dr. ' + doc.name}</h2>
                            <span class="exp-badge"><i class="fa-solid fa-shield-halved"></i> Verified</span>
                        </div>
                        <div class="doc-specialty">
                            ${displayCategory} 
                            ${displayDistance ? `<span class="doc-distance-text"><i class="fa-solid fa-location-dot"></i> ${displayDistance}</span>` : ''}
                        </div>
                        <div class="doc-actions">
                            ${actionButtons}
                        </div>
                    </div>
                </div>
            `;
            doctorList.insertAdjacentHTML('beforeend', card);
        });
    }

    if (searchInput) searchInput.addEventListener('input', renderDoctors);
    if (filterSpecialty) filterSpecialty.addEventListener('change', renderDoctors);
    if (filterTypeDropdown) filterTypeDropdown.addEventListener('change', renderDoctors);

    // KICK OFF THE PROCESS
    initializeData();
});

// ==========================================
// --- 4. DYNAMIC GLOBAL ROUTING ---
// ==========================================
window.initiateDocBooking = function(docId, type, docName, docCat, docImg, fee, visitFee, platFee) {
    const bookingData = {
        provider_id: docId, 
        doctorName: docName.includes('Dr.') ? docName : 'Dr. ' + docName, 
        doctorSpecialty: docCat, 
        visitType: type, 
        doctorImage: docImg, 
        consultationFee: fee, 
        visitCharge: visitFee, 
        platformFee: platFee,
        address: type === 'Home Visit' ? (localStorage.getItem('user_address') || "Location not set") : "Platform Default"
    };
    
    localStorage.setItem('pendingBooking', JSON.stringify(bookingData));

    const token = localStorage.getItem('access_token');
    if (!token) {
        localStorage.setItem('redirectAfterAuth', 'book.html');
        window.location.assign('index.html'); 
        return; 
    }

    window.location.assign('book.html');
};