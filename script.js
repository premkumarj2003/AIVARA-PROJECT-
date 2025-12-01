const medicalDatabase = { "allergy": [ { "name": "Para48 (Paracetamol)", "dose": "Typical adult dose: 200 mg every 6 h", "safety": "Informational only.", "side_effects": "Fatigue" }, { "name": "Olan8 (Olanzapine)", "dose": "Typical adult dose: 500 mg every 4-6 h", "safety": "Informational only.", "side_effects": "Headache" } ], "anxiety": [ { "name": "Risp21 (Risperidone)", "dose": "Typical adult dose: 10 mg daily", "safety": "Informational only.", "side_effects": "Headache" } ], "asthma": [ { "name": "Halo28 (Haloperidol)", "dose": "Typical adult dose: 1 tablet daily", "safety": "Informational only.", "side_effects": "Dry mouth" } ], "cold symptoms": [ { "name": "Losa38 (Losartan)", "dose": "Typical adult dose: 1 tablet daily", "safety": "Informational only.", "side_effects": "Headache" } ], "fever": [ { "name": "Tram3 (Tramadol)", "dose": "Clinician-only dosing.", "safety": "Requires clinician supervision.", "side_effects": "Diarrhea" } ], "pain relief": [ { "name": "Azit48 (Azithromycin)", "dose": "Typical adult dose: 1 tablet daily", "safety": "Informational only.", "side_effects": "Dizziness" } ] };
const homeCareTips = { "fever": "Stay hydrated, rest, and use a cool compress.", "pain relief": "Rest the affected area and apply ice or heat.", "cold symptoms": "Drink warm fluids, rest, and gargle salt water.", "anxiety": "Practice deep breathing and meditation.", "asthma": "Avoid triggers like smoke/dust. Keep inhaler nearby.", "allergy": "Avoid known allergens." };
const symptomMap = { "high temperature": "fever", "hot": "fever", "pyrexia": "fever", "migraine": "headache", "head hurts": "headache", "tummy ache": "stomach ache", "abdominal pain": "stomach ache", "gastritis": "acid reflux", "gerd": "acid reflux", "heartburn": "acid reflux", "flu": "cold symptoms", "runny nose": "cold symptoms", "congestion": "cold symptoms", "sneeze": "cold symptoms", "hurt": "pain relief", "pain": "pain relief", "ache": "pain relief", "cut": "cuts", "bleeding": "cuts", "wound": "cuts", "burn": "burns", "scald": "burns", "loose motion": "diarrhea", "upset stomach": "diarrhea", "cant sleep": "insomnia", "sleepless": "insomnia", "vomit": "nausea", "puking": "nausea", "sickness": "nausea", "high blood pressure": "hypertension", "bp": "hypertension", "sugar": "diabetes", "glucose": "diabetes", "nervous": "anxiety", "panic": "anxiety", "breathing problem": "asthma", "wheezing": "asthma" };

let triggeredKeys = new Set(); 
let activeAlert = null; 

document.addEventListener('DOMContentLoaded', () => {
    const loggedInUser = localStorage.getItem('aivara_session');
    if (loggedInUser) {
        checkAuth();
    }
    loadSettings();
    setInterval(() => {
        const user = localStorage.getItem('aivara_session');
        if (user) {
            checkDailyReset();
            checkReminders();
            checkSchedules();
        }
        updateGreeting();
    }, 1000); 
});

