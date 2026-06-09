// ============================================================
// TRINITE CHAT — script.js (AMÉLIORÉ)
// Auth Supabase + 3 Profils + Contacts + Chat temps réel + Feed TikTok
// + Stories + Studio/Upload + Messages vocaux + Fixes loadMessages
// ============================================================

const SUPABASE_URL  = "https://eqttgyxjjupeisgozrut.supabase.co";
const SUPABASE_ANON = "sb_publishable_2tUX4eHP5MrKz_pekDY4aA_EiuZ99Wo";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// ÉTAT GLOBAL
// ============================================================
let currentUser     = null;
let userProfiles    = [];
let activeProfile   = null;
let activeIdx       = 0;
let currentContacts = [];
let chatContact     = null;
let chatMyProfile   = null;
let realtimeChannel = null;
let notifChannel    = null;
let unreadCount     = 0;

// Studio
let cameraStream    = null;
let studioFile      = null;   // File object sélectionné
let studioBlob      = null;   // Blob (photo capturée)
let studioFileName  = null;

// Message vocal
let mediaRecorder   = null;
let voiceChunks     = [];
let isRecording     = false;

// Stories déjà vues (session)
const seenStories   = new Set();

// ============================================================
// VIDÉOS DE DÉMONSTRATION (Feed TikTok)
// ============================================================
const DEMO_VIDEOS = [
  {
    id: "v1",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    author: "@trinitechat",
    desc: "Bienvenue sur Trinite Chat 🔥 Trois profils, une seule app !",
    likes: 3102,
    comments: 95,
    isDemo: true
  },
  {
    id: "v2",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    author: "@profil_pro",
    desc: "Gérez vos conversations pros séparément 💼 #pro #business",
    likes: 1284,
    comments: 48,
    isDemo: true
  },
  {
    id: "v3",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    author: "@anonyme_x",
    desc: "Mode anonyme activé 👻 Personne ne saura qui vous êtes #anonyme",
    likes: 873,
    comments: 22,
    isDemo: true
  },
  {
    id: "v4",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    author: "@prive_heart",
    desc: "Vos messages privés restent privés ❤️ #love #privé",
    likes: 642,
    comments: 17,
    isDemo: true
  }
];

let feedLiked      = {};
let feedLikeCounts = {};

// ============================================================
// UTILITAIRES
// ============================================================

