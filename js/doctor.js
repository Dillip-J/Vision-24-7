// js/doctors.js
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
    
    const doctorList = document.getElementById('doctor-list');
    const doctorCountDisplay = document.getElementById('doctor-count');
    const searchInput = document.getElementById('doctor-search');
    const filterSpecialty = document.getElementById('filter-specialty');

    // ==========================================
    // --- 1. THE MESSENGER (CATCH DATA FROM HOME PAGE) ---
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
    // --- 2. FASTAPI DATA FETCH (With Offline Caching) ---
    // ==========================================
    async function fetchApprovedDoctors() {
        try {
            const response = await fetch(`${API_BASE}/home/nearest?lat=0&lon=0&category=Doctor`);
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
    // --- 3. RENDER & FILTER DOCTORS ---
    // ==========================================
    async function renderDoctors() {
        const providers = await fetchApprovedDoctors();
        
        const doctorsOnly = providers.filter(p => p.provider_type === 'Doctor' || p.type === 'Doctor' || (!p.provider_type && !p.type));
        
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedSpecialty = filterSpecialty ? filterSpecialty.value.trim().toLowerCase() : 'all';

        const filtered = doctorsOnly.filter(doc => {
            const docName = (doc.name || '').trim().toLowerCase();
            const docCat = (doc.category || '').trim().toLowerCase();
            
            const nameMatch = searchTerm === '' || docName.includes(searchTerm) || docCat.includes(searchTerm);
            const specMatch = selectedSpecialty === 'all' || docCat === selectedSpecialty || docCat.includes(selectedSpecialty);
            
            return nameMatch && specMatch;
        });

        if(doctorCountDisplay) doctorCountDisplay.textContent = filtered.length;
        
        if (filtered.length === 0) {
            if(doctorList) {
                doctorList.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; background: var(--card-bg); border-radius: 12px; border: 1px dashed var(--border-color);">
                        <i class="fa-solid fa-user-doctor" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 16px;"></i>
                        <h3 style="color: var(--text-primary); margin-bottom: 8px;">No providers found</h3>
                        <p style="color: var(--text-secondary);">There are currently no approved doctors matching your search criteria.</p>
                    </div>`;
            }
            return;
        }

        if(doctorList) doctorList.innerHTML = '';
        
        filtered.forEach(doc => {
            const imgUrl = doc.profile_photo_url ? `${API_BASE}${doc.profile_photo_url}` : (doc.profilePic || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=200&auto=format&fit=crop");
            const providerId = doc.provider_id || doc.id; 
            const displayCategory = doc.category || 'Specialist';
            
            const consultFee = 500; 
            const visitCharge = 200; 

            const card = `
                <div class="doctor-card">
                    <div class="doc-avatar">
                        <img src="${imgUrl}" alt="${doc.name}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;">
                        <div class="verified-badge"><i class="fa-solid fa-check"></i></div>
                    </div>
                    <div class="doc-info">
                        <div class="doc-title-row">
                            <h2>${doc.name.includes('Dr.') ? doc.name : 'Dr. ' + doc.name}</h2>
                            <span class="exp-badge"><i class="fa-solid fa-shield-halved"></i> Verified</span>
                        </div>
                        <div class="doc-specialty">${displayCategory}</div>
                        <div class="doc-stats">
                            <span class="rating">⭐ 4.9 <span class="reviews">(Dynamic DB)</span></span>
                        </div>
                        <div class="doc-actions">
                            <button class="btn-primary" onclick="initiateDocBooking('${providerId}', 'Video Consult', '${doc.name}', '${displayCategory}', '${imgUrl}')">
                                <i class="fa-solid fa-video"></i> Video - ₹${consultFee}
                            </button>
                            <button class="btn-outline" onclick="initiateDocBooking('${providerId}', 'Home Visit', '${doc.name}', '${displayCategory}', '${imgUrl}')">
                                <i class="fa-solid fa-location-dot"></i> Home - ₹${consultFee + visitCharge}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            doctorList.insertAdjacentHTML('beforeend', card);
        });
    }

    // ==========================================
    // --- 4. ATTACH LISTENERS & INITIALIZE ---
    // ==========================================
    if (searchInput) searchInput.addEventListener('input', renderDoctors);
    if (filterSpecialty) filterSpecialty.addEventListener('change', renderDoctors);

    // Run the initial render, THEN wipe the messenger memory
    renderDoctors().then(() => {
        localStorage.removeItem('autoSearchSpecialty'); 
        localStorage.removeItem('autoSearchQuery'); 
    });
});

// ==========================================
// --- 5. GLOBAL ROUTING & AUTH GUARD ---
// ==========================================
window.initiateDocBooking = function(docId, type, docName, docCat, docImg) {
    const bookingData = {
        provider_id: docId, 
        doctorName: docName.includes('Dr.') ? docName : 'Dr. ' + docName, 
        doctorSpecialty: docCat, 
        visitType: type, 
        doctorImage: docImg, 
        consultationFee: 500, 
        visitCharge: type === 'Home Visit' ? 200 : 0, 
        platformFee: 15
    };
    
    localStorage.setItem('pendingBooking', JSON.stringify(bookingData));

    const token = localStorage.getItem('access_token');
    if (!token) {
        alert("Please log in or create an account to complete your booking.");
        localStorage.setItem('redirectAfterAuth', 'book.html');
        window.location.href = 'index.html'; 
        return; 
    }

    window.location.href = 'book.html';
};