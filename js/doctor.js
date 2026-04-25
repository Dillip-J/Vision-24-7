// js/doctors.js
document.addEventListener('DOMContentLoaded', () => {
    
    // 🚨 Rely STRICTLY on config.js.
    const API_BASE = window.API_BASE;
    if (!API_BASE) {
        console.error("FATAL: window.API_BASE is missing. Ensure config.js is loaded first.");
        return;
    }

    const doctorList = document.getElementById('doctor-list');
    const doctorCountDisplay = document.getElementById('doctor-count');
    const searchInput = document.getElementById('doctor-search');
    const filterSpecialty = document.getElementById('filter-specialty');
    const filterTypeDropdown = document.getElementById('filter-type');

    // --- 1. GLOBAL MEMORY (Get Lat/Lon from user's local storage) ---
    let userLat = parseFloat(localStorage.getItem('user_lat')) || 0.0;
    let userLon = parseFloat(localStorage.getItem('user_lon')) || 0.0;
    const MAX_HOME_VISIT_RADIUS_KM = 15; // Set strict 15km boundary

    // 🚨 THE HAVERSINE FORMULA (Calculates exact KM between two GPS points)
    function calculateDistanceKM(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity; 
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; 
    }

    // ==========================================
    // --- 2. THE MESSENGER (Reads clicks from Home Page) ---
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
    }
    
    const autoQuery = localStorage.getItem('autoSearchQuery');
    if (autoQuery && searchInput) {
        searchInput.value = autoQuery.trim(); 
    }

    // ==========================================
    // --- 3. FASTAPI DATA FETCH ---
    // ==========================================
    async function fetchApprovedDoctors() {
        try {
            const response = await fetch(`${API_BASE}/home/nearest?lat=${userLat}&lon=${userLon}&category=Doctor`);
            if (!response.ok) throw new Error("API Offline");
            
            const freshData = await response.json();
            localStorage.setItem('eterna_cache_doctors', JSON.stringify(freshData));
            return freshData;
        } catch (err) {
            console.warn("Network Error: Loading real doctors from local cache...");
            const cachedData = localStorage.getItem('eterna_cache_doctors');
            return cachedData ? JSON.parse(cachedData) : []; 
        }
    }

    // ==========================================
    // --- 4. DYNAMIC RENDER & FILTER ---
    // ==========================================
    async function renderDoctors() {
        if (doctorList) doctorList.innerHTML = `<div style="text-align:center; padding: 40px; width: 100%;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Loading Providers...</p></div>`;
        
        const providers = await fetchApprovedDoctors();
        const doctorsOnly = providers.filter(p => p.provider_type === 'Doctor' || p.type === 'Doctor' || (!p.provider_type && !p.type));
        
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedSpecialty = filterSpecialty ? filterSpecialty.value.trim().toLowerCase() : 'all';
        const filterType = filterTypeDropdown ? filterTypeDropdown.value : 'all';

        const filtered = doctorsOnly.filter(doc => {
            const docName = (doc.name || '').trim().toLowerCase();
            const docCat = (doc.category || '').trim().toLowerCase();
            
            const nameMatch = searchTerm === '' || docName.includes(searchTerm) || docCat.includes(searchTerm);
            const specMatch = selectedSpecialty === 'all' || docCat === selectedSpecialty || docCat.includes(selectedSpecialty);
            
            // 🚨 THE DISTANCE FILTER 🚨
            let distMatch = true;
            if (filterType === 'home') {
                const docLat = parseFloat(doc.latitude);
                const docLon = parseFloat(doc.longitude);
                
                if (userLat !== 0 && userLon !== 0 && docLat && docLon) {
                    const distance = calculateDistanceKM(userLat, userLon, docLat, docLon);
                    if (distance > MAX_HOME_VISIT_RADIUS_KM) {
                        distMatch = false; // Doctor is too far away for a home visit!
                    }
                } else {
                    // If we lack GPS data for either the user or doctor, hide them for safety
                    distMatch = false; 
                }
            }
            
            return nameMatch && specMatch && distMatch;
        });

        if(doctorCountDisplay) doctorCountDisplay.textContent = filtered.length;
        
        if (filtered.length === 0) {
            if(doctorList) {
                doctorList.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; background: var(--card-bg); border-radius: 12px; border: 1px dashed var(--border-color); width: 100%;">
                        <i class="fa-solid fa-user-doctor" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 16px;"></i>
                        <h3 style="color: var(--text-primary); margin-bottom: 8px;">No providers found</h3>
                        <p style="color: var(--text-secondary);">There are currently no approved doctors matching your search criteria or within range for a Home Visit.</p>
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
            
            // Calculate real distance for display
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
            
            // If user explicitly filtered by "home", ONLY show the home button
            if (filterType === 'home' && showHome) {
                actionButtons += `
                    <button class="btn-outline" onclick="initiateDocBooking('${providerId}', 'Home Visit', '${doc.name}', '${displayCategory}', '${imgUrl}', ${consultFee}, ${visitCharge}, ${platformFee})">
                        <i class="fa-solid fa-location-dot"></i> Home - ₹${consultFee + visitCharge}
                    </button>
                `;
            } 
            // If user explicitly filtered by "video", ONLY show the video button
            else if (filterType === 'video' && showVideo) {
                actionButtons += `
                    <button class="btn-primary" onclick="initiateDocBooking('${providerId}', 'Video Consult', '${doc.name}', '${displayCategory}', '${imgUrl}', ${consultFee}, 0, ${platformFee})">
                        <i class="fa-solid fa-video"></i> Video - ₹${consultFee}
                    </button>
                `;
            } 
            // Show all available buttons if filter is "all"
            else {
                if (showVideo) {
                    actionButtons += `
                        <button class="btn-primary" onclick="initiateDocBooking('${providerId}', 'Video Consult', '${doc.name}', '${displayCategory}', '${imgUrl}', ${consultFee}, 0, ${platformFee})">
                            <i class="fa-solid fa-video"></i> Video - ₹${consultFee}
                        </button>
                    `;
                }
                if (showHome) {
                    actionButtons += `
                        <button class="btn-outline" onclick="initiateDocBooking('${providerId}', 'Home Visit', '${doc.name}', '${displayCategory}', '${imgUrl}', ${consultFee}, ${visitCharge}, ${platformFee})">
                            <i class="fa-solid fa-location-dot"></i> Home - ₹${consultFee + visitCharge}
                        </button>
                    `;
                }
            }

            const card = `
                <div class="doctor-card">
                    <div class="doc-avatar">
                        <img src="${imgUrl}" onerror="this.src='images/default-avatar.png'" alt="${doc.name}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">
                        <div class="verified-badge"><i class="fa-solid fa-check"></i></div>
                    </div>
                    <div class="doc-info">
                        <div class="doc-title-row">
                            <h2>${doc.name.includes('Dr.') ? doc.name : 'Dr. ' + doc.name}</h2>
                            <span class="exp-badge"><i class="fa-solid fa-shield-halved"></i> Verified</span>
                        </div>
                        <div class="doc-specialty">
                            ${displayCategory} 
                            ${displayDistance ? `<span style="font-size:0.85rem; color: var(--text-secondary); margin-left:10px;"><i class="fa-solid fa-location-dot"></i> ${displayDistance}</span>` : ''}
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

    renderDoctors().then(() => {
        // Destroy the messenger keys so they don't get stuck!
        localStorage.removeItem('autoSearchSpecialty'); 
        localStorage.removeItem('autoSearchQuery'); 
    });
});

// ==========================================
// --- 5. DYNAMIC GLOBAL ROUTING ---
// ==========================================
// Attached to window so the HTML onclick handlers can trigger it
window.initiateDocBooking = function(docId, type, docName, docCat, docImg, fee, visitFee, platFee) {
    
    // 1. Save the doctor's info to local storage
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

    // 2. Check if the user is logged in BEFORE sending them to book.html
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        // Not logged in? Store the destination, and send to login screen.
        localStorage.setItem('redirectAfterAuth', 'book.html');
        window.location.assign('index.html'); 
        return; 
    }

    // 3. Already logged in? Send straight to the booking page!
    window.location.assign('book.html');
}; 