function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className   = `toast ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = "toast hidden"; }, 3200);
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function initial(name) { return (name || "?").charAt(0).toUpperCase(); }

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function profileLabel(type) {
  return { pro: "Pro", prive: "Privé", anonyme: "Anonyme" }[type] || type;
}
function profileEmoji(type) {
  return { pro: "💼", prive: "❤️", anonyme: "👻" }[type] || "👤";
}

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
  return String(n);
}

// ============================================================
// BADGE NOTIFICATIONS MESSAGES
// ============================================================

function updateMsgBadge(count) {
  unreadCount = Math.max(0, count);
  const badge = document.getElementById("msg-badge");
  if (!badge) return;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function startNotifListener() {
  if (!currentUser || !userProfiles.length) return;
  if (notifChannel) { db.removeChannel(notifChannel); notifChannel = null; }

  const myProfileIds = userProfiles.map(p => p.id);

  notifChannel = db.channel("notif-badge-" + currentUser.id)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const msg = payload.new;
        const isForMe = myProfileIds.includes(msg.to_profile_id);
        const messagesActive = document.getElementById("screen-main")?.classList.contains("active");
        if (isForMe && !messagesActive) updateMsgBadge(unreadCount + 1);
      }
    )
    .subscribe();
}

// ============================================================
// AUTHENTIFICATION
// ============================================================

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    await afterLogin();
  } else {
    showScreen("screen-auth");
  }

  db.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      currentUser = session.user;
      await afterLogin();
    } else {
      currentUser   = null;
      userProfiles  = [];
      activeProfile = null;
      if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
      if (notifChannel)    { db.removeChannel(notifChannel);    notifChannel    = null; }
      showScreen("screen-auth");
    }
  });
}

async function afterLogin() {
  const { data, error } = await db.from("profiles")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  if (error) { toast("Erreur chargement profils : " + error.message, "error"); return; }

  if (!data || data.length === 0) {
    const rows = [
      { user_id: currentUser.id, profile_type: "pro",     name: "Pro" },
      { user_id: currentUser.id, profile_type: "prive",   name: "Privé" },
      { user_id: currentUser.id, profile_type: "anonyme", name: "Anonyme" }
    ];
    const { data: nd, error: ne } = await db.from("profiles").insert(rows).select();
    if (ne) { toast("Erreur création profils : " + ne.message, "error"); showScreen("screen-setup"); return; }
    userProfiles = nd || [];
    toast("Vos 3 profils ont été créés !", "success");
  } else {
    userProfiles = data;
  }

  await loadMainScreen();
}

// ============================================================
// FORMULAIRES D'AUTHENTIFICATION
// ============================================================

document.getElementById("form-login")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn      = e.target.querySelector("button[type=submit]");
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (btn) { btn.disabled = true; btn.textContent = "Connexion…"; }
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (btn) { btn.disabled = false; btn.textContent = "Se connecter"; }
  if (error) {
    toast(error.message.includes("Invalid") ? "Email ou mot de passe incorrect" : error.message, "error");
  }
});

document.getElementById("form-register")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn      = e.target.querySelector("button[type=submit]");
  const email    = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  if (password.length < 6) { toast("Mot de passe trop court (6 caractères min.)", "error"); return; }
  if (btn) { btn.disabled = true; btn.textContent = "Création…"; }
  const { error } = await db.auth.signUp({ email, password });
  if (btn) { btn.disabled = false; btn.textContent = "Créer mon compte"; }
  if (error) toast(error.message, "error");
  else toast("Compte créé ! Vérifiez votre email puis connectez-vous.", "success");
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.tab;
    document.getElementById("form-login")   ?.classList.toggle("hidden", which !== "login");
    document.getElementById("form-register")?.classList.toggle("hidden", which !== "register");
  });
});

// ============================================================
// SETUP PROFILS (formulaire manuel)
// ============================================================

document.getElementById("form-setup")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.textContent = "Création…"; }
  const rows = [
    { user_id: currentUser.id, profile_type: "pro",     name: document.getElementById("name-pro")?.value.trim()     || "Pro" },
    { user_id: currentUser.id, profile_type: "prive",   name: document.getElementById("name-prive")?.value.trim()   || "Privé" },
    { user_id: currentUser.id, profile_type: "anonyme", name: document.getElementById("name-anonyme")?.value.trim() || "Anonyme" }
  ];
  const { data, error } = await db.from("profiles").insert(rows).select();
  if (btn) { btn.disabled = false; btn.textContent = "Créer mes profils"; }
  if (error) { toast("Erreur : " + error.message, "error"); return; }
  userProfiles = data || [];
  toast("Vos 3 identités sont prêtes !", "success");
  await loadMainScreen();
});

// ============================================================
// DÉCONNEXION
// ============================================================

function handleLogout() {
  if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (notifChannel)    { db.removeChannel(notifChannel);    notifChannel    = null; }
  stopCamera();
  db.auth.signOut();
}
document.getElementById("btn-logout")       ?.addEventListener("click", handleLogout);
document.getElementById("btn-logout-profil")?.addEventListener("click", handleLogout);

// ============================================================
// ÉCRAN PRINCIPAL — CHARGEMENT
// ============================================================

async function loadMainScreen() {
  showScreen("screen-main");
  activeIdx     = 0;
  activeProfile = userProfiles[0];
  buildSwiper();
  updateHeaderProfile();
  buildStories();
  await loadContacts();
  await buildFeed();
  buildProfilScreen();
  wireBottomNav();
  startNotifListener();
  wireContactSearch();
}

// ============================================================
// SWIPER DE PROFILS
// ============================================================

function buildSwiper() {
  const slides = document.getElementById("profile-slides");
  const dots   = document.getElementById("swiper-dots");
  if (!slides || !dots) return;

  slides.innerHTML = "";
  dots.innerHTML   = "";

  userProfiles.forEach((p, i) => {
    const slide = document.createElement("div");
    slide.className = `profile-slide${i === 0 ? " active" : ""}`;
    slide.innerHTML = `
      <div class="slide-icon ${p.profile_type}">${profileEmoji(p.profile_type)}</div>
      <div class="slide-info">
        <span class="slide-name">${escapeHtml(p.name)}</span>
        <span class="slide-type">${profileLabel(p.profile_type)}</span>
      </div>`;
    slide.addEventListener("click", () => setActiveProfile(i));
    slides.appendChild(slide);

    const dot = document.createElement("span");
    dot.className = `dot${i === 0 ? " active" : ""}`;
    dot.addEventListener("click", () => setActiveProfile(i));
    dots.appendChild(dot);
  });

  const wrap = document.getElementById("profile-swiper-wrap");
  let startX = null;
  wrap?.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
  wrap?.addEventListener("touchend",   e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    startX = null;
    if (dx < -40 && activeIdx < userProfiles.length - 1) setActiveProfile(activeIdx + 1);
    if (dx >  40 && activeIdx > 0)                       setActiveProfile(activeIdx - 1);
  });
}

async function setActiveProfile(idx) {
  activeIdx     = idx;
  activeProfile = userProfiles[idx];

  document.querySelectorAll(".profile-slide").forEach((s, i) => s.classList.toggle("active", i === idx));
  document.querySelectorAll(".dot")          .forEach((d, i) => d.classList.toggle("active", i === idx));

  const wrap = document.getElementById("profile-slides");
  if (wrap && wrap.children[0]) {
    const itemW = wrap.children[0].offsetWidth + 12;
    wrap.style.transform = `translateX(-${idx * itemW}px)`;
  }

  updateHeaderProfile();
  await loadContacts();
  buildStories();
}

function updateHeaderProfile() {
  const el = document.getElementById("active-profile-name");
  if (el && activeProfile) el.textContent = activeProfile.name;
}

// ============================================================
// STORIES
// ============================================================

function buildStories() {
  const scroll = document.getElementById("stories-scroll");
  if (!scroll) return;
  scroll.innerHTML = "";

  // "Ma story" — bouton ajouter
  const addWrap = document.createElement("div");
  addWrap.className = "story-item";
  addWrap.innerHTML = `
    <div class="story-add-ring" title="Ajouter une story">
      <span style="font-size:1.4rem">${activeProfile ? profileEmoji(activeProfile.profile_type) : "👤"}</span>
      <span class="story-add-plus">+</span>
    </div>
    <span class="story-name">Ma story</span>`;
  addWrap.addEventListener("click", () => {
    toast("Stories : fonctionnalité bientôt disponible !", "info");
  });
  scroll.appendChild(addWrap);

  // Stories des contacts (simulées — une par contact)
  const STORY_EMOJIS = ["🔥", "💜", "✨", "👋", "🎵", "🌙", "💫", "🎉"];
  currentContacts.slice(0, 10).forEach((c, i) => {
    const seen = seenStories.has(c.id);
    const wrap = document.createElement("div");
    wrap.className = "story-item";
    wrap.innerHTML = `
      <div class="story-ring${seen ? " seen" : ""}">
        <div class="story-avatar">${escapeHtml(initial(c.contact_name))}</div>
      </div>
      <span class="story-name">${escapeHtml(c.contact_name.split(" ")[0])}</span>`;
    wrap.addEventListener("click", () => openStory(c, STORY_EMOJIS[i % STORY_EMOJIS.length]));
    scroll.appendChild(wrap);
  });
}

function openStory(contact, emoji) {
  seenStories.add(contact.id);

  const modal    = document.getElementById("modal-story");
  const avatarEl = document.getElementById("story-modal-avatar");
  const nameEl   = document.getElementById("story-modal-name");
  const bodyEl   = document.getElementById("story-modal-body");

  if (avatarEl) avatarEl.textContent = initial(contact.contact_name);
  if (nameEl)   nameEl.textContent   = contact.contact_name;
  if (bodyEl)   bodyEl.textContent   = emoji;

  modal?.classList.remove("hidden");

  // Marquer comme vu dans le DOM
  buildStories();

  // Auto-fermer après 4s
  clearTimeout(openStory._t);
  openStory._t = setTimeout(() => modal?.classList.add("hidden"), 4000);
}

document.getElementById("story-modal-close")?.addEventListener("click", () => {
  document.getElementById("modal-story")?.classList.add("hidden");
  clearTimeout(openStory._t);
});

document.getElementById("modal-story")?.addEventListener("click", e => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.add("hidden");
    clearTimeout(openStory._t);
  }
});

// ============================================================
// CONTACTS
// ============================================================

async function loadContacts() {
  if (!activeProfile) return;
  const { data, error } = await db.from("contacts")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("assigned_profile_id", activeProfile.id)
    .order("contact_name", { ascending: true });
  if (error) { toast("Erreur contacts : " + error.message, "error"); return; }
  currentContacts = data || [];
  renderContacts(currentContacts);
}

function renderContacts(list) {
  const el = document.getElementById("contact-list");
  if (!el) return;
  el.innerHTML = "";

  if (!list || list.length === 0) {
    el.innerHTML = '<li class="empty-state">Aucun contact pour ce profil</li>';
    return;
  }

  list.forEach(c => {
    const li = document.createElement("li");
    li.className = "contact-item";
    li.innerHTML = `
      <div class="contact-avatar">${escapeHtml(initial(c.contact_name))}</div>
      <div class="contact-info">
        <span class="contact-name-text">${escapeHtml(c.contact_name)}</span>
        <span class="contact-email-text">${escapeHtml(c.contact_email || "")}</span>
      </div>
      <span class="chevron">›</span>`;
    li.addEventListener("click", () => openChat(c, activeProfile));
    el.appendChild(li);
  });
}

// ============================================================
// RECHERCHE CONTACTS
// ============================================================

function wireContactSearch() {
  const input = document.getElementById("contact-search");
  if (!input) return;
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      renderContacts(currentContacts);
      return;
    }
    const filtered = currentContacts.filter(c =>
      c.contact_name.toLowerCase().includes(q) ||
      (c.contact_email || "").toLowerCase().includes(q)
    );
    renderContacts(filtered);
  });
}

// ============================================================
// MODAL AJOUTER UN CONTACT
// ============================================================

document.getElementById("btn-add-contact")?.addEventListener("click", () => {
  const sel = document.getElementById("contact-profile-select");
  if (sel) {
    sel.innerHTML = "";
    userProfiles.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${profileEmoji(p.profile_type)} ${profileLabel(p.profile_type)} — ${p.name}`;
      if (p.id === activeProfile?.id) opt.selected = true;
      sel.appendChild(opt);
    });
  }
  document.getElementById("modal-add-contact")?.classList.remove("hidden");
});

