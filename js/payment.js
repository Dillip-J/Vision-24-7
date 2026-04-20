// js/payment.js
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // --- 1. LOAD PENDING BOOKING DATA ---
    // ==========================================
    const bookingDataStr = localStorage.getItem('pendingBooking');
    const activeBookingId = localStorage.getItem('activeBookingId');
    
    if (!bookingDataStr || !activeBookingId) {
        console.warn("Unauthorized access: No booking data found.");
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
    // --- 2. DYNAMIC UI ADAPTATION ---
    // ==========================================
    const providerType = bookingData.provider_type || 'Doctor'; 
    
    const docImg = document.getElementById('pay-doc-img');
    const docName = document.getElementById('pay-doc-name');
    const docSpec = document.getElementById('pay-doc-spec');
    const dateEl = document.getElementById('pay-date');
    const timeEl = document.getElementById('pay-time');
    const typeEl = document.getElementById('pay-type');
    
    const feeEl = document.getElementById('pay-fee');
    const visitEl = document.getElementById('pay-visit');
    const platformEl = document.getElementById('pay-platform');
    const totalEl = document.getElementById('pay-total');
    const btnAmount = document.getElementById('btn-amount');

    if (docImg) docImg.src = bookingData.doctorImage || bookingData.provider_image || 'assets/default-doc.png';
    if (docName) docName.textContent = bookingData.doctorName || bookingData.provider_name;
    if (docSpec) docSpec.textContent = bookingData.doctorSpecialty || bookingData.category;
    if (typeEl) typeEl.textContent = bookingData.visitType;

    // Pull the saved Date & Time from the booking step
    if (dateEl) dateEl.textContent = localStorage.getItem('bookedDate') || "Today";
    if (timeEl) timeEl.textContent = localStorage.getItem('bookedTime') || "TBD";

    // 🚨 THE FIX: Remove Platform Fee math and hide it
    const baseFee = bookingData.consultationFee || bookingData.price || 500;
    const visitFee = bookingData.visitType === 'Home Visit' ? (bookingData.visitCharge || 200) : 0;
    const totalAmount = baseFee + visitFee;

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

    if (feeEl) feeEl.textContent = formatCurrency(baseFee);
    if (visitEl) visitEl.textContent = formatCurrency(visitFee);
    
    if (platformEl) {
        const platformRow = platformEl.parentElement; 
        if (platformRow) platformRow.style.display = 'none'; 
    }
    
    if (totalEl) totalEl.textContent = formatCurrency(totalAmount);
    if (btnAmount) btnAmount.textContent = formatCurrency(totalAmount);

    // ==========================================
    // --- 3. PAYMENT METHOD UI TOGGLING ---
    // ==========================================
    const methodRows = document.querySelectorAll('.payment-method-row');
    const panels = document.querySelectorAll('.payment-panel');

    methodRows.forEach(row => {
        row.addEventListener('click', () => {
            methodRows.forEach(r => r.classList.remove('active'));
            panels.forEach(p => { p.style.display = 'none'; p.classList.remove('active-panel'); });
            
            const radio = row.querySelector('input[type="radio"]');
            radio.checked = true;
            row.classList.add('active');

            const panelId = `panel-${radio.value}`;
            const targetPanel = document.getElementById(panelId);
            if (targetPanel) {
                targetPanel.style.display = 'block';
                setTimeout(() => targetPanel.classList.add('active-panel'), 10);
            }
        });
    });

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

    // Credit Card formatting (adds space every 4 digits)
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
            
            // Validate Inputs before "paying"
            const activeRadioNode = document.querySelector('input[name="payment_method"]:checked');
            if (!activeRadioNode) return;
            const activeRadio = activeRadioNode.value;

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

            // Lock the button
            const originalHtml = payBtn.innerHTML;
            payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            payBtn.disabled = true;

            // Simulate Payment Gateway Delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Clean up and Redirect
            localStorage.removeItem('pendingBooking');
            localStorage.removeItem('paymentTotalAmount');
            localStorage.setItem('latestBookingId', activeBookingId); 
            
            window.location.href = 'confirmation.html'; 
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