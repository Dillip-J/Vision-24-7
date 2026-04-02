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

// payment.js
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // ⚠️ DEVELOPER MODE: FALLBACK MOCK DATA 
    // Uncomment this block ONLY if you are testing without booking first
    // ==========================================
    /*
    function generateFakeUUID() { return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }); }
    const mockData = {
        provider_id: generateFakeUUID(),
        service_id: 101,
        doctorName: "Dr. Michael Chen",
        doctorSpecialty: "Cardiologist",
        doctorImage: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=200&auto=format&fit=crop",
        date: "Thu, Mar 05, 2026",
        time: "04:30 PM",
        visitType: "Home Visit",
        consultationFee: 80,
        visitCharge: 20,
        platformFee: 5
    };
    localStorage.setItem('pendingBooking', JSON.stringify(mockData));
    */

    // --- 1. Fetch Dynamic Data (STRICT ENFORCEMENT) ---
    let pendingDataJSON = localStorage.getItem('pendingBooking');
    
    // Security Kick: If they bypassed the flow and have an empty cart, kick them to the directory.
    if (!pendingDataJSON) {
        console.warn("Unauthorized access: No booking data found. Redirecting to Doctor directory.");
        window.location.replace('doctors.html'); 
        return; // This immediately stops the rest of the page from trying to load
    }
    
    // If they made it here, they legitimately clicked "Book" on a real doctor
    const booking = JSON.parse(pendingDataJSON);

    // Populate the Summary UI
    document.getElementById('pay-doc-img').src = booking.doctorImage;
    document.getElementById('pay-doc-name').textContent = booking.doctorName;
    document.getElementById('pay-doc-spec').textContent = booking.doctorSpecialty;
    document.getElementById('pay-date').textContent = booking.date;
    document.getElementById('pay-time').textContent = booking.time;
    document.getElementById('pay-type').textContent = booking.visitType;
    document.getElementById('pay-fee').textContent = `$${booking.consultationFee}`;
    document.getElementById('pay-visit').textContent = `$${booking.visitCharge}`;
    
    const pFee = booking.platformFee || 5; 
    document.getElementById('pay-platform').textContent = `$${pFee}`;
    const grandTotal = booking.consultationFee + booking.visitCharge + pFee;
    
    document.getElementById('pay-total').textContent = `$${grandTotal}`;
    document.getElementById('btn-amount').textContent = `$${grandTotal}`;

    // --- 2. Payment Method Toggling Logic ---
    const methodCards = document.querySelectorAll('.payment-method-row');
    const panels = {
        'card': document.getElementById('panel-card'),
        'upi': document.getElementById('panel-upi'),
        'netbanking': document.getElementById('panel-netbanking')
    };

    methodCards.forEach(card => {
        card.addEventListener('click', () => {
            // Update Active Card Styling
            methodCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // Check Radio programmatically
            const radio = card.querySelector('input[type="radio"]');
            radio.checked = true;
            const selectedMethod = radio.value;

            // Hide all panels, remove required attributes from all inputs
            Object.values(panels).forEach(panel => {
                panel.style.display = 'none';
                panel.classList.remove('active-panel');
                panel.querySelectorAll('input').forEach(input => input.required = false);
            });

            // Show selected panel and make its inputs required
            if (panels[selectedMethod]) {
                panels[selectedMethod].style.display = 'flex';
                // Slight delay for CSS animation
                setTimeout(() => panels[selectedMethod].classList.add('active-panel'), 10);
                
                // Only make inputs required for the visible form
                const activeFormInputs = panels[selectedMethod].querySelectorAll('input[type="text"], input[type="password"]');
                activeFormInputs.forEach(input => input.required = true);
            }
        });
    });

    // --- 3. Net Banking Grid Logic ---
    const bankButtons = document.querySelectorAll('.bank-btn');
    const dynamicBankName = document.getElementById('dynamic-bank-name');

    bankButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            bankButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            dynamicBankName.textContent = btn.getAttribute('data-bank');
        });
    });

    // Auto-space Credit Card Number
    const ccInput = document.getElementById('cc-number');
    if(ccInput) {
        ccInput.addEventListener('input', function (e) {
            let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
            let formattedValue = '';
            for (let i = 0; i < value.length; i++) {
                if (i > 0 && i % 4 === 0) formattedValue += ' ';
                formattedValue += value[i];
            }
            e.target.value = formattedValue;
        });
    }

    // ==========================================
    // --- 4. Process Payment (FASTAPI CONNECTED) ---
    // ==========================================
    const payBtn = document.getElementById('confirm-pay-btn');

    payBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        // 1. Verify User is logged in securely
        const token = localStorage.getItem('access_token');
        if (!token) {
            alert("Your session expired. Please log in to complete the booking.");
            window.location.href = "index.html";
            return;
        }

        // 2. Validate the currently visible payment form
        const selectedMethod = document.querySelector('input[name="payment_method"]:checked').value;
        const activeForm = document.getElementById(`form-${selectedMethod}`);
        
        if (activeForm && !activeForm.checkValidity()) {
            activeForm.reportValidity();
            return; 
        }

        // 3. UI Processing State
        const originalBtnText = payBtn.innerHTML;
        payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        payBtn.disabled = true;

        // 4. Build the payload for the Backend
        // Note: 'booking' here comes from your Section 1 (pendingDataJSON)
        
        // Since your mock data is simple, we map it to the backend schema
        const bookingPayload = {
            provider_id: booking.provider_id || "00000000-0000-0000-0000-000000000000", // Needs real UUID from earlier pages
            doctor_service_id: booking.service_id || null, // Will depend on what they booked
            scheduled_time: new Date(`${booking.date} ${booking.time}`).toISOString(),
            delivery_address: booking.visitType === "Home Visit" ? (localStorage.getItem('deliveryAddress') || "Home") : null,
            // You can add payment method to notes or a new column later
            order_notes: `Paid via: ${selectedMethod}` 
        };

        try {
            // 5. Send to FastAPI (NOW USING THE API ROUTER)
            const response = await fetch(`${API_BASE}/bookings/`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(bookingPayload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                alert(`Booking Failed: ${errorData.detail || "Validation Error"}`);
                return;
            }

            const data = await response.json(); // Backend returns {"id": UUID, "status": "Success"}

            // 6. Cleanup & Redirect
            localStorage.removeItem('pendingBooking'); // Clear the cart
            localStorage.setItem('latestBookingId', data.id); // Save real DB ID for the confirmation page

            window.location.href = "confirmation.html";

        } catch (error) {
            console.error("Booking submission error:", error);
            alert("Network error. Could not connect to the server.");
        } finally {
            payBtn.innerHTML = originalBtnText;
            payBtn.disabled = false;
        }
    });

    // --- 5. Theme Toggling Logic ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    if (themeToggleBtn && themeIcon) {
        // Check local storage to keep theme consistent across pages
        const currentTheme = localStorage.getItem('theme');
        if (currentTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.classList.remove('fa-moon', 'fa-regular');
            themeIcon.classList.add('fa-sun', 'fa-solid');
        }

        themeToggleBtn.addEventListener('click', () => {
            const theme = document.documentElement.getAttribute('data-theme');
            
            if (theme === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                
                // Switch to moon icon
                themeIcon.classList.remove('fa-sun', 'fa-solid');
                themeIcon.classList.add('fa-moon', 'fa-regular');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                
                // Switch to sun icon
                themeIcon.classList.remove('fa-moon', 'fa-regular');
                themeIcon.classList.add('fa-sun', 'fa-solid');
            }
        });
    }
});