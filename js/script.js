// ==========================================
// 🚨 SMART API ROUTER
// ==========================================
let API_BASE;

if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
    // 💻 LOCAL MODE: You are testing on your laptop
    API_BASE = 'http://127.0.0.1:8000';
    console.log("🔌 Connected to LOCAL Backend");
} else {
    // 🌍 LIVE MODE: You are on the real internet
    API_BASE = 'https://vision-backend-9lw7.onrender.com'; 
    console.log("☁️ Connected to LIVE Cloud Backend");
}

// ==========================================
// --- 0. INSTANT GLOBAL THEME MANAGER ---
// ==========================================
(function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();

// ==========================================
// --- 1. Global Navigation & Routing Logic ---
// ==========================================
const isIndexPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/patient/');
const activeUserSession = localStorage.getItem('currentUser');

function proceedToNextPage() {
    const targetUrl = localStorage.getItem('redirectAfterAuth') || './home.html';
    localStorage.removeItem('redirectAfterAuth'); 
    window.location.href = targetUrl;
}

if (isIndexPage && activeUserSession) {
    proceedToNextPage();
}

window.goToLogin = function() {
    localStorage.setItem('redirectAfterAuth', window.location.href);
    window.location.href = './index.html';
};

// ==========================================
// --- 2. DYNAMIC NAVBAR & THEME TOGGLE ---
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // --- A. Independent Theme Toggle Logic ---
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    if (themeToggleBtn && themeIcon) {
        if (document.documentElement.getAttribute('data-theme') === 'dark') {
            themeIcon.className = 'fa-solid fa-sun';
        } else {
            themeIcon.className = 'fa-regular fa-moon';
        }

        themeToggleBtn.addEventListener('click', (e) => {
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

    // --- B. Dynamic Auth Actions ---
    const navActions = document.getElementById('nav-actions');

    if (navActions) {
        if (activeUserSession) {
            navActions.innerHTML = `
                <a href="dashboard.html" class="icon-btn" style="text-decoration:none;" title="Dashboard"><i class="fa-solid fa-border-all"></i></a>
                <a href="profile.html" class="icon-btn" style="text-decoration:none;" title="Profile"><i class="fa-regular fa-user"></i></a>
                <button class="icon-btn" id="theme-toggle-dynamic" title="Toggle Theme"><i class="fa-regular fa-moon" id="theme-icon-dynamic"></i></button>
                <button class="icon-btn" id="logout-btn" title="Logout" style="color: #EF4444;"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>
            `;

            document.getElementById('logout-btn').addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('currentUser'); 
                localStorage.removeItem('access_token'); // Ensure token is also destroyed
                window.location.reload(); 
            });

        } else {
            navActions.innerHTML = `
                <button class="icon-btn" id="theme-toggle-dynamic" title="Toggle Theme"><i class="fa-regular fa-moon" id="theme-icon-dynamic"></i></button>
                <button onclick="goToLogin()" style="border: none; cursor: pointer; display:flex; align-items:center; gap:8px; padding: 8px 16px; border-radius: 8px; background-color: var(--brand-blue); color: white; font-size: 0.9rem; font-weight: 600;">
                    <i class="fa-solid fa-right-to-bracket"></i> Login / Sign Up
                </button>
            `;
        }

        const dynThemeBtn = document.getElementById('theme-toggle-dynamic');
        const dynThemeIcon = document.getElementById('theme-icon-dynamic');
        
        if (dynThemeBtn && dynThemeIcon) {
            if (document.documentElement.getAttribute('data-theme') === 'dark') {
                dynThemeIcon.className = 'fa-solid fa-sun';
            }
            dynThemeBtn.addEventListener('click', () => {
                if (document.documentElement.getAttribute('data-theme') === 'dark') {
                    document.documentElement.removeAttribute('data-theme');
                    localStorage.setItem('theme', 'light');
                    dynThemeIcon.className = 'fa-regular fa-moon';
                } else {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    localStorage.setItem('theme', 'dark');
                    dynThemeIcon.className = 'fa-solid fa-sun';
                }
            });
        }
    }
});

// ==========================================
// --- 3. Auth Form Submissions (BULLETPROOF) ---
// ==========================================
const loginFormEl = document.getElementById('form-login');
const signupFormEl = document.getElementById('form-signup');

