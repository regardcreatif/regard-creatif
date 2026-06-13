// ============================================================
// TRINITE CHAT â€” script.js v2
// Particles Â· Theme Â· Ripple Â· Avatar Â· FAB Â· Swipe Delete
// Typing Indicator Â· Sound Toggle Â· Skeleton Â· QR Scan
// ============================================================
(function () {
  "use strict";

  // FIX: Service Worker PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js")
      .catch(e => console.warn("SW registration failed:", e));
  }

  /* ===== THEME TOGGLE ===== */
  const themeBtn  = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  let isDark = true;

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      isDark = !isDark;
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
      if (themeIcon) themeIcon.className = isDark ? "fa-solid fa-moon" : "fa-solid fa-sun";
      localStorage.setItem("trinite-theme", isDark ? "dark" : "light");
    });
  }

  const savedTheme = localStorage.getItem("trinite-theme");
  if (savedTheme === "light") {
    isDark = false;
    document.documentElement.setAttribute("data-theme", "light");
    if (themeIcon) themeIcon.className = "fa-solid fa-sun";
  }

  /* ===== RIPPLE ===== */
  function addRipple(e) {
    const btn  = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const r    = document.createElement("span");
    r.style.cssText = `position:absolute;width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px;background:rgba(255,255,255,0.12);border-radius:50%;pointer-events:none;transform:scale(0);animation:rippleAnim 0.55s ease forwards;z-index:99;`;
    btn.appendChild(r);
    r.addEventListener("animationend", () => r.remove());
  }
  // Expose to global so other IIFEs (Hub) can reference it by name
  window.addRipple = addRipple;

  if (!document.getElementById("ripple-style")) {
    const s = document.createElement("style");
    s.id = "ripple-style";
    s.textContent = "@keyframes rippleAnim{to{transform:scale(1);opacity:0;}}";
    document.head.appendChild(s);
  }

  function wireRipples() {
    document.querySelectorAll(".btn-primary,.shimmer-btn,.studio-btn,.nav-btn").forEach(btn => {
      if (btn.dataset.ripple) return;
      btn.dataset.ripple = "1";
      btn.style.overflow = "hidden";
      if (!btn.style.position) btn.style.position = "relative";
      btn.addEventListener("click", addRipple);
    });
  }

  /* ===== HAPTIC ===== */
  function haptic(ms) { if (navigator.vibrate) navigator.vibrate(ms || 10); }
  window.haptic = haptic;

  /* ===== SKELETON ===== */
  window.showSkeleton = () => {
    const el = document.getElementById("skeleton-overlay");
    if (el) el.classList.remove("hidden");
  };
  window.hideSkeleton = () => {
    const el = document.getElementById("skeleton-overlay");
    if (el) el.classList.add("hidden");
  };

  /* ===== SCREEN OBSERVER ===== */
  const screenObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.attributeName === "class" && m.target.classList.contains("active"))
        requestAnimationFrame(wireRipples);
    });
  });
  document.querySelectorAll(".screen").forEach(s => screenObserver.observe(s, { attributes: true }));

  document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => haptic(8)));
  document.addEventListener("DOMContentLoaded", wireRipples);
  setTimeout(wireRipples, 500);
})();

// ============================================================
// TRINITE CHAT â€” Logique principale
// ============================================================


const SUPABASE_URL  = "https://eqttgyxjjupeisgozrut.supabase.co";
const SUPABASE_ANON = "sb_publishable_2tUX4eHP5MrKz_pekDY4aA_EiuZ99Wo";
const LOGO_URL      = "https://i.postimg.cc/WpqGN1y6/Picsart-26-06-09-10-15-05-552.png";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// Ã‰TAT GLOBAL
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
let typingChannel = null;
let typingTimeout = null;
let currentTypingHandler = null;   // FIX: Ã©viter l'accumulation de listeners
let unreadCount     = 0;
let userAvatarUrl   = null;
let feedSoundEnabled = false;

// Studio
let cameraStream   = null;
let studioFile     = null;
let studioBlob     = null;
let studioFileName = null;
let currentBlobUrl = null;   // FIX: blob URL Ã  rÃ©voquer pour Ã©viter les fuites mÃ©moire

// Voice
let mediaRecorder  = null;
let voiceChunks    = [];
let isRecording    = false;

// Avatar camera
let avatarCamStream = null;

// Stories
const seenStories = new Set();

// ============================================================
// VIDÃ‰OS DEMO
// ============================================================
const DEMO_VIDEOS = [
  { id:"v1", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",      author:"@trinitechat",  desc:"Bienvenue sur Trinite Chat ðŸ”¥ Trois profils, une seule app !", likes:3102, comments:95, isDemo:true },
  { id:"v2", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",          author:"@profil_pro",   desc:"GÃ©rez vos conversations pros sÃ©parÃ©ment ðŸ’¼ #pro #business",   likes:1284, comments:48, isDemo:true },
  { id:"v3", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",        author:"@anonyme_x",    desc:"Mode anonyme activÃ© ðŸ‘» Personne ne saura qui vous Ãªtes",       likes:873,  comments:22, isDemo:true },
  { id:"v4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4", author:"@prive_heart", desc:"Vos messages privÃ©s restent privÃ©s â¤ï¸ #love #privÃ©",        likes:642,  comments:17, isDemo:true }
];

let feedLiked      = {};
let feedLikeCounts = {};
let feedBookmarks  = JSON.parse(localStorage.getItem("trinite_bookmarks") || "{}");
let feedFilter     = "all"; // "all" | "video" | "photo"
let currentCommentsVideoId = null;

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

let _hubRefreshTimer = null;
function showScreen(id) {
  clearTimeout(_hubRefreshTimer); // FIX: annuler tout timer hub en cours pour Ã©viter redirect
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  updateFabVisibility(id);
  
  // Forcer le rafraÃ®chissement du Hub Ã  chaque affichage
  if (id === "screen-hub") {
    _hubRefreshTimer = setTimeout(() => {
      if (typeof window.refreshHub === 'function') window.refreshHub();
    }, 50);
  }
  // FEED STATUS ADD: Charger les favoris Ã  l'ouverture de l'Ã©cran
  if (id === "screen-favorites") {
    setTimeout(() => {
      if (typeof buildFavorites === 'function') buildFavorites();
    }, 50);
  }
  // Stats du profil Ã  l'ouverture
  if (id === "screen-profil") {
    setTimeout(() => {
      if (typeof loadProfilStats === 'function') loadProfilStats();
    }, 100);
  }
}
// Exposer showScreen globalement (nÃ©cessaire pour onclick dans le HTML)
window.showScreen = showScreen;

function initial(name) { return (name || "?").charAt(0).toUpperCase(); }

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function profileLabel(type) { return { pro:"Pro", prive:"PrivÃ©", anonyme:"Anonyme" }[type] || type; }
function profileEmoji(type) { return { pro:"ðŸ’¼", prive:"â¤ï¸", anonyme:"ðŸ‘»" }[type] || "ðŸ‘¤"; }
function profileColor(type) {
  return { pro:"linear-gradient(135deg,#6366f1,#8b5cf6)", prive:"linear-gradient(135deg,#ec4899,#f97316)", anonyme:"linear-gradient(135deg,#6b7280,#374151)" }[type] || "linear-gradient(135deg,#8b5cf6,#db2777)";
}

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
  return String(n);
}

/* ===== AVATAR HELPERS ===== */
function renderAvatar(el, name, avatarUrl) {
  if (!el) return;
  if (avatarUrl) {
    el.innerHTML = `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" onerror="this.style.display='none';this.parentElement.querySelector('.avatar-fallback')?.style.setProperty('display','flex')" />`;
    el.style.background = "transparent";
  } else {
    el.innerHTML = `<span>${initial(name)}</span>`;
    el.style.background = "linear-gradient(135deg,var(--primary),var(--accent))";
  }
}

// ============================================================
// BADGE NOTIFICATIONS
// ============================================================

function updateMsgBadge(count) {
  unreadCount = Math.max(0, count);
  const badge = document.getElementById("msg-badge");
  if (!badge) return;
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
    badge.classList.remove("hidden");
    // FIX: Forcer re-dÃ©clenchement des animations (badgePop + neonPulse)
    badge.style.animation = "none";
    void badge.offsetWidth; // force reflow
    badge.style.animation = "badgePop 0.35s var(--spring), neonPulse 1.5s ease-in-out infinite 0.5s";
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
        if (isForMe && !messagesActive) {
          updateMsgBadge(unreadCount + 1);
          haptic(15);
        }
      }
    )
    .subscribe();
}

// ============================================================
// AUTHENTIFICATION
// ============================================================

async function initAuth() {
  let session = null;
  try {
    const { data } = await db.auth.getSession();
    session = data?.session ?? null;
  } catch (e) {
    console.error("Trinite initAuth â€” getSession failed:", e);
  }

  // Afficher immÃ©diatement â€” plus de dÃ©lai splash
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
  window.showSkeleton();

  // FIX: VÃ©rifier que le bucket "avatars" existe dans Supabase Storage
  try {
    const { data: buckets } = await db.storage.listBuckets();
    const avatarBucketExists = buckets?.some(b => b.name === "avatars");
    if (!avatarBucketExists) {
      console.warn("Trinite Chat: Le bucket 'avatars' n'existe pas encore dans Supabase Storage.");
    }
  } catch (e) { /* non bloquant */ }

  const { data, error } = await db.from("profiles")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  if (error) { window.hideSkeleton(); toast("Erreur chargement profils : " + error.message, "error"); return; }

  if (!data || data.length === 0) {
    window.hideSkeleton();
    const rows = [
      { user_id: currentUser.id, profile_type: "pro",     name: "Pro" },
      { user_id: currentUser.id, profile_type: "prive",   name: "PrivÃ©" },
      { user_id: currentUser.id, profile_type: "anonyme", name: "Anonyme" }
    ];
    const { data: nd, error: ne } = await db.from("profiles").insert(rows).select();
    if (ne) { toast("Erreur crÃ©ation profils : " + ne.message, "error"); showScreen("screen-setup"); return; }
    userProfiles = nd || [];
    toast("Vos 3 profils ont Ã©tÃ© crÃ©Ã©s !", "success");
  } else {
    userProfiles = data;
    userAvatarUrl = data[0]?.avatar_url || null;
  }

  await loadMainScreen();

  setTimeout(() => window.hideSkeleton(), 500);
}

// ============================================================
// FORMULAIRES AUTH
// ============================================================

document.getElementById("form-login")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn      = e.target.querySelector("button[type=submit]");
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connexionâ€¦'; }
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Se connecter'; }
  if (error) {
    toast(error.message.includes("Invalid") ? "Email ou mot de passe incorrect" : error.message, "error");
  }
});

// FIX: Toggle Email / TÃ©lÃ©phone style TikTok sur le formulaire d'inscription
document.querySelectorAll(".auth-type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".auth-type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const type = btn.dataset.type;
    const emailField = document.getElementById("field-register-email");
    const phoneField = document.getElementById("field-register-phone");
    const emailInput = document.getElementById("register-email");
    const phoneInput = document.getElementById("register-phone");
    if (type === "email") {
      emailField?.classList.remove("hidden");
      phoneField?.classList.add("hidden");
      emailInput.required = true;
      phoneInput.required = false;
    } else {
      emailField?.classList.add("hidden");
      phoneField?.classList.remove("hidden");
      emailInput.required = false;
      phoneInput.required = true;
    }
    haptic(8);
  });
});

document.getElementById("form-register")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn      = e.target.querySelector("button[type=submit]");
  const password = document.getElementById("register-password").value;
  const authType = document.querySelector(".auth-type-btn.active")?.dataset.type || "email";

  // FIX: DÃ©terminer email selon le type choisi (email ou tÃ©lÃ©phone)
  let email = "";
  if (authType === "email") {
    email = document.getElementById("register-email").value.trim();
    if (!email) { toast("Entrez votre email", "error"); return; }
  } else {
    const phone = document.getElementById("register-phone").value.trim().replace(/\s+/g,"");
    if (!phone) { toast("Entrez votre numÃ©ro", "error"); return; }
    // FIX: GÃ©nÃ©rer un email fictif Ã  partir du numÃ©ro pour Supabase
    email = phone + "@phone.trinite";
  }

  if (password.length < 6) { toast("Mot de passe trop court (6 caractÃ¨res min.)", "error"); return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> CrÃ©ationâ€¦'; }

  // FIX: signUp retourne { data: { user, session }, error }
  // "Database error saving new user" = un trigger SQL sur auth.users est cassÃ©.
  // Solution : NE PAS utiliser de trigger. CrÃ©er les profils ici, manuellement.
  const { data: signUpData, error } = await db.auth.signUp({ email, password });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> CrÃ©er mon compte'; }

  if (error) {
    // FIX: Message d'erreur francisÃ© + log console pour debug
    console.error("Trinite signUp error:", error);
    const msg = error.message.includes("Database error")
      ? "Erreur serveur : supprimez le trigger SQL sur auth.users (voir console)."
      : error.message.includes("already registered") || error.message.includes("already been registered")
      ? "Cet email est dÃ©jÃ  utilisÃ©."
      : error.message;
    toast(msg, "error");
    return;
  }

  // FIX: RÃ©cupÃ©rer l'utilisateur depuis signUpData.user (disponible mÃªme sans confirmation email)
  // Ne pas utiliser db.auth.getUser() ici : la session n'est pas encore active si
  // "Confirm email" est activÃ© dans Supabase Auth settings.
  const user = signUpData?.user;

  if (user) {
    // FIX: Sauvegarder le numÃ©ro de tÃ©lÃ©phone dans les mÃ©tadonnÃ©es user
    const phone = document.getElementById("register-phone")?.value.trim() || null;
    if (phone) {
      await db.auth.updateUser({ phone, data: { phone } });
    }

    // FIX: CrÃ©er les 3 profils directement aprÃ¨s signUp, sans trigger SQL.
    const rows = [
      { user_id: user.id, profile_type: "pro",     name: "Pro",     phone: phone },
      { user_id: user.id, profile_type: "prive",   name: "PrivÃ©",   phone: phone },
      { user_id: user.id, profile_type: "anonyme", name: "Anonyme", phone: phone }
    ];
    const { error: profileErr } = await db.from("profiles").insert(rows);
    if (profileErr) {
      // FIX: Retenter sans colonne phone si elle n'existe pas encore
      const rows2 = [
        { user_id: user.id, profile_type: "pro",     name: "Pro" },
        { user_id: user.id, profile_type: "prive",   name: "PrivÃ©" },
        { user_id: user.id, profile_type: "anonyme", name: "Anonyme" }
      ];
      const { error: profileErr2 } = await db.from("profiles").insert(rows2);
      if (profileErr2) console.warn("Trinite: profils non crÃ©Ã©s :", profileErr2.message);
    }
  }

  // FIX: Si confirmation email dÃ©sactivÃ©e dans Supabase, la session est active
  // et onAuthStateChange va dÃ©clencher afterLogin() automatiquement.
  // Si confirmation email activÃ©e, on affiche juste un message d'attente.
  const needsConfirm = !signUpData?.session;
  if (needsConfirm) {
    toast("Compte crÃ©Ã© ! VÃ©rifiez votre boÃ®te mail pour confirmer.", "success");
  } else {
    toast("Compte crÃ©Ã© et connectÃ© !", "success");
    // FIX: onAuthStateChange s'en charge â€” pas besoin d'appeler afterLogin() manuellement
  }
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
// SETUP PROFILS
// ============================================================

document.getElementById("form-setup")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> CrÃ©ationâ€¦'; }
  const rows = [
    { user_id: currentUser.id, profile_type: "pro",     name: document.getElementById("name-pro")?.value.trim()     || "Pro" },
    { user_id: currentUser.id, profile_type: "prive",   name: document.getElementById("name-prive")?.value.trim()   || "PrivÃ©" },
    { user_id: currentUser.id, profile_type: "anonyme", name: document.getElementById("name-anonyme")?.value.trim() || "Anonyme" }
  ];
  const { data, error } = await db.from("profiles").insert(rows).select();
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> CrÃ©er mes profils'; }
  if (error) { toast("Erreur : " + error.message, "error"); return; }
  userProfiles = data || [];
  toast("Vos 3 identitÃ©s sont prÃªtes !", "success");
  await loadMainScreen();
});

// ============================================================
// DÃ‰CONNEXION
// ============================================================

function handleLogout() {
  if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (notifChannel)    { db.removeChannel(notifChannel);    notifChannel    = null; }
  stopCamera();
  stopAvatarCamera();
  hideFab();
  db.auth.signOut();
}
document.getElementById("btn-logout")       ?.addEventListener("click", handleLogout);
document.getElementById("btn-logout-profil")?.addEventListener("click", handleLogout);

// ============================================================
// Ã‰CRAN PRINCIPAL
// ============================================================

async function loadMainScreen() {
  showScreen("screen-main");
  activeIdx     = 0;
  activeProfile = userProfiles[0];

  buildSwiper();
  updateHeaderProfile();
  buildStories();
  showSkeleton();
  await loadContacts();
  await buildFeed();
  buildProfilScreen();
  wireBottomNav();
  startNotifListener();
  wireContactSearch();
  initFab();
  updateAvatarUI();

  setTimeout(() => hideSkeleton(), 500);
}

// ============================================================
// SWIPER DE PROFILS (bug fix: offset prÃ©cis)
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
    slide.style.setProperty("--stagger-delay", `${i * 0.08}s`);

    const avatarHtml = p.avatar_url
      ? `<img src="${escapeHtml(p.avatar_url)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
      : profileEmoji(p.profile_type);

    slide.innerHTML = `
      <div class="slide-icon ${p.profile_type}">${avatarHtml}</div>
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
  // FIX: retirer les anciens listeners en remplaÃ§ant le nÅ“ud
  const newWrap = wrap?.cloneNode(true);
  if (wrap && newWrap) wrap.parentNode.replaceChild(newWrap, wrap);
  const swiperWrap = document.getElementById("profile-swiper-wrap");

  let startX = null;
  let startY = null; // FIX: tracking Y pour empÃªcher swipe vertical
  let dragging = false;

  swiperWrap?.addEventListener("touchstart", e => {
    startX   = e.touches[0].clientX;
    startY   = e.touches[0].clientY; // FIX
    dragging = false;
  }, { passive: true });

  swiperWrap?.addEventListener("touchmove", e => {
    if (startX === null) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    // FIX: N'activer que si le mouvement est principalement horizontal
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) dragging = true;
  }, { passive: true });

  swiperWrap?.addEventListener("touchend", e => {
    if (startX === null || !dragging) { startX = null; startY = null; return; }
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    startX   = null;
    startY   = null;
    dragging = false;
    // FIX: Seuil rÃ©duit Ã  30px + vÃ©rification que c'est bien horizontal
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return; // FIX: annuler si trop vertical
    if (dx < -30 && activeIdx < userProfiles.length - 1) {
      setActiveProfile(activeIdx + 1);
      haptic(10);
    } else if (dx > 30 && activeIdx > 0) {
      setActiveProfile(activeIdx - 1);
      haptic(10);
    }
  });
}

