// js/dashboard.js
document.addEventListener('DOMContentLoaded', () => {

    const API_BASE = window.API_BASE || 'https://backend-depolyment-3.onrender.com';
    if (!API_BASE) {
        console.error("FATAL: window.API_BASE is missing.");
        return;
    }

    // 🚨 FIX: Removed Auth Guard Redirect. It will no longer kick users to index.html
    const token = localStorage.getItem('access_token');

    let myBookings = [];

    const getInitials = (name) => {
        if(!name) return 'DR';
        const cleanName = name.replace(/^Dr\.\s*/i, '');
        const parts = cleanName.split(' ');
        return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : `${cleanName[0]}X`.toUpperCase();
    };

    function processSimulatedRefunds() {
        let hasChanges = false;
        let refundData = JSON.parse(localStorage.getItem('simulated_refunds') || '{}');
        const now = new Date().getTime();

        myBookings.forEach(apt => {
            if (apt.status === 'canceled') {
                if (!refundData[apt.rawId]) {
                    let exactPrice = 500;
                    if (apt.raw.total_amount) exactPrice = apt.raw.total_amount;
                    else if (apt.raw.amount) exactPrice = apt.raw.amount;
                    else if (apt.raw.price) exactPrice = apt.raw.price;
                    else if (apt.raw.provider && apt.raw.provider.price) exactPrice = apt.raw.provider.price;

                    refundData[apt.rawId] = {
                        initiatedAt: now,
                        refundTime: now + (12 * 1000), 
                        amount: exactPrice,
                        status: 'initiated'
                    };
                    hasChanges = true;
                } else if (refundData[apt.rawId].status === 'initiated' && now >= refundData[apt.rawId].refundTime) {
                    refundData[apt.rawId].status = 'completed';
                    hasChanges = true;
                    showRefundNotification(apt.rawId, refundData[apt.rawId].amount);
                }
            }
        });

        if (hasChanges) {
            localStorage.setItem('simulated_refunds', JSON.stringify(refundData));
            renderAllLists(); 
        }
    }

    function showRefundNotification(bookingId, amount) {
        const shortId = bookingId.split('-')[0].substring(0, 8).toUpperCase();
        let toast = document.createElement('div');
        toast.className = 'refund-toast';
        toast.innerHTML = `
            <div style="background: var(--card-bg); border: 1px solid #10B981; padding: 16px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 16px; cursor: pointer;">
                <div style="background: rgba(16, 185, 129, 0.1); color: #10B981; width: 40px; height: 40px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1.2rem;">
                    <i class="fa-solid fa-money-bill-transfer"></i>
                </div>
                <div>
                    <h4 style="margin: 0; color: var(--text-main); font-size: 1rem;">Refund Processed</h4>
                    <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 0.85rem;">₹${amount} for BKG-${shortId}</p>
                </div>
            </div>
        `;
        toast.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; animation: slideIn 0.3s ease-out;';
        document.body.appendChild(toast);

        toast.addEventListener('click', () => {
            openRefundReceipt(bookingId);
            toast.remove();
        });

        setTimeout(() => { toast.remove(); }, 5000);
    }

    setInterval(processSimulatedRefunds, 3000);

    window.fetchDashboardData = async function() {
        if (!token) {
            renderStats(); renderAllLists();
            return;
        }

        try {
            const [activeRes, historyRes] = await Promise.all([
                fetch(`${API_BASE}/bookings/me/active`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null),
                fetch(`${API_BASE}/bookings/me/history`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null)
            ]);

            // 🚨 FIX: Removed 401 Redirect. If token is invalid, it just won't load data, no redirect.

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
                    timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
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
                    // 🚨 FIX: Removed all reportUrl references
                    clinicalNotes: apt.notes || apt.clinical_notes || "No clinical notes provided by the doctor.",
                    raw: apt 
                };
            });

            processSimulatedRefunds(); 
            renderStats();
            renderAllLists();

        } catch (error) {
            console.error("Dashboard Error:", error);
            renderStats(); renderAllLists();
        }
    }

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
        `;
    }

    function renderAllLists() {
        renderList('list-active', myBookings.filter(b => b.status === 'active'), "No active appointments right now.");
        renderList('list-completed', myBookings.filter(b => b.status === 'completed'), "You have no completed appointments yet.");
        renderList('list-canceled', myBookings.filter(b => b.status === 'canceled'), "No canceled appointments.");
    }

    function renderList(containerId, dataArray, emptyMessage) {
        const container = document.getElementById(containerId);
        if(!container) return;
        container.innerHTML = '';
        
        if (dataArray.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>${emptyMessage}</p></div>`; return;
        }

        const refundData = JSON.parse(localStorage.getItem('simulated_refunds') || '{}');

        dataArray.forEach(apt => {
            const initials = getInitials(apt.doctorName);
            const isOnline = apt.visitType === 'Video Consult';
            const typeIcon = isOnline ? 'fa-video' : (apt.visitType === 'Delivery' ? 'fa-motorcycle' : 'fa-location-dot');

            let avatarHtml = `<div class="apt-avatar">${initials}</div>`;
            if (apt.raw && apt.raw.provider && apt.raw.provider.profile_photo_url) {
                const photoUrl = apt.raw.provider.profile_photo_url;
                const finalImgUrl = photoUrl.startsWith('http') ? photoUrl : `${API_BASE}${photoUrl}`;
                avatarHtml = `<div class="apt-avatar-img"><img src="${finalImgUrl}" alt="${apt.doctorName}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%;" onerror="this.parentElement.innerHTML='${initials}'"></div>`;
            }

            let actionButtonsHtml = '';
            
            if (apt.status === 'active' && isOnline) {
                actionButtonsHtml += `<button class="btn-action" onclick="joinSecureVideoCall('${apt.rawId}')"><i class="fa-solid fa-video"></i> Join Call</button>`;
            } else if (apt.status === 'active') {
                actionButtonsHtml += `<button class="btn-action-outline" style="color: #F59E0B; border-color: #F59E0B;"><i class="fa-regular fa-clock"></i> Awaiting</button>`;
            } 
            
            // 🚨 FIX: Removed the "View Report" button entirely

            actionButtonsHtml += `<button class="btn-action-outline" onclick="openBookingModal('${apt.rawId}', 'details')" style="margin-left: 8px;"><i class="fa-solid fa-circle-info"></i> Details</button>`;

            if (apt.status === 'active') {
                actionButtonsHtml += `<button class="btn-action-outline" onclick="cancelBooking('${apt.rawId}')" style="margin-left: 8px; color: #EF4444; border-color: #EF4444;"><i class="fa-solid fa-ban"></i> Cancel</button>`;
            }

            let statusClass = `status-${apt.status}`;
            if (apt.status === 'canceled') statusClass = 'status-canceled'; 

            let refundBadgeHtml = '';
            if (apt.status === 'canceled') {
                const rData = refundData[apt.rawId];
                if (rData) {
                    if (rData.status === 'completed') {
                        refundBadgeHtml = `<button onclick="openRefundReceipt('${apt.rawId}')" style="margin-top: 12px; background: transparent; border: none; font-size: 0.85rem; color: #10B981; display: flex; align-items: center; gap: 6px; font-weight: 600; cursor: pointer; padding: 0;"><i class="fa-solid fa-money-bill-transfer"></i> Refunded: ₹${rData.amount} (View)</button>`;
                    } else {
                        refundBadgeHtml = `<button onclick="openRefundReceipt('${apt.rawId}')" style="margin-top: 12px; background: transparent; border: none; font-size: 0.85rem; color: #F59E0B; display: flex; align-items: center; gap: 6px; font-weight: 600; cursor: pointer; padding: 0;"><i class="fa-solid fa-spinner fa-spin"></i> Refund Initiated (View Status)</button>`;
                    }
                }
            }

            container.innerHTML += `
                <div class="apt-card">
                    ${avatarHtml}
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
                        ${refundBadgeHtml} 
                    </div>
                </div>
            `;
        });
    }

    function loadUserProfile() {
        try {
            const userStr = localStorage.getItem('currentUser');
            if (userStr) {
                const user = JSON.parse(userStr);
                const nameEl = document.getElementById('user-prof-name');
                const emailEl = document.getElementById('user-prof-email');
                const phoneEl = document.getElementById('user-prof-phone');
                
                if(nameEl) nameEl.value = user.name || "N/A";
                if(emailEl) emailEl.value = user.email || "N/A";
                if(phoneEl) phoneEl.value = user.phone || "N/A";
            }
        } catch(e) {}
    }
    
    loadUserProfile();

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

        const patientWrapper = document.getElementById('modal-patient-wrapper'); 
        
        const notesWrapper = document.getElementById('modal-notes-wrapper');
        const notesText = document.getElementById('modal-notes-text');

        if (patientWrapper) patientWrapper.classList.remove('hidden');
        
        document.getElementById('modal-patient-name').textContent = apt.raw.patient_name || "Self";
        
        const ageEl = document.getElementById('modal-patient-age');
        if(ageEl) ageEl.textContent = apt.raw.patient_age || "N/A";
        
        const genderEl = document.getElementById('modal-patient-gender');
        if(genderEl) genderEl.textContent = apt.raw.patient_gender || "N/A";
        
        const addressEl = document.getElementById('modal-patient-address');
        if (addressEl) {
            const addressRow = addressEl.parentElement;
            if (apt.visitType === 'Video Consult' || apt.visitType.includes('Video')) {
                addressRow.style.display = 'none'; 
            } else {
                addressRow.style.display = 'flex'; 
                addressEl.textContent = apt.raw.delivery_address || "Platform Default";
            }
        }
        
        const reasonEl = document.getElementById('modal-patient-reason');
        if(reasonEl) reasonEl.textContent = apt.raw.symptoms || "None provided";

        if (apt.status === 'completed') {
            if (notesWrapper) notesWrapper.classList.remove('hidden');
            
            if (notesText) {
                notesText.textContent = apt.clinicalNotes;
            }
            
            // 🚨 FIX: Removed Image Rendering Logic Entirely

        } else {
            if (notesWrapper) notesWrapper.classList.add('hidden');
        }
        
        modal.classList.remove('hidden');
    };

    window.openRefundReceipt = function(rawId) {
        const apt = myBookings.find(b => b.rawId === rawId);
        const refundData = JSON.parse(localStorage.getItem('simulated_refunds') || '{}');
        const rData = refundData[rawId];

        if (!apt || !rData) return;

        const shortId = apt.bookingId;
        const isComplete = rData.status === 'completed';
        const color = isComplete ? '#10B981' : '#F59E0B';
        const icon = isComplete ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-spinner fa-spin"></i>';
        const statusText = isComplete ? 'Refund Successful' : 'Processing Refund (Est: 12 Hours)';

        const initDate = new Date(rData.initiatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const compDate = isComplete ? new Date(rData.refundTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Pending";

        let receiptDiv = document.createElement('div');
        receiptDiv.className = 'modal-overlay';
        receiptDiv.innerHTML = `
            <div class="modal-container" style="max-width: 400px; text-align: center; padding: 32px 24px;">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fa-solid fa-xmark"></i></button>
                <div style="width: 64px; height: 64px; border-radius: 50%; background: ${color}20; color: ${color}; font-size: 2rem; display: flex; justify-content: center; align-items: center; margin: 0 auto 16px auto;">
                    ${icon}
                </div>
                <h2 style="margin: 0 0 8px 0;">${statusText}</h2>
                <p style="color: var(--text-muted); margin: 0 0 24px 0; font-size: 0.95rem;">For Booking ID: ${shortId}</p>
                
                <div style="background: var(--section-bg); border-radius: 12px; padding: 16px; text-align: left; border: 1px solid var(--card-border);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Amount</span>
                        <strong style="color: var(--text-main);">₹${rData.amount}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Initiated</span>
                        <strong style="color: var(--text-main); font-size: 0.9rem;">${initDate}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Completed</span>
                        <strong style="color: var(--text-main); font-size: 0.9rem;">${compDate}</strong>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(receiptDiv);
    };

    window.addEventListener('click', (e) => { 
        if (e.target === modal) modal.classList.add('hidden'); 
    });

    fetchDashboardData();

    window.cancelBooking = async function(rawId) {
        if (!confirm("Are you sure you want to cancel this appointment? This action cannot be undone.")) return;
        
        try {
            const response = await fetch(`${API_BASE}/bookings/${rawId}/cancel`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const apt = myBookings.find(b => b.rawId === rawId);
                
                let exactPrice = 500;
                if (apt.raw.total_amount) exactPrice = apt.raw.total_amount;
                else if (apt.raw.amount) exactPrice = apt.raw.amount;
                else if (apt.raw.price) exactPrice = apt.raw.price;
                else if (apt.raw.provider && apt.raw.provider.price) exactPrice = apt.raw.provider.price;

                const refundData = JSON.parse(localStorage.getItem('simulated_refunds') || '{}');
                const now = new Date().getTime();
                refundData[rawId] = {
                    initiatedAt: now,
                    refundTime: now + (12 * 1000), 
                    amount: exactPrice,
                    status: 'initiated'
                };
                localStorage.setItem('simulated_refunds', JSON.stringify(refundData));

                alert("Booking successfully canceled. Refund has been initiated and will process within 12 hours.");
                if(window.fetchDashboardData) window.fetchDashboardData(); 
            } else {
                alert("Failed to cancel booking.");
            }
        } catch(e) {
            console.error(e);
            alert("Network Error while canceling.");
        }
    };

    // =========================================================================
    // 🚨 PREMIUM 8x8 JaaS REDIRECT FOR PATIENT (GUEST MODE)
    // =========================================================================
    window.joinSecureVideoCall = async function(bookingId) {
        const safeRoomName = "VisionApt_" + bookingId.replace(/[^a-zA-Z0-9]/g, "");
        
        let patientName = "Patient";
        try {
            const user = JSON.parse(localStorage.getItem('currentUser'));
            if (user && user.name) patientName = user.name;
        } catch(e) {}
        
        const tenantId = "vpaas-magic-cookie-386018f4d6bf45cd9bcf28b57f8d4de9";
        
        // Notice: NO JWT TOKEN HERE. The patient enters safely as a standard guest!
        const jitsiUrl = `https://8x8.vc/${tenantId}/${safeRoomName}#config.prejoinPageEnabled=false&userInfo.displayName="${encodeURIComponent(patientName)}"`;
        
        window.open(jitsiUrl, '_blank');
    };
});