// js/doctors.js
document.addEventListener('DOMContentLoaded', () => {
    
    const API_BASE = window.API_BASE || 'https://backend-depolyment-3.onrender.com';

    const doctorList = document.getElementById('doctor-list');
    const doctorCountDisplay = document.getElementById('doctor-count');
    const searchInput = document.getElementById('doctor-search');
    const filterSpecialty = document.getElementById('filter-specialty');
    
    const filterType = document.getElementById('filter-type'); 
    const sortFilter = document.getElementById('sort-filter');

    let userLat = parseFloat(localStorage.getItem('user_lat')) || 0.0;
    let userLon = parseFloat(localStorage.getItem('user_lon')) || 0.0;

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

    async function renderDoctors() {
        const providers = await fetchApprovedDoctors();
        
        const doctorsOnly = providers.filter(p => p.provider_type === 'Doctor' || p.type === 'Doctor' || (!p.provider_type && !p.type));
        
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const selectedSpecialty = filterSpecialty ? filterSpecialty.value.trim().toLowerCase() : 'all';
        const selectedType = filterType ? filterType.value.toLowerCase() : 'all';
        const selectedSort = sortFilter ? sortFilter.value : 'closest';

        const filtered = doctorsOnly.filter(doc => {
            const docName = (doc.name || '').trim().toLowerCase();
            const docCat = (doc.category || '').trim().toLowerCase();
            
            const nameMatch = searchTerm === '' || docName.includes(searchTerm) || docCat.includes(searchTerm);
            const specMatch = selectedSpecialty === 'all' || docCat === selectedSpecialty || docCat.includes(selectedSpecialty);
            
            let hasVideo = false;
            let hasHome = false;
            if (doc.doctor_services && doc.doctor_services.length > 0) {
                hasVideo = !!doc.doctor_services.find(s => s.service_name.toLowerCase().includes("video"));
                hasHome = !!doc.doctor_services.find(s => s.service_name.toLowerCase().includes("home"));
            } else {
                hasVideo = true; hasHome = true; 
            }

            let typeMatch = true;
            if (selectedType === 'video' && !hasVideo) typeMatch = false;
            if (selectedType === 'home' && !hasHome) typeMatch = false;

            return nameMatch && specMatch && typeMatch;
        });

        if (selectedSort === 'closest') {
            filtered.sort((a, b) => (a.distance_km === 'Unknown' ? 999 : a.distance_km) - (b.distance_km === 'Unknown' ? 999 : b.distance_km));
        } else if (selectedSort === 'price_low') {
            filtered.sort((a, b) => (a.price || 500) - (b.price || 500));
        } else if (selectedSort === 'price_high') {
            filtered.sort((a, b) => (b.price || 500) - (a.price || 500));
        }

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
            const safeName = doc.name.replace(/'/g, "\\'");

            let avatarHtml = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#1E293B; color:#fff; border-radius:12px; font-size:2rem;"><i class="fa-solid fa-user-doctor"></i></div>`;
            let imgUrl = "";

            if (doc.profile_photo_url) {
                imgUrl = doc.profile_photo_url.startsWith('http') 
                    ? doc.profile_photo_url 
                    : `${API_BASE}${doc.profile_photo_url}`;
                
                avatarHtml = `<img src="${imgUrl}" alt="${safeName}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name)}&background=1E293B&color=fff&size=128';">`;
            }

            const providerId = doc.provider_id || doc.id; 
            const displayCategory = doc.category || 'Specialist';
            const distance = doc.distance_km !== "Unknown" ? `${doc.distance_km} km away` : "";

            let consultFee = 500;
            let visitCharge = 200;
            
            let showVideo = false;
            let showHome = false;

            if (doc.doctor_services && doc.doctor_services.length > 0) {
                const videoService = doc.doctor_services.find(s => s.service_name.toLowerCase().includes("video"));
                if (videoService) {
                    showVideo = true;
                    consultFee = parseFloat(videoService.price);
                }

                const homeService = doc.doctor_services.find(s => s.service_name.toLowerCase().includes("home"));
                if (homeService) {
                    showHome = true;
                    visitCharge = parseFloat(homeService.price) - consultFee;
                    if (visitCharge < 0) visitCharge = 0; 
                }
            } else {
                showVideo = true;
                showHome = true;
                consultFee = parseFloat(doc.price) || parseFloat(doc.base_price) || 500;
                visitCharge = parseFloat(doc.home_visit_charge) || 200; 
            }

            let actionButtons = '';
            
            if (showVideo) {
                actionButtons += `
                    <button class="btn-primary" onclick="initiateDocBooking('${providerId}', 'Video Consult', '${safeName}', '${displayCategory}', '${imgUrl}', ${consultFee}, 0)">
                        <i class="fa-solid fa-video"></i> Video - ₹${consultFee}
                    </button>
                `;
            }
            
            if (showHome) {
                actionButtons += `
                    <button class="btn-outline" onclick="initiateDocBooking('${providerId}', 'Home Visit', '${safeName}', '${displayCategory}', '${imgUrl}', ${consultFee}, ${visitCharge})">
                        <i class="fa-solid fa-location-dot"></i> Home - ₹${consultFee + visitCharge}
                    </button>
                `;
            }

            if (!showVideo && !showHome) {
                actionButtons = `<button class="btn-outline" disabled style="opacity: 0.5; cursor: not-allowed;"><i class="fa-solid fa-ban"></i> No Services Available</button>`;
            }

            const card = `
                <div class="doctor-card">
                    <div class="doc-avatar">
                        ${avatarHtml}
                        <div class="verified-badge"><i class="fa-solid fa-check"></i></div>
                    </div>
                    <div class="doc-info">
                        <div class="doc-title-row">
                            <h2>${doc.name.includes('Dr.') ? doc.name : 'Dr. ' + doc.name}</h2>
                            <span class="exp-badge"><i class="fa-solid fa-shield-halved"></i> Verified</span>
                        </div>
                        <div class="doc-specialty">
                            ${displayCategory} 
                            ${distance ? `<span style="font-size:0.85rem; color: var(--text-secondary); margin-left:10px;"><i class="fa-solid fa-location-dot"></i> ${distance}</span>` : ''}
                        </div>
                        <div class="doc-actions" style="margin-top: 12px;">
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
    if (filterType) filterType.addEventListener('change', renderDoctors);
    if (sortFilter) sortFilter.addEventListener('change', renderDoctors);

    renderDoctors().then(() => {
        localStorage.removeItem('autoSearchSpecialty'); 
        localStorage.removeItem('autoSearchQuery'); 
    });
});

window.initiateDocBooking = function(docId, type, docName, docCat, docImg, fee, visitFee) {
    const bookingData = {
        provider_id: docId, 
        doctorName: docName.includes('Dr.') ? docName : 'Dr. ' + docName, 
        doctorSpecialty: docCat, 
        visitType: type, 
        doctorImage: docImg, 
        consultationFee: fee, 
        visitCharge: visitFee, 
        address: type === 'Home Visit' ? (localStorage.getItem('user_address') || "Location not set") : "Platform Default"
    };
    
    localStorage.setItem('pendingBooking', JSON.stringify(bookingData));

    const token = localStorage.getItem('access_token');
    if (!token) {
        alert("Please log in or create an account to complete your booking.");
        // 🚨 FIX: Corrected your typo right here!
        localStorage.setItem('redirectAfterAuth', 'book.html');
        window.location.href = 'index.html'; 
        return; 
    }

    window.location.href = 'book.html';
};