async function setActiveProfile(idx) {
  if (idx === activeIdx && activeProfile) return;

  activeIdx     = idx;
  activeProfile = userProfiles[idx];

  document.querySelectorAll(".profile-slide").forEach((s, i) => s.classList.toggle("active", i === idx));
  document.querySelectorAll(".dot")          .forEach((d, i) => d.classList.toggle("active", i === idx));

  const wrap = document.getElementById("profile-slides");
  if (wrap) {
    const slideEls = Array.from(wrap.children);
    if (slideEls.length > 0) {
      const slideW = slideEls[0].getBoundingClientRect().width;
      const gap    = 12;
      // FIX: Transition douce avec cubic-bezier
      wrap.style.transition = "transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
      wrap.style.transform = `translateX(-${idx * (slideW + gap)}px)`;
    }
  }

  updateHeaderProfile();
  updateFabActiveState();
  showSkeleton();
  await loadContacts();
  buildStories();
  setTimeout(() => hideSkeleton(), 500);
}

function updateHeaderProfile() {
  const el = document.getElementById("active-profile-name");
  if (el && activeProfile) el.textContent = activeProfile.name;
}

// ============================================================
// STORIES
// ============================================================

// FEED STATUS ADD: Load active stories (< 24h) from Supabase stories table
async function loadStoriesFromSupabase() {
  if (!currentUser) return [];
  try {
    const { data, error } = await db.from("status")
      .select("id, profile_id, media_url, media_type, created_at, expires_at, profiles(name, avatar_url)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(15);
    if (!error && data) return data;
  } catch (e) { /* non bloquant */ }
  return [];
}

// FEED STATUS ADD: buildStories â€” WhatsApp-style vertical rectangles + Supabase stories table
async function buildStories() {
  const scroll = document.getElementById("stories-scroll");
  if (!scroll) return;
  scroll.innerHTML = "";

  // FEED STATUS ADD: Charger les stories Supabase (valides 24h)
  const supabaseStories = await loadStoriesFromSupabase();

  // SÃ©parer mes stories des stories des autres
  const myStories    = supabaseStories.filter(s => activeProfile && s.profile_id === activeProfile.id);
  const otherStories = supabaseStories.filter(s => !activeProfile || s.profile_id !== activeProfile.id);

  // â”€â”€â”€ "MA STORY" â€” style WhatsApp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addWrap = document.createElement("div");
  addWrap.className = "story-item";

  if (myStories.length > 0) {
    // J'ai des stories actives â†’ montrer la plus rÃ©cente en fond + ring colorÃ©
    const latest = myStories[0];
    const mediaPreview = latest.media_url
      ? (latest.media_type === "video"
          ? `<video src="${escapeHtml(latest.media_url)}" muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:10px"></video>`
          : `<img src="${escapeHtml(latest.media_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" alt="ma story" />`)
      : `<span style="font-size:2rem">${activeProfile ? profileEmoji(activeProfile.profile_type) : "ðŸ‘¤"}</span>`;

    const timeLeft = Math.round((new Date(latest.expires_at) - Date.now()) / 3600000);
    addWrap.innerHTML = `
      <div class="story-ring my-story-ring" title="Voir ma story">
        <div class="story-avatar">${mediaPreview}</div>
        <span class="story-add-plus story-add-plus-sm" title="Ajouter une story">
          <i class="fa-solid fa-plus" style="font-size:0.5rem"></i>
        </span>
      </div>
      <span class="story-name">Ma story</span>
      <span class="story-time-left">${timeLeft}h</span>`;

    // Clic sur le "+" â†’ upload ; clic ailleurs â†’ voir mes stories
    addWrap.addEventListener("click", (e) => {
      if (e.target.closest(".story-add-plus")) { openStoryUpload(); }
      else { openStoryFull(latest); }
    });
  } else {
    // Pas encore de story â†’ bouton + classique
    const myAvatarHtml = userAvatarUrl
      ? `<img src="${escapeHtml(userAvatarUrl)}" alt="moi" />`
      : (activeProfile ? `<span style="font-size:1.8rem">${profileEmoji(activeProfile.profile_type)}</span>` : "ðŸ‘¤");
    addWrap.innerHTML = `
      <div class="story-add-ring" title="Ajouter une story">
        <div class="story-avatar">${myAvatarHtml}</div>
        <span class="story-add-plus"><i class="fa-solid fa-plus" style="font-size:0.55rem"></i></span>
      </div>
      <span class="story-name">Ma story</span>`;
    addWrap.addEventListener("click", () => openStoryUpload());
  }
  scroll.appendChild(addWrap);

  // â”€â”€â”€ STORIES DES AUTRES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderStory = (story, i) => {
    const seen = seenStories.has(story.id);
    const name = story.profiles?.name || "Inconnu";
    const wrap = document.createElement("div");
    wrap.className = "story-item";
    wrap.style.animationDelay = `${i * 0.04}s`;

    const mediaPreview = story.media_url
      ? (story.media_type === "video"
          ? `<video src="${escapeHtml(story.media_url)}" muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:10px"></video>`
          : `<img src="${escapeHtml(story.media_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px" alt="story" />`)
      : escapeHtml(initial(name));

    const profileDot = story.profiles?.avatar_url
      ? `<div class="story-profile-dot"><img src="${escapeHtml(story.profiles.avatar_url)}" alt="${escapeHtml(name)}" /></div>`
      : `<div class="story-profile-dot">${escapeHtml(initial(name))}</div>`;

    wrap.innerHTML = `
      <div class="story-ring${seen ? " seen" : ""}">
        <div class="story-avatar">
          ${mediaPreview}
          ${profileDot}
        </div>
      </div>
      <span class="story-name">${escapeHtml(name.split(" ")[0])}</span>`;
    wrap.addEventListener("click", () => openStoryFull(story));
    scroll.appendChild(wrap);
  };

  if (otherStories.length > 0) {
    otherStories.forEach((story, i) => renderStory(story, i));
  } else if (supabaseStories.length === 0) {
    // FEED STATUS ADD: Fallback contacts si aucune story en base
    const STORY_EMOJIS = ["ðŸ”¥","ðŸ’œ","âœ¨","ðŸ‘‹","ðŸŽµ","ðŸŒ™","ðŸ’«","ðŸŽ‰"];
    currentContacts.slice(0, 10).forEach((c, i) => {
      const seen = seenStories.has(c.id);
      const wrap = document.createElement("div");
      wrap.className = "story-item";
      wrap.innerHTML = `
        <div class="story-ring${seen ? " seen" : ""}">
          <div class="story-avatar">
            <span style="font-size:2rem">${STORY_EMOJIS[i % STORY_EMOJIS.length]}</span>
            <div class="story-profile-dot">${escapeHtml(initial(c.contact_name))}</div>
          </div>
        </div>
        <span class="story-name">${escapeHtml(c.contact_name.split(" ")[0])}</span>`;
      wrap.addEventListener("click", () => openStory(c, STORY_EMOJIS[i % STORY_EMOJIS.length]));
      scroll.appendChild(wrap);
    });
  }
}

function openStory(contact, emoji) {
  seenStories.add(contact.id);
  haptic(8);

  const modal    = document.getElementById("modal-story");
  const avatarEl = document.getElementById("story-modal-avatar");
  const nameEl   = document.getElementById("story-modal-name");
  const bodyEl   = document.getElementById("story-modal-body");

  if (avatarEl) avatarEl.textContent = initial(contact.contact_name);
  if (nameEl)   nameEl.textContent   = contact.contact_name;
  if (bodyEl)   bodyEl.textContent   = emoji;

  const progressBar = modal?.querySelector(".story-progress-bar");
  if (progressBar) {
    // FIX: Reset complet de l'animation pour garantir 4s exactes
    progressBar.style.transition = "none";
    progressBar.style.animation = "none";
    progressBar.style.width = "0%";
    void progressBar.offsetWidth; // force reflow
    progressBar.style.animation = "storyProgress 4s linear forwards";
  }

  modal?.classList.remove("hidden");
  buildStories();

  // FIX: Fermeture automatique exactement aprÃ¨s 4 secondes
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
    el.innerHTML = '<li class="empty-state"><i class="fa-regular fa-comment-dots" style="font-size:2rem;display:block;margin-bottom:0.5rem;opacity:0.3"></i>Aucun contact pour ce profil</li>';
    return;
  }

  list.forEach((c, idx) => {
    const li = document.createElement("li");
    li.className = "contact-swipe-wrap";
    li.style.animationDelay = `${idx * 0.03}s`;

    const deleteBg = document.createElement("div");
    deleteBg.className = "contact-delete-bg";
    deleteBg.innerHTML = '<i class="fa-solid fa-trash"></i>';

    const item = document.createElement("div");
    item.className = "contact-item";

    item.innerHTML = `
      <div class="contact-avatar">${escapeHtml(initial(c.contact_name))}</div>
      <div class="contact-info">
        <span class="contact-name-text">${escapeHtml(c.contact_name)}</span>
        <span class="contact-email-text">${escapeHtml(c.contact_email || "")}</span>
      </div>
      <i class="fa-solid fa-chevron-right chevron"></i>`;

    item.addEventListener("click", () => openChat(c, activeProfile));

    wireSwipeDelete(li, item, deleteBg, c);

    li.appendChild(deleteBg);
    li.appendChild(item);
    el.appendChild(li);
  });
}

/* ===== SWIPE TO DELETE ===== */
function wireSwipeDelete(wrapper, item, deleteBg, contact) {
  let touchStartX = null;
  let currentX    = 0;
  let swiped      = false;

  item.addEventListener("touchstart", e => {
    touchStartX = e.touches[0].clientX;
    currentX    = 0;
    swiped      = false;
    item.style.transition = "none";
  }, { passive: true });

  item.addEventListener("touchmove", e => {
    if (touchStartX === null) return;
    const dx = e.touches[0].clientX - touchStartX;
    if (dx > 0) return;
    currentX = Math.max(dx, -90);
    item.style.transform = `translateX(${currentX}px)`;
    deleteBg.style.opacity = Math.min(1, Math.abs(currentX) / 80);
  }, { passive: true });

  item.addEventListener("touchend", () => {
    item.style.transition = "";
    if (Math.abs(currentX) > 55) {
      item.style.transform = "translateX(-80px)";
      wrapper.classList.add("swiped");
      swiped = true;
      haptic(20);

      deleteBg.addEventListener("click", async () => {
        item.style.transform = "translateX(-100%)";
        item.style.opacity   = "0";
        item.style.height    = "0";
        item.style.padding   = "0";
        item.style.margin    = "0";
        item.style.transition = "all 0.35s ease";
        wrapper.style.transition = "all 0.35s ease";
        wrapper.style.height  = "0";
        wrapper.style.opacity = "0";

        const { error } = await db.from("contacts").delete().eq("id", contact.id);
        if (error) {
          toast("Erreur suppression : " + error.message, "error");
        } else {
          toast("Contact supprimÃ©", "info");
          await loadContacts();
          buildStories();
        }
      }, { once: true });
    } else {
      item.style.transform = "translateX(0)";
      deleteBg.style.opacity = "0";
      wrapper.classList.remove("swiped");
    }
    touchStartX = null;
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
    if (!q) { renderContacts(currentContacts); return; }
    // FIX: Recherche par nom, email OU tÃ©lÃ©phone
    const filtered = currentContacts.filter(c =>
      c.contact_name.toLowerCase().includes(q) ||
      (c.contact_email || "").toLowerCase().includes(q) ||
      (c.contact_phone || "").replace(/\s+/g,"").includes(q.replace(/\s+/g,""))
    );
    renderContacts(filtered);
  });
}

// ============================================================
// MODAL AJOUTER CONTACT
// ============================================================

document.getElementById("btn-add-contact")?.addEventListener("click", () => {
  const sel = document.getElementById("contact-profile-select");
  if (sel) {
    sel.innerHTML = "";
    userProfiles.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${profileEmoji(p.profile_type)} ${profileLabel(p.profile_type)} â€” ${p.name}`;
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

// FIX: Recherche de contact par numÃ©ro de tÃ©lÃ©phone (style WhatsApp)
document.getElementById("btn-search-phone")?.addEventListener("click", async () => {
  const phone = document.getElementById("contact-phone")?.value.trim();
  const resultEl = document.getElementById("phone-search-result");
  if (!phone) { toast("Entrez un numÃ©ro de tÃ©lÃ©phone", "error"); return; }

  if (resultEl) {
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rechercheâ€¦';
    resultEl.className = "phone-search-result searching";
  }

  // FIX: Chercher dans les profils par numÃ©ro de tÃ©lÃ©phone
  const phoneClean = phone.replace(/\s+/g, "");
  const { data, error } = await db.from("profiles")
    .select("id, name, user_id, profile_type, phone")
    .or(`phone.eq.${phoneClean},phone.eq.${phone}`)
    .limit(1);

  if (error || !data || data.length === 0) {
    // FIX: Pas trouvÃ© â€” on peut quand mÃªme ajouter manuellement
    if (resultEl) {
      resultEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> Aucun utilisateur Trinite trouvÃ© â€” vous pouvez quand mÃªme ajouter ce contact.';
      resultEl.className = "phone-search-result not-found";
    }
    // PrÃ©-remplir l'email hidden avec le numÃ©ro
    const emailInput = document.getElementById("contact-email");
    if (emailInput) emailInput.value = phoneClean + "@phone.trinite";
    return;
  }

  const found = data[0];
  // FIX: PrÃ©-remplir automatiquement nom et ID Trinite
  const nameInput = document.getElementById("contact-name");
  const profileIdInput = document.getElementById("contact-profile-id");
  const emailInput = document.getElementById("contact-email");

  if (nameInput && !nameInput.value) nameInput.value = found.name;
  if (profileIdInput) profileIdInput.value = found.id;
  if (emailInput) emailInput.value = phoneClean + "@phone.trinite";

  if (resultEl) {
    resultEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> TrouvÃ© : <strong>${escapeHtml(found.name)}</strong> (${escapeHtml(found.profile_type)})`;
    resultEl.className = "phone-search-result found";
  }
  haptic(15);
});

// FIX: Recherche aussi en tapant (aprÃ¨s 1 seconde sans frappe)
document.getElementById("contact-phone")?.addEventListener("input", () => {
  const resultEl = document.getElementById("phone-search-result");
  if (resultEl) resultEl.classList.add("hidden");
  clearTimeout(window._phoneSearchTimeout);
  window._phoneSearchTimeout = setTimeout(() => {
    const phone = document.getElementById("contact-phone")?.value.trim();
    if (phone && phone.length >= 8) {
      document.getElementById("btn-search-phone")?.click();
    }
  }, 1000);
});

document.getElementById("form-add-contact")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn              = e.target.querySelector("button[type=submit]");
  const phone            = document.getElementById("contact-phone")?.value.trim() || "";
  const name             = document.getElementById("contact-name").value.trim();
  const profileId        = document.getElementById("contact-profile-select").value;
  const contactProfileId = document.getElementById("contact-profile-id").value.trim() || null;
  // FIX: email gÃ©nÃ©rÃ© Ã  partir du tÃ©lÃ©phone si pas trouvÃ© dans profiles
  const emailHidden      = document.getElementById("contact-email").value.trim()
                           || (phone.replace(/\s+/g,"") + "@phone.trinite");

  if (!phone || !name) { toast("Entrez un numÃ©ro et un nom", "error"); return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ajoutâ€¦'; }

  // FIX: contact_user_id est le vrai nom de la colonne dans la table (pas contact_profile_id)
  const { error } = await db.from("contacts").insert({
    user_id:             currentUser.id,
    contact_email:       emailHidden,
    contact_name:        name,
    contact_phone:       phone.replace(/\s+/g, ""),
    assigned_profile_id: profileId  || null,
    contact_user_id:     contactProfileId || null
  });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Ajouter'; }
  if (error) { toast("Erreur : " + error.message, "error"); return; }

  toast("Contact ajoutÃ© !", "success");
  haptic(15);
  document.getElementById("modal-add-contact")?.classList.add("hidden");
  e.target.reset();
  const resultEl = document.getElementById("phone-search-result");
  if (resultEl) resultEl.classList.add("hidden");

  if (profileId === activeProfile?.id) {
    showSkeleton();
    await loadContacts();
    buildStories();
    setTimeout(() => hideSkeleton(), 500);
  }
});

/* ===== QR Code simulation ===== */
document.getElementById("btn-qr-scan")?.addEventListener("click", () => {
  const scanner = document.getElementById("qr-scanner-mock");
  scanner?.classList.toggle("hidden");
  haptic(10);
});

document.getElementById("btn-qr-close")?.addEventListener("click", () => {
  document.getElementById("qr-scanner-mock")?.classList.add("hidden");
});

document.getElementById("btn-qr-simulate")?.addEventListener("click", () => {
  haptic(20);
  const fakeId = "trinite-" + Math.random().toString(36).substr(2, 8);
  const input  = document.getElementById("contact-profile-id");
  if (input) input.value = fakeId;
  document.getElementById("qr-scanner-mock")?.classList.add("hidden");
  toast("QR Code scannÃ© ! ID : " + fakeId, "success");
});

// ============================================================
// Ã‰CRAN PROFIL
// ============================================================