document.getElementById("modal-close")?.addEventListener("click", () => {
  document.getElementById("modal-add-contact")?.classList.add("hidden");
});

document.getElementById("modal-add-contact")?.addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

document.getElementById("form-add-contact")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn              = e.target.querySelector("button[type=submit]");
  const email            = document.getElementById("contact-email").value.trim();
  const name             = document.getElementById("contact-name").value.trim();
  const profileId        = document.getElementById("contact-profile-select").value;
  const contactProfileId = document.getElementById("contact-profile-id").value.trim() || null;

  if (!email || !name) { toast("Remplissez tous les champs", "error"); return; }
  if (btn) { btn.disabled = true; btn.textContent = "Ajout…"; }

  const { error } = await db.from("contacts").insert({
    user_id:             currentUser.id,
    contact_email:       email,
    contact_name:        name,
    assigned_profile_id: profileId,
    contact_profile_id:  contactProfileId   // ID Trinite du contact (pour les messages)
  });

  if (btn) { btn.disabled = false; btn.textContent = "Ajouter"; }
  if (error) { toast("Erreur : " + error.message, "error"); return; }

  toast("Contact ajouté !", "success");
  document.getElementById("modal-add-contact")?.classList.add("hidden");
  e.target.reset();

  if (profileId === activeProfile?.id) {
    await loadContacts();
    buildStories();
  }
});

