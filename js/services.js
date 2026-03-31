// Services.js
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // --- 1. SAFE MOCK DATA FACTORY ---
    // ==========================================
    function generateFakeUUID() {
        if (window.crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function buildDynamicCatalog() {
        const catalog = [];
        
        // Doctors
        const specialties = ["Cardiologist", "Dermatologist", "Pediatrician", "Neurologist", "General Physician"];
        specialties.forEach((spec, index) => {
            catalog.push({
                id: `SRV-DOC-${index}`,            
                provider_id: generateFakeUUID(),   
                service_id: 100 + index,           
                category: "Consultation",
                title: spec + " Consultation",
                doctorName: `Dr. Mock User ${index + 1}`,
                desc: `Professional ${spec} consultation.`,
                price: 500 + (index * 100),
                visitType: index % 2 === 0 ? "Video Consult" : "Home Visit",
                rating: 4.8,
                reviews: 120 + index,
                duration: "30 mins",
                icon: "fa-stethoscope",
                colorClass: "color-blue"
            });
        });

        // Pharmacy
        const medicines = ["Paracetamol 500mg", "Amoxicillin", "Vitamin C Complex"];
        medicines.forEach((med, index) => {
            catalog.push({
                id: `SRV-MED-${index}`,
                provider_id: generateFakeUUID(),   
                service_id: 200 + index,           
                category: "Pharmacy",
                title: med,
                doctorName: "City Care Pharmacy",  
                desc: "Fast delivery to your doorstep.",
                price: 50 + (index * 20),
                visitType: "Delivery",
                rating: 4.9,
                reviews: 890 + index,
                duration: "2-4 hours",
                icon: "fa-pills",
                colorClass: "color-orange"
            });
        });

        return catalog;
    }

    // Initialize the data array
    const servicesData = buildDynamicCatalog();
    console.log("Safe Mock Data Generated:", servicesData);


    // ==========================================
    // --- 2. RENDER ENGINE ---
    // ==========================================
    const grid = document.getElementById('services-grid');
    const searchInput = document.getElementById('service-search');
    const tabs = document.querySelectorAll('.filter-tab');

    let currentFilter = 'All';
    let searchQuery = '';

    function renderGrid() {
        if (!grid) return;
        grid.innerHTML = '';

        const filteredData = servicesData.filter(item => {
            const matchesCategory = currentFilter === 'All' || item.category === currentFilter;
            const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.category.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });

        if (filteredData.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">No services found.</div>`;
            return;
        }

        filteredData.forEach(srv => {
            const isOnline = srv.visitType === "Video Consult";
            const isHome = srv.visitType === "Home Visit" || srv.visitType === "Delivery";
            
            let locationTags = '';
            if (isOnline) locationTags += `<div><i class="fa-solid fa-video"></i> Online</div>`;
            if (isHome) locationTags += `<div><i class="fa-solid fa-location-dot"></i> Home/Delivery</div>`;

            const cardHTML = `
                <div class="srv-card">
                    <div class="srv-top-row">
                        <div class="srv-icon ${srv.colorClass || 'color-blue'}"><i class="fa-solid ${srv.icon || 'fa-user-doctor'}"></i></div>
                        <div class="srv-category-badge">${srv.category}</div>
                    </div>
                    <h3>${srv.title}</h3>
                    <p>${srv.desc}</p>
                    <div class="srv-rating">
                        <i class="fa-solid fa-star"></i> ${srv.rating} <span>(${srv.reviews} reviews)</span>
                    </div>
                    <div class="srv-meta">
                        <div><i class="fa-regular fa-clock"></i> ${srv.duration}</div>
                        ${locationTags}
                    </div>
                    <div class="srv-footer">
                        <div class="srv-price">₹ ${srv.price}</div>
                        <button class="btn-book-now" onclick="initiateBooking('${srv.id}')">Book Now</button>
                    </div>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', cardHTML);
        });
    }

    // --- Event Listeners ---
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderGrid();
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.getAttribute('data-filter');
            renderGrid();
        });
    });

    // Initial Load
    renderGrid();


    // ==========================================
    // --- 3. APPLICATION ROUTING & AUTH GUARD ---
    // ==========================================
    // Attach to window so the inline HTML onclick="initiateBooking()" can reach it
    window.initiateBooking = function(serviceId) {
        
        // 1. JWT Auth Guard
        const token = localStorage.getItem('access_token');
        if (!token) {
            alert("Please log in or create an account to book a service.");
            window.location.href = 'index.html'; 
            return; 
        }

        // 2. Find the clicked service
        const selected = servicesData.find(s => s.id === serviceId);
        if (!selected) return;
        
        // 3. Build the Payload for the Payment Page / Backend
        const pendingBooking = {
            // Backend Data
            provider_id: selected.provider_id, 
            service_id: selected.service_id,   
            
            // UI Display Data
            doctorName: selected.doctorName,
            doctorSpecialty: selected.title,
            visitType: selected.visitType, 
            doctorImage: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=200&auto=format&fit=crop", 
            date: new Date().toLocaleDateString(), // Placeholder for now
            time: "10:00 AM", // Placeholder for now
            
            // Financials
            consultationFee: selected.price,
            visitCharge: selected.visitType === "Home Visit" || selected.visitType === "Delivery" ? 50 : 0,
            platformFee: 15
        };

        // 4. Save and redirect
        localStorage.setItem('pendingBooking', JSON.stringify(pendingBooking));
        
        // NOTE: If you have a 'book.html' where they pick the date/time, send them there first!
        // If not, and you want to jump straight to payment, use 'payment.html'
        window.location.href = "book.html"; 
    };
});