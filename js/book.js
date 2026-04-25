// js/book.js
document.addEventListener('DOMContentLoaded', () => {

    // 🚨 Rely STRICTLY on config.js.
    const API_BASE = window.API_BASE;
    if (!API_BASE) {
        console.error("FATAL: window.API_BASE is missing. Ensure config.js is loaded.");
        alert("Configuration Error: Cannot connect to server.");
        return;
    }

    const savedService = JSON.parse(localStorage.getItem('pendingBooking'));
    const token = localStorage.getItem('access_token');
    
    if (!token || !savedService) {
        window.location.replace('index.html');
        return; 
    }

    const doctorData = savedService;
    const currentProviderId = doctorData.provider_id || doctorData.id;

    // ==========================================================
    // 🚨 FETCH FULL PROFILE (BIO, PHONE, & GPS)
    // ==========================================================
    const cachedDoctors = JSON.parse(localStorage.getItem('eterna_cache_doctors') || '[]');
    const fullDocData = cachedDoctors.find(d => (d.provider_id || d.id) === currentProviderId);
    
    const bioEl = document.getElementById('dyn-doc-bio');
    const phoneEl = document.getElementById('dyn-doc-phone');

    if (fullDocData) {
        if (bioEl) bioEl.textContent = fullDocData.bio || "No description provided by this professional.";
        if (phoneEl) phoneEl.textContent = fullDocData.phone || "Contact not available";
    } else {
        if (bioEl) bioEl.textContent = "Provider details unavailable.";
        if (phoneEl) phoneEl.textContent = "N/A";
    }

    // ==========================================================
    // 🚨 THE DOCTOR ICON FIX
    // ==========================================================
    const docImgEl = document.getElementById('dyn-doc-img');
    if(docImgEl) {
        const rawImg = doctorData.doctorImage || doctorData.doctor_image || "";
        const parentDiv = docImgEl.parentElement; 
        
        parentDiv.style.display = 'flex';
        parentDiv.style.alignItems = 'center';
        parentDiv.style.justifyContent = 'center';
        parentDiv.style.background = 'rgba(37, 99, 235, 0.1)';
        parentDiv.style.overflow = 'hidden';

        const iconHtml = `<i class="fa-solid fa-user-doctor" style="color: var(--brand-blue); font-size: 3.5rem;"></i>`;

        if (!rawImg || rawImg.includes('default-avatar') || rawImg.includes('default-doc')) {
            parentDiv.innerHTML = iconHtml;
        } else {
            docImgEl.onerror = function() { parentDiv.innerHTML = iconHtml; };
            docImgEl.src = rawImg.startsWith('http') ? rawImg : `${API_BASE}${rawImg}`;
            docImgEl.style.width = '100%';
            docImgEl.style.height = '100%';
            docImgEl.style.objectFit = 'cover';
        }
    }

    // Populate standard details
    if(document.getElementById('dyn-doc-name')) document.getElementById('dyn-doc-name').textContent = doctorData.doctorName;
    if(document.getElementById('dyn-doc-spec')) document.getElementById('dyn-doc-spec').textContent = doctorData.doctorSpecialty;
    
    const visitBadge = document.getElementById('dyn-visit-type');
    if (visitBadge) {
        visitBadge.innerHTML = doctorData.visitType.includes('Video') 
            ? `<i class="fa-solid fa-video"></i> ${doctorData.visitType}`
            : `<i class="fa-solid fa-location-dot"></i> ${doctorData.visitType}`;
    }
    
    if(document.getElementById('sum-doc-name')) document.getElementById('sum-doc-name').textContent = doctorData.doctorName;
    if(document.getElementById('sum-type')) document.getElementById('sum-type').textContent = doctorData.visitType;

    const fee = parseFloat(doctorData.consultationFee) || 500;
    const visit = doctorData.visitType === 'Home Visit' ? (parseFloat(doctorData.visitCharge) || 200) : 0;
    const total = fee + visit + (parseFloat(doctorData.platformFee) || 0);
    
    if(document.getElementById('sum-fee')) document.getElementById('sum-fee').textContent = `₹${fee}`;
    if(document.getElementById('sum-visit')) document.getElementById('sum-visit').textContent = `₹${visit}`;
    if(document.getElementById('sum-total')) document.getElementById('sum-total').textContent = `₹${total}`;

    let cachedUser = {};
    try { cachedUser = JSON.parse(localStorage.getItem('currentUser')) || {}; } catch(e){}
    if(document.getElementById('patient-name') && cachedUser.name) {
        document.getElementById('patient-name').value = cachedUser.name;
    }

    // 3. Date & Time Engine Variables
    let selectedTime = null; 
    let selectedDateAPI = null; 
    let selectedDateDisplay = null; 
    
    const dateContainer = document.getElementById('date-container');
    const timeSlotContainer = document.getElementById('time-container'); 
    const proceedBtn = document.getElementById('proceed-btn');

    const formatDateForAPI = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const updateSummaryUI = () => {
        if(document.getElementById('sum-date')) document.getElementById('sum-date').textContent = selectedDateDisplay || "Select a date";
        
        const sumTimeEl = document.getElementById('sum-time');
        const sumTimeRow = document.getElementById('sum-time-row');

        if (selectedTime) {
            if(sumTimeEl) sumTimeEl.textContent = selectedTime;
            if(sumTimeRow) sumTimeRow.style.display = 'flex'; 
            if(proceedBtn) {
                proceedBtn.disabled = false; 
                proceedBtn.classList.remove('disabled');
            }
        } else {
            if(sumTimeEl) sumTimeEl.textContent = "Select a time";
            if(sumTimeRow) sumTimeRow.style.display = 'none'; 
            if(proceedBtn) {
                proceedBtn.disabled = true; 
                proceedBtn.classList.add('disabled');
            }
        }
    };

    // Time slots fetch logic
    async function fetchAndRenderTimeSlots(apiDateString) {
        if (!timeSlotContainer) return;
        selectedTime = null; 
        updateSummaryUI();
        timeSlotContainer.innerHTML = '<div style="width: 100%; padding: 12px; text-align: center; color: var(--text-secondary);">Loading available slots...</div>'; 

        try {
            const response = await fetch(`${API_BASE}/providers/${currentProviderId}/available-slots?date=${apiDateString}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Failed to fetch slots");
            
            const availableSlots = await response.json();
            availableSlots.sort((a, b) => {
                const parseTime = (timeStr) => {
                    const [time, modifier] = timeStr.split(' ');
                    let [hours, minutes] = time.split(':');
                    if (hours === '12') hours = '00';
                    if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
                    return parseInt(hours) * 60 + parseInt(minutes);
                };
                return parseTime(a) - parseTime(b);
            });

            timeSlotContainer.innerHTML = ''; 
            if (availableSlots.length === 0) {
                timeSlotContainer.innerHTML = '<div style="width: 100%; text-align: center; color: var(--text-secondary);">No slots available on this date.</div>';
                return;
            }

            const now = new Date();
            const cutoffTime = new Date(now.getTime() + (5 * 60 * 60 * 1000));
            let validSlotsCount = 0;

            availableSlots.forEach(time => {
                const slotDateTime = new Date(`${apiDateString} ${time}`);
                const slotBtn = document.createElement('button');
                slotBtn.type = 'button'; 
                slotBtn.textContent = time;

                if (slotDateTime < cutoffTime) {
                    slotBtn.className = `time-slot disabled-slot`;
                    slotBtn.disabled = true;
                    slotBtn.title = "Must book at least 5 hours in advance";
                } else {
                    slotBtn.className = `time-slot`;
                    validSlotsCount++;
                    slotBtn.addEventListener('click', (e) => {
                        document.querySelectorAll('.time-slot').forEach(s => {
                            s.classList.remove('active');
                            s.style.backgroundColor = ''; 
                            s.style.color = ''; 
                            s.style.borderColor = ''; 
                        });
                        e.target.classList.add('active');
                        e.target.style.backgroundColor = 'var(--brand-blue)'; 
                        e.target.style.color = '#fff';
                        e.target.style.borderColor = 'var(--brand-blue)';
                        selectedTime = time;
                        updateSummaryUI(); 
                    });
                }
                timeSlotContainer.appendChild(slotBtn);
            });

            if (validSlotsCount === 0) {
                timeSlotContainer.innerHTML += `<div style="width: 100%; text-align: center; color: #ef4444; font-size: 0.85rem; margin-top: 10px;"><i class="fa-solid fa-circle-exclamation"></i> Remaining slots are less than 5 hours away. Please select tomorrow.</div>`;
            }
        } catch (error) {
            timeSlotContainer.innerHTML = '<div style="width: 100%; text-align: center; color: #ef4444;">Error loading time slots. Please try again.</div>';
        }
    }

    if (dateContainer) {
        dateContainer.innerHTML = ''; 
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const apiDateString = formatDateForAPI(d);
            const displayDateString = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            
            const dateBtn = document.createElement('div');
            dateBtn.className = `date-card ${i === 0 ? 'active' : ''}`;
            dateBtn.innerHTML = `<span>${dayName}</span><strong>${d.getDate()}</strong>`;
            
            if (i === 0) {
                selectedDateAPI = apiDateString;
                selectedDateDisplay = displayDateString;
                fetchAndRenderTimeSlots(apiDateString);
            }
            
            dateBtn.addEventListener('click', () => {
                document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
                dateBtn.classList.add('active');
                selectedDateAPI = apiDateString;
                selectedDateDisplay = displayDateString;
                fetchAndRenderTimeSlots(apiDateString);
            });
            dateContainer.appendChild(dateBtn);
        }
    }

    // ==========================================================
    // 🚨 MAPPLS INTEGRATION LOGIC 
    // ==========================================================
    const btnShowMap = document.getElementById('btn-show-map');
    const mapContainer = document.getElementById('mappls-map');
    const addressInputField = document.getElementById('patient-address');
    let mapObject = null;
    let mapMarker = null;

    if (btnShowMap) {
        if (doctorData.visitType === 'Video Consult' || doctorData.visitType.includes('Video')) {
            document.getElementById('address-form-group').style.display = 'none';
        }

        btnShowMap.addEventListener('click', () => {
            if (typeof mappls === 'undefined') {
                alert("Map engine is still loading or API key is invalid.");
                return;
            }

            mapContainer.style.display = 'block';
            btnShowMap.style.display = 'none';

            let startLat = parseFloat(localStorage.getItem('user_lat')) || 28.6139;
            let startLng = parseFloat(localStorage.getItem('user_lon')) || 77.2090;

            mapObject = new mappls.Map('mappls-map', {
                center: [startLat, startLng],
                zoom: 12,
                zoomControl: true,
                location: true 
            });

            mapObject.addListener('click', function(e) {
                const lat = e.lngLat.lat;
                const lng = e.lngLat.lng;

                if (mapMarker) mapMarker.remove();

                mapMarker = new mappls.Marker({
                    map: mapObject,
                    position: { "lat": lat, "lng": lng }
                });

                addressInputField.value = `Pinned Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                addressInputField.style.borderColor = "var(--success-green)";
            });
        });
    }

    // 🚨 HAVERSINE DISTANCE MATH
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

    if (proceedBtn) {
        proceedBtn.addEventListener('click', async (e) => {
            e.preventDefault(); 
            if (!selectedTime) { alert("Please select a time slot."); return; }

            const form = document.getElementById('patient-form');
            if (form && !form.checkValidity()) { form.reportValidity(); return; }
            
            proceedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Securing...';
            proceedBtn.disabled = true;

            let finalAddress = document.getElementById('patient-address') ? document.getElementById('patient-address').value : "Online";
            
            if (doctorData.visitType === 'Video Consult' || doctorData.visitType.includes('Video')) {
                finalAddress = "Online";
            } else {
                // 🚨 GPS GEOFENCE CHECK
                if (!mapMarker) {
                    alert("Please pin your exact location on the map for a Home Visit.");
                    proceedBtn.innerHTML = '<i class="fa-regular fa-circle-check"></i> Proceed to Payment';
                    proceedBtn.disabled = false;
                    return;
                }
                
                const userLat = mapMarker.getPosition().lat;
                const userLng = mapMarker.getPosition().lng;
                const docLat = parseFloat(fullDocData.latitude);
                const docLng = parseFloat(fullDocData.longitude);

                if (docLat && docLng) {
                    const distanceKM = calculateDistanceKM(userLat, userLng, docLat, docLng);
                    const MAX_RADIUS = 15; // 15 Kilometers boundary

                    if (distanceKM > MAX_RADIUS) {
                        alert(`🚨 Service Unavailable\n\nReason: This provider is ${distanceKM.toFixed(1)} km away. They only provide Home Visits within a ${MAX_RADIUS} km radius.\n\nPlease go back and choose a Video Consult or find a closer provider.`);
                        proceedBtn.innerHTML = '<i class="fa-regular fa-circle-check"></i> Proceed to Payment';
                        proceedBtn.disabled = false;
                        return; // 🛑 Kills the booking
                    }
                }
            }

            const localDateTime = `${selectedDateAPI}T${convertTo24Hour(selectedTime)}:00`;
            const genderNode = document.querySelector('input[name="gender"]:checked');
            
            const bookingPayload = {
                provider_id: currentProviderId, 
                scheduled_time: localDateTime,
                delivery_address: finalAddress,
                patient_name: document.getElementById('patient-name').value,
                patient_age: parseInt(document.getElementById('patient-age').value) || 0,
                patient_gender: genderNode ? genderNode.value : "Other",
                symptoms: document.getElementById('patient-symptoms').value || "None"
            };

            try {
                const response = await fetch(`${API_BASE}/bookings/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(bookingPayload)
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.detail || "Booking failed");

                localStorage.setItem('activeBookingId', data.booking_id || data.id);
                localStorage.setItem('paymentTotalAmount', total);
                localStorage.setItem('bookedDate', selectedDateDisplay);
                localStorage.setItem('bookedTime', selectedTime);
                
                window.location.href = "payment.html"; 

            } catch (error) {
                alert(error.message);
                proceedBtn.innerHTML = '<i class="fa-regular fa-circle-check"></i> Proceed to Payment';
                proceedBtn.disabled = false;
            }
        });
    }

    function convertTo24Hour(timeStr) {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
        return `${String(hours).padStart(2, '0')}:${minutes}`;
    }
});