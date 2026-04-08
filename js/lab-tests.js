// js/labs.js
document.addEventListener('DOMContentLoaded', () => {
    const labList = document.getElementById('lab-list');
    const searchInput = document.getElementById('lab-search');
    const countDisplay = document.getElementById('lab-count');

    // ==========================================
    // --- 1. GLOBAL MEMORY (Get Lat/Lon) ---
    // ==========================================
    // 🚨 THIS FIXES THE 9,000KM DISTANCE BUG FOR LABS
    let userLat = parseFloat(localStorage.getItem('user_lat')) || 0.0;
    let userLon = parseFloat(localStorage.getItem('user_lon')) || 0.0;

    const autoQuery = localStorage.getItem('autoSearchQuery');
    if (autoQuery && searchInput) {
        searchInput.value = autoQuery.trim(); 
        localStorage.removeItem('autoSearchQuery'); 
    }

    async function renderLabs() {
        let providers = [];
        try {
            // 🚨 USE REAL GPS COORDINATES NOW!
            const response = await fetch(`${API_BASE}/home/nearest?lat=${userLat}&lon=${userLon}&category=Lab`);
            if (!response.ok) throw new Error("API Offline");
            
            providers = await response.json();
            localStorage.setItem('eterna_cache_labs', JSON.stringify(providers)); 

        } catch (err) {
            const cachedData = localStorage.getItem('eterna_cache_labs');
            providers = cachedData ? JSON.parse(cachedData) : []; 
        }
        
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const filtered = providers.filter(p => {
            const isLab = (p.provider_type === 'Lab' || p.type === 'Lab');
            const name = (p.name || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            return isLab && (searchTerm === '' || name.includes(searchTerm) || category.includes(searchTerm));
        });

        if(countDisplay) countDisplay.textContent = filtered.length;
        
        if (filtered.length === 0) {
            if(labList) {
                labList.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; background: var(--card-bg); border-radius: 12px; border: 1px dashed var(--border-color);">
                        <i class="fa-solid fa-flask" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 16px;"></i>
                        <h3 style="color: var(--text-primary); margin-bottom: 8px;">No labs found</h3>
                        <p style="color: var(--text-secondary);">We are expanding our network. Check back soon!</p>
                    </div>`;
            }
            return;
        }

        if(labList) labList.innerHTML = '';
        
        filtered.forEach(lab => {
            const imgUrl = lab.profile_photo_url ? `${API_BASE}${lab.profile_photo_url}` : (lab.profilePic || "");
            const displayCategory = lab.category || 'Diagnostic Center';
            const providerId = lab.provider_id || lab.id; 
            
            // 🚨 NO HARDCODING: Dynamic Prices & Distance
            const distance = lab.distance_km !== "Unknown" && lab.distance_km !== null ? `${lab.distance_km} km away` : "";
            const baseTestFee = parseFloat(lab.price) || 45; 
            const homeCollectionFee = parseFloat(lab.home_collection_charge) || 10;
            const platformFee = 2;

            const card = `
                <div class="doctor-card">
                    <div class="doc-avatar" style="background: #EFF6FF; color: #0284C7; display: flex; justify-content: center; align-items: center; font-size: 2.5rem; overflow: hidden; border-radius: 12px;">
                        ${imgUrl ? `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<i class="fa-solid fa-microscope"></i>`}
                    </div>
                    <div class="doc-info">
                        <div class="doc-title-row">
                            <h2>${lab.name}</h2>
                            <span class="exp-badge"><i class="fa-solid fa-shield-halved"></i> NABL Verified</span>
                        </div>
                        <div class="doc-specialty">
                            ${displayCategory}
                            ${distance ? `<span style="font-size:0.85rem; color: var(--text-secondary); margin-left:10px;"><i class="fa-solid fa-location-dot"></i> ${distance}</span>` : ''}
                        </div>
                        <div class="doc-stats">
                            <span class="rating"><i class="fa-solid fa-truck-medical"></i> Home Collection: ₹${homeCollectionFee}</span>
                        </div>
                        <div class="doc-actions">
                            <button class="btn-primary" onclick="initiateLabBooking('${providerId}', '${lab.name}', '${displayCategory}', '${imgUrl}', ${baseTestFee}, ${homeCollectionFee}, ${platformFee})">
                                <i class="fa-solid fa-flask-vial"></i> Book Test
                            </button>
                        </div>
                    </div>
                </div>
            `;
            labList.insertAdjacentHTML('beforeend', card);
        });
    }

    if (searchInput) searchInput.addEventListener('input', renderLabs);
    renderLabs();
});

// ==========================================
// --- 5. DYNAMIC GLOBAL ROUTING ---
// ==========================================
// 🚨 Accepts dynamic fees and passes saved address
window.initiateLabBooking = function(labId, labName, labCat, labImg, testFee, visitFee, platFee) {
    const defaultImg = "https://images.unsplash.com/photo-1579154204601-01588f351e67?q=80&w=200&auto=format&fit=crop";
    
    const bookingData = {
        provider_id: labId, 
        doctorName: labName, 
        doctorSpecialty: labCat, 
        visitType: "Home Visit",
        doctorImage: labImg || defaultImg, 
        consultationFee: testFee, 
        visitCharge: visitFee,    
        platformFee: platFee,
        // 🚨 Pass the GPS address forward!
        address: localStorage.getItem('user_address') || "Current Location"
    };

    localStorage.setItem('pendingBooking', JSON.stringify(bookingData));

    const token = localStorage.getItem('access_token');
    if (!token) {
        alert("Please log in or create an account to book a lab test.");
        localStorage.setItem('redirectAfterAuth', 'book.html');
        window.location.href = 'index.html'; 
        return;
    }
    window.location.href = 'book.html';
};