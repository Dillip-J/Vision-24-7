// js/confirmation.js
document.addEventListener('DOMContentLoaded', async () => {
    const latestId = localStorage.getItem('latestBookingId');
    const token = localStorage.getItem('access_token');

    // 1. Security Guard
    if (!token) {
        window.location.replace('index.html');
        return;
    }

    if (!latestId) {
        console.warn("No recent booking ID found.");
        const confIdEl = document.getElementById('conf-id');
        if (confIdEl) confIdEl.textContent = "ERROR: Missing ID";
        return;
    }

    // 2. 🚨 Bulletproof API URL (Bypasses config.js issues completely)
    const API_BASE = window.API_BASE || (
        (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:') 
        ? 'http://127.0.0.1:8000' 
        : 'https://backend-depolyment-1.onrender.com'
    );

    try {
        // 3. Fetch the exact booking directly! No more array searching!
        const response = await fetch(`${API_BASE}/bookings/${latestId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 404) throw new Error("Booking not found in database.");
            throw new Error("Failed to fetch booking details.");
        }

        // This perfectly matches the dictionary your booking.py route returns
        const booking = await response.json();

        // 4. Inject the perfectly formatted backend data straight into the HTML!
        document.getElementById('conf-id').textContent = booking.display_id;
        document.getElementById('conf-doc-name').textContent = booking.doctor_name;
        document.getElementById('conf-doc-spec').textContent = booking.specialty;
        document.getElementById('conf-date').textContent = booking.date;
        document.getElementById('conf-time').textContent = booking.time;
        document.getElementById('conf-type').textContent = booking.visit_type;
        document.getElementById('conf-patient').textContent = booking.patient_name; 
        
        // 5. 🚨 Address & "What's Next" specific display
        const nextStepEl = document.getElementById('conf-next-step');

        if (booking.visit_type === "Video Consult") {
            document.getElementById('conf-address').textContent = "Video link will be activated 5 minutes prior.";
            
            // Update the bullet point for Online Consults
            if (nextStepEl) {
                nextStepEl.textContent = "The doctor will meet you online at the specified time. Please be ready 5 minutes early.";
            }
        } else {
            document.getElementById('conf-address').textContent = `Address: ${booking.address}`;
            
            // Keep the original bullet point for Home Visits / Deliveries
            if (nextStepEl) {
                nextStepEl.textContent = "The doctor will arrive at your location at the scheduled time.";
            }
        }

    } catch (error) {
        console.error("Confirmation Error:", error);
        const confIdEl = document.getElementById('conf-id');
        if(confIdEl) confIdEl.textContent = "NOT FOUND / NETWORK ERROR";
    }

    // 6. Button Navigation
    const btnDashboard = document.getElementById('btn-dashboard');
    if (btnDashboard) {
        btnDashboard.addEventListener('click', () => {
            window.location.href = "dashboard.html";
        });
    }

    const btnHome = document.getElementById('btn-home');
    if (btnHome) {
        btnHome.addEventListener('click', () => {
            window.location.href = "home.html";
        });
    }
});