// ============================================================
// ÉCRAN PROFIL — édition des noms + affichage ID
// ============================================================

function buildProfilScreen() {
  const container = document.getElementById("profil-cards");
  if (!container) return;
  container.innerHTML = "";

  userProfiles.forEach(p => {
    const card = document.createElement("div");
    card.className = "profil-card-edit";
    card.innerHTML = `
      <div class="profile-icon ${p.profile_type}">${profileEmoji(p.profile_type)}</div>
      <div class="field flex1">
        <label>${profileLabel(p.profile_type)}</label>
        <input type="text" data-pid="${p.id}" value="${escapeHtml(p.name)}" placeholder="${profileLabel(p.profile_type)}" />
      </div>`;
    container.appendChild(card);
  });

  // Afficher l'ID du premier profil pour le partage
  const idSection = document.getElementById("profil-id-section");
  const idText    = document.getElementById("profil-id-text");
  if (idSection && idText && userProfiles.length > 0) {
    idSection.style.display = "";
    idText.textContent = userProfiles[0].id;
  }
}

document.getElementById("btn-copy-id")?.addEventListener("click", () => {
  const idText = document.getElementById("profil-id-text")?.textContent;
  if (!idText || idText === "—") return;
  navigator.clipboard?.writeText(idText)
    .then(() => toast("ID copié !", "success"))
    .catch(() => toast("Impossible de copier", "error"));
});

document.getElementById("form-profil")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.textContent = "Enregistrement…"; }

  const inputs = e.target.querySelectorAll("input[data-pid]");
  for (const input of inputs) {
    const pid  = input.dataset.pid;
    const name = input.value.trim();
    if (!name) continue;
    const { error } = await db.from("profiles").update({ name }).eq("id", pid);
    if (error) { toast("Erreur mise à jour : " + error.message, "error"); break; }
    const p = userProfiles.find(x => x.id === pid);
    if (p) p.name = name;
  }

  if (btn) { btn.disabled = false; btn.textContent = "Enregistrer"; }
  toast("Profils mis à jour !", "success");
  buildSwiper();
  updateHeaderProfile();
});

// ============================================================
// NAVIGATION BASSE
// ============================================================

function wireBottomNav() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.screen;
      if (!target) return;

      if (target === "screen-main") updateMsgBadge(0);

      // Arrêter la caméra si on quitte le studio
      const studioActive = document.getElementById("screen-studio")?.classList.contains("active");
      if (studioActive && target !== "screen-studio") stopCamera();

      showScreen(target);

      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(`[data-screen="${target}"]`).forEach(b => b.classList.add("active"));

      if (target === "screen-feed") {
        playCurrentFeedVideo();
      } else {
        pauseAllFeedVideos();
      }
    });
  });
}

// ============================================================
// CHAT TEMPS RÉEL
// ============================================================

function openChat(contact, myProfile) {
  chatContact   = contact;
  chatMyProfile = myProfile;

  const nameEl  = document.getElementById("chat-contact-name");
  const badgeEl = document.getElementById("chat-profile-badge");
  if (nameEl)  nameEl.textContent  = contact.contact_name;
  if (badgeEl) badgeEl.textContent = `${profileEmoji(myProfile.profile_type)} ${myProfile.name}`;

  showScreen("screen-chat");
  loadMessages();
  subscribeToMessages();
}

