// js/payment.js

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // --- 1. LOAD PENDING BOOKING DATA ---
    // ==========================================
    // We assume the previous page saved the booking details into sessionStorage before redirecting here
    const bookingDataStr = sessionStorage.getItem('pendingBooking');
    
    if (!bookingDataStr) {
        console.warn("Unauthorized access: No booking data found. Redirecting to Doctor directory.");
        window.location.replace('doctors.html');
        return;
    }

    const bookingData = JSON.parse(bookingDataStr);
    const token = localStorage.getItem('access_token');

    if (!token) {
        alert("Your session expired. Please log in to complete the booking.");
        window.location.replace('index.html');
        return;
    }

    // ==========================================
    // --- 2. DYNAMIC SIDEBAR ADAPTATION ---
    // ==========================================
    const providerType = bookingData.provider_type || 'Doctor'; // 'Doctor', 'Pharmacy', or 'Lab'
    
    // DOM Elements
    const docImg = document.getElementById('pay-doc-img');
    const docName = document.getElementById('pay-doc-name');
    const docSpec = document.getElementById('pay-doc-spec');
    const dateEl = document.getElementById('pay-date');
    const timeEl = document.getElementById('pay-time');
    const typeEl = document.getElementById('pay-type');
    
    // Fee Elements
    const feeEl = document.getElementById('pay-fee');
    const visitEl = document.getElementById('pay-visit');
    const platformEl = document.getElementById('pay-platform');
    const totalEl = document.getElementById('pay-total');
    const btnAmount = document.getElementById('btn-amount');

    // Set Provider Details
    if (docImg) docImg.src = bookingData.provider_image ? `${API_BASE}${bookingData.provider_image}` : 'images/default-avatar.png';
    if (docName) docName.textContent = bookingData.provider_name;
    if (docSpec) docSpec.textContent = bookingData.service_name || bookingData.category;

    // Adapt Labels based on Provider Type
    const labelDoc = document.querySelector('.summary-label'); // First label (Doctor)
    const labelSpec = document.querySelectorAll('.summary-label')[1]; // Second label (Specialization)
    
    if (providerType === 'Pharmacy') {
        if(labelDoc) labelDoc.textContent = 'Pharmacy';
        if(labelSpec) labelSpec.textContent = 'Order Items';
        if(dateEl) dateEl.textContent = 'Today';
        // 🚨 ZOMATO STYLE ASAP DELIVERY
        if(timeEl) timeEl.innerHTML = '<span style="color: #10B981; font-weight: bold;"><i class="fa-solid fa-bolt"></i> ASAP (30-45 mins)</span>';
        if(typeEl) typeEl.textContent = 'Home Delivery';
    } 
    else if (providerType === 'Lab') {
        if(labelDoc) labelDoc.textContent = 'Diagnostic Lab';
        if(labelSpec) labelSpec.textContent = 'Test Type';
        if(dateEl) dateEl.textContent = bookingData.date;
        if(timeEl) timeEl.textContent = bookingData.time || "Morning Collection";
        if(typeEl) typeEl.textContent = 'Home Sample Collection';
    } 
    else {
        // Doctor
        if(labelDoc) labelDoc.textContent = 'Doctor';
        if(labelSpec) labelSpec.textContent = 'Specialization';
        if(dateEl) dateEl.textContent = bookingData.date;
        if(timeEl) timeEl.textContent = bookingData.time;
        if(typeEl) typeEl.textContent = bookingData.is_online ? 'Video Consult' : 'Clinic Visit';
    }

    // Calculate Costs (Mock logic - replace with real backend pricing later)
    const baseFee = bookingData.price || 500;
    const visitFee = providerType === 'Pharmacy' ? 40 : (bookingData.is_online ? 0 : 100);
    const platformFee = 25;
    const totalAmount = baseFee + visitFee + platformFee;

    // Format Currency
    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

    if (feeEl) feeEl.textContent = formatCurrency(baseFee);
    if (visitEl) visitEl.textContent = formatCurrency(visitFee);
    if (platformEl) platformEl.textContent = formatCurrency(platformFee);
    if (totalEl) totalEl.textContent = formatCurrency(totalAmount);
    if (btnAmount) btnAmount.textContent = formatCurrency(totalAmount);


    // ==========================================
    // --- 3. PAYMENT METHOD UI TOGGLING ---
    // ==========================================
    const methodRows = document.querySelectorAll('.payment-method-row');
    const panels = document.querySelectorAll('.payment-panel');

    methodRows.forEach(row => {
        row.addEventListener('click', () => {
            // Remove active classes
            methodRows.forEach(r => r.classList.remove('active'));
            panels.forEach(p => { p.style.display = 'none'; p.classList.remove('active-panel'); });
            
            // Check the radio button
            const radio = row.querySelector('input[type="radio"]');
            radio.checked = true;
            row.classList.add('active');

            // Show matching panel
            const panelId = `panel-${radio.value}`;
            const targetPanel = document.getElementById(panelId);
            if (targetPanel) {
                targetPanel.style.display = 'block';
                // Small delay to trigger CSS fade-in if needed
                setTimeout(() => targetPanel.classList.add('active-panel'), 10);
            }
        });
    });

    // Bank Selection highlighting
    const bankBtns = document.querySelectorAll('.bank-btn');
    const dynamicBankName = document.getElementById('dynamic-bank-name');
    
    bankBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            bankBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            if(dynamicBankName) {
                dynamicBankName.textContent = e.currentTarget.getAttribute('data-bank');
            }
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
    // --- 4. SECURE PAYMENT PROCESSING ---
    // ==========================================
    const payBtn = document.getElementById('confirm-pay-btn');

    if (payBtn) {
        payBtn.addEventListener('click', async () => {
            
            // Validate the currently selected payment form
            const activeRadio = document.querySelector('input[name="payment_method"]:checked').value;
            if (activeRadio === 'netbanking') {
                const user = document.getElementById('nb-user').value;
                const pass = document.getElementById('nb-pass').value;
                if (!user || !pass) {
                    alert("Please enter your banking credentials.");
                    return;
                }
            } else if (activeRadio === 'card') {
                const cc = document.getElementById('cc-number').value;
                if (cc.length < 15) {
                    alert("Please enter a valid card number.");
                    return;
                }
            }

            // Lock Button
            const originalHtml = payBtn.innerHTML;
            payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            payBtn.disabled = true;

            // Step 1: Simulate Payment Gateway Delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 2: Send Final Booking to Backend
            try {
                // Formatting datetime for FastAPI depending on provider type
                let finalDateTime;
                if (providerType === 'Pharmacy') {
                    // For ASAP delivery, use current time
                    finalDateTime = new Date().toISOString(); 
                } else {
                    // Doctor/Lab uses specific booked time
                    finalDateTime = `${bookingData.date}T${bookingData.time}:00`; 
                }

                const payload = {
                    provider_id: bookingData.provider_id || "00000000-0000-0000-0000-000000000000",
                    scheduled_time: finalDateTime,
                    order_notes: bookingData.notes || `Paid via: ${activeRadio}`,
                    delivery_address: bookingData.address || "Platform Default",
                    // Adding optional fields you might have in your Booking schema
                    doctor_service_id: bookingData.service_id || null
                };

                const response = await fetch(`${API_BASE}/bookings/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || "Database failed to register booking.");
                }

                const data = await response.json(); // Assumes backend returns an ID

                // Clean up session storage and redirect
                sessionStorage.removeItem('pendingBooking');
                localStorage.setItem('latestBookingId', data.id || 'success'); 
                
                window.location.href = 'confirmation.html';

            } catch (error) {
                console.error("Transaction Error:", error);
                alert(`Payment failed: ${error.message}`);
                payBtn.innerHTML = originalHtml;
                payBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // --- 5. Theme Toggling Logic ---
    // ==========================================
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    if (themeToggleBtn && themeIcon) {
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
                themeIcon.classList.remove('fa-sun', 'fa-solid');
                themeIcon.classList.add('fa-moon', 'fa-regular');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeIcon.classList.remove('fa-moon', 'fa-regular');
                themeIcon.classList.add('fa-sun', 'fa-solid');
            }
        });
    }
});