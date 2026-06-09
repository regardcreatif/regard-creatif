// ============================================================
// TRINITE CHAT — script.js
// Auth Supabase + 3 Profils + Contacts + Chat temps réel + Feed TikTok
// ============================================================

const SUPABASE_URL  = "https://eqttgyxjjupeisgozrut.supabase.co";
const SUPABASE_ANON = "sb_publishable_2tUX4eHP5MrKz_pekDY4aA_EiuZ99Wo";

// Initialisation du client Supabase
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// ÉTAT GLOBAL
// ============================================================
let currentUser     = null;   // Utilisateur Supabase connecté
let userProfiles    = [];     // 3 profils (pro, privé, anonyme)
let activeProfile   = null;   // Profil actuellement sélectionné
let activeIdx       = 0;      // Index du profil actif
let currentContacts = [];     // Contacts du profil actif
let chatContact     = null;   // Contact ouvert dans le chat
let chatMyProfile   = null;   // Profil utilisé pour le chat
let realtimeChannel = null;   // Canal Supabase temps réel (chat)
let notifChannel    = null;   // Canal Supabase (notifications badge)
let unreadCount     = 0;      // Compteur messages non lus

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
    comments: 95
  },
  {
    id: "v2",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    author: "@profil_pro",
    desc: "Gérez vos conversations pros séparément 💼 #pro #business",
    likes: 1284,
    comments: 48
  },
  {
    id: "v3",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    author: "@anonyme_x",
    desc: "Mode anonyme activé 👻 Personne ne saura qui vous êtes #anonyme",
    likes: 873,
    comments: 22
  },
  {
    id: "v4",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    author: "@prive_heart",
    desc: "Vos messages privés restent privés ❤️ #love #privé",
    likes: 642,
    comments: 17
  }
];

// États du feed
let feedLiked      = {};  // { videoId: true/false }
let feedLikeCounts = {};  // { videoId: nombre }

// ============================================================
// UTILITAIRES
// ============================================================

