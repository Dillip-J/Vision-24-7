// js/book.js
document.addEventListener('DOMContentLoaded', () => {

    const API_BASE = window.API_BASE;
    if (!API_BASE) {
        console.error("FATAL: window.API_BASE is missing.");
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

    const cachedDoctors = JSON.parse(localStorage.getItem('eterna_cache_doctors') || '[]');
    const fullDocData = cachedDoctors.find(d => (d.provider_id || d.id) === currentProviderId) || {};
    
    const docName = doctorData.doctorName || doctorData.name || fullDocData.name || "Doctor";
    const docSpec = doctorData.doctorSpecialty || doctorData.specialty || doctorData.category || fullDocData.category || "Specialist";
    const visitType = doctorData.visitType || doctorData.visit_type || "Home Visit";
    const rawImg = doctorData.doctorImage || doctorData.doctor_image || fullDocData.profile_photo_url || "";

    const getInitials = (name) => {
        if(!name) return 'DR';
        const cleanName = name.replace(/^Dr\.\s*/i, '');
        const parts = cleanName.split(' ');
        return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : `${cleanName[0]}X`.toUpperCase();
    };

    const bioEl = document.getElementById('dyn-doc-bio');
    if (bioEl) {
        const actualBio = fullDocData.bio || doctorData.bio;
        if (actualBio && actualBio.trim() !== "") {
            bioEl.textContent = actualBio;
        } else {
            bioEl.textContent = `A dedicated ${docSpec} committed to providing excellent and compassionate healthcare services to all patients.`;
        }
    }

    const docImgEl = document.getElementById('dyn-doc-img');
    if(docImgEl) {
        const initials = getInitials(docName);
        const fallbackUrl = `https://ui-avatars.com/api/?name=${initials}&background=1E293B&color=fff&size=128`;
        
        if (!rawImg || rawImg.includes('default-avatar') || rawImg.includes('default-doc')) {
            docImgEl.src = fallbackUrl;
        } else {
            let finalImgUrl = rawImg;
            if (!rawImg.startsWith('http')) {
                const cleanBase = API_BASE.replace(/\/$/, '');
                const cleanImg = rawImg.replace(/^\//, '');    
                finalImgUrl = `${cleanBase}/${cleanImg}`;
            }

            docImgEl.onerror = function() {
                this.onerror = null; 
                this.src = fallbackUrl;
            };
            docImgEl.src = finalImgUrl;
        }
    }

    // 🚨 FIX: Bulletproof display logic to physically hide the address block for video calls
    const isVideoConsult = visitType.toLowerCase().includes('video');
    const addressBlock = document.getElementById('address-block');
    
    if (addressBlock) {
        if (isVideoConsult) {
            addressBlock.style.display = 'none'; // Forces it to hide, ignoring CSS conflicts
        } else {
            addressBlock.style.display = 'block'; // Shows it for Home Visits
        }
    }

    if(document.getElementById('dyn-doc-name')) document.getElementById('dyn-doc-name').textContent = docName;
    if(document.getElementById('dyn-doc-spec')) document.getElementById('dyn-doc-spec').textContent = docSpec;
    
    const visitBadge = document.getElementById('dyn-visit-type');
    if (visitBadge) {
        visitBadge.innerHTML = isVideoConsult 
            ? `<i class="fa-solid fa-video"></i> ${visitType}`
            : `<i class="fa-solid fa-location-dot"></i> ${visitType}`;
    }
    
    if(document.getElementById('sum-doc-name')) document.getElementById('sum-doc-name').textContent = docName;
    if(document.getElementById('sum-type')) document.getElementById('sum-type').textContent = visitType;

    const fee = parseFloat(doctorData.price) || parseFloat(doctorData.consultationFee) || parseFloat(doctorData.consultation_fee) || parseFloat(fullDocData.consultation_fee) || 500;
    const visit = visitType === 'Home Visit' ? (parseFloat(doctorData.visitCharge) || parseFloat(doctorData.home_visit_charge) || 0) : 0;
    const total = fee + visit;
    
    if(document.getElementById('sum-fee')) document.getElementById('sum-fee').textContent = `₹${fee}`;
    if(document.getElementById('sum-visit')) document.getElementById('sum-visit').textContent = `₹${visit}`;
    if(document.getElementById('sum-total')) document.getElementById('sum-total').textContent = `₹${total}`;

    let cachedUser = {};
    try { cachedUser = JSON.parse(localStorage.getItem('currentUser')) || {}; } catch(e){}
    if(document.getElementById('patient-name') && cachedUser.name) {
        document.getElementById('patient-name').value = cachedUser.name;
    }

    const backBtn = document.getElementById("backbtn");
    if (backBtn) backBtn.addEventListener("click", (e) => { e.preventDefault(); window.history.back(); });

    let selectedTime = null; 
    let selectedDateAPI = null; 
    let selectedDateDisplay = null; 
    
    const dateContainer = document.getElementById('date-container');
    const timeSlotContainer = document.getElementById('time-container'); 

    const formatDateForAPI = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const proceedBtn = document.getElementById('proceed-btn');

    const updateSummaryUI = () => {
        if(document.getElementById('sum-date')) document.getElementById('sum-date').textContent = selectedDateDisplay || "Select a date";
        
        const sumTimeEl = document.getElementById('sum-time');
        const sumTimeRow = document.getElementById('sum-time-row');

        if (selectedTime) {
            if(sumTimeEl) sumTimeEl.textContent = selectedTime;
            if(sumTimeRow) sumTimeRow.classList.remove('hidden'); 
            if(proceedBtn) {
                proceedBtn.disabled = false; 
                proceedBtn.classList.remove('disabled');
            }
        } else {
            if(sumTimeEl) sumTimeEl.textContent = "Select a time";
            if(sumTimeRow) sumTimeRow.classList.add('hidden'); 
            if(proceedBtn) {
                proceedBtn.disabled = true; 
                proceedBtn.classList.add('disabled');
            }
        }
    };

    async function fetchAndRenderTimeSlots(apiDateString) {
        if (!timeSlotContainer) return;
        selectedTime = null; 
        updateSummaryUI();
        
        timeSlotContainer.innerHTML = '<div class="empty-state">Loading available slots...</div>'; 

        try {
            const response = await fetch(`${API_BASE}/providers/${currentProviderId}/available-slots?date=${apiDateString}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Failed to fetch slots");
            
            const availableSlots = await response.json();
            
            availableSlots.sort((a, b) => {
                const parseTime = (timeStr) => {
                    const [time, modifier] = timeStr.split(' ');
                    let [hoursStr, minutesStr] = time.split(':');
                    let hours = parseInt(hoursStr, 10);
                    let minutes = parseInt(minutesStr, 10);
                    if (hours === 12) hours = 0;
                    if (modifier === 'PM') hours += 12;
                    return hours * 60 + minutes;
                };
                return parseTime(a) - parseTime(b);
            });

            timeSlotContainer.innerHTML = ''; 

            if (availableSlots.length === 0) {
                timeSlotContainer.innerHTML = '<div class="empty-state">No slots available on this date.</div>';
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
                        });
                        
                        e.target.classList.add('active');
                        
                        selectedTime = time;
                        updateSummaryUI(); 
                    });
                }
                
                timeSlotContainer.appendChild(slotBtn);
            });

            if (validSlotsCount === 0) {
                timeSlotContainer.innerHTML += `<div class="empty-state text-red">
                    <i class="fa-solid fa-circle-exclamation"></i> Remaining slots are less than 5 hours away. Please select tomorrow.
                </div>`;
            }

        } catch (error) {
            console.error(error);
            timeSlotContainer.innerHTML = '<div class="empty-state text-red">Error loading time slots. Please try again.</div>';
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

    if (proceedBtn) {
        proceedBtn.addEventListener('click', async (e) => {
            e.preventDefault(); 
            if (!selectedTime) { alert("Please select a time slot."); return; }

            const form = document.getElementById('patient-form');
            if (form && !form.checkValidity()) { form.reportValidity(); return; }

            const flatNode = document.getElementById('flat-number');
            const bNameNode = document.getElementById('building-name');
            const landNode = document.getElementById('landmark');
            const addrNode = document.getElementById('patient-address');

            const flatVal = flatNode ? flatNode.value.trim() : "";
            const buildingVal = bNameNode ? bNameNode.value.trim() : "";
            const landmarkVal = landNode ? landNode.value.trim() : "";
            const addressVal = addrNode ? addrNode.value.trim() : "";
            
            let finalAddress = "Online";

            // 🚨 FIX: Strict validation that ignores address fields for Video Consults completely
            if (!isVideoConsult) {
                if (!flatVal || !addressVal) {
                    alert("Please provide your Flat/House Number and Area Address for the Home Visit.");
                    return;
                }

                const addrParts = [];
                if (flatVal) addrParts.push(flatVal);
                if (buildingVal) addrParts.push(buildingVal); 
                if (landmarkVal) addrParts.push(landmarkVal);
                if (addressVal) addrParts.push(addressVal);
                
                finalAddress = addrParts.length > 0 ? addrParts.join(', ') : "Address not provided";
            }
            
            proceedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Securing...';
            proceedBtn.disabled = true;

            const localDateTime = `${selectedDateAPI}T${convertTo24Hour(selectedTime)}:00`;
            const genderNode = document.querySelector('input[name="gender"]:checked');

            const bookingPayload = {
                provider_id: currentProviderId, 
                scheduled_time: localDateTime,
                delivery_address: finalAddress,
                building_name: isVideoConsult ? "Online" : (buildingVal || "N/A"), 
                flat_number: isVideoConsult ? "Online" : (flatVal || "N/A"),
                landmark: isVideoConsult ? "Online" : (landmarkVal || "N/A"),
                patient_name: document.getElementById('patient-name').value,
                patient_age: parseInt(document.getElementById('patient-age').value) || 0,
                patient_gender: genderNode ? genderNode.value : "Other",
                symptoms: document.getElementById('patient-symptoms').value || "None",
                total_amount: total 
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

// let autocomplete;
// window.initAutocomplete = function() {
//     const addressInput = document.getElementById("patient-address");
//     if (!addressInput) return;

//     autocomplete = new google.maps.places.Autocomplete(
//         addressInput,
//         {
//             types: ["geocode", "establishment"], 
//             componentRestrictions: { 'country': ['in'] },
//             fields: ['place_id', 'geometry', 'formatted_address']
//         }
//     );
    
//     autocomplete.addListener('place_changed', onPlaceChanged);
// };

// function onPlaceChanged() {
//     let place = autocomplete.getPlace();
//     const addressInput = document.getElementById('patient-address');
    
//     if (!place.geometry) {
//         addressInput.placeholder = "Enter your Address";
//     } else {
//         addressInput.value = place.formatted_address;
//     }
// }

// let autocomplete;

// window.initAutocomplete = function() {
//     const addressInput = document.getElementById("patient-address");
//     if (!addressInput) return;

//     // Create element (no arguments)
//     autocomplete = new google.maps.places.PlaceAutocompleteElement();

//     // Attach it to your input
//     autocomplete.inputElement = addressInput;

//     // Listen for selection
//     autocomplete.addEventListener('placechange', onPlaceChanged);
// };

// function onPlaceChanged(event) {
//     const place = event.detail.place;
//     const addressInput = document.getElementById('patient-address');

//     if (!place || !place.location) {
//         addressInput.placeholder = "Enter your Address";
//     } else {
//         addressInput.value = place.formattedAddress;
//     }
// }
