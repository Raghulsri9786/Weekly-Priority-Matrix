
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
let currentUserId = null;
let currentPlan = {};

// View Controller
function switchView(viewId) {
    const views = ['login-view', 'matrix-view'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (v === viewId) {
            el.classList.remove('hidden-view');
            el.style.display = 'block';
            gsap.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "expo.out" });
        } else {
            el.style.display = 'none';
        }
    });
}

// Initial Animation
window.addEventListener('load', () => {
    gsap.from("#login-view .glass", { opacity: 0, scale: 0.95, duration: 1.2, ease: "power4.out" });
});

// Auth Logic
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const name = document.getElementById('login-name').value;
    const email = document.getElementById('login-email').value;

    btn.innerText = "Initializing...";
    btn.disabled = true;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
        });
        
        if (!response.ok) throw new Error("Auth failed");
        
        const data = await response.json();
        currentUserId = data.id;
        
        // Setup Roadmap UI
        document.getElementById('greeting').innerText = `Roadmap for ${name.split(' ')[0]}`;
        renderMatrix();
        switchView('matrix-view');
        
    } catch (err) {
        alert("Launch failed. Check your Python backend / Firebase key.");
        btn.innerText = "Launch Matrix";
        btn.disabled = false;
    }
});

function renderMatrix() {
    const grid = document.getElementById('matrix-grid');
    grid.innerHTML = '';

    days.forEach(day => {
        const card = document.createElement('div');
        card.className = "matrix-card glass rounded-[2rem] p-8 flex flex-col min-h-[320px] shadow-sm";
        card.innerHTML = `
            <div class="flex items-center justify-between mb-8">
                <span class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">${day}</span>
                <div class="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
            </div>
            <textarea 
                data-day="${day}" 
                placeholder="Top priorities..." 
                class="flex-grow w-full bg-transparent outline-none resize-none text-sm font-medium leading-relaxed placeholder:text-slate-800 custom-scrollbar"
            ></textarea>
        `;
        grid.appendChild(card);

        const textarea = card.querySelector('textarea');
        textarea.addEventListener('input', (e) => {
            currentPlan[day] = e.target.value;
        });
    });

    // Animate Cards entry
    gsap.from(".matrix-card", {
        opacity: 0,
        y: 40,
        stagger: 0.1,
        duration: 0.8,
        ease: "power4.out"
    });
}

// Sync Logic
document.getElementById('sync-btn').addEventListener('click', async () => {
    if (!currentUserId) return;
    
    const btn = document.getElementById('sync-btn');
    const originalText = btn.innerText;
    btn.innerText = "SYNCING...";
    btn.disabled = true;

    try {
        const response = await fetch(`/api/weekly/${currentUserId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: currentPlan })
        });

        if (response.ok) {
            showSuccess();
        }
    } catch (err) {
        console.error("Sync error:", err);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

function showSuccess() {
    const overlay = document.getElementById('success-overlay');
    const lottie = document.getElementById('success-lottie');
    
    gsap.to(overlay, { opacity: 1, duration: 0.4 });
    lottie.play();
    
    setTimeout(() => {
        gsap.to(overlay, { opacity: 0, duration: 0.4 });
        lottie.stop();
    }, 2400);
}
