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

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get the ID of the appointment we JUST booked and the secure Token
    const latestId = localStorage.getItem('latestBookingId');
    const token = localStorage.getItem('access_token');

    // Security Guard
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    if (!latestId) {
        console.warn("No recent booking ID found.");
        document.getElementById('conf-id').textContent = "ERROR";
        return;
    }

    try {
        // 2. Fetch all of this user's active bookings from the Backend
        const response = await fetch(`${API_BASE}/bookings/me/active`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Failed to fetch bookings");

        const activeBookings = await response.json();

        // 3. Find the specific booking object that matches our ID
        const booking = activeBookings.find(b => b.booking_id === latestId);

        if (!booking) {
            console.warn("Booking not found in active database.");
            document.getElementById('conf-id').textContent = "NOT FOUND";
            return;
        }

        // 4. Populate Real Dynamic Data
        
        // Format the ISO Date string from PostgreSQL into readable text
        const scheduledDate = new Date(booking.scheduled_time);
        const dateStr = scheduledDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // Determine Visit Type based on backend data
        let vType = "Home Visit";
        if (booking.provider && booking.provider.provider_type === "Pharmacy") vType = "Delivery";
        if (!booking.delivery_address) vType = "Video Consult"; // If no address was saved, it's online

        // Inject into your exact HTML IDs
        document.getElementById('conf-id').textContent = booking.booking_id.split('-')[0].toUpperCase(); // Shortens UUID for display
        document.getElementById('conf-doc-name').textContent = booking.provider ? booking.provider.name : "Healthcare Provider";
        document.getElementById('conf-doc-spec').textContent = booking.provider ? booking.provider.category : "Service";
        
        document.getElementById('conf-date').textContent = dateStr;
        document.getElementById('conf-time').textContent = timeStr;
        document.getElementById('conf-type').textContent = vType;
        
        // Uses the 'patient_name' column we added to your SQL schema earlier!
        document.getElementById('conf-patient').textContent = booking.patient_name || "Self"; 
        
        // Dynamic Meta Data based on visit type
        if(vType === "Home Visit" || vType === "Delivery") {
            // Show the actual address they provided
            document.getElementById('conf-address').textContent = `Address: ${booking.delivery_address}`;
        } else if (vType === "Video Consult") {
            document.getElementById('conf-address').textContent = "Video link will be activated 5 minutes prior.";
        }

    } catch (error) {
        console.error("Error loading confirmation data:", error);
        document.getElementById('conf-id').textContent = "NETWORK ERROR";
    }

    // 5. Button Navigation Routing (Left untouched as requested)
    document.getElementById('btn-dashboard').addEventListener('click', () => {
        window.location.href = "dashboard.html";
    });

    document.getElementById('btn-home').addEventListener('click', () => {
        window.location.href = "home.html";
    });
});