// --- PATIENT SIGNUP ---
if (signupFormEl) {
    signupFormEl.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        // Use IDs to prevent browser extensions from breaking the array order
        const nameVal = document.getElementById('signup-name').value;
        const emailVal = document.getElementById('signup-email').value.toLowerCase();
        const phoneVal = document.getElementById('signup-phone').value;
        const passVal = document.getElementById('signup-password').value;
        const confirmVal = document.getElementById('signup-confirm').value;

        if (passVal !== confirmVal) {
            alert("Passwords do not match!");
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nameVal,
                    email: emailVal,
                    phone: phoneVal,
                    password: passVal
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.detail && typeof errorData.detail === 'string' && errorData.detail.toLowerCase().includes('already')) {
                    alert("Email is already registered");
                } else {
                    alert(`Signup Failed: ${errorData.detail}`);
                }
                return;
            }

            alert("Account created successfully! Please log in.");
            switchTab(true); // Switch UI to login tab

        } catch (err) {
            console.error("Signup Fetch Error:", err);
            alert("Could not connect to the server.");
        }
    });
}

// --- PATIENT LOGIN ---
if (loginFormEl) {
    loginFormEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Use IDs to prevent browser extensions from breaking the array order
        const loginEmail = document.getElementById('login-email').value.toLowerCase();
        const loginPassword = document.getElementById('login-password').value;
        
        try {
            const formData = new URLSearchParams();
            formData.append('username', loginEmail); 
            formData.append('password', loginPassword);

            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded' 
                },
                body: formData
            });

            if (!response.ok) {
                alert("Incorrect email or password.");
                return;
            }

            const data = await response.json();
            
            // SECURITY: Save the JWT Token from FastAPI!
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('currentUser', JSON.stringify(data.user));

            proceedToNextPage(); 

        } catch (err) {
            console.error("Login Fetch Error:", err);
            alert("Server is offline.");
        }
    });
}

// ==========================================
// --- 4. Tab Switching Logic (Index Page) ---
// ==========================================
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');

// We have to re-select these inside the function scope to ensure they aren't null
window.switchTab = function(showLogin) {
    const fLogin = document.getElementById('form-login');
    const fSignup = document.getElementById('form-signup');
    
    if (!fLogin || !fSignup || !tabLogin || !tabSignup) return;

    if (showLogin) {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        fLogin.classList.add('active-form');
        fSignup.classList.remove('active-form');
    } else {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        fSignup.classList.add('active-form');
        fLogin.classList.remove('active-form');
    }
}

if (tabLogin && tabSignup) {
    tabLogin.addEventListener('click', () => switchTab(true));
    tabSignup.addEventListener('click', () => switchTab(false));
}

// ==========================================
// --- 5. Global Search Logic ---
// ==========================================
const searchInput = document.getElementById('global-search');
const resultsDropdown = document.getElementById('search-results');

if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        if (query.length < 3) {
            if (resultsDropdown) resultsDropdown.innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/home/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            // Clear and show results
            if (resultsDropdown) {
                resultsDropdown.innerHTML = '';
                
                // Append Doctors
                if (data.doctors) {
                    data.doctors.forEach(doc => {
                        resultsDropdown.innerHTML += `<div onclick="location.href='doctors.html?id=${doc.provider_id}'">
                            Dr. ${doc.name} - ${doc.category}
                        </div>`;
                    });
                }

                // Append Services
                if (data.services) {
                    data.services.forEach(ser => {
                        resultsDropdown.innerHTML += `<div onclick="location.href='services.html?id=${ser.service_id}'">
                            Service: ${ser.service_name}
                        </div>`;
                    });
                }
            }
            
            // Also call custom render if it exists on the page
            if (typeof renderUserSearchResults === 'function') {
                renderUserSearchResults(data);
            }
        } catch (err) {
            console.error("Search Error:", err);
        }
    });
}

// ==========================================
// --- GLOBAL OFFLINE DETECTOR ---
// ==========================================
window.addEventListener('offline', () => showNetworkToast(false));
window.addEventListener('online', () => showNetworkToast(true));

function showNetworkToast(isOnline) {
    let toast = document.getElementById('network-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'network-toast';
        toast.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); padding:12px 24px; border-radius:8px; color:#fff; font-weight:600; z-index:9999; transition:all 0.3s ease; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
        document.body.appendChild(toast);
    }
    
    if (isOnline) {
        toast.style.backgroundColor = 'var(--success-green, #10B981)'; 
        toast.innerHTML = '<i class="fa-solid fa-wifi"></i> Back Online';
        setTimeout(() => { 
            toast.style.opacity = '0'; 
            setTimeout(() => toast.remove(), 300); 
        }, 3000);
    } else {
        toast.style.backgroundColor = 'var(--danger-red, #EF4444)';
        toast.style.opacity = '1';
        toast.innerHTML = '<i class="fa-solid fa-plane-up"></i> You are offline. Showing cached data.';
    }
}