function buildProfilScreen() {
  const container = document.getElementById("profil-cards");
  if (!container) return;
  container.innerHTML = "";

  userProfiles.forEach(p => {
    const card = document.createElement("div");
    card.className = "profil-card-edit glass-card stagger-in";
    card.innerHTML = `
      <div class="profile-icon ${p.profile_type}">${profileEmoji(p.profile_type)}</div>
      <div class="field flex1">
        <label>${profileLabel(p.profile_type)}</label>
        <div class="input-wrap">
          <input type="text" data-pid="${p.id}" value="${escapeHtml(p.name)}" placeholder="${profileLabel(p.profile_type)}" />
        </div>
      </div>`;
    container.appendChild(card);
  });

  // FIX: Afficher un QR code et statut pour CHAQUE profil sÃ©parÃ©ment
  const idSection = document.getElementById("profil-id-section");
  if (idSection && userProfiles.length > 0) {
    idSection.style.display = "";
    idSection.innerHTML = userProfiles.map(p => `
      <div class="profil-qr-block glass-card" id="qr-block-${p.id}">
        <div class="profil-qr-header">
          <span class="profil-qr-emoji">${profileEmoji(p.profile_type)}</span>
          <span class="profil-qr-label">${escapeHtml(p.name)} <span style="color:var(--text-muted);font-size:0.75rem">(${profileLabel(p.profile_type)})</span></span>
          <!-- FIX: Toggle statut en ligne par profil -->
          <label class="status-toggle" title="Statut visible uniquement par vos contacts de ce profil">
            <input type="checkbox" class="status-checkbox" data-pid="${p.id}" ${p.is_online ? "checked" : ""} />
            <span class="status-slider"></span>
          </label>
        </div>
        <!-- FIX: Texte statut clair â€” visible seulement par les contacts de CE profil -->
        <p class="status-label-text" id="status-label-${p.id}">${p.is_online ? "ðŸŸ¢ En ligne" : "âš« Hors ligne"} â€” visible uniquement par vos contacts ${profileLabel(p.profile_type)}</p>
        <div class="profil-id-box">
          <span class="profil-id-value" id="profil-id-${p.id}">${escapeHtml(p.id)}</span>
          <button class="icon-btn btn-copy-profile-id" data-pid="${p.id}" title="Copier ID">
            <i class="fa-solid fa-copy"></i>
          </button>
        </div>
        <!-- FIX: QR Code partageable par profil -->
        <div class="profil-qr-canvas-wrap">
          <div id="qr-canvas-${p.id}" class="profil-qr-canvas"></div>
          <p class="profil-id-hint">Faites scanner ce QR pour que vos contacts vous trouvent</p>
          <!-- FIX: Boutons partager et tÃ©lÃ©charger le QR -->
          <div class="qr-share-btns">
            <button class="btn-qr-share" data-pid="${p.id}" data-name="${escapeHtml(p.name)}">
              <i class="fa-solid fa-share-nodes"></i> Partager
            </button>
            <button class="btn-qr-download" data-pid="${p.id}" data-name="${escapeHtml(p.name)}">
              <i class="fa-solid fa-download"></i> TÃ©lÃ©charger
            </button>
          </div>
        </div>
        <!-- FIX: ParamÃ¨tres visibilitÃ© vidÃ©o par profil -->
        <div class="video-visibility-section">
          <p class="video-visibility-title"><i class="fa-solid fa-film"></i> Qui peut voir mes vidÃ©os (${profileLabel(p.profile_type)}) ?</p>
          <div class="video-visibility-options">
            <label class="vv-option">
              <input type="radio" name="vv-${p.id}" value="everyone" class="vv-radio" data-pid="${p.id}" ${(p.video_visibility||"everyone")==="everyone"?"checked":""} />
              <span class="vv-label"><i class="fa-solid fa-globe"></i> Tout le monde</span>
            </label>
            <label class="vv-option">
              <input type="radio" name="vv-${p.id}" value="contacts" class="vv-radio" data-pid="${p.id}" ${(p.video_visibility||"")==="contacts"?"checked":""} />
              <span class="vv-label"><i class="fa-solid fa-user-group"></i> Mes contacts seulement</span>
            </label>
            <label class="vv-option">
              <input type="radio" name="vv-${p.id}" value="nobody" class="vv-radio" data-pid="${p.id}" ${(p.video_visibility||"")==="nobody"?"checked":""} />
              <span class="vv-label"><i class="fa-solid fa-lock"></i> Personne (privÃ©)</span>
            </label>
          </div>
        </div>
      </div>
    `).join("");

    // FIX: GÃ©nÃ©rer les QR codes
    loadQRLib().then(() => {
      userProfiles.forEach(p => {
        const el = document.getElementById("qr-canvas-" + p.id);
        if (el && window.QRCode) {
          el.innerHTML = "";
          new window.QRCode(el, {
            text: "trinite://profile/" + p.id,
            width: 160,
            height: 160,
            colorDark: "#a855f7",
            colorLight: "transparent",
            correctLevel: window.QRCode.CorrectLevel.M
          });
        }
      });
    });

    // FIX: Copier l'ID de chaque profil
    idSection.querySelectorAll(".btn-copy-profile-id").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = document.getElementById("profil-id-" + btn.dataset.pid)?.textContent;
        if (!id) return;
        navigator.clipboard?.writeText(id)
          .then(() => toast("ID copiÃ© !", "success"))
          .catch(() => toast("Impossible de copier", "error"));
      });
    });

    // FIX: Statut en ligne â€” visible seulement par contacts du mÃªme profil
    idSection.querySelectorAll(".status-checkbox").forEach(cb => {
      cb.addEventListener("change", async () => {
        const pid = cb.dataset.pid;
        const online = cb.checked;
        const { error } = await db.from("profiles").update({ is_online: online }).eq("id", pid);
        if (!error) {
          const lbl = document.getElementById("status-label-" + pid);
          const p = userProfiles.find(x => x.id === pid);
          const label = p ? profileLabel(p.profile_type) : "";
          if (lbl) lbl.textContent = (online ? "ðŸŸ¢ En ligne" : "âš« Hors ligne") + " â€” visible uniquement par vos contacts " + label;
          toast(online ? "ðŸŸ¢ En ligne" : "âš« Hors ligne", "info");
        }
      });
    });

    // FIX: Partager QR code via Web Share API ou tÃ©lÃ©chargement
    idSection.querySelectorAll(".btn-qr-share").forEach(btn => {
      btn.addEventListener("click", async () => {
        const pid  = btn.dataset.pid;
        const name = btn.dataset.name;
        const id   = document.getElementById("profil-id-" + pid)?.textContent;
        // FIX: Essayer de partager l'image du QR si canvas disponible
        const canvas = document.querySelector("#qr-canvas-" + pid + " canvas");
        if (canvas && navigator.share) {
          try {
            canvas.toBlob(async blob => {
              if (!blob) { shareTextFallback(id, name); return; }
              const file = new File([blob], "trinite-qr-" + name + ".png", { type: "image/png" });
              await navigator.share({ title: "Trinite Chat â€” " + name, files: [file], text: "Mon ID Trinite : " + id });
            });
          } catch (_) { shareTextFallback(id, name); }
        } else {
          shareTextFallback(id, name);
        }
        haptic(15);
      });
    });

    // FIX: TÃ©lÃ©charger le QR code comme image
    idSection.querySelectorAll(".btn-qr-download").forEach(btn => {
      btn.addEventListener("click", () => {
        const pid  = btn.dataset.pid;
        const name = btn.dataset.name;
        const canvas = document.querySelector("#qr-canvas-" + pid + " canvas");
        if (!canvas) { toast("QR pas encore prÃªt", "error"); return; }
        const link = document.createElement("a");
        link.download = "trinite-qr-" + name + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast("QR tÃ©lÃ©chargÃ© !", "success");
        haptic(10);
      });
    });

    // FIX: VisibilitÃ© vidÃ©o â€” sauvegarde dans Supabase
    idSection.querySelectorAll(".vv-radio").forEach(radio => {
      radio.addEventListener("change", async () => {
        if (!radio.checked) return;
        const pid = radio.dataset.pid;
        const val = radio.value;
        const { error } = await db.from("profiles").update({ video_visibility: val }).eq("id", pid);
        if (!error) {
          const labels = { everyone: "Tout le monde", contacts: "Contacts seulement", nobody: "Personne (privÃ©)" };
          toast("VisibilitÃ© vidÃ©o : " + (labels[val] || val), "success");
          // FIX: Mettre Ã  jour le cache local
          const p = userProfiles.find(x => x.id === pid);
          if (p) p.video_visibility = val;
        }
      });
    });
  }
}

// FIX: Fallback partage par texte si image impossible
function shareTextFallback(id, name) {
  if (navigator.share) {
    navigator.share({ title: "Trinite Chat â€” " + name, text: "Ajoutez-moi sur Trinite Chat !\nMon ID : " + id });
  } else {
    navigator.clipboard?.writeText(id)
      .then(() => toast("ID copiÃ© ! Partagez-le Ã  vos contacts.", "success"))
      .catch(() => toast("ID : " + id, "info"));
  }
}

// FIX: Charger la lib QR Code dynamiquement (CDN)
function loadQRLib() {
  if (window.QRCode) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

document.getElementById("btn-copy-id")?.addEventListener("click", () => {
  const idText = document.getElementById("profil-id-text")?.textContent;
  if (!idText || idText === "â€”") return;
  navigator.clipboard?.writeText(idText)
    .then(() => toast("ID copiÃ© !", "success"))
    .catch(() => toast("Impossible de copier", "error"));
});

document.getElementById("form-profil")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrementâ€¦'; }

  const inputs = e.target.querySelectorAll("input[data-pid]");
  for (const input of inputs) {
    const pid  = input.dataset.pid;
    const name = input.value.trim();
    if (!name) continue;
    const { error } = await db.from("profiles").update({ name }).eq("id", pid);
    if (error) { toast("Erreur : " + error.message, "error"); break; }
    const p = userProfiles.find(x => x.id === pid);
    if (p) p.name = name;
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Enregistrer'; }
  toast("Profils mis Ã  jour !", "success");
  buildSwiper();
  updateHeaderProfile();
});

// ============================================================
// AVATAR â€” Photo de profil personnalisable
// ============================================================

// FIX: Cache simple des avatars dans localStorage pour Ã©viter des rechargements inutiles
const AVATAR_CACHE_KEY = "trinite_avatar_cache";
function getAvatarCache() {
  try { return JSON.parse(localStorage.getItem(AVATAR_CACHE_KEY) || "{}"); } catch { return {}; }
}
function setAvatarCache(url, dataUrl) {
  try {
    const cache = getAvatarCache();
    cache[url] = dataUrl;
    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache));
  } catch (e) { /* quota ignorÃ© silencieusement */ }
}
function getCachedAvatar(url) {
  return getAvatarCache()[url] || null;
}

// FIX: Compression image avant upload (max 400x400, qualitÃ© 0.7)
async function compressAvatar(file) {
  return new Promise((resolve) => {
    const MAX = 400;
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const cvs = document.createElement("canvas");
      cvs.width = w; cvs.height = h;
      cvs.getContext("2d").drawImage(img, 0, 0, w, h);
      cvs.toBlob(blob => {
        resolve(blob
          ? new File([blob], file.name, { type: "image/jpeg" })
          : file);
      }, "image/jpeg", 0.7);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
    img.src = blobUrl;
  });
}

// FIX: Fallback initiales si l'image ne charge pas aprÃ¨s 3 secondes
function renderAvatarWithFallback(el, name, avatarUrl) {
  if (!el) return;
  if (!avatarUrl) {
    el.innerHTML = `<span>${initial(name)}</span>`;
    el.style.background = "linear-gradient(135deg,var(--primary),var(--accent))";
    return;
  }
  // VÃ©rifier le cache d'abord
  const cached = getCachedAvatar(avatarUrl);
  if (cached) {
    el.innerHTML = `<img src="${cached}" alt="${escapeHtml(name)}" />`;
    el.style.background = "transparent";
    return;
  }
  // Charger avec timeout de fallback
  const img = document.createElement("img");
  img.alt = escapeHtml(name);
  let loaded = false;
  const fallbackTimer = setTimeout(() => {
    if (!loaded) {
      el.innerHTML = `<span>${initial(name)}</span>`;
      el.style.background = "linear-gradient(135deg,var(--primary),var(--accent))";
    }
  }, 3000);
  img.onload = () => {
    loaded = true;
    clearTimeout(fallbackTimer);
    setAvatarCache(avatarUrl, avatarUrl);
    el.style.background = "transparent";
  };
  img.onerror = () => {
    loaded = true;
    clearTimeout(fallbackTimer);
    el.innerHTML = `<span>${initial(name)}</span>`;
    el.style.background = "linear-gradient(135deg,var(--primary),var(--accent))";
  };
  img.src = avatarUrl;
  el.innerHTML = "";
  el.appendChild(img);
}

function updateAvatarUI() {
  const largePrev    = document.getElementById("avatar-large-preview");
  const initialsEl   = document.getElementById("avatar-large-initials");
  const imgEl        = document.getElementById("avatar-large-img");
  const removeBtn    = document.getElementById("btn-avatar-remove");

  const name = userProfiles[0]?.name || currentUser?.email || "?";

  if (userAvatarUrl) {
    if (initialsEl) initialsEl.classList.add("hidden");
    if (imgEl)      { imgEl.src = userAvatarUrl; imgEl.classList.remove("hidden"); }
    if (removeBtn)  removeBtn.classList.remove("hidden");
  } else {
    if (initialsEl) { initialsEl.textContent = initial(name); initialsEl.classList.remove("hidden"); }
    if (imgEl)      imgEl.classList.add("hidden");
    if (removeBtn)  removeBtn.classList.add("hidden");
  }
}

async function uploadAvatar(file) {
  if (!currentUser || !file) return;

  const progressWrap = document.getElementById("avatar-upload-progress");
  const progressBar  = document.getElementById("avatar-progress-bar");
  progressWrap?.classList.remove("hidden");
  if (progressBar) progressBar.style.width = "20%";

  const ext  = file.name.split(".").pop() || "jpg";
  const path = `${currentUser.id}/avatar_${Date.now()}.${ext}`;

  const { error: upErr } = await db.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: true
  });

  if (upErr) {
    progressWrap?.classList.add("hidden");
    toast("Erreur upload avatar : " + upErr.message, "error");
    return;
  }

  if (progressBar) progressBar.style.width = "70%";

  const { data: urlData } = db.storage.from("avatars").getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;

  if (!publicUrl) {
    progressWrap?.classList.add("hidden");
    toast("Impossible de rÃ©cupÃ©rer l'URL de l'avatar", "error");
    return;
  }

  if (progressBar) progressBar.style.width = "90%";

  const myProfileIds = userProfiles.map(p => p.id);
  for (const pid of myProfileIds) {
    await db.from("profiles").update({ avatar_url: publicUrl }).eq("id", pid);
  }

  userAvatarUrl = publicUrl;
  userProfiles.forEach(p => { p.avatar_url = publicUrl; });

  if (progressBar) progressBar.style.width = "100%";
  setTimeout(() => progressWrap?.classList.add("hidden"), 600);

  updateAvatarUI();
  buildSwiper();
  buildStories();
  toast("Photo de profil mise Ã  jour !", "success");
  haptic(15);
}

document.getElementById("avatar-file-input")?.addEventListener("change", async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  // FIX: Compresser l'image avant upload
  const compressed = await compressAvatar(file);
  await uploadAvatar(compressed);
  e.target.value = "";
});

document.getElementById("btn-avatar-remove")?.addEventListener("click", async () => {
  if (!currentUser) return;
  const myProfileIds = userProfiles.map(p => p.id);
  for (const pid of myProfileIds) {
    await db.from("profiles").update({ avatar_url: null }).eq("id", pid);
  }
  userAvatarUrl = null;
  userProfiles.forEach(p => { p.avatar_url = null; });
  updateAvatarUI();
  buildSwiper();
  buildStories();
  toast("Photo supprimÃ©e", "info");
});

/* Avatar camÃ©ra */
document.getElementById("btn-avatar-camera")?.addEventListener("click", async () => {
  try {
    avatarCamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    const video = document.getElementById("avatar-camera-stream");
    const controls = document.getElementById("avatar-camera-controls");
    if (video) { video.srcObject = avatarCamStream; video.classList.remove("hidden"); }
    controls?.classList.remove("hidden");
    haptic(10);
  } catch (err) {
    toast("CamÃ©ra inaccessible : " + err.message, "error");
  }
});

document.getElementById("btn-avatar-snap")?.addEventListener("click", () => {
  const video  = document.getElementById("avatar-camera-stream");
  const cvs    = document.getElementById("avatar-canvas");
  if (!avatarCamStream || !cvs || !video) return;

  const vw = video.videoWidth  || 320;
  const vh = video.videoHeight || 320;
  const size = Math.min(vw, vh);
  cvs.width  = size;
  cvs.height = size;
  const c = cvs.getContext("2d");
  c.drawImage(video, (vw - size) / 2, (vh - size) / 2, size, size, 0, 0, size, size);

  cvs.toBlob(async blob => {
    if (!blob) return;
    stopAvatarCamera();
    const file = new File([blob], `avatar_${Date.now()}.jpg`, { type: "image/jpeg" });
    await uploadAvatar(file);
  }, "image/jpeg", 0.88);
  haptic(15);
});

document.getElementById("btn-avatar-cam-stop")?.addEventListener("click", stopAvatarCamera);

function stopAvatarCamera() {
  if (avatarCamStream) {
    avatarCamStream.getTracks().forEach(t => t.stop());
    avatarCamStream = null;
  }
  const video    = document.getElementById("avatar-camera-stream");
  const controls = document.getElementById("avatar-camera-controls");
  video?.classList.add("hidden");
  controls?.classList.add("hidden");
}

// ============================================================
// FAB BOUTON FLOTTANT
// ============================================================

let fabOpen = false;

function initFab() {
  updateFabActiveState();
  updateFabVisibility(document.querySelector(".screen.active")?.id);

  const fab = document.getElementById("fab-main");
  if (!fab) return;

  fab.addEventListener("click", () => {
    fabOpen = !fabOpen;
    toggleFabMenu(fabOpen);
    haptic(12);
  });

  document.querySelectorAll(".fab-option").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const type = btn.dataset.type;
      const idx  = userProfiles.findIndex(p => p.profile_type === type);
      if (idx >= 0) {
        setActiveProfile(idx);
        toast(`Profil ${profileLabel(type)} activÃ©`, "success");
      }
      toggleFabMenu(false);
      haptic(15);
    });
  });

  document.addEventListener("click", e => {
    if (fabOpen && !e.target.closest("#fab-container")) {
      toggleFabMenu(false);
    }
  });

  wireFabDrag(fab);
}

function toggleFabMenu(open) {
  fabOpen = open;
  const container = document.getElementById("fab-container");
  const icon      = document.getElementById("fab-icon");
  if (!container) return;
  container.classList.toggle("open", open);
  document.getElementById("fab-main")?.classList.toggle("open", open);
  if (icon) icon.className = open ? "fa-solid fa-xmark" : "fa-solid fa-user-gear";
}

function hideFab() {
  const container = document.getElementById("fab-container");
  container?.classList.add("hidden");
  toggleFabMenu(false);
}

function updateFabVisibility(screenId) {
  const container = document.getElementById("fab-container");
  const offlineBtn = document.getElementById("btn-offline-hub");
  if (!container) return;
  const hide = !screenId || screenId === "screen-auth" || screenId === "screen-setup";
  container.classList.toggle("hidden", hide);
  if (offlineBtn) offlineBtn.style.display = hide ? "none" : "flex";
}

function updateFabActiveState() {
  document.querySelectorAll(".fab-option").forEach(btn => {
    const isActive = activeProfile && btn.dataset.type === activeProfile.profile_type;
    btn.classList.toggle("active-profile", isActive);
  });
}