// Affiche un toast temporaire en bas de l'écran
function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className   = `toast ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = "toast hidden"; }, 3200);
}

// Formate une date ISO en heure HH:MM
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Affiche un écran et masque les autres
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

// Initiale d'un nom (pour l'avatar)
function initial(name) { return (name || "?").charAt(0).toUpperCase(); }

// Échappe les caractères HTML dangereux
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Labels et emojis par type de profil
function profileLabel(type) {
  return { pro: "Pro", prive: "Privé", anonyme: "Anonyme" }[type] || type;
}
function profileEmoji(type) {
  return { pro: "💼", prive: "❤️", anonyme: "👻" }[type] || "👤";
}

// Formate un nombre (ex: 1284 → 1,2k)
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

// Écoute les nouveaux messages entrants pour le badge
function startNotifListener() {
  if (!currentUser || !userProfiles.length) return;
  if (notifChannel) { db.removeChannel(notifChannel); notifChannel = null; }

  const myProfileIds = userProfiles.map(p => p.id);

  notifChannel = db.channel("notif-badge")
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const msg = payload.new;
        // Ce message m'est destiné si to_profile_id est l'un de mes profils
        const isForMe = myProfileIds.includes(msg.to_profile_id);
        // On ne compte que si l'écran Messages n'est pas actif
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
  // Vérifier si une session existe déjà
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    await afterLogin();
  } else {
    showScreen("screen-auth");
  }

  // Écouter les changements d'état d'authentification
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

// Appelé après une connexion réussie
async function afterLogin() {
  const { data, error } = await db.from("profiles")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  if (error) { toast("Erreur chargement profils : " + error.message, "error"); return; }

  if (!data || data.length === 0) {
    // Aucun profil → créer 3 profils par défaut
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

// Connexion
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

// Inscription
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

// Basculer entre les onglets Connexion / Inscription
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
  await loadContacts();
  buildFeed();
  buildProfilScreen();
  wireBottomNav();
  startNotifListener();
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
    // Créer une slide par profil
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

    // Créer un point de navigation
    const dot = document.createElement("span");
    dot.className = `dot${i === 0 ? " active" : ""}`;
    dot.addEventListener("click", () => setActiveProfile(i));
    dots.appendChild(dot);
  });

  // Swipe horizontal pour changer de profil
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

  // Mettre à jour l'apparence des slides et des dots
  document.querySelectorAll(".profile-slide").forEach((s, i) => s.classList.toggle("active", i === idx));
  document.querySelectorAll(".dot")          .forEach((d, i) => d.classList.toggle("active", i === idx));

  // Déplacer le slider visuellement
  const wrap   = document.getElementById("profile-slides");
  if (wrap && wrap.children[0]) {
    const itemW  = wrap.children[0].offsetWidth + 12;
    wrap.style.transform = `translateX(-${idx * itemW}px)`;
  }

  updateHeaderProfile();
  await loadContacts();
}

function updateHeaderProfile() {
  const el = document.getElementById("active-profile-name");
  if (el && activeProfile) el.textContent = activeProfile.name;
}

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
  renderContacts();
}

function renderContacts() {
  const list = document.getElementById("contact-list");
  if (!list) return;
  list.innerHTML = "";

  if (currentContacts.length === 0) {
    list.innerHTML = '<li class="empty-state">Aucun contact pour ce profil</li>';
    return;
  }

  currentContacts.forEach(c => {
    const li = document.createElement("li");
    li.className = "contact-item";
    li.innerHTML = `
      <div class="contact-avatar">${escapeHtml(initial(c.contact_name))}</div>
      <div class="contact-info">
        <span class="contact-name-text">${escapeHtml(c.contact_name)}</span>
        <span class="contact-email-text">${escapeHtml(c.contact_email)}</span>
      </div>
      <span class="chevron">›</span>`;
    li.addEventListener("click", () => openChat(c, activeProfile));
    list.appendChild(li);
  });
}

// ============================================================
// MODAL AJOUTER UN CONTACT
// ============================================================

document.getElementById("btn-add-contact")?.addEventListener("click", () => {
  // Remplir le sélecteur de profil
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

// Fermer la modal en cliquant sur l'overlay
document.getElementById("modal-add-contact")?.addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

// Soumettre le formulaire d'ajout de contact
document.getElementById("form-add-contact")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn         = e.target.querySelector("button[type=submit]");
  const email       = document.getElementById("contact-email").value.trim();
  const name        = document.getElementById("contact-name").value.trim();
  const profileId   = document.getElementById("contact-profile-select").value;

  if (!email || !name) { toast("Remplissez tous les champs", "error"); return; }
  if (btn) { btn.disabled = true; btn.textContent = "Ajout…"; }

  // Trouver l'ID utilisateur du contact par son email
  const { data: targetUsers, error: ue } = await db
    .from("profiles")
    .select("user_id")
    .limit(1);

  // Insérer le contact directement (sans vérification d'email côté client)
  const { error } = await db.from("contacts").insert({
    user_id:             currentUser.id,
    contact_email:       email,
    contact_name:        name,
    assigned_profile_id: profileId
  });

  if (btn) { btn.disabled = false; btn.textContent = "Ajouter"; }
  if (error) { toast("Erreur : " + error.message, "error"); return; }

  toast("Contact ajouté !", "success");
  document.getElementById("modal-add-contact")?.classList.add("hidden");
  e.target.reset();

  // Recharger les contacts si le profil correspond
  if (profileId === activeProfile?.id) await loadContacts();
});

// ============================================================
// ÉCRAN PROFIL — édition des noms
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
}

// Enregistrer les modifications de noms
document.getElementById("form-profil")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.textContent = "Enregistrement…"; }

  const inputs = e.target.querySelectorAll("input[data-pid]");
  const updates = [];

  inputs.forEach(input => {
    const pid  = input.dataset.pid;
    const name = input.value.trim();
    if (name) updates.push({ id: pid, name });
  });

  // Mettre à jour chaque profil
  for (const u of updates) {
    const { error } = await db.from("profiles").update({ name: u.name }).eq("id", u.id);
    if (error) { toast("Erreur mise à jour : " + error.message, "error"); break; }
    // Mettre à jour le cache local
    const p = userProfiles.find(x => x.id === u.id);
    if (p) p.name = u.name;
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

      // Réinitialiser le badge quand on ouvre Messages
      if (target === "screen-main") updateMsgBadge(0);

      showScreen(target);

      // Mettre à jour le bouton actif dans toutes les barres de nav
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(`[data-screen="${target}"]`).forEach(b => b.classList.add("active"));

      // Actions spécifiques à l'écran
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

  // Remplir l'en-tête du chat
  const nameEl  = document.getElementById("chat-contact-name");
  const badgeEl = document.getElementById("chat-profile-badge");
  if (nameEl)  nameEl.textContent  = contact.contact_name;
  if (badgeEl) badgeEl.textContent = `${profileEmoji(myProfile.profile_type)} ${myProfile.name}`;

  showScreen("screen-chat");
  loadMessages();
  subscribeToMessages();
}

async function loadMessages() {
  if (!chatContact || !chatMyProfile) return;
  const container = document.getElementById("messages-container");
  if (!container) return;

  // Charger les messages échangés entre ce profil et ce contact
  const { data, error } = await db.from("messages")
    .select("*")
    .or(`and(from_profile_id.eq.${chatMyProfile.id},contact_email.eq.${chatContact.contact_email}),and(to_profile_id.eq.${chatMyProfile.id},contact_email.eq.${chatContact.contact_email})`)
    .order("created_at", { ascending: true });

  if (error) { toast("Erreur messages : " + error.message, "error"); return; }

  container.innerHTML = "";
  (data || []).forEach(msg => appendBubble(msg, chatMyProfile.id));
  container.scrollTop = container.scrollHeight;
}

function appendBubble(msg, myProfileId) {
  const container = document.getElementById("messages-container");
  if (!container) return;

  const isSent = msg.from_profile_id === myProfileId;
  const div    = document.createElement("div");
  div.className = `bubble ${isSent ? "sent" : "received"}`;
  div.innerHTML = `
    ${escapeHtml(msg.content)}
    <div class="bubble-time">${formatTime(msg.created_at)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function subscribeToMessages() {
  // Désabonner le canal précédent si existant
  if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }

  realtimeChannel = db.channel("chat-" + chatMyProfile.id + "-" + chatContact.contact_email)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const msg = payload.new;
        // Afficher uniquement les messages de cette conversation
        const relevant =
          (msg.from_profile_id === chatMyProfile.id && msg.contact_email === chatContact.contact_email) ||
          (msg.to_profile_id   === chatMyProfile.id && msg.contact_email === chatContact.contact_email);
        if (relevant) appendBubble(msg, chatMyProfile.id);
      }
    )
    .subscribe();
}

