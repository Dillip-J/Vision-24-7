// js/book.js
document.addEventListener('DOMContentLoaded', () => {

    const savedService = JSON.parse(localStorage.getItem('pendingBooking'));
    const token = localStorage.getItem('access_token');
    
    if (!token || !savedService) {
        window.location.replace('index.html');
        return; 
    }

    const doctorData = savedService;

    // 1. Hide Address Input for Video Consults
    const addressInput = document.getElementById('patient-address');
    if (addressInput && (doctorData.visitType === 'Video Consult' || doctorData.visitType.includes('Video'))) {
        addressInput.parentElement.style.display = 'none';
        addressInput.value = 'Online'; // Force value so backend knows it's online
    }

    // 2. Populate UI Details
    if(document.getElementById('dyn-doc-img')) document.getElementById('dyn-doc-img').src = doctorData.doctorImage || "assets/default-doc.png";
    if(document.getElementById('dyn-doc-name')) document.getElementById('dyn-doc-name').textContent = doctorData.doctorName;
    if(document.getElementById('dyn-doc-spec')) document.getElementById('dyn-doc-spec').textContent = doctorData.doctorSpecialty;
    
    const visitBadge = document.getElementById('dyn-visit-type');
    if (visitBadge) {
        if (doctorData.visitType === 'Home Visit' || doctorData.visitType === 'Delivery') {
            visitBadge.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${doctorData.visitType}`;
        } else {
            visitBadge.innerHTML = `<i class="fa-solid fa-video"></i> ${doctorData.visitType}`;
        }
    }
    
    if(document.getElementById('sum-doc-name')) document.getElementById('sum-doc-name').textContent = doctorData.doctorName;
    if(document.getElementById('sum-type')) document.getElementById('sum-type').textContent = doctorData.visitType;

    const fee = doctorData.consultationFee || 500;
    const visit = doctorData.visitType === 'Home Visit' ? (doctorData.visitCharge || 200) : 0;
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

    // 3. Date & Time Engine Variables
    let selectedTime = null; 
    let selectedDateAPI = null; 
    let selectedDateDisplay = null; 
    
    const currentProviderId = doctorData.provider_id || doctorData.id;
    const dateContainer = document.getElementById('date-container');
    const timeSlotContainer = document.getElementById('time-container'); 

    const formatDateForAPI = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const updateSummaryUI = () => {
        if(document.getElementById('sum-date')) document.getElementById('sum-date').textContent = selectedDateDisplay || "Select a date";
        if(document.getElementById('sum-time')) document.getElementById('sum-time').textContent = selectedTime || "Select a time";
    };

    // 🚨 THE FIX: Connect to Python backend AND enforce the 6-Hour Rule!
    async function fetchAndRenderTimeSlots(apiDateString) {
        if (!timeSlotContainer) return;
        selectedTime = null; 
        updateSummaryUI();
        
        // Show loading state
        timeSlotContainer.innerHTML = '<div style="width: 100%; padding: 12px; text-align: center; color: var(--text-secondary);">Loading available slots...</div>'; 

        try {
            // Fetch REAL availability from your Python backend
            const response = await fetch(`${API_BASE}/providers/${currentProviderId}/available-slots?date=${apiDateString}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Failed to fetch slots");
            
            const availableSlots = await response.json();
            timeSlotContainer.innerHTML = ''; 

            if (availableSlots.length === 0) {
                timeSlotContainer.innerHTML = '<div style="width: 100%; text-align: center; color: var(--text-secondary);">No slots available on this date.</div>';
                return;
            }

            // 🚨 6-HOUR RULE CALCULATOR (24/7 Real-Time)
            const now = new Date();
            // Add exactly 5 hours (in milliseconds) to the current time right now
            const cutoffTime = new Date(now.getTime() + (5 * 60 * 60 * 1000));
            
            let validSlotsCount = 0;

            availableSlots.forEach(time => {
                // Combine the date ("2026-04-14") and time ("02:00 PM") into a mathematical Date object
                const slotDateTime = new Date(`${apiDateString} ${time}`);
                
                const slotBtn = document.createElement('button');
                slotBtn.type = 'button'; 
                slotBtn.textContent = time;

                // Check if the slot is too soon
                if (slotDateTime < cutoffTime) {
                    slotBtn.className = `time-slot disabled-slot`;
                    slotBtn.disabled = true;
                    slotBtn.title = "Must book at least 5 hours in advance";
                } else {
                    slotBtn.className = `time-slot`;
                    validSlotsCount++;
                    
                    slotBtn.addEventListener('click', (e) => {
                        document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('active'));
                        e.target.classList.add('active');
                        selectedTime = time;
                        updateSummaryUI();
                    });
                }
                
                timeSlotContainer.appendChild(slotBtn);
            });

            // If everything got disabled by the 5-hour rule, show a warning
            if (validSlotsCount === 0) {
                timeSlotContainer.innerHTML += `<div style="width: 100%; text-align: center; color: #ef4444; font-size: 0.85rem; margin-top: 10px;">
                    <i class="fa-solid fa-circle-exclamation"></i> Remaining slots are less than 5 hours away. Please select tomorrow.
                </div>`;
            }

        } catch (error) {
            console.error(error);
            timeSlotContainer.innerHTML = '<div style="width: 100%; text-align: center; color: #ef4444;">Error loading time slots. Please try again.</div>';
        }
    }

    // 4. Generate 7 Days in the Scroll Container
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

    // 5. Submit Booking
    const proceedBtn = document.getElementById('proceed-btn');
    if (proceedBtn) {
        proceedBtn.disabled = false; 
        
        proceedBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            
            if (!selectedTime) {
                alert("Please select a time slot before proceeding.");
                return;
            }

            const form = document.getElementById('patient-form');
            if (form && !form.checkValidity()) { 
                form.reportValidity(); 
                return; 
            }
            
            const originalText = proceedBtn.innerHTML;
            proceedBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Securing...';
            proceedBtn.disabled = true;

            const combinedDateTime = new Date(`${selectedDateDisplay} ${selectedTime}`);
            const genderNode = document.querySelector('input[name="gender"]:checked');
            
            let finalAddress = document.getElementById('patient-address') ? document.getElementById('patient-address').value : "Online";
            if (doctorData.visitType === 'Video Consult' || doctorData.visitType.includes('Video')) finalAddress = "Online";

            const bookingPayload = {
                provider_id: currentProviderId, 
                scheduled_time: combinedDateTime.toISOString(),
                delivery_address: finalAddress,
                patient_name: document.getElementById('patient-name').value,
                patient_age: parseInt(document.getElementById('patient-age').value) || 0,
                patient_gender: genderNode ? genderNode.value : "Other",
                symptoms: document.getElementById('patient-symptoms').value || "None"
            };

            fireToBackend(bookingPayload);

            async function fireToBackend(payload) {
                try {
                    const response = await fetch(`${API_BASE}/bookings/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify(payload)
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.detail || "Failed to create booking");

                    localStorage.setItem('activeBookingId', data.id);
                    localStorage.setItem('paymentTotalAmount', total);
                    localStorage.setItem('bookedDate', selectedDateDisplay);
                    localStorage.setItem('bookedTime', selectedTime);

                    window.location.href = "payment.html"; 

                } catch (error) {
                    alert(`Could not secure booking: ${error.message}`);
                    proceedBtn.innerHTML = originalText;
                    proceedBtn.disabled = false;
                }
            }
        });
    }
});