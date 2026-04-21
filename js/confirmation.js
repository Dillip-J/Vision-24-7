// js/confirmation.js
document.addEventListener('DOMContentLoaded', async () => {
    
    // Safety check: ensure API_BASE is available
    const API_BASE = window.API_BASE || 'https://backend-depolyment-3.onrender.com';
    
    const latestId = localStorage.getItem('activeBookingId') || localStorage.getItem('latestBookingId');
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

    try {
        // 3. Fetch the exact booking directly
        const response = await fetch(`${API_BASE}/bookings/${latestId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 404) throw new Error("Booking not found in database.");
            throw new Error("Failed to fetch booking details.");
        }

        const booking = await response.json();

        // 4. Inject the data
        document.getElementById('conf-id').textContent = booking.display_id;
        document.getElementById('conf-doc-name').textContent = booking.doctor_name;
        document.getElementById('conf-doc-spec').textContent = booking.specialty;
        document.getElementById('conf-date').textContent = booking.date;
        document.getElementById('conf-time').textContent = booking.time;
        document.getElementById('conf-type').textContent = booking.visit_type;
        document.getElementById('conf-patient').textContent = booking.patient_name; 
        
        // 5. 🚨 THE ADDRESS HIDING LOGIC
        const nextStepEl = document.getElementById('conf-next-step');
        const typeIconEl = document.getElementById('conf-type-icon');
        const addressRowEl = document.getElementById('conf-address-row'); // The whole span holding the icon and text

        if (booking.visit_type === "Video Consult" || booking.visit_type.includes("Video")) {
            
            // Swap icon to Video Camera
            if (typeIconEl) typeIconEl.className = "fa-solid fa-video";
            
            // Completely hide the physical address line
            if (addressRowEl) addressRowEl.style.display = 'none';
            
            // Update the instructional bullet point
            if (nextStepEl) {
                nextStepEl.textContent = "The doctor will meet you online at the specified time. A video link will appear in your dashboard.";
            }
        } else {
            
            // It's a physical visit, show the address line
            if (addressRowEl) {
                addressRowEl.style.display = 'block';
                document.getElementById('conf-address').textContent = booking.address || "Location set in booking";
            }
            
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