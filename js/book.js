// js/book.js
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // --- 1. STRICT DATA ENFORCEMENT ---
    // ==========================================
    const savedService = JSON.parse(localStorage.getItem('pendingBooking'));
    const token = localStorage.getItem('access_token');
    
    if (!token || !savedService) {
        window.location.href = 'index.html';
        return; 
    }

    const doctorData = savedService;

    // Populate UI Headers dynamically
    if(document.getElementById('dyn-doc-img')) document.getElementById('dyn-doc-img').src = doctorData.doctorImage || "assets/default-doc.png";
    if(document.getElementById('dyn-doc-name')) document.getElementById('dyn-doc-name').textContent = doctorData.doctorName;
    if(document.getElementById('dyn-doc-spec')) document.getElementById('dyn-doc-spec').textContent = doctorData.doctorSpecialty;
    if(document.getElementById('dyn-doc-exp')) document.getElementById('dyn-doc-exp').textContent = "Verified Provider";
    
    // Populate Summary Box & Math
    if(document.getElementById('sum-doc-name')) document.getElementById('sum-doc-name').textContent = doctorData.doctorName;
    if(document.getElementById('sum-doc-spec')) document.getElementById('sum-doc-spec').textContent = doctorData.doctorSpecialty;
    if(document.getElementById('sum-type')) document.getElementById('sum-type').textContent = doctorData.visitType;

    // 🚨 THE FIX: Do the math for the sidebar!
    const fee = doctorData.consultationFee || 500;
    const visit = doctorData.visitType === 'Home Visit' ? (doctorData.visitCharge || 200) : 0;
    const total = fee + visit;
    
    if(document.getElementById('sum-fee')) document.getElementById('sum-fee').textContent = `₹${fee}`;
    if(document.getElementById('sum-visit')) document.getElementById('sum-visit').textContent = `₹${visit}`;
    if(document.getElementById('sum-total')) document.getElementById('sum-total').textContent = `₹${total}`;

    // Pre-fill user data
    let cachedUser = {};
    try { cachedUser = JSON.parse(localStorage.getItem('currentUser')) || {}; } catch(e){}
    if(document.getElementById('patient-name') && cachedUser.name) {
        document.getElementById('patient-name').value = cachedUser.name;
    }

    //back arrow logic
    document.getElementById("backbtn").addEventListener("click", function(e){
        e.preventDefault();
        window.history.back();
    });

    // ==========================================
    // --- 2. TIME SLOT & CALENDAR LOGIC ---
    // ==========================================
    let selectedTime = "10:00 AM"; 
    let selectedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // 🚨 THE FIX: Generate 7 Days of Dates
    const dateContainer = document.getElementById('date-container');
    if (dateContainer) {
        dateContainer.innerHTML = ''; // Clear empty div
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateString = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = d.getDate();

            const dateBtn = document.createElement('div');
            dateBtn.className = `date-card ${i === 0 ? 'active' : ''}`;
            dateBtn.innerHTML = `<strong>${dayName}</strong><span>${dayNum}</span>`;
            
            dateBtn.addEventListener('click', () => {
                document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
                dateBtn.classList.add('active');
                selectedDate = dateString;
                if(document.getElementById('sum-date')) document.getElementById('sum-date').textContent = selectedDate;
            });
            dateContainer.appendChild(dateBtn);
        }
    }

    const timeSlots = document.querySelectorAll('.time-slot'); 
    timeSlots.forEach(slot => {
        slot.addEventListener('click', (e) => {
            timeSlots.forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            selectedTime = e.target.textContent;
            if(document.getElementById('sum-time')) document.getElementById('sum-time').textContent = selectedTime;
        });
    });

    if(document.getElementById('sum-date')) document.getElementById('sum-date').textContent = selectedDate;
    if(document.getElementById('sum-time')) document.getElementById('sum-time').textContent = selectedTime;

    // ==========================================
    // --- 3. THE BACKEND CONNECTION ENGINE ---
    // ==========================================
    const proceedBtn = document.getElementById('proceed-btn');
    
    if (proceedBtn) {
        proceedBtn.disabled = false; // Enable button on load
        
        proceedBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            
            const form = document.getElementById('patient-form');
            if (form && !form.checkValidity()) { 
                form.reportValidity(); 
                return; 
            }
            
            const originalText = proceedBtn.innerHTML;
            proceedBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Securing Booking...';
            proceedBtn.disabled = true;

            // Extract Data perfectly using IDs
            const combinedDateTime = new Date(`${selectedDate} ${selectedTime}`);
            const genderNode = document.querySelector('input[name="gender"]:checked');

            const bookingPayload = {
                provider_id: doctorData.id || doctorData.provider_id, 
                scheduled_time: combinedDateTime.toISOString(),
                delivery_address: document.getElementById('patient-address').value || null,
                latitude: null, 
                longitude: null, 
                patient_name: document.getElementById('patient-name').value,
                patient_age: parseInt(document.getElementById('patient-age').value),
                patient_gender: genderNode ? genderNode.value : "Other",
                symptoms: document.getElementById('patient-symptoms').value
            };

            // GPS Engine
            if ((doctorData.visitType === 'Home Visit' || doctorData.visitType === 'Delivery') && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        bookingPayload.latitude = position.coords.latitude;
                        bookingPayload.longitude = position.coords.longitude;
                        fireToBackend(bookingPayload);
                    }, 
                    (error) => {
                        console.warn("Location blocked by user. Proceeding without GPS.");
                        fireToBackend(bookingPayload);
                    },
                    { timeout: 5000 } 
                );
            } else {
                fireToBackend(bookingPayload);
            }

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

                    if (!response.ok) {
                        throw new Error(data.detail || "Failed to create booking");
                    }

                    // SUCCESS!
                    localStorage.setItem('activeBookingId', data.id);
                    localStorage.setItem('deliveryAddress', payload.delivery_address); 
                    
                    // Add Total cost to active booking for payment page
                    localStorage.setItem('paymentTotalAmount', total);

                    window.location.href = "payment.html"; 

                } catch (error) {
                    console.error("Booking Error:", error);
                    alert(`Could not secure booking: ${error.message}`);
                    proceedBtn.innerHTML = originalText;
                    proceedBtn.disabled = false;
                }
            }
        });
    }
});