/* FAB Drag to change profile */
function wireFabDrag(fab) {
  let dragging = false;
  let startX = 0, startY = 0;
  let currentTarget = null;

  fab.addEventListener("touchstart", e => {
    startX   = e.touches[0].clientX;
    startY   = e.touches[0].clientY;
    dragging = false;
    currentTarget = null;
  }, { passive: true });

  // FIX: non-passive pour preventDefault pendant le glissement FAB
  fab.addEventListener("touchmove", e => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!dragging && Math.sqrt(dx*dx + dy*dy) > 12) {
      dragging = true;
      toggleFabMenu(true);
    }
    if (!dragging) return;
    // FIX: EmpÃªcher scroll page pendant drag FAB
    e.preventDefault();

    const tx = e.touches[0].clientX;
    const ty = e.touches[0].clientY;

    let nearest = null;
    let minDist = 999;

    document.querySelectorAll(".fab-option").forEach(btn => {
      const rect = btn.getBoundingClientRect();
      const cx   = rect.left + rect.width / 2;
      const cy   = rect.top  + rect.height / 2;
      const dist = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
      // FIX: Feedback visuel renforcÃ© sur l'option ciblÃ©e
      if (dist < 55) {
        btn.style.transform = "scale(1.25)";
        btn.style.boxShadow = "0 0 0 3px #fff, 0 0 24px rgba(255,255,255,0.5)";
      } else {
        btn.style.transform = "";
        btn.style.boxShadow = "";
      }
      if (dist < minDist) { minDist = dist; nearest = btn; }
    });

    currentTarget = minDist < 65 ? nearest : null;
  }, { passive: false }); // FIX: non-passive

  fab.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    // FIX: RÃ©initialiser tous les styles inline des options
    document.querySelectorAll(".fab-option").forEach(b => {
      b.style.transform = "";
      b.style.boxShadow = "";
    });
    if (currentTarget) {
      currentTarget.click();
    } else {
      toggleFabMenu(false);
    }
    currentTarget = null;
  });
}

// ============================================================
// NAVIGATION BASSE
// ============================================================

function wireBottomNav() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.screen;
      if (!target) return;
      // FIX: ignorer les clics nav quand on est dans le chat (Ã©vite de quitter la conv)
      const chatActive = document.getElementById("screen-chat")?.classList.contains("active");
      if (chatActive) return;

      if (target === "screen-main") updateMsgBadge(0);

      const studioActive = document.getElementById("screen-studio")?.classList.contains("active");
      if (studioActive && target !== "screen-studio") stopCamera();

      showScreen(target);
      haptic(8);

      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(`[data-screen="${target}"]`).forEach(b => b.classList.add("active"));

      if (target === "screen-feed") {
        playCurrentFeedVideo();
      } else if (target === "screen-hub") {
        // Forcer la rÃ©initialisation du Hub
        setTimeout(() => {
          if (typeof window.refreshHub === 'function') window.refreshHub();
        }, 50);
      } else {
        pauseAllFeedVideos();
      }
    });
  });
}

// ============================================================
// CHAT TEMPS RÃ‰EL
// ============================================================

function openChat(contact, myProfile) {
  chatContact   = contact;
  chatMyProfile = myProfile;

  const nameEl  = document.getElementById("chat-contact-name");
  const badgeEl = document.getElementById("chat-profile-badge");
  const avatarEl = document.getElementById("chat-contact-avatar");

  if (nameEl)  nameEl.textContent  = contact.contact_name;
  if (badgeEl) badgeEl.textContent = `${profileEmoji(myProfile.profile_type)} ${myProfile.name}`;
  if (avatarEl) {
    avatarEl.textContent = initial(contact.contact_name);
    avatarEl.style.background = "linear-gradient(135deg,var(--primary),var(--accent))";
  }

  showScreen("screen-chat");
  // Statut en ligne dans le header
  setTimeout(() => setOnlineStatus(contact), 100);
  // Mise Ã  jour badge messages non lus
  setTimeout(() => updateUnreadBadge(), 200);
// ===== ACCUSÃ‰S DE LECTURE + INDICATEUR DE FRAPPE =====
const markAsRead = async () => {
  if (!chatContact.contact_profile_id) return;
  const { error } = await db
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('to_profile_id', chatMyProfile.id)
    .eq('from_profile_id', chatContact.contact_profile_id)
    .is('read_at', null);
  if (error) console.error("Erreur marquage lu:", error);
};
markAsRead();

if (typingChannel) db.removeChannel(typingChannel);
typingChannel = db.channel(`typing:${chatMyProfile.id}:${chatContact.contact_profile_id}`);
typingChannel
  .on('broadcast', { event: 'typing' }, (payload) => {
    const isTyping = payload.payload.isTyping;
    const indicator = document.getElementById('typing-indicator');
    if (isTyping && indicator) indicator.classList.remove('hidden');
    else if (indicator) indicator.classList.add('hidden');
  })
  .subscribe();

const input = document.getElementById('message-input');
// FIX: retirer l'ancien listener avant d'en ajouter un nouveau (Ã©vite l'accumulation)
if (currentTypingHandler) {
  input?.removeEventListener('input', currentTypingHandler);
  currentTypingHandler = null;
}
const handleTyping = () => {
  if (!chatMyProfile || !chatContact) return;
  typingChannel?.send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId: chatMyProfile.id, isTyping: true }
  });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typingChannel?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: chatMyProfile.id, isTyping: false }
    });
  }, 2000);
};
currentTypingHandler = handleTyping;
input?.addEventListener('input', handleTyping);


  loadMessages();
  subscribeToMessages();
  wireTypingIndicator();
}

async function loadMessages() {
  if (!chatContact || !chatMyProfile) return;
  const container = document.getElementById("messages-container");
  if (!container) return;

  container.innerHTML = "";

  const myId       = chatMyProfile.id;
  const contactPid = chatContact.contact_profile_id || null;

  let query;

  if (contactPid) {
    query = db.from("messages")
      .select("*")
      .or(
        `and(from_profile_id.eq.${myId},to_profile_id.eq.${contactPid}),` +
        `and(from_profile_id.eq.${contactPid},to_profile_id.eq.${myId})`
      )
      .order("created_at", { ascending: true })
      .limit(50);
  } else {
    // FIX: pas de contact_profile_id â€” on n'affiche rien pour Ã©viter une fuite de donnÃ©es
    const hint = document.createElement("div");
    hint.style.cssText = "text-align:center;font-size:0.75rem;color:var(--text-muted);padding:1.5rem 1rem;";
    hint.textContent = "â„¹ï¸ Ce contact n'a pas encore d'ID Trinite. Demandez-lui de partager son profil.";
    container.appendChild(hint);
    return;
  }

  const { data, error } = await query;
  if (error) { toast("Erreur messages : " + error.message, "error"); return; }

  (data || []).forEach(msg => appendBubble(msg, myId));
  container.scrollTop = container.scrollHeight;
}

function appendBubble(msg, myProfileId) {
  const container = document.getElementById("messages-container");
  if (!container) return;

  const isSent = msg.from_profile_id === myProfileId;
  const div    = document.createElement("div");
  div.className = `bubble ${isSent ? "sent" : "received"}`;
  if (msg.id) div.dataset.msgId = msg.id;
  div.dataset.isSent = isSent ? "1" : "0";

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
  } else if (msg.content_type === "image") {
    div.innerHTML = `
      <img class="bubble-img" src="${escapeHtml(msg.content)}" alt="Image" loading="lazy" />
      <div class="bubble-time">${formatTime(msg.created_at)}</div>`;
  } else {
    const isRead = msg.read_at !== null;
    const checkIcon = isSent
      ? (isRead ? '<i class="fa-solid fa-check-double" style="color:#818cf8"></i>' : '<i class="fa-solid fa-check"></i>')
      : "";
    div.innerHTML = `
      <span class="msg-text">${escapeHtml(msg.content)}</span>
      <div class="bubble-time">${formatTime(msg.created_at)} ${checkIcon}</div>`;
  }

  // Long press â†’ reaction picker + delete
  let pressTimer = null;
  const startPress = () => { pressTimer = setTimeout(() => showReactionPicker(div, msg.id, isSent), 500); };
  const clearPress = () => clearTimeout(pressTimer);
  div.addEventListener("touchstart",  startPress, { passive: true });
  div.addEventListener("touchend",    clearPress);
  div.addEventListener("touchmove",   clearPress, { passive: true });
  div.addEventListener("mousedown",   startPress);
  div.addEventListener("mouseup",     clearPress);
  div.addEventListener("mouseleave",  clearPress);
  div.addEventListener("contextmenu", (e) => { e.preventDefault(); showReactionPicker(div, msg.id, isSent); });

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function subscribeToMessages() {
  if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }

  const myId        = chatMyProfile.id;
  const contactPid  = chatContact.contact_profile_id || null;
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

/* ===== TYPING INDICATOR ===== */
// FIX: Ancienne version ajoutait un nouveau listener Ã  chaque ouverture de chat
// et masquait (Ã  tort) l'indicateur quand L'UTILISATEUR tapait plutÃ´t que le contact.
// L'indicateur est dÃ©sormais pilotÃ© uniquement par le channel broadcast dans openChat().
function wireTypingIndicator() { /* gÃ©rÃ© par typingChannel broadcast */ }

document.getElementById("btn-send")?.addEventListener("click", sendMessage);
document.getElementById("message-input")?.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

async function sendMessage() {
  const input   = document.getElementById("message-input");
  const content = input?.value.trim();
  if (!content || !chatContact || !chatMyProfile) return;
  input.value = "";
  haptic(8);

  const contactPid = chatContact.contact_profile_id || null;
  const payload = {
    from_profile_id: chatMyProfile.id,
    to_profile_id:   contactPid,
    content,
    content_type:    "text"
  };

  if (!isOnline) {
    await saveToOfflineQueue(payload);
    toast("Message en attente (hors-ligne) ðŸ•", "info");
    // Afficher le message localement avec badge "en attente"
    appendPendingMessage(content);
    return;
  }

  const { error } = await db.from("messages").insert(payload);
  if (error) toast("Erreur envoi : " + error.message, "error");
}

function appendPendingMessage(content) {
  // FIX: Ã©tait "messages-list" (inexistant) â€” le vrai conteneur est "messages-container"
  const list = document.getElementById("messages-container");
  if (!list) return;
  const div = document.createElement("div");
  div.className = "bubble sent msg-pending";
  div.innerHTML = `<span class="msg-text">${escapeHtml(content)}</span>
    <span class="msg-pending-badge"><i class="fa-solid fa-clock"></i> En attente</span>`;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

document.getElementById("btn-back")?.addEventListener("click", () => {
  if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (typingChannel) {
  db.removeChannel(typingChannel);
  typingChannel = null;
}
clearTimeout(typingTimeout);
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
    mediaRecorder?.stop();
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks  = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) voiceChunks.push(e.data); };

    mediaRecorder.onstop = async () => {
      isRecording = false;
      btn.classList.remove("recording");
      btn.title = "Message vocal";
      btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      stream.getTracks().forEach(t => t.stop());

      if (voiceChunks.length === 0 || !chatContact || !chatMyProfile) return;

      const durationSec = Math.max(1, Math.round(voiceChunks.length / 3));
      const transcript  = `ðŸŽ¤ Message vocal (${durationSec}s)`;

      const contactPid = chatContact.contact_profile_id || null;
      const { error } = await db.from("messages").insert({
        from_profile_id: chatMyProfile.id,
        to_profile_id:   contactPid,
        content:         transcript,
        content_type:    "voice"
      });
      if (error) toast("Erreur envoi vocal : " + error.message, "error");
    };

    mediaRecorder.start(100);
    isRecording = true;
    btn.classList.add("recording");
    btn.title = "ArrÃªter l'enregistrement";
    btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
    haptic(15);

  } catch (err) {
    toast("Micro inaccessible : " + err.message, "error");
  }
}

// ============================================================
// FONCTIONNALITÃ‰: BADGE MESSAGES NON LUS
// ============================================================

async function updateUnreadBadge() {
  if (!activeProfile) return;
  try {
    const { count } = await db.from("messages")
      .select("id", { count: "exact", head: true })
      .eq("to_profile_id", activeProfile.id)
      .is("read_at", null);
    const badge = document.getElementById("msg-badge");
    if (!badge) return;
    if (count && count > 0) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  } catch (_) {}
}

// ============================================================
// FONCTIONNALITÃ‰: STATUT EN LIGNE dans le header du chat
// ============================================================

function setOnlineStatus(contact) {
  const statusEl = document.getElementById("chat-online-status");
  if (!statusEl) return;
  // Simuler statut en ligne basÃ© sur l'id du contact (stable par session)
  const seed = [...(contact.id || "a")].reduce((a, c) => a + c.charCodeAt(0), 0);
  const isOnline = seed % 5 < 2; // ~40% en ligne
  statusEl.innerHTML = isOnline
    ? `<span class="online-dot"></span><span class="online-label-green">En ligne</span>`
    : `<span class="online-label-muted">DerniÃ¨re vue rÃ©cemment</span>`;
}

// ============================================================
// FONCTIONNALITÃ‰: RÃ‰ACTIONS AUX MESSAGES (long press)
// ============================================================

let reactionTargetMsg = null;
const messageReactions = {};

function showReactionPicker(bubbleEl, msgId, isSent) {
  reactionTargetMsg = { el: bubbleEl, id: msgId, isSent };
  const picker = document.getElementById("reaction-picker");
  if (!picker) return;
  const rect = bubbleEl.getBoundingClientRect();
  const top  = Math.max(4, rect.top - 68 + window.scrollY);
  const left = Math.max(4, Math.min(rect.left, window.innerWidth - 260));
  picker.style.top  = top  + "px";
  picker.style.left = left + "px";
  picker.classList.remove("hidden");
  haptic(12);
  setTimeout(() => {
    document.addEventListener("click", () => {
      picker.classList.add("hidden");
      reactionTargetMsg = null;
    }, { once: true });
  }, 50);
}

document.querySelectorAll(".react-btn[data-emoji]").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!reactionTargetMsg) return;
    const emoji = btn.dataset.emoji;
    const { el, id } = reactionTargetMsg;
    if (!messageReactions[id]) messageReactions[id] = [];
    const existing = messageReactions[id].find(r => r.emoji === emoji);
    if (existing) messageReactions[id] = messageReactions[id].filter(r => r !== existing);
    else messageReactions[id].push({ emoji });
    renderReactions(el, id);
    document.getElementById("reaction-picker")?.classList.add("hidden");
    reactionTargetMsg = null;
    haptic(8);
  });
});

function renderReactions(bubbleEl, msgId) {
  let bar = bubbleEl.querySelector(".bubble-reactions");
  const reactions = messageReactions[msgId] || [];
  if (reactions.length === 0) { bar?.remove(); return; }
  if (!bar) { bar = document.createElement("div"); bar.className = "bubble-reactions"; bubbleEl.appendChild(bar); }
  const grouped = {};
  reactions.forEach(r => { grouped[r.emoji] = (grouped[r.emoji] || 0) + 1; });
  bar.innerHTML = Object.entries(grouped)
    .map(([em, cnt]) => `<span class="bubble-reaction-chip">${em}${cnt > 1 ? ` ${cnt}` : ""}</span>`)
    .join("");
}

// ============================================================
// FONCTIONNALITÃ‰: SUPPRIMER UN MESSAGE
// ============================================================

document.querySelector(".delete-msg-btn")?.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (!reactionTargetMsg) return;
  const { el, id, isSent } = reactionTargetMsg;
  document.getElementById("reaction-picker")?.classList.add("hidden");
  reactionTargetMsg = null;
  if (!isSent) { toast("Vous ne pouvez supprimer que vos propres messages.", "info"); return; }
  if (!id) { el.remove(); return; }
  try {
    await db.from("messages").delete().eq("id", id);
    el.style.transition = "opacity 0.3s, transform 0.3s";
    el.style.opacity    = "0";
    el.style.transform  = "scale(0.8)";
    setTimeout(() => el.remove(), 320);
    toast("Message supprimÃ©", "info");
  } catch (err) {
    toast("Erreur : " + (err.message || err), "error");
  }
});

// ============================================================
// FONCTIONNALITÃ‰: RECHERCHE DANS LE CHAT
// ============================================================

document.getElementById("btn-chat-search")?.addEventListener("click", () => {
  const bar = document.getElementById("chat-search-bar");
  if (!bar) return;
  bar.classList.toggle("hidden");
  if (!bar.classList.contains("hidden")) {
    document.getElementById("chat-search-input")?.focus();
  } else {
    // Reset highlights when closing
    document.querySelectorAll("#messages-container .bubble").forEach(b => {
      b.style.opacity = ""; b.style.outline = "";
    });
    const inp = document.getElementById("chat-search-input");
    if (inp) inp.value = "";
    const cnt = document.getElementById("chat-search-count");
    if (cnt) cnt.textContent = "";
  }
});

document.getElementById("chat-search-input")?.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  const bubbles = document.querySelectorAll("#messages-container .bubble");
  let count = 0;
  bubbles.forEach(b => {
    const text = b.textContent.toLowerCase();
    if (!q) { b.style.opacity = ""; b.style.outline = ""; return; }
    if (text.includes(q)) {
      b.style.opacity = "1"; b.style.outline = "2px solid var(--primary)";
      b.style.borderRadius = "12px"; count++;
      b.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      b.style.opacity = "0.25"; b.style.outline = "";
    }
  });
  const countEl = document.getElementById("chat-search-count");
  if (countEl) countEl.textContent = q ? `${count} rÃ©sultat${count !== 1 ? "s" : ""}` : "";
});

// ============================================================
// FONCTIONNALITÃ‰: IMAGE EN PIÃˆCE JOINTE (aperÃ§u avant envoi)
// ============================================================

let pendingImgFile = null;

document.getElementById("btn-attach-img")?.addEventListener("click", () => {
  document.getElementById("chat-img-input")?.click();
});

document.getElementById("chat-img-input")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = "";
  pendingImgFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const modal = document.getElementById("img-preview-modal");
    const img   = document.getElementById("img-preview-src");
    if (img) img.src = ev.target.result;
    modal?.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

document.getElementById("btn-img-cancel")?.addEventListener("click", () => {
  document.getElementById("img-preview-modal")?.classList.add("hidden");
  pendingImgFile = null;
});