// Envoyer un message
document.getElementById("btn-send")?.addEventListener("click", sendMessage);
document.getElementById("message-input")?.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

async function sendMessage() {
  const input   = document.getElementById("message-input");
  const content = input?.value.trim();
  if (!content || !chatContact || !chatMyProfile) return;
  input.value = "";

  const { error } = await db.from("messages").insert({
    from_profile_id: chatMyProfile.id,
    to_profile_id:   null,               // null = message à un contact externe
    contact_email:   chatContact.contact_email,
    content
  });

  if (error) toast("Erreur envoi : " + error.message, "error");
}

// Bouton retour depuis le chat
document.getElementById("btn-back")?.addEventListener("click", () => {
  if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
  showScreen("screen-main");
  document.querySelectorAll(".nav-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.screen === "screen-main")
  );
});

// ============================================================
// FEED TIKTOK — Construction
// ============================================================

function buildFeed() {
  const container = document.getElementById("feed-container");
  if (!container) return;
  container.innerHTML = "";

  // Initialiser les compteurs de likes
  DEMO_VIDEOS.forEach(v => {
    if (feedLikeCounts[v.id] === undefined) feedLikeCounts[v.id] = v.likes;
    if (feedLiked[v.id]      === undefined) feedLiked[v.id]      = false;
  });

  DEMO_VIDEOS.forEach((v, index) => {
    const item = document.createElement("div");
    item.className = "feed-item";
    item.dataset.vid = v.id;

    item.innerHTML = `
      <!-- Vidéo plein écran -->
      <video
        class="feed-video"
        src="${v.url}"
        loop
        playsinline
        preload="metadata"
        muted
      ></video>

      <!-- Dégradé sombre en bas -->
      <div class="feed-item-gradient"></div>

      <!-- Infos auteur / description -->
      <div class="feed-item-info">
        <div class="feed-author">${escapeHtml(v.author)}</div>
        <div class="feed-desc">${escapeHtml(v.desc)}</div>
      </div>

      <!-- Boutons d'action droite -->
      <div class="feed-actions">
        <!-- Like -->
        <button class="feed-action-btn btn-like${feedLiked[v.id] ? " liked" : ""}" data-vid="${v.id}" aria-label="J'aime">
          <i class="fa-${feedLiked[v.id] ? "solid" : "regular"} fa-heart"></i>
          <span class="feed-action-label">${formatCount(feedLikeCounts[v.id])}</span>
        </button>
        <!-- Commentaire (simulation) -->
        <button class="feed-action-btn btn-comment" aria-label="Commenter">
          <i class="fa-regular fa-comment"></i>
          <span class="feed-action-label">${formatCount(v.comments)}</span>
        </button>
        <!-- Partager -->
        <button class="feed-action-btn btn-share" aria-label="Partager">
          <i class="fa-solid fa-share"></i>
          <span class="feed-action-label">Partager</span>
        </button>
      </div>`;

    // Wirer les interactions
    wireFeedItem(item, v, index);

    container.appendChild(item);
  });

  // Lancer l'IntersectionObserver pour autoplay/pause
  initFeedObserver();
}