// Run once on load just in case they open the app without internet
if (!navigator.onLine) showNetworkToast(false);
// // --- Tab Switching Logic (Only runs if tabs exist on the page) ---
// const tabLogin = document.getElementById('tab-login');
// const tabSignup = document.getElementById('tab-signup');
// const formLogin = document.getElementById('form-login');
// const formSignup = document.getElementById('form-signup');

// if (tabLogin && tabSignup) {
//     function switchTab(showLogin) {
//         if (showLogin) {
//             tabLogin.classList.add('active');
//             tabSignup.classList.remove('active');
//             formLogin.classList.add('active-form');
//             formSignup.classList.remove('active-form');
//         } else {
//             tabSignup.classList.add('active');
//             tabLogin.classList.remove('active');
//             formSignup.classList.add('active-form');
//             formLogin.classList.remove('active-form');
//         }
//     }

//     tabLogin.addEventListener('click', () => switchTab(true));
//     tabSignup.addEventListener('click', () => switchTab(false));
// }

// // --- Theme Toggling Logic (Only runs if the toggle button exists) ---
// const themeToggleBtn = document.getElementById('theme-toggle');
// const themeIcon = document.getElementById('theme-icon');

// if (themeToggleBtn && themeIcon) {
//     // Check local storage to keep theme consistent across pages
//     const currentTheme = localStorage.getItem('theme');
//     if (currentTheme === 'dark') {
//         document.documentElement.setAttribute('data-theme', 'dark');
//         themeIcon.classList.remove('fa-moon', 'fa-regular');
//         themeIcon.classList.add('fa-sun', 'fa-solid');
//     }

//     themeToggleBtn.addEventListener('click', () => {
//         const theme = document.documentElement.getAttribute('data-theme');
        
//         if (theme === 'dark') {
//             document.documentElement.removeAttribute('data-theme');
//             localStorage.setItem('theme', 'light');
            
//             // Switch to moon icon
//             themeIcon.classList.remove('fa-sun', 'fa-solid');
//             themeIcon.classList.add('fa-moon', 'fa-regular');
//         } else {
//             document.documentElement.setAttribute('data-theme', 'dark');
//             localStorage.setItem('theme', 'dark');
            
//             // Switch to sun icon
//             themeIcon.classList.remove('fa-moon', 'fa-regular');
//             themeIcon.classList.add('fa-sun', 'fa-solid');
//         }
//     });
// }

// // --- Doctors Filtering Logic ---
// const searchInput = document.getElementById('doctor-search');
// const filterSpecialty = document.getElementById('filter-specialty');
// const filterType = document.getElementById('filter-type');
// const doctorCards = document.querySelectorAll('.doctor-card');
// const doctorCountDisplay = document.getElementById('doctor-count');

// if (searchInput && filterSpecialty && filterType) {
//     function filterDoctors() {
//         const searchTerm = searchInput.value.toLowerCase();
//         const selectedSpecialty = filterSpecialty.value;
//         const selectedType = filterType.value;
        
//         let visibleCount = 0;

//         doctorCards.forEach(card => {
//             const name = card.getAttribute('data-name').toLowerCase();
//             const specialty = card.getAttribute('data-specialty');
//             const type = card.getAttribute('data-type'); // e.g. "video home"

//             // Check criteria
//             const matchesSearch = name.includes(searchTerm) || specialty.toLowerCase().includes(searchTerm);
//             const matchesSpecialty = selectedSpecialty === 'all' || specialty === selectedSpecialty;
//             const matchesType = selectedType === 'all' || type.includes(selectedType);

//             // Toggle visibility
//             if (matchesSearch && matchesSpecialty && matchesType) {
//                 card.style.display = 'flex';
//                 visibleCount++;
//             } else {
//                 card.style.display = 'none';
//             }
//         });

//         // Update the results counter
//         doctorCountDisplay.textContent = visibleCount;
//     }

//     // Attach event listeners to trigger the filter function immediately on change
//     searchInput.addEventListener('input', filterDoctors);
//     filterSpecialty.addEventListener('change', filterDoctors);
//     filterType.addEventListener('change', filterDoctors);
// }
// // --- Auth Form Submissions (Simulating a Real Database) ---
// const loginFormEl = document.getElementById('form-login');
// const signupFormEl = document.getElementById('form-signup');

// if (signupFormEl) {
//     signupFormEl.addEventListener('submit', (e) => {
//         e.preventDefault(); 
        
//         const inputs = signupFormEl.querySelectorAll('input');
//         const fullName = inputs[0].value;
//         const email = inputs[1].value;
//         const phone = inputs[2].value;

//         // 1. Fetch the entire "Database" of users (or create an empty one)
//         let usersDB = JSON.parse(localStorage.getItem('usersDB')) || {};