// ============================================================
// FIX PRINCIPAL : loadMessages() — utilise to_profile_id, pas contact_email
// ============================================================

async function loadMessages() {
  if (!chatContact || !chatMyProfile) return;
  const container = document.getElementById("messages-container");
  if (!container) return;

  container.innerHTML = "";

  const myId      = chatMyProfile.id;
  const contactPid = chatContact.contact_profile_id || null;

  let query;

  if (contactPid) {
    // Cas idéal : on connaît le profil_id du contact
    query = db.from("messages")
      .select("*")
      .or(
        `and(from_profile_id.eq.${myId},to_profile_id.eq.${contactPid}),` +
        `and(from_profile_id.eq.${contactPid},to_profile_id.eq.${myId})`
      )
      .order("created_at", { ascending: true })
      .limit(50);
  } else {
    // Fallback : charger les 50 derniers messages envoyés depuis ce profil
    query = db.from("messages")
      .select("*")
      .eq("from_profile_id", myId)
      .order("created_at", { ascending: true })
      .limit(50);
  }

  const { data, error } = await query;
  if (error) { toast("Erreur messages : " + error.message, "error"); return; }

  (data || []).forEach(msg => appendBubble(msg, myId));
  container.scrollTop = container.scrollHeight;

  // Afficher un message si le contact n'a pas d'ID Trinite
  if (!contactPid) {
    const hint = document.createElement("div");
    hint.style.cssText = "text-align:center;font-size:0.75rem;color:var(--text-muted);padding:0.5rem 1rem;";
    hint.textContent = "ℹ️ Ajoutez l'ID Trinite du contact pour voir les messages reçus.";
    container.insertBefore(hint, container.firstChild);
  }
}

function appendBubble(msg, myProfileId) {
  const container = document.getElementById("messages-container");
  if (!container) return;

  const isSent = msg.from_profile_id === myProfileId;
  const div    = document.createElement("div");
  div.className = `bubble ${isSent ? "sent" : "received"}`;

  if (msg.content_type === "voice") {
    div.innerHTML = `
      <div class="bubble-voice">
        <i class="fa-solid fa-microphone"></i>
        <div class="bubble-voice-wave">
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div class="bubble-voice-text">${escapeHtml(msg.content || "Message vocal")}</div>
      <div class="bubble-time">${formatTime(msg.created_at)}</div>`;
  } else {
    div.innerHTML = `
      ${escapeHtml(msg.content)}
      <div class="bubble-time">${formatTime(msg.created_at)}</div>`;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function subscribeToMessages() {
  if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }

  const myId       = chatMyProfile.id;
  const contactPid = chatContact.contact_profile_id || null;
  const channelName = `chat-${myId}-${chatContact.id}`;

  realtimeChannel = db.channel(channelName)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const msg = payload.new;
        let relevant = false;

        if (contactPid) {
          relevant =
            (msg.from_profile_id === myId       && msg.to_profile_id === contactPid) ||
            (msg.from_profile_id === contactPid  && msg.to_profile_id === myId);
        } else {
          relevant = msg.from_profile_id === myId;
        }

        if (relevant) appendBubble(msg, myId);
      }
    )
    .subscribe();
}

// Envoyer un message texte
document.getElementById("btn-send")?.addEventListener("click", sendMessage);
document.getElementById("message-input")?.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

async function sendMessage() {
  const input   = document.getElementById("message-input");
  const content = input?.value.trim();
  if (!content || !chatContact || !chatMyProfile) return;
  input.value = "";

  const contactPid = chatContact.contact_profile_id || null;

  const { error } = await db.from("messages").insert({
    from_profile_id: chatMyProfile.id,
    to_profile_id:   contactPid,
    content,
    content_type:    "text"
  });

  if (error) toast("Erreur envoi : " + error.message, "error");
}

document.getElementById("btn-back")?.addEventListener("click", () => {
  if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
  showScreen("screen-main");
  document.querySelectorAll(".nav-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.screen === "screen-main")
  );
});

// ============================================================
// MESSAGE VOCAL
// ============================================================

document.getElementById("btn-voice")?.addEventListener("click", toggleVoiceRecording);

async function toggleVoiceRecording() {
  const btn = document.getElementById("btn-voice");
  if (!btn) return;

  if (isRecording) {
    // Arrêter l'enregistrement
    mediaRecorder?.stop();
    return;
  }

  // Démarrer l'enregistrement
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks  = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) voiceChunks.push(e.data); };

    mediaRecorder.onstop = async () => {
      isRecording = false;
      btn.classList.remove("recording");
      btn.title = "Message vocal";

      // Arrêter le stream micro
      stream.getTracks().forEach(t => t.stop());

      if (voiceChunks.length === 0 || !chatContact || !chatMyProfile) return;

      const durationSec = Math.max(1, Math.round(voiceChunks.length / 3));
      const transcript  = `🎤 Message vocal (${durationSec}s)`;

      const contactPid = chatContact.contact_profile_id || null;
      const { error } = await db.from("messages").insert({
        from_profile_id: chatMyProfile.id,
        to_profile_id:   contactPid,
        content:         transcript,
        content_type:    "voice"
      });

      if (error) toast("Erreur envoi vocal : " + error.message, "error");
    };

    mediaRecorder.start(200);
    isRecording = true;
    btn.classList.add("recording");
    btn.title = "Arrêter l'enregistrement";
    toast("Enregistrement en cours… Tapez à nouveau pour arrêter.", "info");

    // Arrêt automatique après 60s
    setTimeout(() => {
      if (isRecording) mediaRecorder?.stop();
    }, 60000);

  } catch (err) {
    toast("Impossible d'accéder au micro : " + err.message, "error");
  }
}