// --- CORE LOGIC ---
function checkDailyReset() {
    const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    const today = new Date().toDateString();
    let changed = false;
    reminders.forEach(r => {
        if (r.freq === 'Daily' && r.status === 'taken' && r.lastTaken !== today) {
            r.status = 'pending';
            r.snoozeUntil = null;
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem('reminders', JSON.stringify(reminders));
        loadReminders();
    }
}

function checkReminders() {
    if (!document.getElementById('alert-modal').classList.contains('hidden') && document.getElementById('alert-modal').style.display === 'flex') return;
    
    const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    reminders.forEach(r => {
        if (r.status !== 'pending') return;

        const [rHour, rMin] = r.time.split(':').map(Number);
        const reminderMinutes = rHour * 60 + rMin;
        let shouldTrigger = false;

        if (r.snoozeUntil) {
            if (now.getTime() >= r.snoozeUntil) shouldTrigger = true;
        } else {
            if (currentMinutes >= reminderMinutes) shouldTrigger = true;
        }

        if (shouldTrigger && !triggeredKeys.has(r.id)) {
            showAlert('reminder', r);
            triggeredKeys.add(r.id);
            setTimeout(() => triggeredKeys.delete(r.id), 60000);
        }
    });
}

function checkSchedules() {
    if (!document.getElementById('alert-modal').classList.contains('hidden') && document.getElementById('alert-modal').style.display === 'flex') return;

    const schedules = JSON.parse(localStorage.getItem('schedules') || '[]');
    const now = new Date();
    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    schedules.forEach(s => {
        if (s.status !== 'active') return;
        if (s.date !== dateStr) return;

        let targetMinutes = -1;
        const targetTime = s.remindTime || s.start;
        if(targetTime) {
            const [tHour, tMin] = targetTime.split(':').map(Number);
            targetMinutes = tHour * 60 + tMin;
        }

        let shouldTrigger = false;
        if (s.snoozeUntil) {
            if (now.getTime() >= s.snoozeUntil) shouldTrigger = true;
        } else {
            if (targetMinutes !== -1 && currentMinutes >= targetMinutes) shouldTrigger = true;
        }

        if (shouldTrigger && !triggeredKeys.has(s.id)) {
            const type = s.snoozeUntil ? 'schedule-reminder' : 'schedule-start';
            showAlert(type, s);
            triggeredKeys.add(s.id);
            setTimeout(() => triggeredKeys.delete(s.id), 60000);
        }
    });
}

function showAlert(type, item) {
    activeAlert = { id: item.id, type: type, item: item };
    const modal = document.getElementById('alert-modal');
    const title = document.getElementById('alert-title');
    const msg = document.getElementById('alert-msg');
    const btns = document.getElementById('modal-btns');
    
    modal.style.display = 'flex';
    modal.classList.remove('hidden'); 
    triggerVibration();

    if (type === 'reminder') {
        title.innerText = "💊 Medicine Time!";
        msg.innerText = `Please take ${item.name} (${item.dose}).`;
        speak(`It's time for your medicine. Please take ${item.name}.`);
        btns.innerHTML = `<button class="btn-primary" onclick="handleAlertAction('taken')">Taken</button><button class="btn-outline" onclick="handleAlertAction('snooze')">Snooze (2 min)</button>`;
    } else {
        title.innerText = "📅 Schedule Alert";
        msg.innerText = `Reminder: ${item.event} at ${convertTo12Hour(item.start)}.`;
        speak(`Reminder. You have a schedule: ${item.event}.`);
        btns.innerHTML = `<button class="btn-primary" onclick="handleAlertAction('got-it')">Got It</button><button class="btn-outline" onclick="handleAlertAction('snooze-schedule')">Remind me after 2 min</button>`;
    }
}

function handleAlertAction(action) {
    if (!activeAlert) return;
    const { id } = activeAlert;

    if (action === 'taken') {
        confirmTaken(id, 'reminder');
    } else if (action === 'got-it') {
        confirmFinished(id); 
    } else if (action === 'snooze' || action === 'snooze-schedule') {
        const dbName = action === 'snooze' ? 'reminders' : 'schedules';
        const items = JSON.parse(localStorage.getItem(dbName) || '[]');
        const index = items.findIndex(i => i.id == id);
        if (index !== -1) {
            items[index].snoozeUntil = Date.now() + (2 * 60 * 1000);
            localStorage.setItem(dbName, JSON.stringify(items));
            showToast("Snoozed for 2 minutes 💤");
        }
        closeModal();
        triggeredKeys.delete(id); 
    }
}

// --- FIXED CONFIRMATION FUNCTIONS ---
function confirmFinished(id) { 
    let schedules = JSON.parse(localStorage.getItem('schedules') || '[]'); 
    const index = schedules.findIndex(s => s.id == id); 
    if(index !== -1) { 
        addToHistory({ type: 'Schedule', name: "Acknowledged: " + schedules[index].event, time: new Date().toLocaleString(), id: Date.now() }); 
        updateStats('Schedule'); 
        schedules[index].status = 'finished'; 
        localStorage.setItem('schedules', JSON.stringify(schedules)); 
        loadSchedules(); 
        showToast("Schedule Finished!"); 
    } 
    closeModal(); 
}

function confirmTaken(id, type) { 
    if(type === 'reminder') { 
        const reminders = JSON.parse(localStorage.getItem('reminders') || '[]'); 
        const r = reminders.find(i => i.id == id); 
        if(r) { 
            r.status = 'taken'; 
            r.lastTaken = new Date().toDateString(); 
            localStorage.setItem('reminders', JSON.stringify(reminders)); 
            addToHistory({ type: 'Medicine', name: r.name, time: new Date().toLocaleString(), id: Date.now() }); 
            updateStats('Medicine'); 
            loadReminders(); 
            setTimeout(() => { deleteItem(id, 'reminder'); }, 3000); 
        } 
    } 
    closeModal(); 
}

// --- AUTH & UTILS ---
function openAuthModal(view) { document.getElementById('auth-modal').style.display = 'flex'; switchAuth(view); }
function switchAuth(view) { document.getElementById('login-view').classList.add('hidden'); document.getElementById('signup-view').classList.add('hidden'); document.getElementById('forgot-view').classList.add('hidden'); document.getElementById('login-error').style.display = 'none'; if (view === 'login') document.getElementById('login-view').classList.remove('hidden'); if (view === 'signup') document.getElementById('signup-view').classList.remove('hidden'); if (view === 'forgot') document.getElementById('forgot-view').classList.remove('hidden'); }
function handleSignup() { const user = document.getElementById('signup-username').value.trim(); const email = document.getElementById('signup-email').value.trim(); const pass = document.getElementById('signup-password').value.trim(); if (!user || !email || !pass) { alert("Please fill all fields"); return; } const users = JSON.parse(localStorage.getItem('aivara_users') || '[]'); if (users.find(u => u.username === user)) { alert("Username already taken"); return; } users.push({ username: user, email: email, password: pass }); localStorage.setItem('aivara_users', JSON.stringify(users)); showToast("Account Created! Please Login."); switchAuth('login'); }
function handleLogin() { const user = document.getElementById('login-username').value.trim(); const pass = document.getElementById('login-password').value.trim(); const users = JSON.parse(localStorage.getItem('aivara_users') || '[]'); const validUser = users.find(u => u.username === user && u.password === pass); if (validUser) { localStorage.setItem('aivara_session', validUser.username); document.getElementById('auth-modal').style.display = 'none'; checkAuth(); } else { const err = document.getElementById('login-error'); err.style.display = 'block'; err.innerText = "Incorrect username or password."; document.getElementById('forgot-link').classList.remove('hidden'); } }
function handleRecovery() { const email = document.getElementById('recover-email').value.trim(); if (email) { showToast(`Credentials sent to ${email}`); switchAuth('login'); } else { alert("Please enter your registered email"); } }
function checkAuth() { const user = localStorage.getItem('aivara_session'); const landing = document.getElementById('landing-view'); const dashboard = document.getElementById('dashboard-view'); if(user) { landing.classList.add('hidden'); dashboard.classList.remove('hidden'); document.getElementById('sidebar-username').innerText = user; loadSettings(); loadReminders(); loadSchedules(); loadHistory(); updateCharts(); updateGreeting(); } else { landing.classList.remove('hidden'); dashboard.classList.add('hidden'); } }
function logout() { localStorage.removeItem('aivara_session'); location.reload(); }
function loadSettings() { if(localStorage.getItem('aivara_theme') === 'dark') { document.body.classList.add('dark-mode'); const toggle = document.getElementById('theme-toggle'); if(toggle) toggle.checked = true; } const vToggle = document.getElementById('voice-toggle'); if(vToggle) vToggle.checked = localStorage.getItem('aivara_voice') !== 'muted'; const vibToggle = document.getElementById('vibrate-toggle'); if(vibToggle) vibToggle.checked = localStorage.getItem('aivara_vibrate') === 'true'; const user = localStorage.getItem('aivara_session'); if (user) { const users = JSON.parse(localStorage.getItem('aivara_users') || '[]'); const currentUser = users.find(u => u.username === user); if (currentUser) { if(document.getElementById('profile-name')) document.getElementById('profile-name').value = currentUser.name || user; if(document.getElementById('profile-email')) document.getElementById('profile-email').value = currentUser.email; if(document.getElementById('profile-age')) document.getElementById('profile-age').value = currentUser.age || ''; if(document.getElementById('profile-gender')) { document.getElementById('profile-gender').value = currentUser.gender || 'Male'; updateAvatar(currentUser.gender || 'Male'); } } } }
function updateAvatar(gender) { const img = document.getElementById('sidebar-avatar'); if(img) { if(gender === 'Female') { img.src = 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png'; } else { img.src = 'https://cdn-icons-png.flaticon.com/512/4140/4140048.png'; } } }
function toggleTheme() { document.body.classList.toggle('dark-mode'); const isDark = document.body.classList.contains('dark-mode'); localStorage.setItem('aivara_theme', isDark ? 'dark' : 'light'); }
function toggleVoice() { const isMuted = !document.getElementById('voice-toggle').checked; localStorage.setItem('aivara_voice', isMuted ? 'muted' : 'on'); showToast(isMuted ? "Voice Alerts Muted" : "Voice Alerts Enabled"); }
function toggleVibrate() { const isVibrate = document.getElementById('vibrate-toggle').checked; localStorage.setItem('aivara_vibrate', isVibrate ? 'true' : 'false'); if(isVibrate && navigator.vibrate) navigator.vibrate(200); showToast(isVibrate ? "Vibration Enabled" : "Vibration Disabled"); }
function saveProfile() { const user = localStorage.getItem('aivara_session'); const name = document.getElementById('profile-name').value; const age = document.getElementById('profile-age').value; const gender = document.getElementById('profile-gender').value; if (user) { let users = JSON.parse(localStorage.getItem('aivara_users') || '[]'); const userIndex = users.findIndex(u => u.username === user); if (userIndex !== -1) { users[userIndex].name = name; users[userIndex].age = age; users[userIndex].gender = gender; localStorage.setItem('aivara_users', JSON.stringify(users)); updateAvatar(gender); showToast("Profile Updated!"); } } }
function changeEmail() { const newEmail = prompt("Enter new email address:"); if(newEmail && newEmail.includes('@')) { const user = localStorage.getItem('aivara_session'); let users = JSON.parse(localStorage.getItem('aivara_users') || '[]'); const userIndex = users.findIndex(u => u.username === user); if(userIndex !== -1) { users[userIndex].email = newEmail; localStorage.setItem('aivara_users', JSON.stringify(users)); document.getElementById('profile-email').value = newEmail; showToast("Email Changed!"); } } else if (newEmail) { alert("Invalid email format."); } }
function changePassword() { const current = prompt("Enter current password:"); const user = localStorage.getItem('aivara_session'); let users = JSON.parse(localStorage.getItem('aivara_users') || '[]'); const userObj = users.find(u => u.username === user); if(userObj && userObj.password === current) { const newPass = prompt("Enter new password:"); if(newPass) { userObj.password = newPass; localStorage.setItem('aivara_users', JSON.stringify(users)); showToast("Password Changed!"); } } else if (current) { alert("Incorrect current password."); } }
function showSupport(type) { if(type === 'about') alert("AIVARA AI Health Assistant v1.0\nCreated for better health management."); if(type === 'contact') sendContactEmail(); if(type === 'faq') alert("FAQs:\n1. How to set reminder? -> Go to Reminders tab.\n2. Is data safe? -> Yes, stored locally."); if(type === 'bug') window.location.href = "mailto:support@aivara.ai?subject=Bug Report"; if(type === 'rate') { if(confirm("Rate us 5 stars? ⭐⭐⭐⭐⭐")) showToast("Thank you for rating!"); } }
function quickReply(text) { document.getElementById('user-input').value = text; sendMessage(); }
function handleEnter(e) { if(e.key === 'Enter') sendMessage(); }
function sendMessage() { const input = document.getElementById('user-input'); const box = document.getElementById('chat-box'); const text = input.value.toLowerCase().trim(); if(!text) return; box.innerHTML += `<div class="msg user-msg">${input.value}</div>`; input.value = ''; box.scrollTop = box.scrollHeight; let detectedCondition = null; for (const key in symptomMap) { if (text.includes(key)) { detectedCondition = symptomMap[key]; break; } } if (!detectedCondition) { for (const key in medicalDatabase) { if (text.includes(key)) { detectedCondition = key; break; } } } let reply = ""; if (detectedCondition) { const medInfo = medicalDatabase[detectedCondition]; const careInfo = homeCareTips[detectedCondition] || "Rest and stay hydrated."; reply = `<strong>Diagnosis:</strong> ${detectedCondition.toUpperCase()}<br><br>`; if (medInfo) { const med = medInfo[0]; reply += `<strong>💊 Recommended Medication:</strong> ${med.name}<br><strong>📏 Dosage:</strong> ${med.dose}<br><strong>⚠️ Precautions:</strong> ${med.safety}<br><br>`; } reply += `<strong>🏠 Home Care:</strong> ${careInfo}<br>`; } else { if (text.includes("hello") || text.includes("hi")) { reply = "Hello! I am AIVARA, your medical assistant. Tell me your symptoms."; } else { reply = `I understand you are feeling unwell. General advice:<br>1. Rest<br>2. Hydrate<br>3. Monitor symptoms.`; } } setTimeout(() => { box.innerHTML += `<div class="msg bot-msg"><img src="https://cdn-icons-png.flaticon.com/512/4712/4712027.png" class="chat-icon-small"><div>${reply}</div></div>`; box.scrollTop = box.scrollHeight; }, 600); }
function switchTab(tabId) { const currentView = document.querySelector('.tab-view:not(.hidden)'); const targetView = document.getElementById(`view-${tabId}`); if (!targetView) { showToast("Coming Soon!"); return; } if (currentView && currentView.id !== `view-${tabId}`) { currentView.classList.add('view-exit'); setTimeout(() => { currentView.classList.add('hidden'); currentView.classList.remove('view-exit'); targetView.classList.remove('hidden'); targetView.classList.add('view-enter'); void targetView.offsetWidth; targetView.classList.remove('view-enter'); if(tabId === 'tracking') updateCharts(); if(tabId === 'history') loadHistory(); }, 300); } else if (!currentView) { targetView.classList.remove('hidden'); } document.querySelectorAll('.menu li, .footer-item').forEach(el => el.classList.remove('active')); const activeTab = document.getElementById(`tab-${tabId}`); if(activeTab) activeTab.classList.add('active'); }
function updateGreeting() { const user = localStorage.getItem('aivara_session') || 'User'; const hour = new Date().getHours(); let greeting = (hour < 12) ? 'Good Morning' : (hour < 18) ? 'Good Afternoon' : 'Good Evening'; const greetEl = document.getElementById('greeting-text'); if(greetEl) greetEl.innerText = `${greeting}, ${user}!`; const dateEl = document.getElementById('current-date'); if(dateEl) dateEl.innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
function resetApp() { if(confirm("Delete all data?")) { localStorage.clear(); location.reload(); } }
function scrollToSection(id) { document.getElementById(id).scrollIntoView({ behavior: 'smooth' }); }
function sendContactEmail() { const name = document.getElementById('contact-name').value.trim(); const email = document.getElementById('contact-email').value.trim(); const message = document.getElementById('contact-message').value.trim(); if (!name || !email || !message) { alert("Please fill in all fields."); return; } const subject = `AIVARA Support Request from ${name}`; const body = `Name: ${name}%0AEmail: ${email}%0A%0AMessage:%0A${message}`; const mailtoLink = `mailto:premkumarj18122003@gmail.com,varunvarunsp@gmail.com?subject=${subject}&body=${body}`; window.location.href = mailtoLink; document.getElementById('contact-name').value = ''; document.getElementById('contact-email').value = ''; document.getElementById('contact-message').value = ''; showToast("Opening Email Client..."); }
function speak(text) { if (localStorage.getItem('aivara_voice') === 'muted') return; if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const msg = new SpeechSynthesisUtterance(text); msg.rate = 1; window.speechSynthesis.speak(msg); } }
function triggerVibration() { if (localStorage.getItem('aivara_vibrate') === 'true' && navigator.vibrate) { navigator.vibrate([200, 100, 200]); } }
function showToast(message) { const toast = document.getElementById('toast-container'); document.getElementById('toast-message').innerText = message; toast.classList.remove('hidden'); setTimeout(() => { toast.classList.add('hidden'); }, 2000); }
function closeModal() { document.getElementById('alert-modal').style.display = 'none'; window.speechSynthesis.cancel(); }
function convertTo12Hour(t) { if(!t) return ""; let [h, m] = t.split(':'); let am = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${m} ${am}`; }

// --- DATA MANAGEMENT ---
let editReminderId = null;
const reminderForm = document.getElementById('reminder-form');
if(reminderForm) { reminderForm.addEventListener('submit', (e) => { e.preventDefault(); const name = document.getElementById('med-name').value; const dose = document.getElementById('med-dose').value; const time = document.getElementById('med-time').value; const freq = document.getElementById('med-freq').value; const notes = document.getElementById('med-notes').value; const reminders = JSON.parse(localStorage.getItem('reminders') || '[]'); if (editReminderId) { const index = reminders.findIndex(r => r.id == editReminderId); if (index !== -1) { reminders[index] = { ...reminders[index], name, dose, time, freq, notes }; showToast('Reminder Updated!'); } resetReminderForm(); } else { const reminder = { id: Date.now(), name, dose, time, freq, notes, status: 'pending', snoozeUntil: null }; reminders.push(reminder); showToast('Reminder Added!'); } localStorage.setItem('reminders', JSON.stringify(reminders)); loadReminders(); reminderForm.reset(); }); }
function loadReminders() { const reminders = JSON.parse(localStorage.getItem('reminders') || '[]'); const list = document.getElementById('reminders-list'); if(!list) return; list.innerHTML = ''; reminders.forEach(r => { const div = document.createElement('div'); div.className = `reminder-item ${r.status}`; div.innerHTML = `<div class="reminder-info"><h4>${r.name} - ${convertTo12Hour(r.time)}</h4><p>Dosage: ${r.dose} | Frequency: ${r.freq}</p><div class="status-text">Status: ${r.status === 'taken' ? 'Taken' : 'Pending'}</div></div><div class="actions" style="display:flex;">${r.status === 'pending' ? `<button onclick="editReminder('${r.id}')" class="btn-circle btn-yellow"><i class="fas fa-pen"></i></button><button onclick="confirmTaken('${r.id}', 'reminder')" class="btn-circle btn-blue"><i class="fas fa-check"></i></button>` : ''}<button onclick="deleteItem('${r.id}', 'reminder')" class="btn-circle btn-red"><i class="fas fa-trash"></i></button></div>`; list.appendChild(div); }); }
function editReminder(id) { const reminders = JSON.parse(localStorage.getItem('reminders') || '[]'); const r = reminders.find(item => item.id == id); if(r) { document.getElementById('med-name').value = r.name; document.getElementById('med-dose').value = r.dose; document.getElementById('med-time').value = r.time; document.getElementById('med-freq').value = r.freq; document.getElementById('med-notes').value = r.notes; editReminderId = id; document.getElementById('reminder-form-title').innerText = "Edit Medicine"; document.getElementById('rem-submit-btn').innerText = "Update Reminder"; document.getElementById('rem-cancel-btn').classList.remove('hidden'); } }
function resetReminderForm() { editReminderId = null; document.getElementById('reminder-form').reset(); document.getElementById('reminder-form-title').innerHTML = '<i class="fas fa-plus-circle"></i> Add Medicine'; document.getElementById('rem-submit-btn').innerText = "Set Reminder"; document.getElementById('rem-cancel-btn').classList.add('hidden'); }
let editScheduleId = null;
const scheduleForm = document.getElementById('schedule-form');
if(scheduleForm) { scheduleForm.addEventListener('submit', (e) => { e.preventDefault(); const event = document.getElementById('sch-event').value; const date = document.getElementById('sch-date').value; const start = document.getElementById('sch-start').value; const end = document.getElementById('sch-end').value; const loc = document.getElementById('sch-loc').value; const note = document.getElementById('sch-note').value; const remindTime = document.getElementById('sch-remind-time').value; const schedules = JSON.parse(localStorage.getItem('schedules') || '[]'); if (editScheduleId) { const index = schedules.findIndex(s => s.id == editScheduleId); if (index !== -1) { schedules[index] = { ...schedules[index], event, date, start, end, loc, note, remindTime }; showToast("Schedule Updated!"); } resetScheduleForm(); } else { const schedule = { id: Date.now(), event, date, start, end, loc, note, remindTime, status: 'active', snoozeUntil: null }; schedules.push(schedule); showToast("Schedule Set!"); } localStorage.setItem('schedules', JSON.stringify(schedules)); loadSchedules(); scheduleForm.reset(); }); }
function loadSchedules() { const schedules = JSON.parse(localStorage.getItem('schedules') || '[]'); const list = document.getElementById('schedules-list'); if(!list) return; list.innerHTML = ''; const activeSchedules = schedules.filter(s => s.status === 'active'); activeSchedules.forEach(s => { const div = document.createElement('div'); div.className = 'schedule-item'; div.innerHTML = `<div class="schedule-info"><h4>${s.event}</h4><p><i class="fas fa-calendar"></i> ${s.date} | <i class="fas fa-clock"></i> ${convertTo12Hour(s.start)} - ${convertTo12Hour(s.end)}</p><p><i class="fas fa-bell"></i> Alert: ${convertTo12Hour(s.remindTime)}</p><div class="status-indicator"><div class="blinker"></div> Active</div></div><div class="actions" style="display:flex;"><button onclick="editSchedule('${s.id}')" class="btn-circle btn-yellow" title="Edit"><i class="fas fa-pen"></i></button><button onclick="confirmFinished('${s.id}')" class="btn-circle btn-green" title="Finish"><i class="fas fa-flag-checkered"></i></button><button onclick="deleteItem('${s.id}', 'schedule')" class="btn-circle btn-red"><i class="fas fa-trash"></i></button></div>`; list.appendChild(div); }); }
function editSchedule(id) { const schedules = JSON.parse(localStorage.getItem('schedules') || '[]'); const s = schedules.find(i => i.id == id); if(s) { document.getElementById('sch-event').value = s.event; document.getElementById('sch-date').value = s.date; document.getElementById('sch-start').value = s.start; document.getElementById('sch-end').value = s.end; document.getElementById('sch-loc').value = s.loc; document.getElementById('sch-note').value = s.note; document.getElementById('sch-remind-time').value = s.remindTime; editScheduleId = id; document.getElementById('schedule-form-title').innerText = "Edit Schedule"; document.getElementById('sch-submit-btn').innerText = "Update Schedule"; document.getElementById('sch-cancel-btn').classList.remove('hidden'); document.getElementById('schedule-form').scrollIntoView({ behavior: 'smooth' }); } }
function resetScheduleForm() { editScheduleId = null; document.getElementById('schedule-form').reset(); document.getElementById('schedule-form-title').innerText = "Set New Schedule"; document.getElementById('sch-submit-btn').innerText = "Set Schedule"; document.getElementById('sch-cancel-btn').classList.add('hidden'); }
function deleteItem(id, type) { let items = JSON.parse(localStorage.getItem(type + 's') || '[]'); items = items.filter(i => i.id != id); localStorage.setItem(type + 's', JSON.stringify(items)); type === 'reminder' ? loadReminders() : loadSchedules(); }
function updateStats(type) { const today = new Date().toLocaleDateString(); const stats = JSON.parse(localStorage.getItem('aivara_stats') || '{}'); if (!stats[today]) { stats[today] = { medicine: 0, schedule: 0 }; } if (type === 'Medicine') stats[today].medicine++; localStorage.setItem('aivara_stats', JSON.stringify(stats)); }
let weeklyChartInstance = null; let gaugeChartInstance = null;
function updateCharts() { const todayStr = new Date().toLocaleDateString(); const stats = JSON.parse(localStorage.getItem('aivara_stats') || '{}'); const reminders = JSON.parse(localStorage.getItem('reminders') || '[]'); const todayStats = stats[todayStr] || { medicine: 0 }; const takenToday = todayStats.medicine; const pendingCount = reminders.filter(r => r.status === 'pending').length; const totalDailyGoal = takenToday + pendingCount; const percentage = totalDailyGoal === 0 ? 0 : Math.round((takenToday / totalDailyGoal) * 100); const gaugeText = document.getElementById('gauge-text'); const emojiEl = document.getElementById('insight-emoji'); const textEl = document.getElementById('insight-text'); if(gaugeText) gaugeText.innerText = `${percentage}%`; let colorState = '#2563EB'; if(percentage >= 80) { if(emojiEl) emojiEl.innerText = "🤩"; if(textEl) textEl.innerText = "Excellent consistency! Keep it up."; colorState = '#10b981'; if(gaugeText) gaugeText.style.color = '#10b981'; } else if(percentage >= 50) { if(emojiEl) emojiEl.innerText = "🙂"; if(textEl) textEl.innerText = "Good job, but try not to miss any."; colorState = '#2563EB'; if(gaugeText) gaugeText.style.color = '#2563EB'; } else { if(emojiEl) emojiEl.innerText = "😟"; if(textEl) textEl.innerText = "You're missing doses. Let's get back on track!"; colorState = '#f59e0b'; if(gaugeText) gaugeText.style.color = '#f59e0b'; } const ctxGauge = document.getElementById('gaugeChart'); if(ctxGauge) { if(gaugeChartInstance) gaugeChartInstance.destroy(); gaugeChartInstance = new Chart(ctxGauge.getContext('2d'), { type: 'doughnut', data: { labels: ['Taken', 'Remaining'], datasets: [{ data: [percentage, 100 - percentage], backgroundColor: [colorState, '#f1f5f9'], borderWidth: 0, borderRadius: 20, cutout: '85%' }] }, options: { rotation: -90, circumference: 180, plugins: { legend: { display: false }, tooltip: { enabled: false } }, aspectRatio: 1.6 } }); } const ctxWeekly = document.getElementById('weeklyChart'); if(ctxWeekly) { if(weeklyChartInstance) weeklyChartInstance.destroy(); const last7DaysLabels = []; const last7DaysCounts = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const dateKey = d.toLocaleDateString(); const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }); last7DaysLabels.push(dayName); const dayStat = stats[dateKey] ? stats[dateKey].medicine : 0; last7DaysCounts.push(dayStat); } weeklyChartInstance = new Chart(ctxWeekly.getContext('2d'), { type: 'bar', data: { labels: last7DaysLabels, datasets: [{ label: 'Medicines Taken', data: last7DaysCounts, backgroundColor: '#2563EB', borderRadius: 6, barThickness: 20 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } } }); } }
function addToHistory(log) { const history = JSON.parse(localStorage.getItem('history') || '[]'); log.id = log.id || Date.now(); history.push(log); localStorage.setItem('history', JSON.stringify(history)); }
function loadHistory() { const history = JSON.parse(localStorage.getItem('history') || '[]'); const medsList = document.getElementById('history-meds-list'); const schList = document.getElementById('history-sch-list'); if(!medsList || !schList) return; medsList.innerHTML = ''; schList.innerHTML = ''; history.slice().reverse().forEach(h => { const li = document.createElement('li'); li.innerHTML = `<div><strong>${h.name}</strong><br><small>${h.time}</small></div><button onclick="deleteHistoryItem(${h.id})" class="btn-mini-trash"><i class="fas fa-trash"></i></button>`; if(h.type === 'Medicine') { medsList.appendChild(li); } else if (h.type === 'Schedule') { schList.appendChild(li); } }); }
function deleteHistoryItem(id) { let history = JSON.parse(localStorage.getItem('history') || '[]'); history = history.filter(h => h.id != id); localStorage.setItem('history', JSON.stringify(history)); loadHistory(); }
function clearHistory(type) { if(!confirm(`Clear all ${type} logs?`)) return; let history = JSON.parse(localStorage.getItem('history') || '[]'); history = history.filter(h => h.type !== type); localStorage.setItem('history', JSON.stringify(history)); loadHistory(); showToast(`${type} History Cleared`); }