//         // 2. Create the new user's profile
//         const newProfile = {
//             fullName: fullName, 
//             email: email, 
//             phone: phone,
//             dob: "", address: "", emergency: "", medical: "", profilePic: "" 
//         };

//         // 3. Save this user INTO the database, using their email as the unique key
//         usersDB[email] = newProfile;
//         localStorage.setItem('usersDB', JSON.stringify(usersDB));

//         // 4. Set the "Session" to remember who just logged in
//         localStorage.setItem('currentUser', email);

//         window.location.href = 'home.html';
//     });
// }

// if (loginFormEl) {
//     loginFormEl.addEventListener('submit', (e) => {
//         e.preventDefault();
//         const loginEmail = loginFormEl.querySelector('input[type="email"]').value;
        
//         // 1. Fetch the Database
//         let usersDB = JSON.parse(localStorage.getItem('usersDB')) || {};
        
//         // 2. Check if this user exists in our DB
//         if (!usersDB[loginEmail]) {
//             // If they don't exist, create a blank profile for them
//             usersDB[loginEmail] = {
//                 fullName: "Guest User", 
//                 email: loginEmail,
//                 phone: "", dob: "", address: "", emergency: "", medical: "", profilePic: ""
//             };
//             localStorage.setItem('usersDB', JSON.stringify(usersDB));
//         }

//         // 3. Set the "Session" to log them in
//         localStorage.setItem('currentUser', loginEmail);
        
//         window.location.href = 'home.html';
//     });
// }
// // Logout Logic
// const logoutBtn = document.getElementById('logout-btn');
// if (logoutBtn) {
//     logoutBtn.addEventListener('click', (e) => {
//         e.preventDefault();
//         localStorage.removeItem('currentUser'); // Destroy the session!
//         window.location.href = 'index.html';    // Kick back to login screen
//     });
// }

// document.addEventListener('DOMContentLoaded', () => {
//     // --- DYNAMIC NAVBAR AUTH STATE ---
//     const currentUserEmail = localStorage.getItem('currentUser');
//     const navActions = document.getElementById('nav-actions');

//     if (navActions) {
//         if (currentUserEmail) {
//             // User IS logged in: Show standard icons
//             navActions.innerHTML = `
//                 <a href="dashboard.html" class="icon-btn" style="text-decoration:none;" title="Dashboard"><i class="fa-solid fa-border-all"></i></a>
//                 <a href="profile.html" class="icon-btn" style="text-decoration:none;" title="Profile"><i class="fa-regular fa-user"></i></a>
//                 <button class="icon-btn" id="theme-toggle" title="Toggle Theme"><i class="fa-regular fa-moon" id="theme-icon"></i></button>
//                 <button class="icon-btn" id="logout-btn" title="Logout" style="color: #EF4444;"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>
//             `;

//             // Attach Logout Logic
//             document.getElementById('logout-btn').addEventListener('click', (e) => {
//                 e.preventDefault();
//                 localStorage.removeItem('currentUser'); 
//                 window.location.reload(); // Instantly reloads to show public view
//             });

//         } else {
//             // User is NOT logged in: Show Login Button
//             navActions.innerHTML = `
//                 <button class="icon-btn" id="theme-toggle" title="Toggle Theme"><i class="fa-regular fa-moon" id="theme-icon"></i></button>
//                 <a href="index.html" style="text-decoration:none; display:flex; align-items:center; gap:8px; padding: 8px 16px; border-radius: 8px; background-color: var(--brand-blue); color: white; font-size: 0.9rem; font-weight: 600;">
//                     <i class="fa-solid fa-right-to-bracket"></i> Login / Sign Up
//                 </a>
//             `;
//         }

//         // Re-attach Theme Toggle (Since we rebuilt the HTML)
//         const themeToggleBtn = document.getElementById('theme-toggle');
//         const themeIcon = document.getElementById('theme-icon');
//         if (themeToggleBtn && themeIcon) {
//             const currentTheme = localStorage.getItem('theme');
//             if (currentTheme === 'dark') {
//                 document.documentElement.setAttribute('data-theme', 'dark');
//                 themeIcon.className = 'fa-solid fa-sun';
//             }
//             themeToggleBtn.addEventListener('click', () => {
//                 if (document.documentElement.getAttribute('data-theme') === 'dark') {
//                     document.documentElement.removeAttribute('data-theme');
//                     localStorage.setItem('theme', 'light');
//                     themeIcon.className = 'fa-regular fa-moon';
//                 } else {
//                     document.documentElement.setAttribute('data-theme', 'dark');
//                     localStorage.setItem('theme', 'dark');
//                     themeIcon.className = 'fa-solid fa-sun';
//                 }
//             });
//         }
//     }
// });