// ============================================================
// FEED TIKTOK — Construction avec vidéos uploadées
// ============================================================

async function buildFeed() {
  const container = document.getElementById("feed-container");
  if (!container) return;
  container.innerHTML = "";

  // Charger les vidéos uploadées depuis Supabase Storage
  let uploadedVideos = [];
  try {
    const { data: files, error } = await db.storage.from("videos").list("", {
      limit: 20,
      sortBy: { column: "created_at", order: "desc" }
    });
    if (!error && files) {
      uploadedVideos = files
        .filter(f => f.name && !f.name.startsWith("."))
        .map(f => {
          const { data: { publicUrl } } = db.storage.from("videos").getPublicUrl(f.name);
          return {
            id:       "upload-" + f.id,
            url:      publicUrl,
            author:   "@" + (f.metadata?.uploader || "utilisateur"),
            desc:     f.metadata?.description || "Vidéo publiée sur Trinite Chat",
            likes:    Math.floor(Math.random() * 500),
            comments: Math.floor(Math.random() * 50),
            isDemo:   false
          };
        });
    }
  } catch (_) {
    // Bucket peut ne pas exister encore — on continue avec les démos
  }

  // Mélanger démos + uploads (uploads en premier)
  const allVideos = [...uploadedVideos, ...DEMO_VIDEOS];

  allVideos.forEach(v => {
    if (feedLikeCounts[v.id] === undefined) feedLikeCounts[v.id] = v.likes;
    if (feedLiked[v.id]      === undefined) feedLiked[v.id]      = false;
  });

  allVideos.forEach((v, index) => {
    const item = document.createElement("div");
    item.className = "feed-item";
    item.dataset.vid = v.id;

    item.innerHTML = `
      <video
        class="feed-video"
        src="${escapeHtml(v.url)}"
        loop
        playsinline
        preload="metadata"
      ></video>
      ${!v.isDemo ? '<div class="feed-uploaded-badge">✦ Votre vidéo</div>' : ""}
      <div class="feed-item-gradient"></div>
      <div class="feed-item-info">
        <div class="feed-author">${escapeHtml(v.author)}</div>
        <div class="feed-desc">${escapeHtml(v.desc)}</div>
      </div>
      <div class="feed-actions">
        <button class="feed-action-btn btn-like${feedLiked[v.id] ? " liked" : ""}" data-vid="${v.id}" aria-label="J'aime">
          <i class="fa-${feedLiked[v.id] ? "solid" : "regular"} fa-heart"></i>
          <span class="feed-action-label">${formatCount(feedLikeCounts[v.id])}</span>
        </button>
        <button class="feed-action-btn btn-comment" aria-label="Commenter">
          <i class="fa-regular fa-comment"></i>
          <span class="feed-action-label">${formatCount(v.comments)}</span>
        </button>
        <button class="feed-action-btn btn-share" aria-label="Partager">
          <i class="fa-solid fa-share"></i>
          <span class="feed-action-label">Partager</span>
        </button>
      </div>`;

    wireFeedItem(item, v, index);
    container.appendChild(item);
  });

  initFeedObserver();
}

// ============================================================
// FEED TIKTOK — Interactions
// ============================================================

function wireFeedItem(item, video, index) {
  const videoEl = item.querySelector(".feed-video");

  let lastTap = 0;
  item.addEventListener("touchend", e => {
    const now = Date.now();
    if (now - lastTap < 280) { e.preventDefault(); toggleLike(video.id, item); }
    lastTap = now;
  });

  item.addEventListener("dblclick", () => toggleLike(video.id, item));

  let tapTimer = null;
  item.addEventListener("touchend", e => {
    if (tapTimer) clearTimeout(tapTimer);
    if (e.target.closest(".feed-actions")) return;
    tapTimer = setTimeout(() => {
      if (videoEl.paused) videoEl.play().catch(() => {});
      else                videoEl.pause();
    }, 200);
  });

  item.querySelector(".btn-like")?.addEventListener("click", e => {
    e.stopPropagation();
    toggleLike(video.id, item);
  });

  item.querySelector(".btn-comment")?.addEventListener("click", e => {
    e.stopPropagation();
    openChatFromFeed();
  });

  item.querySelector(".btn-share")?.addEventListener("click", e => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({ title: "Trinite Chat", text: video.desc, url: location.href });
    } else {
      toast("Lien copié !", "success");
    }
  });

  let touchStartX = null;
  let touchStartY = null;
  item.addEventListener("touchstart", e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  item.addEventListener("touchend", e => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    touchStartX = null;
    if (dx > 60 && dy < 60) openChatFromFeed(item);
  });
}

