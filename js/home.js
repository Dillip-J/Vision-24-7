// js/home.js
document.addEventListener('DOMContentLoaded', () => {

    const API_BASE = window.API_BASE;
    if (!API_BASE) {
        console.error("FATAL: window.API_BASE is missing. Check config.js");
        return;
    }

    // 🚨 THE NUCLEAR WIPE: Destroy old ghosts so they don't drag us to book.html
    localStorage.removeItem('pendingBooking');
    localStorage.removeItem('redirectAfterAuth');

    // ==========================================
    // --- 1. JS-Based Global Navigation Router ---
    // ==========================================
    document.querySelectorAll('[data-nav]').forEach(element => {
        element.addEventListener('click', (e) => {
            e.preventDefault(); 
            const targetPage = element.getAttribute('data-nav');
            window.location.href = targetPage;
        });
    });

    // ==========================================
    // --- 2. DYNAMIC CATEGORY BUILDER ---
    // ==========================================
    const designMap = {
        "Cardiologist": { icon: "fa-heart", color: "red" },
        "Pediatrician": { icon: "fa-baby", color: "pink" },
        "Orthopedic": { icon: "fa-bone", color: "orange" },
        "General Physician": { icon: "fa-stethoscope", color: "blue" },
        "Ophthalmologist": { icon: "fa-eye", color: "purple" },
        "Neurologist": { icon: "fa-brain", color: "indigo" },
        "Dermatologist": { icon: "fa-face-smile", color: "yellow" },
        "Dietitian": { icon: "fa-apple-whole", color: "green" },
        "default": { icon: "fa-user-doctor", color: "blue" } 
    };

    async function fetchAndRenderSpecialties() {
        const grid = document.getElementById('dynamic-specialties');
        if (!grid) return;

        try {
            const response = await fetch(`${API_BASE}/home/`);
            if (!response.ok) throw new Error("API Offline");
            
            const data = await response.json();
            const categories = data.categories || [];

            grid.innerHTML = ''; // Clear the loading spinner

            if (categories.length === 0) {
                grid.innerHTML = `<p class="empty-state-text">No specialties available at the moment.</p>`;
                return;
            }

            categories.forEach(cat => {
                const style = designMap[cat] || designMap["default"];
                const cardHTML = `
                    <div class="specialty-card" data-specialty="${cat}">
                        <div class="spec-icon ${style.color}"><i class="fa-solid ${style.icon}"></i></div>
                        <p>${cat}</p>
                    </div>
                `;
                grid.insertAdjacentHTML('beforeend', cardHTML);
            });

            document.querySelectorAll('.specialty-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    const specialtyName = card.getAttribute('data-specialty');
                    if (specialtyName) {
                        localStorage.setItem('autoSearchSpecialty', specialtyName);
                        window.location.href = 'doctors.html';
                    }
                });
            });

        } catch (error) {
            console.error("Network Error: Could not load categories.", error);
        }
    }

    fetchAndRenderSpecialties();

    // ==========================================
    // --- 3. Global Search Bar Logic ---
    // ==========================================
    const searchBtn = document.getElementById('btn-global-search');
    const searchInput = document.getElementById('global-search');
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                localStorage.setItem('autoSearchQuery', query);
                window.location.href = 'doctors.html';
            }
        });
    }

    // ==========================================
    // --- 4. Mobile Hamburger Menu Toggle ---
    // ==========================================
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    const navActions = document.getElementById('nav-actions');

    if (mobileBtn && navLinks && navActions) {
        mobileBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            navActions.classList.toggle('active');
        });
    }
});
// // js/home.js
// const API_BASE = 'http://127.0.0.1:8000';

// document.addEventListener('DOMContentLoaded', () => {

//     // ==========================================
//     // --- 1. JS-Based Global Navigation Router ---
//     // ==========================================
//     document.querySelectorAll('[data-nav]').forEach(element => {
//         element.addEventListener('click', (e) => {
//             e.preventDefault(); 
//             const targetPage = element.getAttribute('data-nav');
//             window.location.href = targetPage;
//         });
//     });

//     // ==========================================
//     // --- 2. THE SENDER (Specialty Click to Doctors Page) ---
//     // ==========================================
//     const specialtyCards = document.querySelectorAll('.specialty-card');

//     specialtyCards.forEach(card => {
//         card.addEventListener('click', (e) => {
//             const specialtyName = card.getAttribute('data-specialty');
            
//             if (specialtyName) {
//                 console.log("Saving to memory: ", specialtyName); // For debugging
//                 localStorage.setItem('autoSearchSpecialty', specialtyName);
//                 window.location.href = 'doctors.html';
//             } else {
//                 console.error("The clicked card is missing the data-specialty attribute!");
//             }
//         });
//     });

//     // ==========================================
//     // --- 3. Global Search Bar Logic ---
//     // ==========================================
//     const searchBtn = document.getElementById('btn-global-search');
//     const searchInput = document.getElementById('global-search');
    
//     if (searchBtn && searchInput) {
//         searchBtn.addEventListener('click', () => {
//             const query = searchInput.value.trim();
//             if (query) {
//                 localStorage.setItem('autoSearchQuery', query);
//                 window.location.href = 'doctors.html';
//             }
//         });
//     }

//     // ==========================================
//     // --- 4. Mobile Hamburger Menu Toggle ---
//     // ==========================================
//     const mobileBtn = document.getElementById('mobile-menu-btn');
//     const navLinks = document.getElementById('nav-links');
//     const navActions = document.getElementById('nav-actions');

//     if (mobileBtn && navLinks && navActions) {
//         mobileBtn.addEventListener('click', () => {
//             navLinks.classList.toggle('active');
//             navActions.classList.toggle('active');
//         });
//     }

//     // ==========================================
//     // --- 5. Dynamic Live Database Stats ---
//     // ==========================================
//     const statUsers = document.getElementById('stat-users');
//     const statDoctors = document.getElementById('stat-doctors');
//     const statConsults = document.getElementById('stat-consults');

//     function animateValue(obj, start, end, duration) {
//         if (!obj || isNaN(end)) return;
//         let startTimestamp = null;
//         const step = (timestamp) => {
//             if (!startTimestamp) startTimestamp = timestamp;
//             const progress = Math.min((timestamp - startTimestamp) / duration, 1);
//             obj.innerHTML = Math.floor(progress * (end - start) + start) + "+";
//             if (progress < 1) window.requestAnimationFrame(step);
//         };
//         window.requestAnimationFrame(step);
//     }

//     async function fetchPlatformStats() {
//         try {
//             const response = await fetch(`${API_BASE}/home/`); 
//             if (!response.ok) throw new Error("API Offline");
            
//             const data = await response.json();
            
//             const activeProviders = data.featured ? data.featured.length : 15;
            
//             animateValue(statUsers, 0, 1250, 1500);      
//             animateValue(statDoctors, 0, activeProviders * 10, 1500); 
//             animateValue(statConsults, 0, 5400, 1500);   

//         } catch (error) {
//             console.warn("Failed to fetch live stats. Using static fallbacks.");
            
//             animateValue(statUsers, 0, 150, 1500);
//             animateValue(statDoctors, 0, 45, 1500);
//             animateValue(statConsults, 0, 890, 1500);
//         }
//     }

//     if (statUsers || statDoctors || statConsults) {
//         fetchPlatformStats();
//     }
// });