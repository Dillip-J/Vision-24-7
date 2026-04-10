// js/book.js
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // --- 1. STRICT DATA ENFORCEMENT ---
    // ==========================================
    const savedService = JSON.parse(localStorage.getItem('pendingBooking'));
    const token = localStorage.getItem('access_token');
    
    // Security: Kick user out if no token or no doctor selected
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
    
    // Populate Summary Box
    if(document.getElementById('sum-doc-name')) document.getElementById('sum-doc-name').textContent = doctorData.doctorName;
    if(document.getElementById('sum-doc-spec')) document.getElementById('sum-doc-spec').textContent = doctorData.doctorSpecialty;
    if(document.getElementById('sum-type')) document.getElementById('sum-type').textContent = doctorData.visitType;

    let cachedUser = {};
    try { cachedUser = JSON.parse(localStorage.getItem('currentUser')) || {}; } catch(e){}
    
    const nameInputs = document.querySelectorAll('.patient-form input[type="text"]');
    if(nameInputs.length > 0 && cachedUser.name) nameInputs[0].value = cachedUser.name;


    // ==========================================
    // --- 2. TIME SLOT & CALENDAR LOGIC ---
    // ==========================================
    const timeSlots = document.querySelectorAll('.time-slot'); 
    let selectedTime = "10:00 AM"; 
    let selectedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    timeSlots.forEach(slot => {
        slot.addEventListener('click', (e) => {
            timeSlots.forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            selectedTime = e.target.textContent;
            
            const sumTime = document.getElementById('sum-time');
            if(sumTime) sumTime.textContent = selectedTime;
        });
    });

    if(document.getElementById('sum-date')) document.getElementById('sum-date').textContent = selectedDate;
    if(document.getElementById('sum-time')) document.getElementById('sum-time').textContent = selectedTime;


    // ==========================================
    // --- 3. THE BACKEND CONNECTION ENGINE ---
    // ==========================================
    const proceedBtn = document.getElementById('proceed-btn');
    
    if (proceedBtn) {
        proceedBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            
            const form = document.getElementById('patient-form');
            if (form && !form.checkValidity()) { 
                form.reportValidity(); 
                return; 
            }
            
            // 1. Lock the Button UI
            const originalText = proceedBtn.innerHTML;
            proceedBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Securing Booking...';
            proceedBtn.disabled = true;

            // 2. Extract Data from the HTML Form
            const currentVisitType = document.getElementById('sum-type') ? document.getElementById('sum-type').textContent : doctorData.visitType;
            
            const patientName = document.querySelector('.patient-form input[type="text"]').value;
            const patientAge = parseInt(document.querySelector('.patient-form input[type="number"]').value);
            const genderNode = document.querySelector('.patient-form input[name="gender"]:checked');
            const patientGender = genderNode ? genderNode.value : "Other";
            
            const textareas = document.querySelectorAll('.patient-form textarea');
            const symptoms = textareas.length > 0 ? textareas[0].value : "";
            const patientAddress = textareas.length > 1 ? textareas[1].value : "";

            // 3. Format Date and Time for Python/PostgreSQL
            const combinedDateTime = new Date(`${selectedDate} ${selectedTime}`);

            // 4. Build the exact payload schemas.py expects!
            const bookingPayload = {
                provider_id: doctorData.id || doctorData.provider_id, // Must match your UUID from the search page
                scheduled_time: combinedDateTime.toISOString(),
                delivery_address: patientAddress || null,
                latitude: null, // Default
                longitude: null, // Default
                patient_name: patientName,
                patient_age: patientAge,
                patient_gender: patientGender,
                symptoms: symptoms
            };

            // 5. GPS Engine (Optional injection)
            if ((currentVisitType === 'Home Visit' || currentVisitType === 'Delivery') && navigator.geolocation) {
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

            // ==========================================
            // 6. THE FASTAPI FETCH
            // ==========================================
            async function fireToBackend(payload) {
                try {
                    const response = await fetch(`${API_BASE}/bookings/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` // The Bouncer's VIP pass
                        },
                        body: JSON.stringify(payload)
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.detail || "Failed to create booking");
                    }

                    // SUCCESS! We have our Integer booking_id.
                    // Save it to localStorage so the Payment page knows what to pay for!
                    localStorage.setItem('activeBookingId', data.id);
                    localStorage.setItem('deliveryAddress', payload.delivery_address); // Save for UI

                    // Jump to Payment!
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
// document.addEventListener('DOMContentLoaded', () => {

//     // --- 1. Dynamic Data Injection ---
//     const doctorData = {
//         id: "doc_michael_chen", // Unique ID for our simulated database
//         name: "Dr. Michael Chen",
//         specialty: "Cardiologist",
//         experience: "20 years experience",
//         visitType: "Home Visit", 
//         image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=200&auto=format&fit=crop",
//         consultationFee: 80,
//         visitCharge: 20,
//         platformFee: 5 // Added based on your payment screenshot
//     };

//     // Populate UI
//     document.getElementById('dyn-doc-img').src = doctorData.image;
//     document.getElementById('dyn-doc-name').textContent = doctorData.name;
//     document.getElementById('dyn-doc-spec').textContent = doctorData.specialty;
//     document.getElementById('dyn-doc-exp').textContent = doctorData.experience;
    
//     document.getElementById('sum-doc-name').textContent = doctorData.name;
//     document.getElementById('sum-doc-spec').textContent = doctorData.specialty;
//     document.getElementById('sum-type').textContent = doctorData.visitType;

//     document.getElementById('sum-fee').textContent = `$${doctorData.consultationFee}`;
//     document.getElementById('sum-visit').textContent = `$${doctorData.visitCharge}`;
//     document.getElementById('sum-total').textContent = `$${doctorData.consultationFee + doctorData.visitCharge}`;

//     // --- Simulated Database Setup ---
//     // If no bookings exist in local storage, create an empty array
//     if (!localStorage.getItem('bookedAppointments')) {
//         localStorage.setItem('bookedAppointments', JSON.stringify([]));
//     }

//     const dateContainer = document.getElementById('date-container');
//     const sumDateDisplay = document.getElementById('sum-date');
//     const timeContainer = document.getElementById('time-container');
//     const sumTimeRow = document.getElementById('sum-time-row');
//     const sumTimeDisplay = document.getElementById('sum-time');
//     const proceedBtn = document.getElementById('proceed-btn');
    
//     const times = [
//         "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
//         "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
//         "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
//         "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
//         "06:00 PM", "06:30 PM"
//     ];

//     let currentDateString = "";
//     let currentTimeSelected = "";

//     // --- 2. Render Time Slots Dynamically ---
//     function renderTimeSlots(dateString) {
//         timeContainer.innerHTML = ''; // Clear old slots
//         sumTimeRow.style.display = 'none'; // Hide time in summary
//         proceedBtn.disabled = true; 
//         currentTimeSelected = "";

//         // Fetch bookings from local storage
//         const allBookings = JSON.parse(localStorage.getItem('bookedAppointments'));
        
//         // Filter to find times already booked for THIS doctor on THIS date
//         const bookedTimes = allBookings
//             .filter(b => b.doctorId === doctorData.id && b.date === dateString)
//             .map(b => b.time);

//         times.forEach(time => {
//             const btn = document.createElement('button');
//             btn.className = 'time-slot';
//             btn.textContent = time;
//             btn.type = 'button'; // Prevent form submission

//             // Check if this specific time is booked
//             if (bookedTimes.includes(time)) {
//                 btn.classList.add('disabled');
//                 btn.disabled = true; 
//             } else {
//                 btn.addEventListener('click', (e) => {
//                     e.preventDefault();
//                     document.querySelectorAll('.time-slot').forEach(t => t.classList.remove('active'));
//                     btn.classList.add('active');
                    
//                     sumTimeRow.style.display = 'flex';
//                     sumTimeDisplay.textContent = time;
//                     currentTimeSelected = time;
//                     checkFormReady();
//                 });
//             }
//             timeContainer.appendChild(btn);
//         });
//     }

//     // --- 3. Dynamic Date Generation ---
//     const today = new Date();
    
//     for (let i = 0; i < 7; i++) {
//         const d = new Date(today);
//         d.setDate(today.getDate() + i);
        
//         const dayName = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
//         const month = d.toLocaleDateString('en-US', { month: 'short' });
//         const dayNum = d.toLocaleDateString('en-US', { day: 'numeric' });
//         const fullDateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        
//         const btn = document.createElement('button');
//         btn.className = `date-card ${i === 0 ? 'active' : ''}`;
//         btn.type = 'button'; // Prevent form submission
//         btn.innerHTML = `<span>${dayName}</span><strong>${month}<br>${dayNum}</strong>`;
//         btn.dataset.fulldate = fullDateStr;
        
//         // Set initial state for "Today"
//         if(i === 0) {
//             sumDateDisplay.textContent = fullDateStr;
//             currentDateString = fullDateStr;
//         }

//         btn.addEventListener('click', (e) => {
//             e.preventDefault();
//             document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
//             btn.classList.add('active');
            
//             sumDateDisplay.textContent = btn.dataset.fulldate;
//             currentDateString = btn.dataset.fulldate;
            
//             // Re-render time slots based on the newly selected date!
//             renderTimeSlots(currentDateString);
//         });

//         dateContainer.appendChild(btn);
//     }

//     // Initial render of time slots for "Today"
//     renderTimeSlots(currentDateString);

//     // --- 4. Form Validation & Proceed to Payment ---
//     function checkFormReady() {
//         if (currentTimeSelected !== "") {
//             proceedBtn.disabled = false;
//         } else {
//             proceedBtn.disabled = true;
//         }
//     }

//     proceedBtn.addEventListener('click', (e) => {
//         e.preventDefault(); 
        
//         // Grab form values
//         const inputs = document.querySelectorAll('.patient-form input, .patient-form textarea');
//         let patientName = inputs[0].value || "John Doe"; // Fallback if empty for prototype

//         // Create a pending booking object to pass to the payment page
//         const pendingBooking = {
//             doctorId: doctorData.id,
//             doctorName: doctorData.name,
//             doctorSpecialty: doctorData.specialty,
//             doctorImage: doctorData.image,
//             visitType: doctorData.visitType,
//             date: currentDateString,
//             time: currentTimeSelected,
//             consultationFee: doctorData.consultationFee,
//             visitCharge: doctorData.visitCharge,
//             platformFee: doctorData.platformFee,
//             totalAmount: doctorData.consultationFee + doctorData.visitCharge + doctorData.platformFee,
//             patientName: patientName
//         };

//         // Save to local storage so the next page can read it
//         localStorage.setItem('pendingBooking', JSON.stringify(pendingBooking));

//         // Redirect to Payment Page
//         window.location.href = "payment.html"; 
//     });
// });
// document.addEventListener('DOMContentLoaded', () => {

//     // --- 1. Dynamic Data Injection (Simulating data passed from previous page) ---
//     const doctorData = {
//         name: "Dr. Michael Chen",
//         specialty: "Cardiologist",
//         experience: "20 years experience",
//         visitType: "Home Visit", // Could be "Video Consult"
//         image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=200&auto=format&fit=crop",
//         consultationFee: 80,
//         visitCharge: 20
//     };

//     // Populate UI
//     document.getElementById('dyn-doc-img').src = doctorData.image;
//     document.getElementById('dyn-doc-name').textContent = doctorData.name;
//     document.getElementById('dyn-doc-spec').textContent = doctorData.specialty;
//     document.getElementById('dyn-doc-exp').textContent = doctorData.experience;
    
//     document.getElementById('sum-doc-name').textContent = doctorData.name;
//     document.getElementById('sum-doc-spec').textContent = doctorData.specialty;
//     document.getElementById('sum-type').textContent = doctorData.visitType;

//     document.getElementById('sum-fee').textContent = `$${doctorData.consultationFee}`;
//     document.getElementById('sum-visit').textContent = `$${doctorData.visitCharge}`;
//     document.getElementById('sum-total').textContent = `$${doctorData.consultationFee + doctorData.visitCharge}`;


//     // --- 2. Dynamic Date Generation ---
//     const dateContainer = document.getElementById('date-container');
//     const sumDateDisplay = document.getElementById('sum-date');
//     const today = new Date();
    
//     // Generate next 7 days
//     for (let i = 0; i < 7; i++) {
//         const d = new Date(today);
//         d.setDate(today.getDate() + i);
        
//         const dayName = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
//         const dayOfMonth = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        
//         // Split for UI (e.g. "Wed" and "Mar 4")
//         const splitDate = dayOfMonth.split(', ');
//         const uiTop = dayName;
//         const uiBottom = i === 0 ? splitDate[1] : splitDate[0] + '<br>' + splitDate[1];
        
//         const btn = document.createElement('button');
//         btn.className = `date-card ${i === 0 ? 'active' : ''}`;
//         btn.innerHTML = `<span>${uiTop}</span><strong>${i === 0 ? splitDate[0] : splitDate[0]}<br>${splitDate[1]}</strong>`;
        
//         // Save full date string for the summary
//         btn.dataset.fulldate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        
//         if(i === 0) sumDateDisplay.textContent = btn.dataset.fulldate;

//         btn.addEventListener('click', () => {
//             document.querySelectorAll('.date-card').forEach(c => c.classList.remove('active'));
//             btn.classList.add('active');
//             sumDateDisplay.textContent = btn.dataset.fulldate;
//             checkFormReady();
//         });

//         dateContainer.appendChild(btn);
//     }


//     // --- 3. Dynamic Time Slot Generation ---
//     const timeContainer = document.getElementById('time-container');
//     const sumTimeRow = document.getElementById('sum-time-row');
//     const sumTimeDisplay = document.getElementById('sum-time');
    
//     const times = [
//         "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
//         "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
//         "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
//         "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
//         "06:00 PM", "06:30 PM"
//     ];

//     // Mocking disabled state based on your screenshot
//     // const disabledTimes = ["10:30 AM", "02:30 PM", "04:00 PM"];

//     times.forEach(time => {
//         const btn = document.createElement('button');
//         btn.className = 'time-slot';
//         btn.textContent = time;

//         if (disabledTimes.includes(time)) {
//             btn.classList.add('disabled');
//         } else {
//             btn.addEventListener('click', () => {
//                 document.querySelectorAll('.time-slot').forEach(t => t.classList.remove('active'));
//                 btn.classList.add('active');
                
//                 sumTimeRow.style.display = 'flex';
//                 sumTimeDisplay.textContent = time;
//                 checkFormReady();
//             });
//         }
//         timeContainer.appendChild(btn);
//     });

//     // --- 4. Form Validation & Proceed Button ---
//     const proceedBtn = document.getElementById('proceed-btn');
    
//     function checkFormReady() {
//         // Simple validation: Ensure a time slot is selected
//         const timeSelected = document.querySelector('.time-slot.active');
//         if (timeSelected) {
//             proceedBtn.disabled = false;
//         }
//     }

//     proceedBtn.addEventListener('click', () => {
//         // Transition to Payment UI (we will build this next)
//         window.location.href = "payment.html"; 
//     });
// });