// ============================================================
// FEED TIKTOK — Interactions
// ============================================================

function wireFeedItem(item, video, index) {
  const videoEl = item.querySelector(".feed-video");

  // --- Double-tap = like ---
  let lastTap = 0;
  item.addEventListener("touchend", e => {
    const now = Date.now();
    if (now - lastTap < 280) {
      e.preventDefault();
      toggleLike(video.id, item);
    }
    lastTap = now;
  });

  // Double-clic (desktop)
  item.addEventListener("dblclick", () => toggleLike(video.id, item));

  // --- Tap simple = play/pause ---
  let tapTimer = null;
  item.addEventListener("touchend", e => {
    if (tapTimer) clearTimeout(tapTimer);
    // Ignorer si c'est sur un bouton d'action
    if (e.target.closest(".feed-actions")) return;
    tapTimer = setTimeout(() => {
      if (videoEl.paused) videoEl.play().catch(() => {});
      else                videoEl.pause();
    }, 200);
  });

  // --- Bouton like ---
  item.querySelector(".btn-like")?.addEventListener("click", e => {
    e.stopPropagation();
    toggleLike(video.id, item);
  });

  // --- Bouton commentaire → ouvre le chat avec le premier contact ---
  item.querySelector(".btn-comment")?.addEventListener("click", e => {
    e.stopPropagation();
    openChatFromFeed();
  });

  // --- Bouton partager ---
  item.querySelector(".btn-share")?.addEventListener("click", e => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({ title: "Trinite Chat", text: video.desc, url: location.href });
    } else {
      toast("Lien copié !", "success");
    }
  });

  // --- Swipe vers la droite → ouvre le chat ---
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
    // Swipe droite (>60px horizontalement, <60px vertical = pas un scroll)
    if (dx > 60 && dy < 60) openChatFromFeed(item);
  });
}

