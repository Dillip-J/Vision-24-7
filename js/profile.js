document.addEventListener('DOMContentLoaded', () => {

// ==========================================
// 🚨 SMART API ROUTER
// ==========================================
let API_BASE;

if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    // 💻 LOCAL MODE: You are testing on your laptop
    API_BASE = 'http://127.0.0.1:8000';
    console.log("🔌 Connected to LOCAL Backend");
} else {
    // 🌍 LIVE MODE: You are on the real internet
    API_BASE = 'https://backend-depolyment-1.onrender.com'; 
    console.log("☁️ Connected to LIVE Cloud Backend");
}

    // ==========================================
    // --- 1. SECURE SESSION GUARD ---
    // ==========================================
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        window.location.href = 'index.html'; // Redirect to login if no secure token
        return; 
    }

    let userProfile = {}; // We will fetch this from the real database!

    // DOM Elements
    const avatarInitials = document.getElementById('avatar-initials');
    const displayName = document.getElementById('display-name');
    const displayEmail = document.getElementById('display-email');
    
    const inputName = document.getElementById('input-name');
    const inputEmail = document.getElementById('input-email');
    const inputPhone = document.getElementById('input-phone');
    
    // Note: These don't exist in our PostgreSQL table yet, but we'll leave the inputs functional for the UI
    const inputDob = document.getElementById('input-dob');
    const inputAddress = document.getElementById('input-address');
    const inputEmergency = document.getElementById('input-emergency');
    const inputMedical = document.getElementById('input-medical');


    // ==========================================
    // --- 2. FETCH REAL DATA FROM FASTAPI ---
    // ==========================================
    async function fetchMyProfile() {
        try {
            const response = await fetch(`${API_BASE}/users/me`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if(response.status === 401) {
                    alert("Session expired. Please log in again.");
                    localStorage.removeItem('access_token');
                    window.location.href = 'index.html';
                }
                return;
            }

            userProfile = await response.json();
            populateUI();

        } catch (err) {
            console.error("Failed to fetch profile:", err);
        }
    }


    // ==========================================
    // --- 3. MOBILE-FIRST IMAGE UPLOAD (SECURE) ---
    // ==========================================
    const fileInput = document.getElementById('mobile-image-upload');
    const btnChangePic = document.getElementById('btn-change-pic');
    const avatarClickable = document.getElementById('avatar-clickable');

    const triggerGallery = () => { fileInput.click(); };

    if (btnChangePic) btnChangePic.addEventListener('click', triggerGallery);
    if (avatarClickable) avatarClickable.addEventListener('click', triggerGallery);

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Please select a valid image file.');
                return;
            }

            // 1. Instant UI Feedback (Your Base64 trick!)
            const reader = new FileReader();
            reader.onload = (event) => {
                avatarInitials.textContent = ""; 
                avatarInitials.style.backgroundImage = `url(${event.target.result})`;
                avatarInitials.style.backgroundSize = "cover";
                avatarInitials.style.backgroundPosition = "center";
            };
            reader.readAsDataURL(file);

            // 2. Upload to FastAPI
            const formData = new FormData();
            formData.append("file", file); // Must match backend parameter name

            try {
                if(btnChangePic) btnChangePic.textContent = "Uploading...";
                
                const response = await fetch(`${API_BASE}/users/me/profile-photo`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }, // NO Content-Type for FormData
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    userProfile.profile_photo_url = data.url; // Update local state with real URL
                    alert("Profile photo updated successfully!");
                } else {
                    alert("Failed to upload photo to server.");
                }
            } catch (err) {
                console.error("Upload error:", err);
                alert("Network error during upload.");
            } finally {
                if(btnChangePic) btnChangePic.innerHTML = '<i class="fa-solid fa-camera"></i> Change Photo';
            }
        }
    });


    // ==========================================
    // --- 4. INPUT RESTRICTIONS ---
    // ==========================================
    const restrictToNumbers = (e) => {
        let value = e.target.value;
        e.target.value = value.replace(/[^0-9+\s-]/g, '');
    };
    if (inputPhone) inputPhone.addEventListener('input', restrictToNumbers);
    if (inputEmergency) inputEmergency.addEventListener('input', restrictToNumbers);


    // ==========================================
    // --- 5. INITIALIZE THE UI ---
    // ==========================================
    function populateUI() {
        if(inputName) inputName.value = userProfile.name || ""; // Backend uses 'name' not 'fullName'
        if(inputEmail) {
            inputEmail.value = userProfile.email || "";
            inputEmail.readOnly = true; // Email cannot be changed easily
        }
        if(inputPhone) inputPhone.value = userProfile.phone || "";
        
        // These fields are currently just UI placeholders (Not in DB yet)
        if(inputDob) inputDob.value = localStorage.getItem('temp_dob') || "";
        if(inputEmergency) inputEmergency.value = localStorage.getItem('temp_emergency') || "";
        if(inputMedical) inputMedical.value = localStorage.getItem('temp_medical') || "";

        if(displayName) displayName.textContent = userProfile.name || "Guest User";
        if(displayEmail) displayEmail.textContent = userProfile.email || "No email provided";

        // Avatar Rendering Logic
        if (avatarInitials) {
            if (userProfile.profile_photo_url) {
                avatarInitials.textContent = ""; 
                avatarInitials.style.backgroundImage = `url(${API_BASE}${userProfile.profile_photo_url})`;
                avatarInitials.style.backgroundSize = "cover";
                avatarInitials.style.backgroundPosition = "center";
            } else {
                avatarInitials.style.backgroundImage = "none";
                if (userProfile.name && userProfile.name.trim() !== "") {
                    const parts = userProfile.name.trim().split(' ');
                    avatarInitials.textContent = parts.length >= 2 
                        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() 
                        : `${parts[0][0]}`.toUpperCase();
                } else {
                    avatarInitials.textContent = "JD";
                }
            }
        }
    }


    // ==========================================
    // --- 6. SAVE TEXT FORM LOGIC ---
    // ==========================================
    const btnSave = document.getElementById('btn-save-profile');

    if (btnSave) {
        btnSave.addEventListener('click', async (e) => {
            e.preventDefault(); 
            
            if (inputName && !inputName.value.trim()) {
                alert("Full Name is required");
                return;
            }

            const originalText = btnSave.innerHTML;
            btnSave.innerHTML = 'Saving...';
            btnSave.disabled = true;

            // Save non-DB items locally for now so the UI doesn't break
            if(inputDob) localStorage.setItem('temp_dob', inputDob.value);
            if(inputEmergency) localStorage.setItem('temp_emergency', inputEmergency.value);
            if(inputMedical) localStorage.setItem('temp_medical', inputMedical.value);

            // TODO: In Phase 2, we need to create a PATCH /users/me route in Python to save the Name and Phone!
            alert("Note: Basic info (Name/Phone) requires a backend update route (Phase 2). Local UI updated.");

            btnSave.innerHTML = '<i class="fa-solid fa-check"></i> Saved Successfully';
            btnSave.style.backgroundColor = 'var(--success-green)';
            btnSave.style.borderColor = 'var(--success-green)';
            btnSave.style.color = 'white';
            
            setTimeout(() => {
                btnSave.innerHTML = originalText;
                btnSave.style.backgroundColor = '';
                btnSave.style.borderColor = '';
                btnSave.style.color = '';
                btnSave.disabled = false;
            }, 2000);
        });
    }

    // --- 7. Cancel Logic ---
    const btnCancel = document.getElementById('btn-cancel-profile');
    if (btnCancel) {
        btnCancel.addEventListener('click', (e) => {
            e.preventDefault();
            populateUI(); // Reverts any unsaved typing by re-reading the object
        });
    }

    // FIRE IT UP!
    fetchMyProfile();
});