document.getElementById("btn-img-send")?.addEventListener("click", async () => {
  if (!pendingImgFile || !chatContact || !chatMyProfile) {
    toast("Ouvrez un chat avant d'envoyer une image.", "info"); return;
  }
  document.getElementById("img-preview-modal")?.classList.add("hidden");
  toast("Envoi en coursâ€¦", "info");
  const path = `chat/${chatMyProfile.id}/${Date.now()}_${pendingImgFile.name}`;
  const { error: upErr } = await db.storage.from("avatars").upload(path, pendingImgFile, { upsert: false });
  pendingImgFile = null;
  if (upErr) { toast("Erreur upload : " + upErr.message, "error"); return; }
  const { data: urlData } = db.storage.from("avatars").getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) { toast("Erreur URL image", "error"); return; }
  const { error } = await db.from("messages").insert({
    from_profile_id: chatMyProfile.id,
    to_profile_id:   chatContact.contact_profile_id || null,
    content:         publicUrl,
    content_type:    "image"
  });
  if (error) toast("Erreur envoi : " + error.message, "error");
});

// ============================================================
// FONCTIONNALITÃ‰: THÃˆMES DE COULEUR
// ============================================================

const COLOR_THEMES = {
  purple: { primary: "#7c3aed", accent: "#ec4899", glow: "rgba(124,58,237,0.4)" },
  blue:   { primary: "#1d4ed8", accent: "#3b82f6", glow: "rgba(29,78,216,0.4)"  },
  rose:   { primary: "#be185d", accent: "#f43f5e", glow: "rgba(190,24,93,0.4)"  },
  green:  { primary: "#059669", accent: "#10b981", glow: "rgba(5,150,105,0.4)"  },
  orange: { primary: "#c2410c", accent: "#f97316", glow: "rgba(194,65,12,0.4)"  },
};

function applyColorTheme(name) {
  const theme = COLOR_THEMES[name];
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty("--primary",      theme.primary);
  root.style.setProperty("--accent",       theme.accent);
  root.style.setProperty("--primary-glow", theme.glow);
  localStorage.setItem("trinite_color_theme", name);
  document.querySelectorAll(".color-dot").forEach(d =>
    d.classList.toggle("active", d.dataset.color === name));
}

// Restaurer le thÃ¨me sauvegardÃ©
const _savedColorTheme = localStorage.getItem("trinite_color_theme");
if (_savedColorTheme && COLOR_THEMES[_savedColorTheme]) applyColorTheme(_savedColorTheme);

document.getElementById("btn-theme-color")?.addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("color-theme-panel")?.classList.toggle("hidden");
});

document.querySelectorAll(".color-dot").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    applyColorTheme(btn.dataset.color);
    document.getElementById("color-theme-panel")?.classList.add("hidden");
    haptic(8);
    toast("ThÃ¨me appliquÃ© âœ“", "success");
  });
});

document.addEventListener("click", (e) => {
  if (!e.target.closest("#btn-theme-color") && !e.target.closest("#color-theme-panel")) {
    document.getElementById("color-theme-panel")?.classList.add("hidden");
  }
});

// ============================================================
// FONCTIONNALITÃ‰: STATS DU PROFIL
// ============================================================

async function loadProfilStats() {
  if (!activeProfile) return;
  try {
    const [cRes, pRes, sRes] = await Promise.all([
      db.from("contacts").select("id", { count: "exact", head: true }).eq("profile_id", activeProfile.id),
      db.from("posts").select("id", { count: "exact", head: true }).eq("profile_id", activeProfile.id),
      db.from("status").select("id", { count: "exact", head: true }).eq("profile_id", activeProfile.id).gte("expires_at", new Date().toISOString())
    ]);
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? 0; };
    setVal("stat-contacts", cRes.count);
    setVal("stat-posts",    pRes.count);
    setVal("stat-stories",  sRes.count);
  } catch (_) {}
}

// ============================================================
// FEED TIKTOK
// ============================================================

async function buildFeed() {
  const container = document.getElementById("feed-container");
  if (!container) return;
  container.innerHTML = "";

  let videos = [];

  // FEED STATUS ADD: Primary source â€” load posts from Supabase posts table
  if (currentUser) {
    try {
      const { data: posts, error } = await db.from("posts")
        .select("id, profile_id, video_url, caption, likes_count, is_demo, created_at, profiles(name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && posts && posts.length > 0) {
        // FEED STATUS ADD: Map posts rows to video objects used by the feed renderer
        videos = posts.map(p => ({
          id:         p.id,
          url:        p.video_url,
          author:     "@" + (p.profiles?.name || "trinitÃ©").toLowerCase().replace(/\s+/g, "_"),
          desc:       p.caption || "",
          likes:      p.likes_count || 0,
          comments:   0,
          isDemo:     p.is_demo || false,
          profile_id: p.profile_id
        }));
      }
    } catch (_) { /* non bloquant */ }
  }

  // FEED STATUS ADD: If posts table is empty, seed demo posts then fall back to DEMO_VIDEOS
  if (videos.length === 0) {
    if (currentUser) await initDemoPosts(); // FEED STATUS ADD: seed on first launch
    videos = [...DEMO_VIDEOS];              // FEED STATUS ADD: local fallback
  }

  // FEED STATUS ADD: Also surface user-uploaded videos from Storage not yet in posts table
  try {
    const { data: uploads } = await db.storage.from("videos").list(currentUser?.id || "", {
      limit: 20,
      offset: 0,
      sortBy: { column: "created_at", order: "desc" }
    });

    if (uploads && uploads.length > 0) {
      const userVids = uploads.map(f => {
        const { data: urlData } = db.storage.from("videos").getPublicUrl(`${currentUser.id}/${f.name}`);
        return {
          id:           f.id || f.name,
          url:          urlData?.publicUrl || "",
          author:       "@" + (activeProfile?.name || "moi").toLowerCase().replace(/\s+/, "_"),
          desc:         f.metadata?.description || f.name,
          likes:        Math.floor(Math.random() * 500),
          comments:     Math.floor(Math.random() * 50),
          isDemo:       false,
          profile_id:   activeProfile?.id,
          visibility:   activeProfile?.video_visibility || "everyone"
        };
      }).filter(v => v.url && !videos.some(existing => existing.url === v.url));
      videos = [...userVids, ...videos];
    }
  } catch (_) {}

  videos.forEach(v => {
    feedLikeCounts[v.id] = feedLikeCounts[v.id] ?? v.likes;
  });
  // FEED STATUS ADD: Cache global pour buildFavorites()
  window._feedVideosCache = videos;

  videos.forEach((v, index) => {
    const item = document.createElement("div");
    item.className = "feed-item";
    const isBookmarked = feedBookmarks[v.id] || false;
    const mediaType = v.media_type || "video";
    // Render photo as <img> if media_type is photo/image
    const mediaEl = (mediaType === "photo" || mediaType === "image")
      ? `<img class="feed-video" src="${escapeHtml(v.url)}" style="width:100%;height:100%;object-fit:cover" alt="${escapeHtml(v.desc)}" />`
      : `<video class="feed-video" src="${escapeHtml(v.url)}" loop playsinline preload="none" ${feedSoundEnabled ? "" : "muted"}></video>`;
    item.innerHTML = `
      ${mediaEl}
      <div class="feed-item-gradient"></div>
      ${v.isDemo ? "" : '<div class="feed-uploaded-badge">MES VIDÃ‰OS</div>'}
      <div class="feed-item-info">
        <div class="feed-author">${escapeHtml(v.author)}</div>
        <div class="feed-desc">${escapeHtml(v.desc)}</div>
      </div>
      <div class="feed-actions">
        <div style="display:flex;flex-direction:column;align-items:center;gap:0.3rem">
          <button class="feed-action-btn btn-like${feedLiked[v.id] ? " liked" : ""}" data-vid="${v.id}" aria-label="J'aime">
            <i class="fa-${feedLiked[v.id] ? "solid" : "regular"} fa-heart"></i>
          </button>
          <span class="feed-action-label liked-count">${formatCount(feedLikeCounts[v.id])}</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:0.3rem">
          <button class="feed-action-btn btn-comment" aria-label="Commenter">
            <i class="fa-regular fa-comment"></i>
          </button>
          <span class="feed-action-label comment-count">${formatCount(v.comments)}</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:0.3rem">
          <button class="feed-action-btn btn-bookmark${isBookmarked ? " bookmarked" : ""}" data-vid="${v.id}" aria-label="Favoris">
            <i class="fa-${isBookmarked ? "solid" : "regular"} fa-bookmark"></i>
          </button>
          <span class="feed-action-label">Sauv.</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:0.3rem">
          <button class="feed-action-btn btn-share" aria-label="Partager">
            <i class="fa-solid fa-share-nodes"></i>
          </button>
          <span class="feed-action-label">Partager</span>
        </div>
      </div>`;

    wireFeedItem(item, v, index);
    container.appendChild(item);
  });

  initFeedObserver();
}

/* ===== Sound Toggle ===== */
document.getElementById("btn-feed-sound")?.addEventListener("click", () => {
  feedSoundEnabled = !feedSoundEnabled;
  const icon = document.querySelector("#btn-feed-sound i");
  if (icon) icon.className = feedSoundEnabled ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark";

  document.querySelectorAll(".feed-video").forEach(v => {
    v.muted = !feedSoundEnabled;
  });
  haptic(10);
  toast(feedSoundEnabled ? "Son activÃ© ðŸ”Š" : "Son coupÃ© ðŸ”‡", "info");
});

// ============================================================
// FEED â€” Interactions
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
    haptic(15);
  });

  item.querySelector(".btn-comment")?.addEventListener("click", e => {
    e.stopPropagation();
    openComments(video.id, video.desc);
    haptic(10);
  });

  item.querySelector(".btn-bookmark")?.addEventListener("click", e => {
    e.stopPropagation();
    toggleBookmark(video.id, item);
    haptic(12);
  });

  item.querySelector(".btn-share")?.addEventListener("click", e => {
    e.stopPropagation();
    shareVideo(video);
    haptic(10);
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
  if (!wasLiked) {
    feedLikeCounts[videoId]++;
    showHeartAnimation(item);
    showLikeParticles(item);
    haptic(15);
  } else {
    feedLikeCounts[videoId]--;
  }

  const btn        = item.querySelector(".btn-like");
  const icon       = btn?.querySelector("i");
  const likedCount = item.querySelector(".liked-count");
  if (btn) {
    btn.classList.toggle("liked", feedLiked[videoId]);
    if (icon)       icon.className = `fa-${feedLiked[videoId] ? "solid" : "regular"} fa-heart`;
    if (likedCount) likedCount.textContent = formatCount(feedLikeCounts[videoId]);
  }
}

function showHeartAnimation(item) {
  const heart = document.createElement("div");
  heart.className = "heart-anim";
  heart.textContent = "â¤ï¸";
  item.appendChild(heart);
  setTimeout(() => heart.remove(), 750);
}

function showLikeParticles(item) {
  const colors = ["#fe2c55","#ff6b9d","#ff4081","#e91e8c","#f06292","#ff8a65","#ffd740"];
  const count  = 12;
  for (let i = 0; i < count; i++) {
    const angle    = (i / count) * Math.PI * 2;
    const dist     = 60 + Math.random() * 80;
    const tx       = Math.cos(angle) * dist;
    const ty       = Math.sin(angle) * dist;
    const duration = 0.6 + Math.random() * 0.4;

    const p = document.createElement("div");
    p.className = "like-particle";
    p.style.cssText = `
      left: calc(50% - 4px);
      top: calc(50% - 4px);
      background: ${colors[i % colors.length]};
      --tx: ${tx}px;
      --ty: ${ty}px;
      --particle-duration: ${duration}s;
      width: ${4 + Math.random() * 6}px;
      height: ${4 + Math.random() * 6}px;
    `;
    item.appendChild(p);
    setTimeout(() => p.remove(), duration * 1000 + 100);
  }
}

function openChatFromFeed(item) {
  if (!activeProfile) { toast("Connectez-vous d'abord", "error"); return; }

  if (item) {
    const hint = document.createElement("div");
    hint.className = "swipe-hint";
    hint.textContent = "ðŸ’¬ Ouverture du chatâ€¦";
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
// FEED â€” AutoPlay IntersectionObserver
// ============================================================

let feedObserver = null;

function initFeedObserver() {
  if (feedObserver) feedObserver.disconnect();

  feedObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const videoEl = entry.target.querySelector(".feed-video");
      if (!videoEl) return;
      if (entry.isIntersecting) {
        document.querySelectorAll(".feed-video").forEach(v => { if (v !== videoEl && !v.paused) v.pause(); });
        videoEl.muted = !feedSoundEnabled;
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
      }
    });
  }, { root: document.getElementById("feed-container"), threshold: 0.6 });

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
    if (v && v.paused) { v.muted = !feedSoundEnabled; v.play().catch(() => {}); }
  }
}

function pauseAllFeedVideos() {
  document.querySelectorAll(".feed-video").forEach(v => { if (!v.paused) v.pause(); });
}

// ============================================================
// STUDIO
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
const stCanvas       = document.getElementById("studio-canvas");

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
    haptic(10);
  } catch (err) {
    toast("CamÃ©ra inaccessible : " + err.message, "error");
  }
});

btnCameraStop?.addEventListener("click", stopCamera);

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  if (cameraPreview) { cameraPreview.srcObject = null; cameraPreview.classList.add("hidden"); }
  btnCameraStart?.classList.remove("hidden");
  btnCameraStop ?.classList.add("hidden");
  btnTakePhoto  ?.classList.add("hidden");
}

btnTakePhoto?.addEventListener("click", () => {
  if (!cameraStream || !stCanvas) return;
  const vw = cameraPreview.videoWidth  || 640;
  const vh = cameraPreview.videoHeight || 480;
  stCanvas.width  = vw;
  stCanvas.height = vh;
  const c = stCanvas.getContext("2d");
  c.drawImage(cameraPreview, 0, 0, vw, vh);

  stCanvas.toBlob(blob => {
    if (!blob) return;
    studioBlob     = blob;
    studioFileName = `photo_${Date.now()}.jpg`;
    // FIX: rÃ©voquer l'ancienne URL pour Ã©viter les fuites mÃ©moire
    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); }
    const url = URL.createObjectURL(blob);
    currentBlobUrl = url;
    photoPreview.src = url;
    photoPreview.classList.remove("hidden");
    videoPreview.classList.add("hidden");
    placeholder?.classList.add("hidden");
    stopCamera();
    showUploadSection(`ðŸ“· Photo â€” ${(blob.size / 1024).toFixed(0)} Ko`);
    haptic(15);
  }, "image/jpeg", 0.88);
});

fileInput?.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;
  studioFile = file; studioBlob = null; studioFileName = file.name;

  // FIX: rÃ©voquer l'ancienne URL pour Ã©viter les fuites mÃ©moire
  if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); }
  const url = URL.createObjectURL(file);
  currentBlobUrl = url;
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
  showUploadSection(`ðŸ“ ${file.name} â€” ${(file.size / (1024*1024)).toFixed(2)} Mo`);
  e.target.value = "";
});

function showUploadSection(info) {
  if (fileInfoEl) fileInfoEl.textContent = info;
  if (uploadSection) uploadSection.style.display = "";
}

btnUpload?.addEventListener("click", async () => {
  const desc    = document.getElementById("studio-desc")?.value.trim() || "VidÃ©o Trinite Chat";
  const fileObj = studioBlob
    ? new File([studioBlob], studioFileName, { type: "image/jpeg" })
    : studioFile;

  if (!fileObj) { toast("Aucun fichier Ã  publier", "error"); return; }
  if (!currentUser) { toast("Connectez-vous d'abord", "error"); return; }

  const progressWrap = document.getElementById("studio-upload-progress");
  const progressBar  = document.getElementById("studio-progress-bar");
  btnUpload.disabled = true;
  btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicationâ€¦';
  progressWrap?.classList.remove("hidden");
  if (progressBar) progressBar.style.width = "10%";

  const ext  = studioFileName.split(".").pop() || "mp4";
  const path = `${currentUser.id}/${Date.now()}.${ext}`;

  const progInterval = setInterval(() => {
    const cur = parseFloat(progressBar?.style.width || "10");
    if (cur < 85 && progressBar) progressBar.style.width = (cur + 5) + "%";
  }, 300);

  const { error } = await db.storage.from("videos").upload(path, fileObj, {
    cacheControl: "3600",
    upsert: false,
    metadata: { uploader: activeProfile?.name || "user", description: desc }
  });

  clearInterval(progInterval);
  btnUpload.disabled = false;
  btnUpload.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Publier dans le Feed';
  progressWrap?.classList.add("hidden");
  if (progressBar) progressBar.style.width = "0%";

  if (error) { toast("Erreur upload : " + error.message, "error"); return; }

  // FEED STATUS ADD: Get public URL and write a record in the posts table
  const { data: vidUrlData } = db.storage.from("videos").getPublicUrl(path);
  const vidPublicUrl = vidUrlData?.publicUrl;
  if (vidPublicUrl && activeProfile) {
    const { error: postErr } = await db.from("posts").insert({
      profile_id:  activeProfile.id,
      video_url:   vidPublicUrl,
      caption:     desc,
      likes_count: 0,
      is_demo:     false
    });
    if (postErr) console.warn("Trinite: post insert error:", postErr.message);
  }

  if (progressBar) progressBar.style.width = "100%";
  toast("PubliÃ© dans le Feed âœ“", "success");
  haptic(20);

  studioFile = null; studioBlob = null; studioFileName = null;
  // FIX: rÃ©voquer le blob URL aprÃ¨s publication
  if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }
  if (videoPreview) { videoPreview.src = ""; videoPreview.classList.add("hidden"); }
  if (photoPreview) { photoPreview.src = ""; photoPreview.classList.add("hidden"); }
  placeholder?.classList.remove("hidden");
  if (uploadSection) uploadSection.style.display = "none";
  const descInput = document.getElementById("studio-desc");
  if (descInput) descInput.value = "";

  await buildFeed();
});


// ============================================================
// ONLINE / OFFLINE DETECTION + INDEXEDDB QUEUE
// ============================================================
let isOnline = navigator.onLine;

(function initOfflineSystem() {
  const dot = document.getElementById("offline-dot");
  const btn = document.getElementById("btn-offline-hub");

  function updateStatus(notify) {
    isOnline = navigator.onLine;
    dot?.classList.toggle("offline", !isOnline);
    btn?.classList.toggle("offline-mode", !isOnline);
    if (notify === true) {
      if (!isOnline) toast("Mode hors-ligne activÃ©", "info");
      else { toast("Connexion rÃ©tablie âœ“", "success"); syncOfflineQueue(); }
    }
  }

  window.addEventListener("online",  () => updateStatus(true));
  window.addEventListener("offline", () => updateStatus(true));
  updateStatus(false);

  // Bouton toujours visible sauf sur auth/setup â€” polling simple
  function showOfflineBtn() {
    if (!btn) return;
    const active = document.querySelector(".screen.active");
    const id = active ? active.id : "";
    // FIX: aussi cacher sur screen-chat pour Ã©viter navigation accidentelle
    const hide = !id || id === "screen-auth" || id === "screen-setup" || id === "screen-chat";
    btn.style.display = hide ? "none" : "flex";
  }

  // VÃ©rifier toutes les 500ms â€” simple et fiable
  setInterval(showOfflineBtn, 500);
  showOfflineBtn();

  btn?.addEventListener("click", () => {
    showScreen("screen-hub");
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll('[data-screen="screen-hub"]').forEach(b => b.classList.add("active"));
    if (typeof window.refreshHub === 'function') window.refreshHub();
  });
})();

