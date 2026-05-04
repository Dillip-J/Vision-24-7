// js/provider-dash.js

document.addEventListener('DOMContentLoaded', () => {
  
    const token = localStorage.getItem('provider_token');
    const currentProviderString = localStorage.getItem('currentProvider'); 

    if (!token || !currentProviderString) { 
        window.location.replace('index.html'); 
        return; 
    }

    let currentProvider;
    try { 
        currentProvider = JSON.parse(currentProviderString); 
    } catch (e) { 
        localStorage.clear(); 
        window.location.replace('index.html'); 
        return; 
    }

    const providerName = currentProvider.name || "Doctor";

    const headerImg = document.getElementById("header-profile-img");
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(providerName)}&background=1E293B&color=fff&size=128`;

    if (currentProvider.profile_photo_url) {
        const photoUrl = currentProvider.profile_photo_url;
        if (photoUrl.startsWith('http')) {
            if (headerImg) headerImg.src = photoUrl;
        } else {
            if (headerImg) headerImg.src = `${API_BASE}${photoUrl}`;
        }
    } else {
        if (headerImg) headerImg.src = defaultAvatar;
    }
    
    setupDocumentUpload();

    const welcomeEl = document.getElementById('welcome-message');
    const clinicEl = document.getElementById('clinic-name');
    if(welcomeEl) welcomeEl.textContent = `Dr. ${providerName.replace('Dr. ', '')}`;
    if(clinicEl) clinicEl.textContent = `${currentProvider.category || "General Practitioner"} • Doctor`;

    const tabApt = document.getElementById('tab-appointments');
    const tabRec = document.getElementById('tab-records');
    const tabSched = document.getElementById('tab-schedule');
    const tabProf = document.getElementById('tab-profile');

    const themeBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    if (themeBtn) {
        if (localStorage.getItem('theme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.className = 'fa-solid fa-sun';
        }
        themeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (document.documentElement.getAttribute('data-theme') === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeIcon.className = 'fa-regular fa-moon';
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeIcon.className = 'fa-solid fa-sun';
            }
        });
    }

    const tabs = {
        appointments: { btn: tabApt, view: document.getElementById('view-appointments'), render: loadAppointments },
        schedule: { btn: tabSched, view: document.getElementById('view-schedule'), render: loadScheduleManager },
        records: { btn: tabRec, view: document.getElementById('view-records'), render: renderPatientRecords },
        earnings: { btn: document.getElementById('tab-earnings'), view: document.getElementById('view-earnings'), render: renderEarnings },
        profile: { btn: tabProf, view: document.getElementById('view-profile'), render: loadProfileSettings }
    };

    function switchTab(tabKey) {
        Object.values(tabs).forEach(tab => {
            if(tab.btn) tab.btn.classList.remove('active');
            if(tab.view) {
                tab.view.classList.remove('active');
                tab.view.classList.add('hidden');
            }
        });
        
        if(tabs[tabKey].btn) tabs[tabKey].btn.classList.add('active');
        if(tabs[tabKey].view) {
            tabs[tabKey].view.classList.add('active');
            tabs[tabKey].view.classList.remove('hidden'); 
        }
        
        if(tabs[tabKey].render) tabs[tabKey].render(); 
    }
    
    Object.keys(tabs).forEach(key => {
        if(tabs[key].btn) tabs[key].btn.addEventListener('click', (e) => { e.preventDefault(); switchTab(key); });
    });

    async function fetchMyDashboard() {
        try {
            const res = await fetch(`${API_BASE}/providers/dashboard/me`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            
            if (res.status === 401) {
                localStorage.clear();
                window.location.replace('index.html');
                return { items: [], financials: { lifetime_earnings: 0, this_month_earnings: 0 } };
            }
            if (!res.ok) throw new Error("Fetch failed");
            return await res.json(); 
        } catch (e) { 
            return { items: [], financials: { lifetime_earnings: 0, this_month_earnings: 0 } }; 
        }
    }

    async function loadAppointments() {
        const listEl = document.getElementById('provider-appointments-list');
        if(!listEl) return;
        listEl.innerHTML = '<div class="empty-state">Loading data...</div>';

        const dashboardData = await fetchMyDashboard();
        
        let myBookings = [];
        if (Array.isArray(dashboardData)) {
            myBookings = dashboardData;
        } else if (dashboardData && dashboardData.items) {
            myBookings = dashboardData.items;
        }

        const activeBookings = myBookings.filter(b => {
            const stat = (b.status || b.booking_status || '').toLowerCase();
            return stat === 'confirmed' || stat === 'pending' || stat === 'active' || stat === 'in_transit';
        });
        
        const completedBookings = myBookings.filter(b => {
            const stat = (b.status || b.booking_status || '').toLowerCase();
            return stat === 'completed';
        });

        const statsEl = document.getElementById('provider-stats');
        if(statsEl) {
            statsEl.innerHTML = `
                <div class="stat-card">
                    <div class="stat-info"><span>Total Patients</span><strong>${myBookings.length}</strong></div>
                    <div class="stat-icon"><i class="fa-solid fa-users"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info"><span>Active</span><strong class="text-blue">${activeBookings.length}</strong></div>
                    <div class="stat-icon"><i class="fa-regular fa-calendar-check"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info"><span>Completed</span><strong class="text-green">${completedBookings.length}</strong></div>
                    <div class="stat-icon green"><i class="fa-solid fa-check-double"></i></div>
                </div>
            `;
        }

        if (activeBookings.length === 0) {
            listEl.innerHTML = `<div class="empty-state">No active requests at the moment.</div>`;
            return;
        }

        listEl.innerHTML = activeBookings.map(apt => {
            const patientName = apt.client_name || apt.patient_name || apt.user_name || "Unknown Patient";
            const bookingId = apt.raw_id || apt.booking_id || apt.id;
            const visitType = apt.visit_type || "Video Consult";
            const isOnline = visitType.toLowerCase().includes('video');
            const aptStatus = (apt.status || apt.booking_status || 'pending').toLowerCase();
            const aptSymptoms = apt.symptoms || "No details provided.";
            const aptPhone = apt.client_phone || apt.patient_phone || apt.phone || 'N/A';

            let fullAddress = "";
            if (!isOnline) {
                let addrParts = [];
                if (apt.flat_number && apt.flat_number !== 'Online') addrParts.push(apt.flat_number);
                if (apt.building_name && apt.building_name !== 'Online') addrParts.push(apt.building_name);
                if (apt.landmark && apt.landmark !== 'Online') addrParts.push(`Near ${apt.landmark}`);
                if (apt.delivery_address && apt.delivery_address !== 'Online') addrParts.push(apt.delivery_address);
                
                fullAddress = addrParts.length > 0 ? addrParts.join(', ') : (apt.address || apt.delivery_address || 'Address not provided');
            }

            let btns = '';
            
            if (aptStatus === 'pending') {
                btns += `<button class="btn-primary" onclick="updateBookingStatus('${bookingId}', 'confirmed')"><i class="fa-solid fa-thumbs-up"></i> Accept</button>`;
                btns += `<button class="btn-outline red" onclick="updateBookingStatus('${bookingId}', 'rejected')"><i class="fa-solid fa-xmark"></i> Reject</button>`;
            } else {
                if (isOnline) {
                    btns += `<button class="btn-primary green" onclick="joinSecureVideoCall('${bookingId}')"><i class="fa-solid fa-video"></i> Join Call</button>`;
                }
                btns += `<button class="btn-outline purple" onclick="openUploadModal('${bookingId}', '${patientName}')"><i class="fa-solid fa-check-double"></i> Complete</button>`;
                btns += `<button class="btn-outline red" onclick="updateBookingStatus('${bookingId}', 'canceled')"><i class="fa-solid fa-triangle-exclamation"></i> Cancel</button>`;
            }

            let displayStatus = aptStatus === 'pending' ? 'NEEDS APPROVAL' : 'CONFIRMED';
            let statusClass = aptStatus === 'pending' ? 'pending' : 'completed';

            return `
                <div class="apt-card ${statusClass}">
                    <div class="apt-header">
                        <h3>${patientName} <span>(${apt.age || '--'}y, ${apt.gender || 'N/A'})</span></h3>
                        <span class="status-badge ${statusClass}">${displayStatus}</span>
                    </div>
                    <div class="apt-info"><strong>ID:</strong> ${bookingId} | <i class="fa-solid fa-phone"></i> ${aptPhone}</div>
                    <div class="apt-symptoms"><strong><i class="fa-solid fa-notes-medical"></i> Symptoms:</strong> ${aptSymptoms}</div>
                    <div class="apt-meta">
                        <div><i class="fa-regular fa-clock text-blue"></i> ${apt.time || apt.scheduled_time || 'ASAP'}</div>
                        <div><i class="fa-solid ${isOnline ? 'fa-video' : 'fa-location-dot'}"></i> ${visitType} ${!isOnline ? ` - ${fullAddress}` : ''}</div>
                    </div>
                    <div class="apt-actions">${btns}</div>
                </div>
            `;
        }).join('');
    }

    async function loadScheduleManager() {
        const dateCon = document.getElementById('provider-date-container');
        const timeCon = document.getElementById('provider-time-container');
        if (!dateCon || !timeCon) return;

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        dateCon.innerHTML = days.map(d => `<button class="btn-day-select" data-day="${d}">${d}</button>`).join('');

        const renderTimes = async (day) => {
            timeCon.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">Loading slots...</div>';
            let saved = [];
            try {
                const res = await fetch(`${API_BASE}/providers/schedule/${day}`, { headers: { 'Authorization': `Bearer ${token}` } });
                if(res.ok) { const data = await res.json(); saved = data.slots || []; }
            } catch (err) {}

            const times = [];
            const startMins = 9 * 60; 
            const endMins = 17 * 60;  
            const duration = 45;      

            for (let m = startMins; m < endMins; m += duration) {
                let hours = Math.floor(m / 60);
                let mins = m % 60;
                let modifier = hours >= 12 ? 'PM' : 'AM';
                let displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
                
                const timeString = `${displayHours < 10 ? '0'+displayHours : displayHours}:${mins === 0 ? '00' : mins} ${modifier}`;
                times.push(timeString);
            }

            timeCon.innerHTML = times.map(t => {
                const isAvail = saved.includes(t);
                return `<button class="btn-time-slot ${isAvail ? 'available' : ''}" data-time="${t}">
                            ${isAvail ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-ban"></i>'} ${t}
                        </button>`;
            }).join('');

            timeCon.querySelectorAll('.btn-time-slot').forEach(btn => {
                btn.addEventListener('click', async function() {
                    this.classList.toggle('available');
                    const avail = Array.from(timeCon.querySelectorAll('.available')).map(b => b.getAttribute('data-time'));
                    
                    try {
                        await fetch(`${API_BASE}/providers/schedule`, { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                            body: JSON.stringify({ day: day, slots: avail }) 
                        });
                        
                        this.innerHTML = this.classList.contains('available') 
                            ? `<i class="fa-solid fa-check-circle"></i> ${this.getAttribute('data-time')}` 
                            : `<i class="fa-solid fa-ban"></i> ${this.getAttribute('data-time')}`;
                    } catch (e) { 
                        this.classList.toggle('available'); 
                    } 
                });
            });
        };

        let activeDay = 'Monday';
        const dayBtns = dateCon.querySelectorAll('.btn-day-select');
        dayBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                dayBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                activeDay = e.currentTarget.getAttribute('data-day');
                renderTimes(activeDay);
            });
        });

        if(dayBtns.length > 0) { 
            dayBtns[0].classList.add('active'); 
            renderTimes('Monday'); 
        }
    }

    // =========================================================================
    // --- 8. PATIENT RECORDS / HISTORY LOGIC ---
    // =========================================================================
    async function renderPatientRecords() {
        const tbody = document.getElementById('records-list');
        if(!tbody) return;
        
        const dashboardData = await fetchMyDashboard();
        
        let myBookings = [];
        if (Array.isArray(dashboardData)) {
            myBookings = dashboardData;
        } else if (dashboardData && dashboardData.items) {
            myBookings = dashboardData.items;
        }

        const done = myBookings.filter(b => {
            const stat = (b.status || b.booking_status || '').toLowerCase();
            return stat === 'completed' || stat === 'canceled' || stat === 'rejected';
        });

        if(done.length === 0) { tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No records found.</td></tr>`; return; }

        const thNotes = document.querySelector('.records-table th:nth-child(4)');
        if(thNotes) thNotes.textContent = 'Clinical Notes';

        tbody.innerHTML = done.map(apt => {
            const patientName = apt.client_name || apt.patient_name || apt.user_name || "Unknown Patient";
            const aptStatus = (apt.status || apt.booking_status || 'completed').toLowerCase();
            
            // 🚨 STRICT FIX: Properly splits the symptoms and the clinical notes in the HTML
            const aptSymptoms = apt.symptoms || "None provided";
            
            let notesToDisplay = "No clinical notes recorded.";
            if (apt.clinical_notes && apt.clinical_notes.trim() !== "") {
                notesToDisplay = apt.clinical_notes;
            } else if (aptStatus === 'canceled' || aptStatus === 'rejected') {
                notesToDisplay = "Canceled/Rejected.";
            }

            const visitType = apt.visit_type || "Video Consult";
            const time = apt.time || (apt.scheduled_time ? new Date(apt.scheduled_time).toLocaleString() : 'ASAP');

            return `
            <tr>
                <td><strong>${patientName}</strong><br><span class="status-badge ${aptStatus}">${aptStatus.toUpperCase()}</span></td>
                <td>${time}</td>
                <td>${visitType}</td>
                <td>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px;"><strong>Symptoms:</strong> ${aptSymptoms}</div>
                    <div class="note-preview"><strong>Notes:</strong> ${notesToDisplay}</div>
                </td>
            </tr>
            `;
        }).join('');
    }

    // =========================================================================
    // --- 9. EARNINGS & TRANSACTIONS LOGIC ---
    // =========================================================================
    async function renderEarnings() {
        const listEl = document.getElementById('transactions-list');
        if(!listEl) return;

        const dashboardData = await fetchMyDashboard();
        
        let myBookings = [];
        if (Array.isArray(dashboardData)) {
            myBookings = dashboardData;
        } else if (dashboardData && dashboardData.items) {
            myBookings = dashboardData.items;
        }
        
        const completedBookings = myBookings.filter(b => {
            const stat = (b.status || b.booking_status || '').toLowerCase();
            return stat === 'completed';
        });

        let basePrice = 500; 
        if (currentProvider && currentProvider.price != null) {
             basePrice = parseFloat(currentProvider.price);
        }

        const getBookingPrice = (b) => {
            if (b.total_amount != null) return parseFloat(b.total_amount);
            if (b.amount != null) return parseFloat(b.amount);
            if (b.provider && b.provider.price != null) return parseFloat(b.provider.price);
            return basePrice; 
        };
        
        let realLifetimeEarnings = 0;
        completedBookings.forEach(b => {
            realLifetimeEarnings += getBookingPrice(b); 
        });

        const financials = { 
            lifetime_earnings: realLifetimeEarnings, 
            this_month_earnings: realLifetimeEarnings, 
            current_month_name: (dashboardData.financials && dashboardData.financials.current_month_name) ? dashboardData.financials.current_month_name : "This Month" 
        };
        
        const formatMoney = (amount) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

        const statsEl = document.getElementById('earnings-stats');
        if(statsEl) {
            statsEl.innerHTML = `
                <div class="stat-card gradient-blue">
                    <div class="stat-info">
                        <span>Earnings in ${financials.current_month_name}</span>
                        <strong>₹${formatMoney(financials.this_month_earnings)}</strong>
                    </div>
                    <div class="stat-icon"><i class="fa-solid fa-chart-line"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info">
                        <span>Lifetime Earnings</span>
                        <strong>₹${formatMoney(financials.lifetime_earnings)}</strong>
                    </div>
                    <div class="stat-icon green"><i class="fa-solid fa-sack-dollar"></i></div>
                </div>
                <div class="stat-card">
                    <div class="stat-info">
                        <span>Total Processed</span>
                        <strong>${completedBookings.length}</strong>
                    </div>
                    <div class="stat-icon"><i class="fa-solid fa-hand-holding-medical"></i></div>
                </div>
            `;
        }

        if(completedBookings.length === 0) { listEl.innerHTML = `<div class="empty-state">No earnings yet.</div>`; return; }

        listEl.innerHTML = completedBookings.map(b => {
            const patientName = b.client_name || b.patient_name || b.user_name || "Patient";
            const bookingId = b.raw_id || b.booking_id || b.id;
            return `
            <div class="tx-card">
                <div class="tx-left">
                    <div class="tx-icon"><i class="fa-solid fa-indian-rupee-sign"></i></div>
                    <div><span class="tx-name">${patientName}</span><span class="tx-detail">${bookingId}</span></div>
                </div>
                <div class="tx-right">
                    <span class="tx-amount">+ ₹${formatMoney(getBookingPrice(b))}</span> 
                    <br>
                    <span class="status-badge completed" style="display: inline-block; margin-top: 4px;">PAID ONLINE</span>
                </div>
            </div>
            `;
        }).join('');
    }

    // =========================================================================
    // --- 10. PROFILE SETTINGS LOGIC ---
    // =========================================================================
    // 🚨 FIX: Re-added the async fetch so it downloads the phone number from the DB!
    async function loadProfileSettings() {
        try {
            const res = await fetch(`${API_BASE}/providers/me`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            if (res.ok) {
                const fullProfile = await res.json();
                currentProvider = { ...currentProvider, ...fullProfile };
                localStorage.setItem('currentProvider', JSON.stringify(currentProvider));
            }
        } catch (err) {
            console.warn("Could not fetch latest profile data. Using cache.");
        }

        const nameEl = document.getElementById('prof-name');
        const phoneEl = document.getElementById('prof-phone');
        const feeEl = document.getElementById('prof-fee');
        const bioEl = document.getElementById('prof-bio');
        const bankNameEl = document.getElementById('prof-bank-name');
        const accNoEl = document.getElementById('prof-acc-no');
        const ifscEl = document.getElementById('prof-ifsc');

        if(nameEl) nameEl.value = currentProvider.name || '';
        if(phoneEl) phoneEl.value = currentProvider.phone || '';
        if(feeEl) feeEl.value = currentProvider.consultation_fee || 500;

        if(bioEl) bioEl.value = currentProvider.bio || '';
        if(bankNameEl) bankNameEl.value = currentProvider.bank_name || '';

        
        if(accNoEl) {
            accNoEl.placeholder = "Enter Account Number (9-18 Digits)";
            accNoEl.value = currentProvider.account_number || '';
            accNoEl.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, '').slice(0, 18);
            });
        }
        
        if(ifscEl) {
            ifscEl.placeholder = "Enter IFSC Code (e.g. SBIN0001234)";
            ifscEl.value = currentProvider.ifsc_code || '';
            ifscEl.addEventListener('input', function() {
                this.value = this.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11);
            });
        }
    }

    const profileForm = document.getElementById('form-provider-profile');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {};
            
            const nameVal = document.getElementById('prof-name')?.value;
            if(nameVal) payload.name = nameVal;
            
            const phoneVal = document.getElementById('prof-phone')?.value;
            if(phoneVal) payload.phone = phoneVal;

            const feeVal = document.getElementById('prof-fee')?.value;
            if(feeVal) payload.consultation_fee = parseFloat(feeVal);

            const bioVal = document.getElementById('prof-bio')?.value;
            if(bioVal) payload.bio = bioVal;
            
            const bankNameVal = document.getElementById('prof-bank-name')?.value;
            if(bankNameVal) payload.bank_name = bankNameVal;

            const accVal = document.getElementById('prof-acc-no')?.value;
            if(accVal) {
                if (accVal.length < 9) { alert("Account Number must be at least 9 digits long."); return; }
                payload.account_number = accVal;
            }
            
            const ifscVal = document.getElementById('prof-ifsc')?.value;
            if(ifscVal) {
                const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
                if (!ifscRegex.test(ifscVal)) {
                    alert("Invalid IFSC Code format. Must be 11 characters (e.g., HDFC0123456) with a zero as the 5th character.");
                    return; 
                }
                payload.ifsc_code = ifscVal;
            }

            const submitBtn = document.getElementById('btn-save-profile');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${API_BASE}/providers/me`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || "Failed to update settings");

                const updatedProvider = { ...currentProvider, ...result.provider };
                localStorage.setItem('currentProvider', JSON.stringify(updatedProvider));
                currentProvider = updatedProvider;
                
                if(document.getElementById('welcome-message')) {
                    document.getElementById('welcome-message').textContent = `Dr. ${currentProvider.name.replace('Dr. ', '')}`;
                }
                
                alert("Details saved successfully!");
                loadProfileSettings(); 

            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // =========================================================================
    // --- 11. GLOBAL ACTIONS ---
    // =========================================================================
    window.updateBookingStatus = async function(id, status) {
        const confirmMsg = status === 'canceled' ? "Cancel this due to an emergency?" : `Mark as ${status}?`;
        if (!confirm(confirmMsg)) return;
        try {
            await fetch(`${API_BASE}/providers/bookings/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ status }) });
            loadAppointments(); 
        } catch (e) { alert(e.message); }
    };

    window.joinSecureVideoCall = async function(bookingId) {
        window.open(`video-room.html?room=${bookingId}&role=doctor`, '_blank');
    };

    // =========================================================================
    // --- 12. COMPLETION MODAL LOGIC (PURE TEXT NOTES) ---
    // =========================================================================
    const modal = document.getElementById('upload-modal');
    window.openUploadModal = function(id, name) {
        const idEl = document.getElementById('record-booking-id');
        const nameEl = document.getElementById('record-patient-name');
        const notesEl = document.getElementById('record-notes');
        
        if(idEl) idEl.value = id;
        if(nameEl) nameEl.textContent = name;
        if(notesEl) notesEl.value = '';
        
        const noteLabel = document.getElementById('modal-notes-label');
        const titleEl = document.getElementById('modal-dynamic-title');
        
        if (titleEl && noteLabel) {
            titleEl.textContent = "Complete Consultation";
            noteLabel.textContent = "Clinical Notes / Diagnosis *";
        }
        if(modal) modal.classList.remove('hidden');
    };

    const closeUploadBtn = document.getElementById('close-upload-btn');
    if(closeUploadBtn) {
        closeUploadBtn.addEventListener('click', (e) => { 
            e.preventDefault(); 
            if(modal) modal.classList.add('hidden'); 
        });
    }

    const uploadForm = document.getElementById('form-upload-record');
    if(uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('record-booking-id').value;
            const notes = document.getElementById('record-notes').value;
            
            const btn = e.target.querySelector('button');
            btn.textContent = "Processing..."; btn.disabled = true;

            try {
                // Send only text notes to complete the appointment
                await fetch(`${API_BASE}/providers/bookings/${id}/status`, { 
                    method: 'PATCH', 
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                    body: JSON.stringify({ 
                        status: 'completed', 
                        notes: notes,
                        report_url: null 
                    }) 
                });

                if(modal) modal.classList.add('hidden'); 
                loadAppointments(); 

            } catch(error) {
                alert("Error: " + error.message);
            } finally { 
                btn.textContent = "Mark Completed"; 
                btn.disabled = false; 
            }
        });
    }
    
    // =========================================================================
    // --- 13. PROFILE PHOTO UPLOAD LOGIC ---
    // =========================================================================
    function setupDocumentUpload() {
        const fileInput = document.getElementById("profile-photo-input");
        const triggerBtn = document.getElementById("btn-trigger-upload");

        if (triggerBtn && fileInput) {
            triggerBtn.addEventListener("click", () => fileInput.click());
            
            fileInput.addEventListener("change", async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const fd = new FormData(); 
                fd.append("file", file); 
                
                const originalText = triggerBtn.innerHTML;
                triggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';
                triggerBtn.disabled = true;

                try {
                    const res = await fetch(`${API_BASE}/files/provider/profile-photo`, { 
                        method: "POST", 
                        headers: { 'Authorization': `Bearer ${token}` }, 
                        body: fd 
                    });
                    
                    if (!res.ok) throw new Error("Upload failed.");
                    
                    const data = await res.json();
                    
                    let fullUrl = data.url;
                    if (!fullUrl.startsWith('http')) {
                        fullUrl = `${API_BASE}${data.url}`;
                    }
                    
                    const headerImg = document.getElementById("header-profile-img");
                    if(headerImg) headerImg.src = fullUrl;
                    
                    currentProvider.profile_photo_url = data.url; 
                    localStorage.setItem('currentProvider', JSON.stringify(currentProvider));
                    
                } catch (error) {
                    alert("Error uploading image. Please try again.");
                } finally {
                    triggerBtn.innerHTML = originalText;
                    triggerBtn.disabled = false;
                    fileInput.value = ''; 
                }
            });
        }
    }

    // =========================================================================
    // --- 14. LOGOUT AND INITIALIZATION ---
    // =========================================================================
    const logout = (e) => { 
        e.preventDefault(); 
        localStorage.clear(); 
        window.location.replace('index.html'); 
    };
    
    const btnLogout = document.getElementById('btn-logout');
    const mobileLogout = document.getElementById('mobile-btn-logout');
    if(btnLogout) btnLogout.addEventListener('click', logout);
    if(mobileLogout) mobileLogout.addEventListener('click', logout);

    switchTab('appointments');
});
// let autocomplete;

// window.initAutocomplete = function() {
//     const addressInput = document.getElementById("patient-address");
//     if (!addressInput) return;

//     // Create element (no arguments)
//     autocomplete = new google.maps.places.PlaceAutocompleteElement();

//     // Attach it to your input
//     autocomplete.inputElement = addressInput;

//     // Listen for selection
//     autocomplete.addEventListener('placechange', onPlaceChanged);
// };

// function onPlaceChanged(event) {
//     const place = event.detail.place;
//     const addressInput = document.getElementById('patient-address');

//     if (!place || !place.location) {
//         addressInput.placeholder = "Enter your Address";
//     } else {
//         addressInput.value = place.formattedAddress;
//     }
// }