// Basculer le like sur une vidéo
function toggleLike(videoId, item) {
  const wasLiked = feedLiked[videoId];
  feedLiked[videoId] = !wasLiked;

  if (!wasLiked) {
    feedLikeCounts[videoId]++;
    showHeartAnimation(item);
  } else {
    feedLikeCounts[videoId]--;
  }

  // Mettre à jour le bouton
  const btn  = item.querySelector(".btn-like");
  const icon = btn?.querySelector("i");
  const lbl  = btn?.querySelector(".feed-action-label");
  if (btn) {
    btn.classList.toggle("liked", feedLiked[videoId]);
    if (icon) icon.className = `fa-${feedLiked[videoId] ? "solid" : "regular"} fa-heart`;
    if (lbl)  lbl.textContent = formatCount(feedLikeCounts[videoId]);
  }
}

// Animation cœur au double-tap
function showHeartAnimation(item) {
  const heart = document.createElement("div");
  heart.className = "heart-anim";
  heart.textContent = "❤️";
  item.appendChild(heart);
  setTimeout(() => heart.remove(), 750);
}

// Ouvrir le chat depuis le Feed (premier contact disponible)
function openChatFromFeed(item) {
  if (!activeProfile) {
    toast("Connectez-vous d'abord", "error");
    return;
  }

  // Afficher une animation swipe si aucun contact
  if (item) {
    const hint = document.createElement("div");
    hint.className = "swipe-hint";
    hint.textContent = "💬 Ouverture du chat…";
    item.appendChild(hint);
    setTimeout(() => hint.remove(), 900);
  }

  // Aller sur l'écran Messages après un court délai
  setTimeout(() => {
    showScreen("screen-main");
    document.querySelectorAll(".nav-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.screen === "screen-main")
    );
    pauseAllFeedVideos();
    // Si au moins un contact : ouvrir directement le chat
    if (currentContacts.length > 0) {
      openChat(currentContacts[0], activeProfile);
    } else {
      toast("Ajoutez un contact pour discuter !", "info");
    }
  }, 400);
}

// ============================================================
// FEED TIKTOK — Autoplay via IntersectionObserver
// ============================================================

let feedObserver = null;

function initFeedObserver() {
  // Nettoyer l'observer précédent
  if (feedObserver) feedObserver.disconnect();

  const options = {
    root:       document.getElementById("feed-container"),
    threshold:  0.6   // La vidéo joue quand 60% est visible
  };

  feedObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const videoEl = entry.target.querySelector(".feed-video");
      if (!videoEl) return;
      if (entry.isIntersecting) {
        // Mettre en pause toutes les autres vidéos
        document.querySelectorAll(".feed-video").forEach(v => {
          if (v !== videoEl && !v.paused) v.pause();
        });
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
      }
    });
  }, options);

  // Observer chaque item du feed
  document.querySelectorAll(".feed-item").forEach(item => feedObserver.observe(item));
}

// Jouer la vidéo actuellement visible dans le feed
function playCurrentFeedVideo() {
  const container = document.getElementById("feed-container");
  if (!container) return;

  const items = Array.from(document.querySelectorAll(".feed-item"));
  const scrollTop = container.scrollTop;
  const h = container.clientHeight;

  // Trouver l'item le plus visible
  let bestItem = null;
  let bestOverlap = -1;

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

// Mettre en pause toutes les vidéos du feed
function pauseAllFeedVideos() {
  document.querySelectorAll(".feed-video").forEach(v => {
    if (!v.paused) v.pause();
  });
}

// ============================================================
// DÉMARRAGE
// ============================================================
initAuth();
