// dashboard.js
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // --- 1. STRICT JWT SESSION GUARD ---
    // ==========================================
    const token = localStorage.getItem('access_token');
    if (!token) { 
        window.location.href = 'index.html'; 
        return; 
    }

    let myBookings = [];
    let myReports = [];

    // Helper: Extract Initials
    const getInitials = (name) => {
        if(!name) return 'DR';
        const cleanName = name.replace(/^Dr\.\s*/i, '');
        const parts = cleanName.split(' ');
        return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : `${cleanName[0]}X`.toUpperCase();
    };

    // ==========================================
    // --- 2. FASTAPI DATA FETCH ---
    // ==========================================
    async function fetchDashboardData() {
        try {
            // Fetch Active Bookings (Upcoming)
            const activeRes = await fetch(`${API_BASE}/bookings/me/active`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            // Fetch History Bookings (Completed/Canceled)
            const historyRes = await fetch(`${API_BASE}/bookings/me/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (activeRes.status === 401 || historyRes.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = 'index.html';
                return;
            }

            const activeData = await activeRes.json();
            const historyData = await historyRes.json();

            // Combine and map Backend Schema to Frontend UI expectations
            const allFetched = [...activeData, ...historyData].map(apt => {
                
                // Format Date & Time safely
                let dateStr = "TBD";
                let timeStr = "TBD";
                if (apt.scheduled_time) {
                    const d = new Date(apt.scheduled_time);
                    dateStr = d.toLocaleDateString();
                    timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else if (apt.created_at) {
                    dateStr = new Date(apt.created_at).toLocaleDateString();
                    timeStr = "ASAP";
                }

                // Map status names
                let mappedStatus = apt.booking_status;
                if (mappedStatus === 'pending' || mappedStatus === 'confirmed') mappedStatus = 'upcoming';

                // Determine Visit Type
                let vType = "Home Visit";
                if (apt.provider && apt.provider.provider_type === "Pharmacy") vType = "Delivery";
                if (!apt.delivery_address) vType = "Video Consult";

                return {
                    bookingId: apt.booking_id.split('-')[0].toUpperCase(), // Shorten UUID
                    rawId: apt.booking_id,
                    doctorName: apt.provider ? apt.provider.name : "Unknown Provider",
                    doctorSpecialty: apt.provider ? apt.provider.category : "Healthcare Service",
                    status: mappedStatus,
                    date: dateStr,
                    time: timeStr,
                    visitType: vType,
                    hasReport: apt.booking_status === 'completed', // Mock flag for reports tab
                    clinicalNotes: apt.order_notes || "No additional notes."
                };
            });

            myBookings = allFetched;
            myReports = myBookings.filter(apt => apt.status === 'completed' && apt.hasReport === true);

            // Trigger UI Renders
            renderStats();
            renderAppointments();
            renderReports();

        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
            // Fallback empty states will trigger automatically
            renderStats();
            renderAppointments();
            renderReports();
        }
    }

    // ==========================================
    // --- 3. RENDER STATS DYNAMICALLY ---
    // ==========================================
    function renderStats() {
        const statsContainer = document.getElementById('stats-container');
        if(!statsContainer) return;

        const upcomingCount = myBookings.filter(a => a.status === 'upcoming').length;
        const completedCount = myBookings.filter(a => a.status === 'completed').length;

        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-info"><span class="stat-title">Total Bookings</span><span class="stat-value">${myBookings.length}</span></div>
                <div class="stat-icon icon-blue"><i class="fa-regular fa-calendar"></i></div>
            </div>
            <div class="stat-card">
                <div class="stat-info"><span class="stat-title">Upcoming</span><span class="stat-value text-blue">${upcomingCount}</span></div>
                <div class="stat-icon icon-blue"><i class="fa-regular fa-clock"></i></div>
            </div>
            <div class="stat-card">
                <div class="stat-info"><span class="stat-title">Completed</span><span class="stat-value" style="color: var(--success-green);">${completedCount}</span></div>
                <div class="stat-icon icon-green"><i class="fa-regular fa-circle-check"></i></div>
            </div>
            <div class="stat-card">
                <div class="stat-info"><span class="stat-title">Reports</span><span class="stat-value" style="color: #9333EA;">${myReports.length}</span></div>
                <div class="stat-icon icon-purple"><i class="fa-regular fa-file-lines"></i></div>
            </div>
        `;
    }

    // ==========================================
    // --- 4. VIEW RENDERERS ---
    // ==========================================
    const aptList = document.getElementById('appointments-list');
    const repList = document.getElementById('reports-list');
    const placeholderList = document.getElementById('placeholder-list');
    const sectionTitle = document.getElementById('dynamic-section-title');

    function renderAppointments() {
        if(!aptList) return;
        aptList.innerHTML = '';
        
        if (myBookings.length === 0) {
            aptList.innerHTML = `<div class="empty-state"><i class="fa-regular fa-calendar-xmark"></i><p>You have no bookings yet.</p></div>`;
            return;
        }

        myBookings.forEach(apt => {
            const initials = getInitials(apt.doctorName);
            const isUpcoming = apt.status === 'upcoming';
            const isOnline = apt.visitType.includes('Video');
            const typeIcon = isOnline ? 'fa-video' : (apt.visitType === 'Delivery' ? 'fa-motorcycle' : 'fa-location-dot');

            // Online appointments get the Join Call button!
            let actionButtonsHtml = '';
            if (isUpcoming && isOnline) {
                actionButtonsHtml = `<button class="btn-action" onclick="window.open('video-room.html?room=${apt.rawId}', '_blank')"><i class="fa-solid fa-video"></i> Join Call</button>`;
            } else if (isUpcoming) {
                actionButtonsHtml = `<button class="btn-action-outline" style="color: #F59E0B; border-color: #F59E0B;"><i class="fa-regular fa-clock"></i> Awaiting Provider</button>`;
            } else {
                actionButtonsHtml = `<button class="btn-action-outline" onclick="alert('Clinical Notes: ${apt.clinicalNotes}')"><i class="fa-solid fa-stethoscope"></i> View Notes</button>`;
            }

            // Status color mapping
            let statusClass = `status-${apt.status}`;
            if (apt.status === 'canceled') statusClass = 'status-canceled'; // Make sure you add .status-canceled to your CSS (red)

            aptList.innerHTML += `
                <div class="apt-card">
                    <div class="apt-avatar">${initials}</div>
                    <div class="apt-content">
                        <div class="apt-top-row">
                            <div class="apt-title-group">
                                <h3>${apt.doctorSpecialty}</h3>
                                <span class="status-badge ${statusClass}">${apt.status}</span>
                            </div>
                            <span class="apt-id">${apt.bookingId}</span>
                        </div>
                        <div class="apt-doctor">${apt.doctorName}</div>
                        <div class="apt-meta-grid">
                            <div class="meta-item"><i class="fa-regular fa-calendar"></i> ${apt.date}</div>
                            <div class="meta-item"><i class="fa-regular fa-clock"></i> ${apt.time}</div>
                            <div class="meta-item"><i class="fa-solid ${typeIcon}"></i> ${apt.visitType}</div>
                        </div>
                        <div class="apt-actions">${actionButtonsHtml}</div>
                    </div>
                </div>
            `;
        });
    }

    function renderReports() {
        if(!repList) return;
        repList.innerHTML = '';
        
        if (myReports.length === 0) {
            repList.innerHTML = `<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>No medical reports uploaded by providers yet.</p></div>`;
            return;
        }

        myReports.forEach(rep => {
            repList.innerHTML += `
                <div class="apt-card">
                    <div class="report-icon"><i class="fa-regular fa-file-pdf"></i></div>
                    <div class="apt-content">
                        <div class="apt-top-row">
                            <div class="apt-title-group">
                                <h3>Medical Record / Summary</h3>
                                <span class="status-badge status-completed">Lab / Clinical</span>
                            </div>
                            <span class="apt-id">${rep.bookingId}</span>
                        </div>
                        <div class="apt-doctor">Provider: ${rep.doctorName}</div>
                        <div class="apt-meta-grid" style="grid-template-columns: 1fr;">
                            <div class="meta-item"><i class="fa-regular fa-calendar"></i> Date: ${rep.date}</div>
                        </div>
                        <div class="apt-actions">
                            <button class="btn-action btn-download" onclick="downloadSimulation('${rep.bookingId}')">
                                <i class="fa-solid fa-download"></i> Secure Download
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    // ==========================================
    // --- 5. TABS LOGIC ---
    // ==========================================
    const tabs = document.querySelectorAll('.dash-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            const tabName = e.target.textContent;

            if(aptList) aptList.style.display = 'none';
            if(repList) repList.style.display = 'none';
            if(placeholderList) placeholderList.style.display = 'none';
            
            const bookNewBtn = document.getElementById('book-new-btn');
            if(bookNewBtn) bookNewBtn.style.display = 'none';

            if (tabName === 'Bookings') {
                if(sectionTitle) sectionTitle.textContent = 'My Appointments';
                if(aptList) aptList.style.display = 'flex';
                if(bookNewBtn) bookNewBtn.style.display = 'flex';
            } 
            else if (tabName === 'Reports') {
                if(sectionTitle) sectionTitle.textContent = 'My Medical Reports';
                if(repList) repList.style.display = 'flex';
            } 
            else {
                if(sectionTitle) sectionTitle.textContent = `My ${tabName}`;
                if(placeholderList) placeholderList.style.display = 'block';
            }
        });
    });

    // START ENGINE
    fetchDashboardData();
});

// Download Simulation (Public Function)
window.downloadSimulation = function(reportId) {
    alert(`Initiating secure download for Record ID:\n"${reportId}"\n\n(In Phase 2, this will download the encrypted PDF from FastAPI storage.)`);
};