// IndexedDB â€” file d'attente messages offline
const IDB_NAME    = "trinite-offline";
const IDB_STORE   = "msg-queue";
let   idb         = null;

function openIDB() {
  return new Promise((resolve, reject) => {
    if (idb) return resolve(idb);
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(IDB_STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = e => { idb = e.target.result; resolve(idb); };
    req.onerror   = () => reject(req.error);
  });
}

async function saveToOfflineQueue(payload) {
  const db2 = await openIDB();
  return new Promise((resolve, reject) => {
    const tx  = db2.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).add({ ...payload, queuedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

async function syncOfflineQueue() {
  if (!isOnline) return;
  const db2 = await openIDB();
  const tx   = db2.transaction(IDB_STORE, "readwrite");
  const store = tx.objectStore(IDB_STORE);
  const all   = await new Promise(r => { const req = store.getAll(); req.onsuccess = () => r(req.result); });
  if (!all.length) return;
  let sent = 0;
  for (const item of all) {
    const { error } = await db.from("messages").insert({
      from_profile_id: item.from_profile_id,
      to_profile_id:   item.to_profile_id,
      content:         item.content,
      content_type:    "text"
    });
    if (!error) { store.delete(item.id); sent++; }
  }
  if (sent) toast(`${sent} message(s) synchronisÃ©(s) âœ“`, "success");
}

// ============================================================
// PASSWORD REVEAL TOGGLE
// ============================================================
function setupReveal(btnId, inputId) {
  const btn   = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;
  btn.addEventListener("click", () => {
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    btn.querySelector("i").className = isHidden ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
  });
}
setupReveal("reveal-login",    "login-password");
setupReveal("reveal-register", "register-password");

// ============================================================
// MOT DE PASSE OUBLIÃ‰
// ============================================================
document.getElementById("btn-forgot")?.addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  if (!email) {
    toast("Entrez votre email d'abord", "error");
    document.getElementById("login-email").focus();
    return;
  }
  const btn = document.getElementById("btn-forgot");
  btn.disabled = true;
  btn.textContent = "Envoi en coursâ€¦";
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href
  });
  btn.disabled = false;
  btn.textContent = "Mot de passe oubliÃ© ?";
  if (error) {
    toast("Erreur : " + error.message, "error");
  } else {
    toast("Email de rÃ©initialisation envoyÃ© âœ“", "success");
  }
});

// ============================================================
// FEED STATUS ADD: DEMO POSTS SEEDER â€” seeds DEMO_VIDEOS into posts table on first launch
// ============================================================

async function initDemoPosts() {
  if (!currentUser || !userProfiles.length) return;
  try {
    // FEED STATUS ADD: Check if demo posts already exist to avoid duplicate seeding
    const { data: existing } = await db.from("posts")
      .select("id")
      .eq("is_demo", true)
      .limit(1);
    if (existing && existing.length > 0) return; // already seeded

    const profileId = userProfiles[0]?.id;
    if (!profileId) return;

    // FEED STATUS ADD: Insert DEMO_VIDEOS array into Supabase posts table
    const demoPosts = DEMO_VIDEOS.map(v => ({
      profile_id:  profileId,
      video_url:   v.url,
      caption:     v.desc,
      likes_count: v.likes,
      is_demo:     true
    }));

    const { error } = await db.from("posts").insert(demoPosts);
    if (error) console.warn("Trinite initDemoPosts:", error.message);
  } catch (e) { /* non bloquant */ }
}

// ============================================================
// FEED STATUS ADD: STORY FULL-SCREEN VIEWER â€” for Supabase stories
// ============================================================

function openStoryFull(story) {
  // FEED STATUS ADD: Mark story as seen and open the shared story modal
  seenStories.add(story.id);
  haptic(8);

  const modal    = document.getElementById("modal-story");
  const avatarEl = document.getElementById("story-modal-avatar");
  const nameEl   = document.getElementById("story-modal-name");
  const bodyEl   = document.getElementById("story-modal-body");

  const name = story.profiles?.name || "Inconnu";

  if (avatarEl) {
    if (story.profiles?.avatar_url) {
      avatarEl.innerHTML = `<img src="${escapeHtml(story.profiles.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
    } else {
      avatarEl.textContent = initial(name);
    }
  }
  if (nameEl) nameEl.textContent = name;

  if (bodyEl) {
    // FEED STATUS ADD: Show video or image depending on media_type
    if (story.media_type === "video" && story.media_url) {
      bodyEl.innerHTML = `<video src="${escapeHtml(story.media_url)}" autoplay loop muted playsinline style="width:100%;max-height:70vh;object-fit:contain;border-radius:12px"></video>`;
    } else if (story.media_url) {
      bodyEl.innerHTML = `<img src="${escapeHtml(story.media_url)}" style="width:100%;max-height:70vh;object-fit:contain;border-radius:12px" alt="story" />`;
    } else {
      bodyEl.textContent = "âœ¨";
    }
  }

  const progressBar = modal?.querySelector(".story-progress-bar");
  if (progressBar) {
    progressBar.style.transition = "none";
    progressBar.style.animation  = "none";
    progressBar.style.width      = "0%";
    void progressBar.offsetWidth; // force reflow
    progressBar.style.animation  = "storyProgress 4s linear forwards";
  }

  modal?.classList.remove("hidden");
  buildStories();

  clearTimeout(openStory._t);
  openStory._t = setTimeout(() => modal?.classList.add("hidden"), 4000);
}

// ============================================================
// FEED STATUS ADD: STORY UPLOAD â€” ouvre la galerie du tÃ©lÃ©phone
// ============================================================

function openStoryUpload() {
  // FEED STATUS ADD: Trigger l'input file cachÃ© pour accÃ©der Ã  la galerie
  const input = document.getElementById("story-gallery-input");
  if (input) input.click();
}

// FEED STATUS ADD: Gestionnaire upload story depuis la galerie
document.getElementById("story-gallery-input")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file || !currentUser || !activeProfile) return;
  e.target.value = "";

  const isVideo = file.type.startsWith("video/");
  const ext     = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
  const path    = `stories/${currentUser.id}/${Date.now()}.${ext}`;

  toast("Publication de votre statutâ€¦", "info");

  // FEED STATUS ADD: Utilise le bucket "avatars" (existant) pour les stories
  const bucket = isVideo ? "videos" : "avatars";
  const { error: upErr } = await db.storage.from(bucket).upload(path, file, {
    cacheControl: "3600", upsert: false
  });
  if (upErr) {
    toast("Erreur upload story : " + (upErr.message || "vÃ©rifiez vos buckets Supabase."), "error");
    return;
  }

  const { data: urlData } = db.storage.from(bucket).getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) { toast("Erreur URL story", "error"); return; }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.from("status").insert({
    profile_id: activeProfile.id,
    media_url:  publicUrl,
    media_type: isVideo ? "video" : "image",
    expires_at: expiresAt
  });

  toast("Statut publiÃ© ! Visible 24h âœ“", "success");
  buildStories();
});

// ============================================================
// FEED STATUS ADD: COMMENTAIRES â€” bottom sheet
// ============================================================

let commentsCache = {}; // videoId â†’ [{author, text, time}]

function openComments(videoId, videoDesc) {
  currentCommentsVideoId = videoId;
  const sheet    = document.getElementById("comments-sheet");
  const backdrop = document.getElementById("comments-backdrop");
  sheet?.classList.add("open");
  backdrop?.classList.add("open");
  renderComments(videoId);
  document.getElementById("comment-input")?.focus();
}

function closeComments() {
  currentCommentsVideoId = null;
  document.getElementById("comments-sheet")?.classList.remove("open");
  document.getElementById("comments-backdrop")?.classList.remove("open");
}

function renderComments(videoId) {
  const list = document.getElementById("comments-list");
  if (!list) return;
  const items = commentsCache[videoId] || [];
  if (items.length === 0) {
    list.innerHTML = '<p class="comments-empty">Aucun commentaire â€” soyez le premier ! ðŸ’¬</p>';
    return;
  }
  list.innerHTML = items.map(c => `
    <div class="comment-item">
      <div class="comment-avatar">${escapeHtml(initial(c.author))}</div>
      <div class="comment-body">
        <div class="comment-author">${escapeHtml(c.author)}</div>
        <div class="comment-text">${escapeHtml(c.text)}</div>
        <div class="comment-time">${c.time}</div>
      </div>
    </div>`).join("");
  list.scrollTop = list.scrollHeight;
}

function submitComment() {
  const input   = document.getElementById("comment-input");
  const text    = input?.value.trim();
  if (!text || !currentCommentsVideoId) return;
  input.value = "";

  const author = activeProfile?.name || "Moi";
  const entry  = { author, text, time: "Ã€ l'instant" };

  if (!commentsCache[currentCommentsVideoId]) commentsCache[currentCommentsVideoId] = [];
  commentsCache[currentCommentsVideoId].push(entry);

  renderComments(currentCommentsVideoId);
  haptic(8);

  // FEED STATUS ADD: Update comment count badge on feed item
  const btn = document.querySelector(`.btn-like[data-vid="${currentCommentsVideoId}"]`);
  const countEl = btn?.closest(".feed-item")?.querySelector(".comment-count");
  if (countEl) {
    const n = commentsCache[currentCommentsVideoId].length;
    countEl.textContent = formatCount(n);
  }
}

document.getElementById("btn-comments-close")?.addEventListener("click", closeComments);
document.getElementById("comments-backdrop")?.addEventListener("click", closeComments);
document.getElementById("btn-comment-send")?.addEventListener("click", submitComment);
document.getElementById("comment-input")?.addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); submitComment(); }
});

// ============================================================
// FEED STATUS ADD: FAVORIS / BOOKMARK
// ============================================================

function toggleBookmark(videoId, item) {
  const wasBookmarked  = !!feedBookmarks[videoId];
  feedBookmarks[videoId] = !wasBookmarked;
  localStorage.setItem("trinite_bookmarks", JSON.stringify(feedBookmarks));

  const btn  = item.querySelector(".btn-bookmark");
  const icon = btn?.querySelector("i");
  if (btn)  btn.classList.toggle("bookmarked", !wasBookmarked);
  if (icon) icon.className = wasBookmarked ? "fa-regular fa-bookmark" : "fa-solid fa-bookmark";

  toast(wasBookmarked ? "RetirÃ© des favoris" : "AjoutÃ© aux favoris â­", "success");
}

// ============================================================
// FEED STATUS ADD: PARTAGE AMÃ‰LIORÃ‰
// ============================================================

function shareVideo(video) {
  const shareData = {
    title: "Trinite Chat",
    text:  video.desc || "Regarde cette vidÃ©o sur Trinite Chat !",
    url:   video.url  || location.href
  };
  if (navigator.share && navigator.canShare?.(shareData)) {
    navigator.share(shareData).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(video.url || location.href)
      .then(() => toast("Lien copiÃ© dans le presse-papier !", "success"))
      .catch(() => toast("Partage non disponible", "info"));
  } else {
    toast("Lien : " + (video.url || location.href), "info");
  }
}

// ============================================================
// FEED STATUS ADD: Ã‰CRAN FAVORIS
// ============================================================

function buildFavorites() {
  const list = document.getElementById("favorites-list");
  if (!list) return;

  // Trouver toutes les vidÃ©os/posts bookmarkÃ©s
  const bookmarkedIds = Object.keys(feedBookmarks).filter(id => feedBookmarks[id]);
  const allVideos = window._feedVideosCache || [];
  const bookmarked = bookmarkedIds
    .map(id => allVideos.find(v => v.id === id))
    .filter(Boolean);

  if (bookmarked.length === 0) {
    list.innerHTML = `
      <div class="favorites-empty">
        <i class="fa-regular fa-bookmark" style="font-size:2.5rem;color:var(--text-muted)"></i>
        <p>Aucun favori pour l'instant.</p>
        <p style="font-size:0.8rem;color:var(--text-muted)">Tape <i class="fa-solid fa-bookmark"></i> sur une vidÃ©o du feed.</p>
      </div>`;
    return;
  }

  list.innerHTML = "";
  bookmarked.forEach(v => {
    const card = document.createElement("div");
    card.className = "fav-card";
    const mediaType = v.media_type || "video";
    const mediaEl = (mediaType === "photo" || mediaType === "image")
      ? `<img src="${escapeHtml(v.url)}" alt="${escapeHtml(v.desc)}" />`
      : `<video src="${escapeHtml(v.url)}" muted playsinline preload="metadata"></video>`;
    card.innerHTML = `
      ${mediaEl}
      <div class="fav-card-overlay">
        <div class="fav-card-author">${escapeHtml(v.author)}</div>
        <div class="fav-card-desc">${escapeHtml(v.desc)}</div>
      </div>
      <button class="fav-card-remove" aria-label="Retirer des favoris"><i class="fa-solid fa-bookmark"></i></button>`;

    // Clic sur la carte â†’ aller au feed
    card.addEventListener("click", e => {
      if (e.target.closest(".fav-card-remove")) return;
      showScreen("screen-feed");
      document.querySelectorAll(".nav-btn").forEach(b =>
        b.classList.toggle("active", b.dataset.screen === "screen-feed"));
    });

    // Retirer des favoris
    card.querySelector(".fav-card-remove").addEventListener("click", e => {
      e.stopPropagation();
      feedBookmarks[v.id] = false;
      localStorage.setItem("trinite_bookmarks", JSON.stringify(feedBookmarks));
      // Mettre Ã  jour le bouton dans le feed si visible
      const feedBtn = document.querySelector(`.btn-bookmark[data-vid="${v.id}"]`);
      if (feedBtn) {
        feedBtn.classList.remove("bookmarked");
        const icon = feedBtn.querySelector("i");
        if (icon) icon.className = "fa-regular fa-bookmark";
      }
      buildFavorites();
      toast("RetirÃ© des favoris", "info");
      haptic(8);
    });

    list.appendChild(card);
  });
}

// FEED STATUS ADD: Hook showScreen pour charger les favoris Ã  l'ouverture
const _origShowScreen = window.showScreen;
if (_origShowScreen) {
  window.showScreen = function(id) {
    _origShowScreen(id);
    if (id === "screen-favorites") buildFavorites();
  };
}

// ============================================================
// FEED STATUS ADD: FILTRE VIDÃ‰O / PHOTO
// ============================================================

document.querySelectorAll(".feed-filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".feed-filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    feedFilter = btn.dataset.filter || "all";
    applyFeedFilter();
    haptic(8);
  });
});

function applyFeedFilter() {
  document.querySelectorAll(".feed-item").forEach(item => {
    if (feedFilter === "all") {
      item.style.display = "";
      return;
    }
    const hasVideo = !!item.querySelector("video");
    const show = feedFilter === "video" ? hasVideo : !hasVideo;
    item.style.display = show ? "" : "none";
  });
}

// ============================================================
// DÃ‰MARRAGE
// ============================================================
initAuth();


// ============================================================
// HUB HORS-LIGNE : Snake, Casino, Paris sportifs
// ============================================================

window.initHub = function() {
  // Attendre que l'Ã©cran Hub soit chargÃ©
  const hubScreen = document.getElementById("screen-hub");
  if (!hubScreen) return;

  // ========== SNAKE ==========
  const snakeCanvas = document.getElementById("hub-snake-canvas");
  let snakeCtx = snakeCanvas?.getContext("2d");
  const CELL = 20;
  const COLS = 15;
  const ROWS = 15;
  let snake, snakeDir, snakeNextDir, snakeFood, snakeScore, snakeBest, snakeLoop, snakeRunning;

  function initHubSnake() {
    snake = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }];
    snakeDir = { x: 1, y: 0 };
    snakeNextDir = { x: 1, y: 0 };
    snakeScore = 0;
    snakeBest = parseInt(localStorage.getItem("hub-snake-best") || "0");
    document.getElementById("hub-snake-score").textContent = 0;
    document.getElementById("hub-snake-best").textContent = snakeBest;
    placeHubFood();
    drawHubSnake();
  }

  function placeHubFood() {
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    snakeFood = pos;
  }

  function drawHubSnake() {
    if (!snakeCtx || !snakeCanvas) return;
    snakeCtx.fillStyle = "#0a0a18";
    snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
    // Food
    snakeCtx.font = "16px serif";
    snakeCtx.textAlign = "center";
    snakeCtx.textBaseline = "middle";
    snakeCtx.fillText("ðŸŽ", snakeFood.x * CELL + CELL/2, snakeFood.y * CELL + CELL/2);
    // Snake
    snake.forEach((seg, i) => {
      const ratio = 1 - i / snake.length;
      snakeCtx.fillStyle = `rgba(${Math.round(139 + (219-139)*(1-ratio))}, ${Math.round(92 + (39-92)*(1-ratio))}, 246, ${0.5 + ratio * 0.5})`;
      snakeCtx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function stepHubSnake() {
    snakeDir = { ...snakeNextDir };
    const head = { x: snake[0].x + snakeDir.x, y: snake[0].y + snakeDir.y };
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return hubGameOver();
    if (snake.some(s => s.x === head.x && s.y === head.y)) return hubGameOver();
    snake.unshift(head);
    if (head.x === snakeFood.x && head.y === snakeFood.y) {
      snakeScore++;
      document.getElementById("hub-snake-score").textContent = snakeScore;
      if (snakeScore > snakeBest) {
        snakeBest = snakeScore;
        localStorage.setItem("hub-snake-best", snakeBest);
        document.getElementById("hub-snake-best").textContent = snakeBest;
      }
      placeHubFood();
    } else {
      snake.pop();
    }
    drawHubSnake();
  }

  function hubGameOver() {
    clearInterval(snakeLoop);
    snakeRunning = false;
    drawHubSnake();
    if (snakeCtx) {
      snakeCtx.fillStyle = "rgba(0,0,0,0.6)";
      snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
      snakeCtx.fillStyle = "#fff";
      snakeCtx.font = "bold 16px Inter";
      snakeCtx.textAlign = "center";
      snakeCtx.fillText("Game Over", snakeCanvas.width/2, snakeCanvas.height/2);
    }
    document.getElementById("hub-snake-start").textContent = "Rejouer";
  }

  function startHubSnake() {
    if (snakeRunning) return;
    initHubSnake();
    snakeRunning = true;
    clearInterval(snakeLoop);
    snakeLoop = setInterval(stepHubSnake, 150);
    document.getElementById("hub-snake-start").textContent = "En cours...";
  }

  document.getElementById("hub-snake-start")?.addEventListener("click", startHubSnake);
  document.querySelectorAll("#screen-hub [data-dir]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!snakeRunning) return;
      const d = btn.dataset.dir;
      if (d === "UP" && snakeDir.y !== 1) snakeNextDir = { x: 0, y: -1 };
      if (d === "DOWN" && snakeDir.y !== -1) snakeNextDir = { x: 0, y: 1 };
      if (d === "LEFT" && snakeDir.x !== 1) snakeNextDir = { x: -1, y: 0 };
      if (d === "RIGHT" && snakeDir.x !== -1) snakeNextDir = { x: 1, y: 0 };
    });
  });
  initHubSnake();

  // ========== CASINO ==========
  const SYMBOLS = ["ðŸ’", "â­", "ðŸ‹", "ðŸŠ", "7ï¸âƒ£", "ðŸ’Ž", "ðŸŽ°"];
  const PAYTABLE = { "ðŸ’ŽðŸ’ŽðŸ’Ž": 50, "7ï¸âƒ£7ï¸âƒ£7ï¸âƒ£": 20, "ðŸ’ðŸ’ðŸ’": 10, "â­â­â­": 5 };
  let casinoTokens = parseInt(localStorage.getItem("hub-casino-tokens") || "500");
  let casinoSpinning = false;

  document.getElementById("hub-casino-tokens").textContent = casinoTokens;

  document.getElementById("hub-casino-reset")?.addEventListener("click", () => {
    casinoTokens = 500;
    localStorage.setItem("hub-casino-tokens", casinoTokens);
    document.getElementById("hub-casino-tokens").textContent = casinoTokens;
    document.getElementById("hub-casino-result").textContent = "Jetons rechargÃ©s !";
  });

  document.getElementById("hub-casino-spin")?.addEventListener("click", async () => {
    if (casinoSpinning) return;
    const bet = parseInt(document.getElementById("hub-casino-bet").value);
    if (casinoTokens < bet) {
      document.getElementById("hub-casino-result").textContent = "Jetons insuffisants !";
      return;
    }
    casinoTokens -= bet;
    localStorage.setItem("hub-casino-tokens", casinoTokens);
    document.getElementById("hub-casino-tokens").textContent = casinoTokens;
    casinoSpinning = true;
    document.getElementById("hub-casino-spin").disabled = true;

    const reels = ["hub-reel-0", "hub-reel-1", "hub-reel-2"];
    const results = [];
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 300));
      const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      results.push(sym);
      document.getElementById(reels[i]).textContent = sym;
    }

    const key = results.join("");
    let win = 0;
    let resultTxt = "";
    if (PAYTABLE[key]) {
      win = bet * PAYTABLE[key];
      resultTxt = `ðŸŽ‰ Jackpot ! +${win} jetons`;
    } else if (results[0] === results[1] || results[1] === results[2] || results[0] === results[2]) {
      win = bet * 2;
      resultTxt = `âœ“ Deux identiques ! +${win} jetons`;
    } else {
      resultTxt = `Perduâ€¦ -${bet} jetons`;
    }
    casinoTokens += win;
    localStorage.setItem("hub-casino-tokens", casinoTokens);
    document.getElementById("hub-casino-tokens").textContent = casinoTokens;
    document.getElementById("hub-casino-result").textContent = resultTxt;
    casinoSpinning = false;
    document.getElementById("hub-casino-spin").disabled = false;
  });

  // ========== PARIS SPORTIFS ==========
  const MATCHES = [
    { id: 1, team1: "Lyon", team2: "Paris", odds1: 2.1, odds2: 1.8 },
    { id: 2, team1: "Marseille", team2: "Monaco", odds1: 2.5, odds2: 1.6 },
    { id: 3, team1: "Nantes", team2: "Bordeaux", odds1: 1.9, odds2: 2.0 },
  ];
  let parisTokens = parseInt(localStorage.getItem("hub-paris-tokens") || "500");
  let parisBets = JSON.parse(localStorage.getItem("hub-paris-bets") || "[]");
  let parisHistory = JSON.parse(localStorage.getItem("hub-paris-history") || "[]");

  document.getElementById("hub-paris-tokens").textContent = parisTokens;

  function renderParisMatches() {
    const container = document.getElementById("hub-paris-matches");
    if (!container) return;
    container.innerHTML = "";
    MATCHES.forEach(m => {
      const existingBet = parisBets.find(b => b.matchId === m.id);
      const card = document.createElement("div");
      card.style.cssText = "background:var(--bg3); border-radius:12px; padding:0.75rem;";
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <strong>${m.team1}</strong> <span style="color:var(--text-muted)">VS</span> <strong>${m.team2}</strong>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button class="paris-bet-btn" data-match="${m.id}" data-pick="1" data-odds="${m.odds1}" ${existingBet ? 'disabled' : ''}
            style="flex:1; background:${existingBet?.pick === 1 ? 'var(--primary)' : 'var(--bg-card)'}; border:1px solid var(--border); border-radius:8px; padding:0.4rem; cursor:pointer;">
            ${m.team1}<br><strong>${m.odds1}Ã—</strong>
          </button>
          <button class="paris-bet-btn" data-match="${m.id}" data-pick="2" data-odds="${m.odds2}" ${existingBet ? 'disabled' : ''}
            style="flex:1; background:${existingBet?.pick === 2 ? 'var(--primary)' : 'var(--bg-card)'}; border:1px solid var(--border); border-radius:8px; padding:0.4rem; cursor:pointer;">
            ${m.team2}<br><strong>${m.odds2}Ã—</strong>
          </button>
        </div>
        ${existingBet ? `<div style="margin-top:0.5rem; font-size:0.7rem; color:#f59e0b;">Pari: ${existingBet.amount} jetons <button class="resolve-bet" data-match="${m.id}" style="margin-left:0.5rem; background:var(--primary); border:none; border-radius:8px; padding:0.2rem 0.5rem; color:#fff;">RÃ©soudre</button></div>` :
          `<div style="margin-top:0.5rem;"><input type="number" id="mise-${m.id}" placeholder="Mise" value="50" min="10" max="${parisTokens}" style="width:70px; background:var(--bg-input); border:1px solid var(--border); border-radius:8px; padding:0.2rem 0.4rem; color:var(--text);"></div>`}
      `;
      container.appendChild(card);
    });

    document.querySelectorAll(".paris-bet-btn:not([disabled])").forEach(btn => {
      btn.addEventListener("click", () => {
        const matchId = parseInt(btn.dataset.match);
        const pick = parseInt(btn.dataset.pick);
        const odds = parseFloat(btn.dataset.odds);
        const miseEl = document.getElementById(`mise-${matchId}`);
        const amount = parseInt(miseEl?.value || 50);
        if (amount <= 0 || amount > parisTokens) { alert("Mise invalide"); return; }
        parisTokens -= amount;
        localStorage.setItem("hub-paris-tokens", parisTokens);
        document.getElementById("hub-paris-tokens").textContent = parisTokens;
        parisBets.push({ matchId, pick, odds, amount });
        localStorage.setItem("hub-paris-bets", JSON.stringify(parisBets));
        renderParisMatches();
        renderParisHistory();
      });
    });

    document.querySelectorAll(".resolve-bet").forEach(btn => {
      btn.addEventListener("click", () => {
        const matchId = parseInt(btn.dataset.match);
        const bet = parisBets.find(b => b.matchId === matchId);
        const match = MATCHES.find(m => m.id === matchId);
        if (!bet || !match) return;
        const winner = Math.random() < 0.5 ? 1 : 2;
        const won = bet.pick === winner;
        const gain = won ? Math.floor(bet.amount * bet.odds) : 0;
        parisTokens += gain;
        localStorage.setItem("hub-paris-tokens", parisTokens);
        document.getElementById("hub-paris-tokens").textContent = parisTokens;
        parisHistory.unshift({
          match: `${match.team1} vs ${match.team2}`,
          pick: bet.pick === 1 ? match.team1 : match.team2,
          winner: winner === 1 ? match.team1 : match.team2,
          amount: bet.amount,
          gain,
          won,
          ts: Date.now()
        });
        if (parisHistory.length > 20) parisHistory.pop();
        localStorage.setItem("hub-paris-history", JSON.stringify(parisHistory));
        parisBets = parisBets.filter(b => b.matchId !== matchId);
        localStorage.setItem("hub-paris-bets", JSON.stringify(parisBets));
        renderParisMatches();
        renderParisHistory();
      });
    });
  }

    function renderParisHistory() {
    const container = document.getElementById("hub-paris-history");
    if (!container) return;
    if (!parisHistory.length) {
      container.innerHTML = '<div style="text-align:center; color:var(--text-muted);">Aucun pari</div>';
      return;
    }
    container.innerHTML = parisHistory.slice(0, 8).map(h => `
      <div style="display:flex; justify-content:space-between; padding:0.3rem 0; border-bottom:1px solid var(--border);">
        <span style="font-size:0.65rem;">${h.match}<br><small>${h.pick}</small></span>
        <span class="${h.won ? 'win' : 'lose'}" style="color:${h.won ? '#22c55e' : '#ef4444'}">${h.won ? '+' + h.gain : '-' + h.amount}</span>
      </div>
    `).join("");
  }

  renderParisMatches();
  renderParisHistory();

  // Exposer les fonctions Paris au niveau global pour refreshHub
  window._hubRenderParisMatches  = renderParisMatches;
  window._hubRenderParisHistory  = renderParisHistory;
};

