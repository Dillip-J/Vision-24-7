// js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {

    // 1. SECURITY & SESSION GUARD
    const token = localStorage.getItem('access_token');
    if (!token) { window.location.replace('index.html'); return; }

    let myBookings = [];
    let myReports = [];

    const getInitials = (name) => {
        if(!name) return 'DR';
        const cleanName = name.replace(/^Dr\.\s*/i, '');
        const parts = cleanName.split(' ');
        return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : `${cleanName[0]}X`.toUpperCase();
    };

    // 3. BULLETPROOF FASTAPI FETCH
    window.fetchDashboardData = async function() {
        try {
            // 🚨 FIX 2: Removed local fallback inside function
            const [activeRes, historyRes] = await Promise.all([
                fetch(`${API_BASE}/bookings/me/active`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
                fetch(`${API_BASE}/bookings/me/history`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null)
            ]);

            if ((activeRes && activeRes.status === 401) || (historyRes && historyRes.status === 401)) {
                localStorage.removeItem('access_token'); window.location.replace('index.html'); return;
            }

            let activeData = []; let historyData = [];
            if (activeRes && activeRes.ok) activeData = await activeRes.json();
            if (historyRes && historyRes.ok) historyData = await historyRes.json();

            const activeArray = Array.isArray(activeData) ? activeData : (activeData.items || []);
            const historyArray = Array.isArray(historyData) ? historyData : (historyData.items || []);

            myBookings = [...activeArray, ...historyArray].map(apt => {
                let dateStr = "TBD"; let timeStr = "TBD";
                if (apt.scheduled_time) {
                    const d = new Date(apt.scheduled_time);
                    dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else if (apt.created_at) {
                    dateStr = new Date(apt.created_at).toLocaleDateString(); timeStr = "ASAP";
                }

                let mappedStatus = (apt.booking_status || 'pending').toLowerCase();
                if (['pending', 'confirmed', 'in_transit'].includes(mappedStatus)) mappedStatus = 'active';
                if (mappedStatus === 'rejected') mappedStatus = 'canceled';

                let vType = "Home Visit";
                const addr = (apt.delivery_address || "").trim().toLowerCase();
                if (apt.provider && apt.provider.provider_type === "Pharmacy") vType = "Delivery";
                if (addr === "" || addr === "none" || addr === "null" || addr === "online" || addr === "platform default" || addr === "undefined") {
                    vType = "Video Consult";
                }

                return {
                    bookingId: apt.booking_id, 
                    rawId: apt.booking_id,
                    doctorName: apt.provider ? apt.provider.name : "Unknown Provider",
                    doctorSpecialty: apt.provider ? apt.provider.category : "Healthcare Service",
                    status: mappedStatus,
                    date: dateStr,
                    time: timeStr,
                    visitType: vType,
                    hasReport: mappedStatus === 'completed', 
                    clinicalNotes: apt.order_notes || "No additional notes.",
                    raw: apt 
                };
            });

            myReports = myBookings.filter(apt => apt.status === 'completed' && apt.hasReport === true);
            renderStats();
            renderAllLists();

        } catch (error) {
            console.error("Dashboard Error:", error);
            renderStats(); renderAllLists();
        }
    }

    // 4. STATS RENDERER
    function renderStats() {
        const statsContainer = document.getElementById('stats-container');
        if(!statsContainer) return;
        const activeCount = myBookings.filter(a => a.status === 'active').length;
        const completedCount = myBookings.filter(a => a.status === 'completed').length;
        const canceledCount = myBookings.filter(a => a.status === 'canceled').length;

        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-info"><span class="stat-title">Appointments</span><span class="stat-value text-blue">${activeCount}</span></div>
                <div class="stat-icon icon-blue"><i class="fa-regular fa-clock"></i></div>
            </div>
            <div class="stat-card">
                <div class="stat-info"><span class="stat-title">Completed</span><span class="stat-value" style="color: var(--success-green);">${completedCount}</span></div>
                <div class="stat-icon icon-green"><i class="fa-regular fa-circle-check"></i></div>
            </div>
            <div class="stat-card">
                <div class="stat-info"><span class="stat-title">Canceled</span><span class="stat-value" style="color: #EF4444;">${canceledCount}</span></div>
                <div class="stat-icon" style="background: rgba(239, 68, 68, 0.15); color: #F87171;"><i class="fa-solid fa-ban"></i></div>
            </div>
            <div class="stat-card">
                <div class="stat-info"><span class="stat-title">Reports</span><span class="stat-value" style="color: #9333EA;">${myReports.length}</span></div>
                <div class="stat-icon" style="background: rgba(147, 51, 234, 0.15); color: #C084FC;"><i class="fa-regular fa-file-lines"></i></div>
            </div>
        `;
    }

    // 5. TAB LIST RENDERING ENGINE
    function renderAllLists() {
        renderList('list-active', myBookings.filter(b => b.status === 'active'), "No active appointments right now.");
        renderList('list-completed', myBookings.filter(b => b.status === 'completed'), "You have no completed appointments yet.");
        renderList('list-canceled', myBookings.filter(b => b.status === 'canceled'), "No canceled appointments.");
        renderReports();
        renderComplaints();
    }

    function renderList(containerId, dataArray, emptyMessage) {
        const container = document.getElementById(containerId);
        if(!container) return;
        container.innerHTML = '';
        
        if (dataArray.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>${emptyMessage}</p></div>`; return;
        }

        dataArray.forEach(apt => {
            const initials = getInitials(apt.doctorName);
            const isOnline = apt.visitType === 'Video Consult';
            const typeIcon = isOnline ? 'fa-video' : (apt.visitType === 'Delivery' ? 'fa-motorcycle' : 'fa-location-dot');

            let actionButtonsHtml = '';
            
            if (apt.status === 'active' && isOnline) {
                actionButtonsHtml += `<button class="btn-action" onclick="window.open('video-room.html?room=${apt.rawId}&role=patient', '_blank')"><i class="fa-solid fa-video"></i> Join Call</button>`;
            } else if (apt.status === 'active') {
                actionButtonsHtml += `<button class="btn-action-outline" style="color: #F59E0B; border-color: #F59E0B;"><i class="fa-regular fa-clock"></i> Awaiting</button>`;
            } else if (apt.status === 'completed') {
                actionButtonsHtml += `<button class="btn-action-outline" onclick="downloadSimulation('${apt.bookingId}')"><i class="fa-solid fa-download"></i> Report</button>`;
            }

            actionButtonsHtml += `<button class="btn-action-outline" onclick="openBookingModal('${apt.rawId}')" style="margin-left: 8px;"><i class="fa-solid fa-circle-info"></i> Details</button>`;

            if (apt.status === 'active') {
                actionButtonsHtml += `<button class="btn-action-outline" onclick="cancelBooking('${apt.rawId}')" style="margin-left: 8px; color: #EF4444; border-color: #EF4444;"><i class="fa-solid fa-ban"></i> Cancel</button>`;
            }

            if (apt.status === 'completed') {
                actionButtonsHtml += `<button class="btn-action-outline" onclick="fileComplaint('${apt.rawId}')" style="margin-left: 8px; color: #EF4444; border-color: #EF4444;"><i class="fa-solid fa-triangle-exclamation"></i> Complaint</button>`;
            }

            let statusClass = `status-${apt.status}`;
            if (apt.status === 'canceled') statusClass = 'status-canceled'; 

            container.innerHTML += `
                <div class="apt-card">
                    <div class="apt-avatar">${initials}</div>
                    <div class="apt-content">
                        <div class="apt-top-row">
                            <div class="apt-title-group">
                                <h3>${apt.doctorSpecialty}</h3>
                                <span class="status-badge ${statusClass}">${apt.status.toUpperCase()}</span>
                            </div>
                            <span class="apt-id">${apt.bookingId}</span>
                        </div>
                        <div class="apt-doctor">${apt.doctorName}</div>
                        <div class="apt-meta-grid">
                            <div class="meta-item"><i class="fa-regular fa-calendar"></i> ${apt.date}</div>
                            <div class="meta-item"><i class="fa-regular fa-clock"></i> ${apt.time}</div>
                            <div class="meta-item"><i class="fa-solid ${typeIcon}"></i> ${apt.visitType}</div>
                        </div>
                        <div class="apt-actions" style="margin-top: 12px;">${actionButtonsHtml}</div>
                    </div>
                </div>
            `;
        });
    }

    function renderReports() {
        const repList = document.getElementById('list-reports');
        if(!repList) return;
        repList.innerHTML = '';
        if (myReports.length === 0) { repList.innerHTML = `<div class="empty-state"><i class="fa-regular fa-file-pdf"></i><p>No medical reports uploaded by providers yet.</p></div>`; return; }

        myReports.forEach(rep => {
            repList.innerHTML += `
                <div class="apt-card">
                    <div class="apt-avatar" style="background: rgba(147, 51, 234, 0.15); color: #C084FC;"><i class="fa-regular fa-file-pdf"></i></div>
                    <div class="apt-content">
                        <div class="apt-top-row">
                            <div class="apt-title-group">
                                <h3>Medical Record / Summary</h3>
                                <span class="status-badge status-completed">Available</span>
                            </div>
                            <span class="apt-id">${rep.bookingId}</span>
                        </div>
                        <div class="apt-doctor">Provider: ${rep.doctorName}</div>
                        <div class="apt-meta-grid" style="grid-template-columns: 1fr;">
                            <div class="meta-item"><i class="fa-regular fa-calendar"></i> Date: ${rep.date}</div>
                        </div>
                        <div class="apt-actions" style="margin-top: 12px;">
                            <button class="btn-action" style="background: #9333EA; border: none; color: white;" onclick="downloadSimulation('${rep.bookingId}')"><i class="fa-solid fa-download"></i> Secure Download</button>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    function renderComplaints() {
        const compList = document.getElementById('list-complaints');
        if(!compList) return;
        compList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.5;"></i><p>You have no active complaints.</p></div>`;
    }

    // 6. SAFE TABS SWITCHING LOGIC
    const tabs = document.querySelectorAll('.dash-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const sectionTitle = document.getElementById('dynamic-section-title');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden')); 
            
            e.target.classList.add('active');
            const targetId = e.target.getAttribute('data-target');
            if (targetId) {
                const targetContent = document.getElementById(targetId);
                if(targetContent) targetContent.classList.remove('hidden');
            }
            
            if(sectionTitle) sectionTitle.textContent = e.target.textContent;
        });
    });

    // 7. MODAL ENGINE
    const modal = document.getElementById('booking-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');

    if (closeModalBtn) closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));

    window.openBookingModal = function(rawId) {
        const apt = myBookings.find(b => b.rawId === rawId);
        if (!apt) return;

        document.getElementById('modal-booking-id').textContent = `Booking ID: ${apt.bookingId}`;
        document.getElementById('modal-status-badge').textContent = apt.status.toUpperCase();
        document.getElementById('modal-doc-initials').textContent = getInitials(apt.doctorName);
        document.getElementById('modal-doc-name').textContent = apt.doctorName;
        document.getElementById('modal-doc-spec').textContent = apt.doctorSpecialty;
        document.getElementById('modal-service').textContent = apt.doctorSpecialty;
        
        document.getElementById('modal-type-text').textContent = apt.visitType;
        const typeIcon = document.getElementById('modal-type-icon');
        if(typeIcon) typeIcon.className = apt.visitType === 'Video Consult' ? 'fa-solid fa-video text-purple' : 'fa-solid fa-location-dot text-purple';

        document.getElementById('modal-date').textContent = apt.date;
        document.getElementById('modal-time').textContent = apt.time;

        document.getElementById('modal-patient-name').textContent = apt.raw.patient_name || "Self";
        
        const ageEl = document.getElementById('modal-patient-age');
        if(ageEl) ageEl.textContent = apt.raw.patient_age || "N/A";
        
        const genderEl = document.getElementById('modal-patient-gender');
        if(genderEl) genderEl.textContent = apt.raw.patient_gender || "N/A";
        
        const addressEl = document.getElementById('modal-patient-address');
        if(addressEl) addressEl.textContent = apt.raw.delivery_address || "Platform Default";
        
        const reasonEl = document.getElementById('modal-patient-reason');
        if(reasonEl) reasonEl.textContent = apt.raw.symptoms || apt.raw.order_notes || "None provided";

        const notesSection = document.getElementById('modal-notes-section');
        const notesText = document.getElementById('modal-notes-text');
        if (apt.status === 'completed' && notesSection) {
            notesSection.classList.remove('hidden');
            notesText.textContent = apt.clinicalNotes;
        } else if (notesSection) {
            notesSection.classList.add('hidden');
        }
        
        modal.classList.remove('hidden');
    };

    window.addEventListener('click', (e) => { 
        if (e.target === modal) modal.classList.add('hidden'); 
    });

    // 8. START ENGINE
    fetchDashboardData();
});

// ==========================================
// GLOBAL ACTIONS (Cancel & Complaint)
// ==========================================
window.cancelBooking = async function(rawId) {
    if (!confirm("Are you sure you want to cancel this appointment? This action cannot be undone.")) return;
    
    // 🚨 FIX 3: Point to Cloud API here too
    const API_BASE = window.API_BASE || 'https://backend-depolyment-3.onrender.com';
    const token = localStorage.getItem('access_token');
    
    try {
        const response = await fetch(`${API_BASE}/bookings/${rawId}/cancel`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            alert("Booking successfully canceled.");
            if(window.fetchDashboardData) window.fetchDashboardData(); 
        } else {
            alert("Failed to cancel booking.");
        }
    } catch(e) {
        console.error(e);
        alert("Network Error while canceling.");
    }
};

window.fileComplaint = function(rawId) {
    alert(`Initiating Complaint Protocol for Booking ID: ${rawId}\n\n(In Phase 2, this will open the Complaint Submission Modal.)`);
};

window.downloadSimulation = function(reportId) {
    alert(`Initiating secure download for Record ID:\n"${reportId}"\n\n(In Phase 2, this will download the encrypted PDF from FastAPI storage.)`);
};