function toggleLike(videoId, item) {
  const wasLiked = feedLiked[videoId];
  feedLiked[videoId] = !wasLiked;
  if (!wasLiked) { feedLikeCounts[videoId]++; showHeartAnimation(item); }
  else           { feedLikeCounts[videoId]--; }

  const btn  = item.querySelector(".btn-like");
  const icon = btn?.querySelector("i");
  const lbl  = btn?.querySelector(".feed-action-label");
  if (btn) {
    btn.classList.toggle("liked", feedLiked[videoId]);
    if (icon) icon.className = `fa-${feedLiked[videoId] ? "solid" : "regular"} fa-heart`;
    if (lbl)  lbl.textContent = formatCount(feedLikeCounts[videoId]);
  }
}

function showHeartAnimation(item) {
  const heart = document.createElement("div");
  heart.className = "heart-anim";
  heart.textContent = "❤️";
  item.appendChild(heart);
  setTimeout(() => heart.remove(), 750);
}

function openChatFromFeed(item) {
  if (!activeProfile) { toast("Connectez-vous d'abord", "error"); return; }

  if (item) {
    const hint = document.createElement("div");
    hint.className = "swipe-hint";
    hint.textContent = "💬 Ouverture du chat…";
    item.appendChild(hint);
    setTimeout(() => hint.remove(), 900);
  }

  setTimeout(() => {
    showScreen("screen-main");
    document.querySelectorAll(".nav-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.screen === "screen-main")
    );
    pauseAllFeedVideos();
    if (currentContacts.length > 0) openChat(currentContacts[0], activeProfile);
    else toast("Ajoutez un contact pour discuter !", "info");
  }, 400);
}

// ============================================================
// FEED TIKTOK — Autoplay via IntersectionObserver
// ============================================================

let feedObserver = null;

function initFeedObserver() {
  if (feedObserver) feedObserver.disconnect();

  const options = {
    root:      document.getElementById("feed-container"),
    threshold: 0.6
  };

  feedObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const videoEl = entry.target.querySelector(".feed-video");
      if (!videoEl) return;
      if (entry.isIntersecting) {
        document.querySelectorAll(".feed-video").forEach(v => { if (v !== videoEl && !v.paused) v.pause(); });
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
      }
    });
  }, options);

  document.querySelectorAll(".feed-item").forEach(item => feedObserver.observe(item));
}

function playCurrentFeedVideo() {
  const container = document.getElementById("feed-container");
  if (!container) return;
  const items     = Array.from(document.querySelectorAll(".feed-item"));
  const scrollTop = container.scrollTop;
  const h         = container.clientHeight;
  let bestItem = null, bestOverlap = -1;
  items.forEach(item => {
    const top    = item.offsetTop - scrollTop;
    const bottom = top + item.offsetHeight;
    const overlap = Math.min(bottom, h) - Math.max(top, 0);
    if (overlap > bestOverlap) { bestOverlap = overlap; bestItem = item; }
  });
  if (bestItem) {
    const v = bestItem.querySelector(".feed-video");
    if (v && v.paused) v.play().catch(() => {});
  }
}

function pauseAllFeedVideos() {
  document.querySelectorAll(".feed-video").forEach(v => { if (!v.paused) v.pause(); });
}

// ============================================================
// STUDIO — Caméra + Photo + Upload Supabase Storage
// ============================================================

const btnCameraStart = document.getElementById("btn-camera-start");
const btnCameraStop  = document.getElementById("btn-camera-stop");
const btnTakePhoto   = document.getElementById("btn-take-photo");
const fileInput      = document.getElementById("studio-file-input");
const btnUpload      = document.getElementById("btn-studio-upload");
const cameraPreview  = document.getElementById("studio-camera-preview");
const videoPreview   = document.getElementById("studio-video-preview");
const photoPreview   = document.getElementById("studio-photo-preview");
const placeholder    = document.getElementById("studio-placeholder");
const uploadSection  = document.getElementById("studio-upload-section");
const fileInfoEl     = document.getElementById("studio-file-info");
const canvas         = document.getElementById("studio-canvas");

// Démarrer la caméra
btnCameraStart?.addEventListener("click", async () => {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    cameraPreview.srcObject = cameraStream;
    cameraPreview.classList.remove("hidden");
    videoPreview.classList.add("hidden");
    photoPreview.classList.add("hidden");
    placeholder?.classList.add("hidden");
    btnCameraStart.classList.add("hidden");
    btnCameraStop.classList.remove("hidden");
    btnTakePhoto.classList.remove("hidden");
    if (uploadSection) uploadSection.style.display = "none";
    studioFile = null; studioBlob = null;
  } catch (err) {
    toast("Caméra inaccessible : " + err.message, "error");
  }
});

