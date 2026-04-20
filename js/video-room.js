// js/video-room.js (PATIENT SIDE ONLY)
document.addEventListener('DOMContentLoaded', () => {
    // 1. Force the container to take up the whole screen (Prevents the 0px Blank Screen bug)
    document.body.style.margin = "0";
    document.body.style.height = "100vh";
    document.body.style.backgroundColor = "#1a1a1a";
    
    const container = document.getElementById('meet-container');
    if (container) {
        container.style.width = "100%";
        container.style.height = "100%";
    } else {
        alert("CRITICAL ERROR: Could not find <div id='meet-container'> in your HTML!");
        return;
    }

    // 2. Grab the room and name from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomName = urlParams.get('room');
    let customName = urlParams.get('name'); 

    // 3. Security Guard
    if (!roomName) {
        container.innerHTML = `
            <div style="color: white; text-align: center; margin-top: 20vh; font-family: sans-serif;">
                <h2><i class="fa-solid fa-triangle-exclamation" style="color: #EF4444;"></i> Secure Room Error</h2>
                <p>No valid room ID was provided.</p>
                <p>Please close this tab and click "Join Call" directly from your Dashboard.</p>
            </div>`;
        return;
    }

    // 4. Bulletproof Patient Name Assignment
    if (!customName || customName === 'Self' || customName === 'undefined' || customName === 'null') {
        try {
            const patientStr = localStorage.getItem('user') || localStorage.getItem('currentUser');
            if (patientStr) customName = JSON.parse(patientStr).name;
        } catch(e) {
            console.warn("Could not parse user name from memory.");
        }
    }
    let displayName = customName || "Patient";

    // 5. FIRE UP THE VIDEO ENGINE
    try {
        const domain = 'meet.jit.si';
        const options = {
            roomName: roomName,
            width: '100%',
            height: '100%',
            parentNode: container,
            userInfo: {
                displayName: displayName
            },
            configOverwrite: {
                startWithAudioMuted: false,
                startWithVideoMuted: false,
                prejoinPageEnabled: false 
            },
            interfaceConfigOverwrite: {
                SHOW_JITSI_WATERMARK: false,
                SHOW_WATERMARK_FOR_GUESTS: false,
                TOOLBAR_BUTTONS: [
                    'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                    'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
                    'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                    'videoquality', 'filmstrip', 'shortcuts', 'tileview'
                ]
            }
        };
        
        const api = new JitsiMeetExternalAPI(domain, options);
        api.addListener('videoConferenceLeft', () => window.close());

    } catch (error) {
        // If the Jitsi script tag is missing from the HTML, it will get caught here instead of blanking out
        console.error("Video Engine Crash:", error);
        container.innerHTML = `
            <div style="color: white; text-align: center; margin-top: 20vh; font-family: sans-serif;">
                <h2 style="color: #EF4444;">Video Engine Failed to Load</h2>
                <p>Make sure this script is in your HTML file:</p>
                <code>&lt;script src="https://meet.jit.si/external_api.js"&gt;&lt;/script&gt;</code>
            </div>`;
    }
});