// Lance le Hub au chargement
window.initHub();

// RafraÃ®chir le Hub Ã  chaque affichage
window.refreshHub = function() {
  const casinoSpan = document.getElementById("hub-casino-tokens");
  if (casinoSpan) casinoSpan.textContent = localStorage.getItem("hub-casino-tokens") || "500";
  const parisSpan = document.getElementById("hub-paris-tokens");
  if (parisSpan) parisSpan.textContent = localStorage.getItem("hub-paris-tokens") || "500";
  if (typeof window._hubRenderParisMatches === 'function') {
    window._hubRenderParisMatches();
    window._hubRenderParisHistory();
  }
};

/* ===================================================
   HUB REORG â€” NEW LOGIC (2026)
   =================================================== */

(function initHubReorg() {
  'use strict';

  /* ---- Tab Navigation ---- */
  function switchHubTab(tabId) {
    document.querySelectorAll('.hub-tab-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    document.querySelectorAll('.hub-tab-pane').forEach(function(p) {
      p.classList.toggle('active', p.id === tabId);
    });
    if (typeof haptic === 'function') haptic(6);
  }

  document.querySelectorAll('.hub-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { switchHubTab(btn.dataset.tab); });
  });

  /* ---- P2P Scan Simulation ---- */
  var FAKE_DEVICES = [
    { name: 'Amine T.',   emoji: 'ðŸ§‘', dist: '12m',  signal: 'â–‚â–„â–†â–Š' },
    { name: 'Sofia K.',   emoji: 'ðŸ‘©', dist: '28m',  signal: 'â–‚â–„â–†'  },
    { name: 'Yacine M.',  emoji: 'ðŸ‘¨â€ðŸ’»', dist: '45m',  signal: 'â–‚â–„'   },
  ];
  var FAKE_REPLIES = [
    'Salut !', "T'es lÃ  ?", 'Ã‡a va ?', 'On se voit ce soir ?',
    'ðŸ‘‹', 'ðŸ”¥', 'Nickel !', 'OK chef !', 'Ptdr ðŸ˜‚', 'RDV dans 10 min',
    'Je suis en bas â¬‡ï¸', 'Attends-moi !', 'Top !', 'â¤ï¸'
  ];

  var p2pConnectedDevice = null;
  var p2pMsgInterval    = null;

  var scanBtn      = document.getElementById('btn-p2p-scan');
  var devicesList  = document.getElementById('p2p-devices-list');
  var emptyEl      = document.getElementById('p2p-empty');
  var chatZone     = document.getElementById('p2p-chat-zone');
  var messagesEl   = document.getElementById('p2p-messages');
  var connectedName= document.getElementById('p2p-connected-name');
  var statusBadge  = document.getElementById('p2p-status-badge');
  var msgInput     = document.getElementById('p2p-msg-input');
  var sendBtn      = document.getElementById('btn-p2p-send');

  if (scanBtn) {
    scanBtn.addEventListener('click', function() {
      scanBtn.disabled = true;
      scanBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scan en coursâ€¦';
      setTimeout(function() {
        scanBtn.disabled = false;
        scanBtn.innerHTML = '<i class="fa-solid fa-satellite-dish" id="p2p-scan-icon"></i> Scanner les environs';
        devicesList && devicesList.querySelectorAll('.p2p-device-item').forEach(function(e) { e.remove(); });
        if (emptyEl) emptyEl.style.display = 'none';
        FAKE_DEVICES.forEach(function(dev, i) {
          setTimeout(function() {
            var item = document.createElement('div');
            item.className = 'p2p-device-item';
            item.innerHTML =
              '<div class="p2p-device-avatar">' + dev.emoji + '</div>' +
              '<div class="p2p-device-info">' +
                '<div class="p2p-device-name">' + dev.name + '</div>' +
                '<div class="p2p-device-dist">' + dev.dist + ' de distance</div>' +
              '</div>' +
              '<div class="p2p-device-signal">' + dev.signal + '</div>';
            item.addEventListener('click', function() { connectP2P(dev, item); });
            devicesList && devicesList.appendChild(item);
          }, i * 400);
        });
        if (statusBadge) {
          statusBadge.textContent = FAKE_DEVICES.length + ' appareils';
          statusBadge.classList.add('visible');
        }
      }, 2000);
    });
  }

  function connectP2P(dev, itemEl) {
    devicesList && devicesList.querySelectorAll('.p2p-device-item').forEach(function(e) {
      e.style.opacity = (e === itemEl) ? '1' : '0.4';
    });
    p2pConnectedDevice = dev;
    if (connectedName) connectedName.textContent = dev.name;
    if (chatZone) chatZone.classList.remove('hidden');
    if (messagesEl) messagesEl.innerHTML = '';
    addP2PBubble('received', 'Salut ! Je suis Ã  portÃ©e ðŸ‘‹');
    clearInterval(p2pMsgInterval);
    p2pMsgInterval = setInterval(function() {
      if (Math.random() < 0.45) {
        addP2PBubble('received', FAKE_REPLIES[Math.floor(Math.random() * FAKE_REPLIES.length)]);
      }
    }, 7000);
  }

  function addP2PBubble(type, text) {
    if (!messagesEl) return;
    var b = document.createElement('div');
    b.className = 'p2p-bubble ' + type;
    b.textContent = text;
    messagesEl.appendChild(b);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function sendP2PMessage() {
    if (!msgInput || !msgInput.value.trim()) return;
    addP2PBubble('sent', msgInput.value.trim());
    var sent = msgInput.value.trim();
    msgInput.value = '';
    setTimeout(function() {
      addP2PBubble('received', FAKE_REPLIES[Math.floor(Math.random() * FAKE_REPLIES.length)]);
    }, 800 + Math.random() * 1400);
  }

  if (sendBtn) sendBtn.addEventListener('click', sendP2PMessage);
  if (msgInput) {
    msgInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendP2PMessage(); });
  }

  /* ---- Casino (machine Ã  sous) ---- */
  var CASINO_SYMBOLS = ['ðŸ’','ðŸ‹','ðŸŠ','ðŸ‡','ðŸ’Ž','â­','7ï¸âƒ£','ðŸŽ°'];
  var CASINO_MULT    = { 'ðŸ’Ž':10, '7ï¸âƒ£':7, 'â­':5, 'ðŸ‡':3, 'ðŸŠ':2, 'ðŸ‹':1.5, 'ðŸ’':1.3, 'ðŸŽ°':1 };

  var casinoTokens   = parseInt(localStorage.getItem('hub_casino_tokens') || '500', 10);
  var spinBtn2       = document.getElementById('hub-casino-spin');
  var resetBtn2      = document.getElementById('hub-casino-reset');
  var resultEl2      = document.getElementById('hub-casino-result');
  var reels2         = [
    document.getElementById('hub-reel-0'),
    document.getElementById('hub-reel-1'),
    document.getElementById('hub-reel-2'),
  ];

  function updateCasinoTokens(val) {
    casinoTokens = Math.max(0, val);
    localStorage.setItem('hub_casino_tokens', casinoTokens);
    var el = document.getElementById('hub-casino-tokens');
    if (el) el.textContent = casinoTokens;
  }
  updateCasinoTokens(casinoTokens);

  if (resetBtn2) {
    resetBtn2.addEventListener('click', function() {
      updateCasinoTokens(500);
      if (resultEl2) resultEl2.textContent = 'ðŸŽ RechargÃ© !';
    });
  }

  if (spinBtn2) {
    spinBtn2.addEventListener('click', function() {
      var betSel = document.getElementById('hub-casino-bet');
      var bet    = parseInt(betSel ? betSel.value : '50', 10);
      if (casinoTokens < bet) {
        if (resultEl2) resultEl2.textContent = 'âŒ Jetons insuffisants !';
        return;
      }
      updateCasinoTokens(casinoTokens - bet);
      spinBtn2.disabled = true;
      if (resultEl2) resultEl2.textContent = '';
      reels2.forEach(function(r) { if (r) r.classList.add('spinning'); });

      var elapsed = 0;
      var iv = setInterval(function() {
        reels2.forEach(function(r) {
          if (r) r.textContent = CASINO_SYMBOLS[Math.floor(Math.random() * CASINO_SYMBOLS.length)];
        });
        elapsed += 100;
        if (elapsed >= 1500) {
          clearInterval(iv);
          reels2.forEach(function(r) { if (r) r.classList.remove('spinning'); });
          spinBtn2.disabled = false;
          var result = reels2.map(function(r) { return r ? r.textContent : 'ðŸŽ°'; });
          if (result[0] === result[1] && result[1] === result[2]) {
            var mult = CASINO_MULT[result[0]] || 2;
            var win  = Math.round(bet * mult * 3);
            updateCasinoTokens(casinoTokens + win);
            if (resultEl2) resultEl2.textContent = 'ðŸŽ‰ JACKPOT ! +' + win + ' jetons !';
          } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
            var win2 = Math.round(bet * 1.5);
            updateCasinoTokens(casinoTokens + win2);
            if (resultEl2) resultEl2.textContent = 'âœ¨ Paire ! +' + win2 + ' jetons';
          } else {
            if (resultEl2) resultEl2.textContent = 'ðŸ˜” Perdu ! -' + bet + ' jetons';
          }
        }
      }, 100);
    });
  }

  /* ---- Snake (hub) ---- */
  var snakeCanvas2   = document.getElementById('hub-snake-canvas');
  var snakeStartBtn2 = document.getElementById('hub-snake-start');
  var snakeScoreEl2  = document.getElementById('hub-snake-score');
  var snakeBestEl2   = document.getElementById('hub-snake-best');
  var dirBtns2       = document.querySelectorAll('.snake-dir-btn');
  var snakeGame2     = null;
  var snakeBest2     = parseInt(localStorage.getItem('hub_snake_best2') || '0', 10);
  if (snakeBestEl2) snakeBestEl2.textContent = snakeBest2;

  function startHubSnake2() {
    if (!snakeCanvas2) return;
    var ctx   = snakeCanvas2.getContext('2d');
    var GRID  = 20;
    var COLS  = Math.floor(snakeCanvas2.width / GRID);
    var ROWS  = Math.floor(snakeCanvas2.height / GRID);
    var snake = [{ x: Math.floor(COLS/2), y: Math.floor(ROWS/2) }];
    var dir   = { x: 1, y: 0 };
    var nextD = { x: 1, y: 0 };
    var score = 0;
    var running2 = true;
    var loop2;

    function rnd(max) { return Math.floor(Math.random() * max); }
    function placeFood() {
      var pos;
      do { pos = { x: rnd(COLS), y: rnd(ROWS) }; }
      while (snake.some(function(s) { return s.x === pos.x && s.y === pos.y; }));
      return pos;
    }
    var food = placeFood();

    function draw2() {
      ctx.fillStyle = '#0a0a18';
      ctx.fillRect(0, 0, snakeCanvas2.width, snakeCanvas2.height);
      ctx.font = (GRID - 2) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ðŸŽ', food.x * GRID + GRID/2, food.y * GRID + GRID/2);
      snake.forEach(function(seg, i) {
        ctx.fillStyle = (i === 0) ? '#8b5cf6' : 'rgba(139,92,246,0.65)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(seg.x*GRID+1, seg.y*GRID+1, GRID-2, GRID-2, 4);
        } else {
          ctx.rect(seg.x*GRID+1, seg.y*GRID+1, GRID-2, GRID-2);
        }
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Score: ' + score, 8, 8);
    }

    function step2() {
      if (!running2) return;
      dir = { x: nextD.x, y: nextD.y };
      var head = { x: (snake[0].x + dir.x + COLS) % COLS, y: (snake[0].y + dir.y + ROWS) % ROWS };
      if (snake.some(function(s) { return s.x === head.x && s.y === head.y; })) {
        running2 = false;
        clearInterval(loop2);
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(0, 0, snakeCanvas2.width, snakeCanvas2.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Game Over', snakeCanvas2.width/2, snakeCanvas2.height/2 - 12);
        ctx.font = '13px Inter, sans-serif';
        ctx.fillText('Score : ' + score, snakeCanvas2.width/2, snakeCanvas2.height/2 + 12);
        if (score > snakeBest2) {
          snakeBest2 = score;
          localStorage.setItem('hub_snake_best2', snakeBest2);
          if (snakeBestEl2) snakeBestEl2.textContent = snakeBest2;
        }
        if (snakeStartBtn2) snakeStartBtn2.textContent = 'Rejouer';
        snakeGame2 = null;
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score++;
        if (snakeScoreEl2) snakeScoreEl2.textContent = score;
        food = placeFood();
      } else {
        snake.pop();
      }
      draw2();
    }

    draw2();
    loop2 = setInterval(step2, 130);
    if (snakeStartBtn2) snakeStartBtn2.textContent = 'ArrÃªter';

    snakeGame2 = {
      stop: function() { running2 = false; clearInterval(loop2); snakeGame2 = null; },
      setDir: function(dx, dy) {
        if (snake.length > 1 && dx === -dir.x && dy === -dir.y) return;
        nextD = { x: dx, y: dy };
      }
    };
  }

  if (snakeStartBtn2) {
    snakeStartBtn2.addEventListener('click', function() {
      if (snakeGame2) { snakeGame2.stop(); snakeStartBtn2.textContent = 'Jouer'; return; }
      startHubSnake2();
    });
  }

  dirBtns2.forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!snakeGame2) return;
      var map = { UP:[0,-1], DOWN:[0,1], LEFT:[-1,0], RIGHT:[1,0] };
      var d = map[btn.dataset.dir];
      if (d) snakeGame2.setDir(d[0], d[1]);
    });
  });

  document.addEventListener('keydown', function(e) {
    if (!snakeGame2) return;
    var map = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0] };
    var d = map[e.key];
    if (d) { e.preventDefault(); snakeGame2.setDir(d[0], d[1]); }
  });

  /* ---- Paris Sportifs (hub) ---- */
  var PARIS_DATA = [
    { id:'pm1', home:'France',    away:'Espagne',   ho:2.1, do:3.2, ao:3.5 },
    { id:'pm2', home:'BrÃ©sil',    away:'Argentine', ho:2.4, do:3.0, ao:2.8 },
    { id:'pm3', home:'Allemagne', away:'Portugal',  ho:1.9, do:3.4, ao:4.0 },
  ];
  var parisTokens2  = parseInt(localStorage.getItem('hub_paris_tokens2') || '500', 10);
  var parisHistory2 = JSON.parse(localStorage.getItem('hub_paris_history2') || '[]');

  function updateParisTokens2(val) {
    parisTokens2 = Math.max(0, val);
    localStorage.setItem('hub_paris_tokens2', parisTokens2);
    var el = document.getElementById('hub-paris-tokens');
    if (el) el.textContent = parisTokens2;
  }
  updateParisTokens2(parisTokens2);

  function renderParisHistory2() {
    var el = document.getElementById('hub-paris-history');
    if (!el) return;
    if (!parisHistory2.length) { el.innerHTML = '<span style="color:var(--text-muted)">Aucun pari</span>'; return; }
    el.innerHTML = parisHistory2.slice(-5).reverse().map(function(h) {
      return '<div style="padding:0.2rem 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between">' +
        '<span>' + h.match + ' â€” ' + (h.bet==='H'?'Dom.':h.bet==='D'?'Nul':'Ext.') + '</span>' +
        '<span style="color:' + (h.win>=0?'#22c55e':'#ef4444') + '">' + (h.win>=0?'+':'') + h.win + 'j</span>' +
      '</div>';
    }).join('');
  }

  function renderParisMatches2() {
    var container = document.getElementById('hub-paris-matches');
    if (!container) return;
    container.innerHTML = PARIS_DATA.map(function(m) {
      return '<div class="glass-card" style="padding:0.6rem;border-radius:12px">' +
        '<div style="display:flex;justify-content:space-between;font-size:0.78rem;font-weight:700;margin-bottom:0.4rem">' +
          '<span>' + m.home + '</span><span style="color:var(--text-muted);font-weight:400">VS</span><span>' + m.away + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:0.3rem">' +
          '<button onclick="parisPlaceBet(\'' + m.id + '\',\'H\',' + m.ho + ')" class="paris-bet-btn">Dom. Ã—' + m.ho + '</button>' +
          '<button onclick="parisPlaceBet(\'' + m.id + '\',\'D\',' + m.do + ')" class="paris-bet-btn" style="background:rgba(99,102,241,0.15)">Nul Ã—' + m.do + '</button>' +
          '<button onclick="parisPlaceBet(\'' + m.id + '\',\'A\',' + m.ao + ')" class="paris-bet-btn" style="background:rgba(236,72,153,0.15)">Ext. Ã—' + m.ao + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.parisPlaceBet = function(matchId, bet, odds) {
    var stake = 50;
    if (parisTokens2 < stake) { alert('Jetons insuffisants !'); return; }
    var match = PARIS_DATA.find(function(m) { return m.id === matchId; });
    if (!match) return;
    updateParisTokens2(parisTokens2 - stake);
    var won = Math.random() < (1 / odds) * 0.95;
    var winAmt = won ? Math.round(stake * odds) - stake : -stake;
    updateParisTokens2(parisTokens2 + (won ? Math.round(stake * odds) : 0));
    parisHistory2.push({ match: match.home + ' VS ' + match.away, bet: bet, win: winAmt });
    if (parisHistory2.length > 20) parisHistory2.shift();
    localStorage.setItem('hub_paris_history2', JSON.stringify(parisHistory2));
    renderParisHistory2();
    var msg = won ? 'âœ… GagnÃ© ! +' + (Math.round(stake*odds)-stake) + ' jetons' : 'âŒ Perdu ! -' + stake + ' jetons';
    if (typeof showToast === 'function') showToast(msg);
    else alert(msg);
  };

  renderParisMatches2();
  renderParisHistory2();

})();

/* ============================================================
   HUB SIDEBAR RETRACTABLE + FAB HIDE ON HUB (v3)
   ============================================================ */

(function initHubExtras() {
  'use strict';

  /* ---- 1. Retractable sidebar toggle ---- */
  var hubScreen   = document.getElementById('screen-hub');
  var hubBody     = hubScreen && hubScreen.querySelector('.hub-body');
  var sideNav     = hubScreen && hubScreen.querySelector('.hub-inner-nav');
  var hubContent  = hubScreen && hubScreen.querySelector('.hub-content');

  if (hubBody && sideNav) {
    // Create the toggle handle
    var handle = document.createElement('button');
    handle.id = 'hub-sidebar-toggle';
    handle.setAttribute('aria-label', 'RÃ©tracter/afficher barre');
    handle.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    hubBody.appendChild(handle);

    var isRetracted = false;

    function setSidebarState(retract) {
      isRetracted = retract;
      sideNav.classList.toggle('retracted', retract);
      var icon = handle.querySelector('i');
      if (icon) {
        icon.className = retract
          ? 'fa-solid fa-chevron-left'
          : 'fa-solid fa-chevron-right';
      }
      handle.title = retract ? 'Afficher la barre' : 'RÃ©tracter la barre';
      if (typeof haptic === 'function') haptic(6);
    }

    handle.addEventListener('click', function () {
      setSidebarState(!isRetracted);
    });

    // Auto-deploy sidebar when hub screen becomes active
    var hubObserver = new MutationObserver(function () {
      if (hubScreen.classList.contains('active') && isRetracted) {
        // keep user preference â€” do NOT auto-redeploy
      }
      if (hubScreen.classList.contains('active')) {
        updateFabForHub(true);
      } else {
        updateFabForHub(false);
      }
    });
    hubObserver.observe(hubScreen, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---- 2. FAB: hide on Hub, show on other screens ---- */
  var fabEl = document.getElementById('fab-container');

  function updateFabForHub(hubIsActive) {
    if (!fabEl) return;
    if (hubIsActive) {
      fabEl.classList.add('fab-force-hide');
    } else {
      fabEl.classList.remove('fab-force-hide');
    }
  }

  // Initial state
  if (hubScreen && hubScreen.classList.contains('active')) {
    updateFabForHub(true);
  }

  // Also patch every nav-btn click to check the target screen
  document.querySelectorAll('.nav-btn[data-screen]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.dataset.screen;
      updateFabForHub(target === 'screen-hub');
    }, true); // capture phase so it fires before showScreen
  });

  // MutationObserver on all screens in case showScreen is called programmatically
  document.querySelectorAll('.screen').forEach(function (sc) {
    new MutationObserver(function () {
      if (sc.classList.contains('active')) {
        updateFabForHub(sc.id === 'screen-hub');
      }
    }).observe(sc, { attributes: true, attributeFilter: ['class'] });
  });

  // ============================================================
  // HUB ADD: SPLASH SCREEN â€” Affichage 3 secondes au dÃ©marrage
  // ============================================================
  window.addEventListener('DOMContentLoaded', function () {
    // HUB ADD: RÃ©cupÃ©rer le splash screen
    var splash = document.getElementById('splash-screen');
    if (!splash) return;

    // HUB ADD: Attendre que l'image logo charge, puis masquer (min 1200ms)
    var splashImg = splash.querySelector('img');
    var splashHide = function () {
      splash.classList.add('splash-hide');
      setTimeout(function () { splash.style.display = 'none'; }, 400);
    };
    var minDelay = 1500; // ms minimum affichÃ©
    var start = Date.now();
    var doHide = function () {
      var elapsed = Date.now() - start;
      var remaining = Math.max(0, minDelay - elapsed);
      setTimeout(splashHide, remaining);
    };
    if (splashImg && !splashImg.complete) {
      splashImg.addEventListener('load',  doHide, { once: true });
      splashImg.addEventListener('error', doHide, { once: true });
      // SÃ©curitÃ© : si l'image met trop longtemps (>4s), on cache quand mÃªme
      setTimeout(splashHide, 4000);
    } else {
      doHide();
    }
  });

  // ============================================================
  // HUB ADD: ACTUS â€” Chargement depuis l'URL JSON distante
  // ============================================================

  var URL_ACTUS = 'https://regardcreatif.github.io/regard-creatif/actus.json';

  // HUB ADD: Cache des donnÃ©es d'actus en mÃ©moire
  var actusDataCache = null;

  // HUB ADD: Fonction asynchrone de chargement des actus
  async function loadActusFromAPI() {
    // HUB ADD: Si dÃ©jÃ  en cache mÃ©moire, retourner directement
    if (actusDataCache) return actusDataCache;

    try {
      // HUB ADD: Tentative de fetch depuis l'API
      var response = await fetch(URL_ACTUS);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();

      // HUB ADD: Stocker dans localStorage pour usage hors-ligne
      try {
        localStorage.setItem('hub_actus_cache', JSON.stringify(data));
      } catch (e) {
        console.warn('HUB ADD: localStorage write failed', e);
      }

      actusDataCache = data;
      return data;
    } catch (fetchErr) {
      console.warn('HUB ADD: fetch actus failed, trying localStorage', fetchErr);

      // HUB ADD: En cas d'Ã©chec, lire le cache localStorage
      try {
        var cached = localStorage.getItem('hub_actus_cache');
        if (cached) {
          actusDataCache = JSON.parse(cached);
          return actusDataCache;
        }
      } catch (parseErr) {
        console.warn('HUB ADD: localStorage parse failed', parseErr);
      }

      // HUB ADD: Rien trouvÃ© â€” retourner null
      return null;
    }
  }

  // HUB ADD: Fonction de rendu des actus pour une catÃ©gorie donnÃ©e
  function renderActus(categorie) {
    var feedEl = document.getElementById('actus-' + categorie + '-feed');
    if (!feedEl) return;

    // HUB ADD: Afficher l'indicateur de chargement
    var loadingEl = document.getElementById('hub-actus-loading-indicator');
    if (loadingEl) loadingEl.style.display = 'inline';

    loadActusFromAPI().then(function (data) {
      // HUB ADD: Cacher l'indicateur de chargement
      if (loadingEl) loadingEl.style.display = 'none';

      // HUB ADD: Vider le conteneur
      feedEl.innerHTML = '';

      // HUB ADD: Pas de donnÃ©es
      if (!data || !data[categorie] || !data[categorie].length) {
        feedEl.innerHTML = '<div class="hub-actus-empty"><i class="fa-solid fa-newspaper" style="font-size:2rem;display:block;margin-bottom:0.5rem;opacity:0.3"></i>Aucune actualitÃ© disponible</div>';
        return;
      }

      // HUB ADD: Construire les cartes pour chaque article
      data[categorie].forEach(function (article) {
        var card = document.createElement('a');
        card.className = 'hub-actu-card';
        card.href = article.lien || '#';
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        // HUB ADD: Construire le HTML de la carte
        var titleText    = article.titre      || 'Sans titre';
        var descText     = article.description || '';
        var dateText     = article.date        || '';
        var sourceText   = article.source      || '';

        card.innerHTML =
          '<div class="hub-actu-card-title">' + escapeHtml(titleText) + '</div>' +
          (descText ? '<div class="hub-actu-card-desc">' + escapeHtml(descText) + '</div>' : '') +
          '<div class="hub-actu-card-meta">' +
            (dateText   ? '<span><i class="fa-regular fa-calendar"></i> ' + escapeHtml(dateText)   + '</span>' : '') +
            (sourceText ? '<span><i class="fa-solid fa-link"></i> '       + escapeHtml(sourceText) + '</span>' : '') +
          '</div>';

        // HUB ADD: Effet ripple sur la carte
        card.style.overflow  = 'hidden';
        card.style.position  = 'relative';
        card.addEventListener('click', addRipple);

        feedEl.appendChild(card);
      });
    });
  }

  // HUB ADD: Fonction utilitaire d'Ã©chappement HTML
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // HUB ADD: Wiring des boutons de catÃ©gorie d'actus
  function wireActusCatButtons() {
    var catBtns = document.querySelectorAll('.hub-actus-cat-btn');
    catBtns.forEach(function (btn) {
      if (btn.dataset.actusWired) return;
      btn.dataset.actusWired = '1';

      btn.addEventListener('click', function () {
        var cat = btn.dataset.cat;
        if (!cat) return;

        // HUB ADD: Mettre Ã  jour l'Ã©tat actif des boutons
        catBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        // HUB ADD: Afficher le bon feed, masquer les autres
        document.querySelectorAll('.hub-actus-feed').forEach(function (feed) {
          feed.style.display = 'none';
        });
        var targetFeed = document.getElementById('actus-' + cat + '-feed');
        if (targetFeed) targetFeed.style.display = 'flex';

        // HUB ADD: Charger les actus pour cette catÃ©gorie
        renderActus(cat);

        // HUB ADD: Effet ripple sur le bouton
        addRipple.call(btn, { currentTarget: btn, clientX: btn.getBoundingClientRect().left + btn.offsetWidth/2, clientY: btn.getBoundingClientRect().top + btn.offsetHeight/2 });
      });
    });
  }

  // HUB ADD: Initialiser les actus quand le tab-actus devient visible
  var tabActusEl = document.getElementById('tab-actus');
  if (tabActusEl) {
    var actusObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.target.classList.contains('active') && !m.target.dataset.actusLoaded) {
          m.target.dataset.actusLoaded = '1';
          wireActusCatButtons();
          renderActus('tech'); // HUB ADD: Charger tech par dÃ©faut
        }
      });
    });
    actusObserver.observe(tabActusEl, { attributes: true, attributeFilter: ['class'] });
  }

  // HUB ADD: Wirer aussi les boutons de ripple sur les nouveaux boutons hub au chargement
  document.addEventListener('DOMContentLoaded', function () {
    wireActusCatButtons();
    // HUB ADD: Ã‰tendre wireRipples aux nouveaux boutons hub
    document.querySelectorAll('.hub-tab-btn, .hub-actus-cat-btn, .hub-scan-btn').forEach(function (btn) {
      if (btn.dataset.ripple) return;
      btn.dataset.ripple = '1';
      btn.style.overflow = 'hidden';
      if (!btn.style.position || btn.style.position === 'static') btn.style.position = 'relative';
      btn.addEventListener('click', addRipple);
    });
  });

})();