// Arrêter la caméra
btnCameraStop?.addEventListener("click", stopCamera);

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  if (cameraPreview) {
    cameraPreview.srcObject = null;
    cameraPreview.classList.add("hidden");
  }
  btnCameraStart?.classList.remove("hidden");
  btnCameraStop ?.classList.add("hidden");
  btnTakePhoto  ?.classList.add("hidden");
}

// Prendre une photo
btnTakePhoto?.addEventListener("click", () => {
  if (!cameraStream || !canvas) return;
  const vw = cameraPreview.videoWidth  || 640;
  const vh = cameraPreview.videoHeight || 480;
  canvas.width  = vw;
  canvas.height = vh;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraPreview, 0, 0, vw, vh);

  canvas.toBlob(blob => {
    if (!blob) return;
    studioBlob     = blob;
    studioFileName = `photo_${Date.now()}.jpg`;
    const url = URL.createObjectURL(blob);
    photoPreview.src = url;
    photoPreview.classList.remove("hidden");
    videoPreview.classList.add("hidden");
    placeholder?.classList.add("hidden");

    stopCamera();
    showUploadSection(`📷 Photo — ${(blob.size / 1024).toFixed(0)} Ko`);
  }, "image/jpeg", 0.88);
});

// Sélectionner un fichier depuis la galerie
fileInput?.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;
  studioFile     = file;
  studioBlob     = null;
  studioFileName = file.name;

  const url = URL.createObjectURL(file);

  if (file.type.startsWith("video/")) {
    videoPreview.src = url;
    videoPreview.classList.remove("hidden");
    photoPreview.classList.add("hidden");
  } else {
    photoPreview.src = url;
    photoPreview.classList.remove("hidden");
    videoPreview.classList.add("hidden");
  }
  cameraPreview.classList.add("hidden");
  placeholder?.classList.add("hidden");
  stopCamera();

  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  showUploadSection(`📁 ${file.name} — ${sizeMb} Mo`);
  e.target.value = "";
});

function showUploadSection(info) {
  if (fileInfoEl) fileInfoEl.textContent = info;
  if (uploadSection) uploadSection.style.display = "";
}

// Upload vers Supabase Storage
btnUpload?.addEventListener("click", async () => {
  const desc    = document.getElementById("studio-desc")?.value.trim() || "Vidéo Trinite Chat";
  const fileObj = studioBlob
    ? new File([studioBlob], studioFileName, { type: "image/jpeg" })
    : studioFile;

  if (!fileObj) { toast("Aucun fichier à publier", "error"); return; }
  if (!currentUser) { toast("Connectez-vous d'abord", "error"); return; }

  const progressWrap = document.getElementById("studio-upload-progress");
  const progressBar  = document.getElementById("studio-progress-bar");
  btnUpload.disabled = true;
  btnUpload.textContent = "Publication…";
  progressWrap?.classList.remove("hidden");
  if (progressBar) progressBar.style.width = "10%";

  const ext       = studioFileName.split(".").pop() || "mp4";
  const path      = `${currentUser.id}/${Date.now()}.${ext}`;

  // Supabase Storage ne supporte pas le suivi de progression via JS SDK —
  // on simule une barre de progression
  const progInterval = setInterval(() => {
    const cur = parseFloat(progressBar?.style.width || "10");
    if (cur < 85 && progressBar) progressBar.style.width = (cur + 5) + "%";
  }, 300);

  const { error } = await db.storage.from("videos").upload(path, fileObj, {
    cacheControl: "3600",
    upsert:       false,
    metadata:     { uploader: activeProfile?.name || "user", description: desc }
  });

  clearInterval(progInterval);
  btnUpload.disabled = false;
  btnUpload.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publier dans le Feed';
  progressWrap?.classList.add("hidden");
  if (progressBar) progressBar.style.width = "0%";

  if (error) {
    toast("Erreur upload : " + error.message, "error");
    return;
  }

  if (progressBar) progressBar.style.width = "100%";
  toast("Publié dans le Feed ✓", "success");

  // Réinitialiser le studio
  studioFile = null; studioBlob = null; studioFileName = null;
  if (videoPreview) { videoPreview.src = ""; videoPreview.classList.add("hidden"); }
  if (photoPreview) { photoPreview.src = ""; photoPreview.classList.add("hidden"); }
  placeholder?.classList.remove("hidden");
  if (uploadSection) uploadSection.style.display = "none";
  if (document.getElementById("studio-desc")) document.getElementById("studio-desc").value = "";

  // Recharger le feed pour inclure la nouvelle vidéo
  await buildFeed();
});

// ============================================================
// DÉMARRAGE
// ============================================================
initAuth();
