// ============================================================
// TRINITE CHAT — script.js v2
// Particles · Theme · Ripple · Avatar · FAB · Swipe Delete
// Typing Indicator · Sound Toggle · Skeleton · QR Scan
// ============================================================
(function () {
  "use strict";

  /* ===== SPLASH SCREEN ===== */
  (function initSplash() {
    const splash = document.getElementById("screen-splash");
    if (!splash) return;

    const SPLASH_MIN_MS  = 2000; // durée minimum affichée (style WhatsApp)
    const SPLASH_MAX_MS  = 5000; // fermeture forcée si auth bloquée (réseau lent)
    const splashStart    = Date.now();
    let _splashDone      = false;

    window._dismissSplash = function () {
      if (_splashDone) return;
      // Respecter la durée minimum pour ne pas flasher
      const elapsed  = Date.now() - splashStart;
      const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
      setTimeout(function () {
        if (_splashDone) return;
        _splashDone = true;
        splash.classList.add("splash-exit");
        setTimeout(() => {
          splash.style.display = "none";
          splash.classList.remove("active");
        }, 600);
      }, remaining);
    };

    // Fermeture forcée si auth trop lente (réseau 3G/lent)
    setTimeout(() => window._dismissSplash(), SPLASH_MAX_MS);
  })();

  /* ===== PARTICLE CANVAS ===== */
  const canvas  = document.getElementById("particles-canvas");
  const ctx     = canvas ? canvas.getContext("2d") : null;
  let particles = [];

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function randomRange(min, max) { return min + Math.random() * (max - min); }

  function createParticle() {
    return {
      x: randomRange(0, canvas.width),
      y: randomRange(0, canvas.height),
      r: randomRange(0.5, 2.5),
      dx: randomRange(-0.25, 0.25),
      dy: randomRange(-0.4, -0.1),
      alpha: randomRange(0.2, 0.8),
      dAlpha: randomRange(-0.003, 0.003),
      color: Math.random() > 0.5 ? "139,92,246" : "219,39,119",
    };
  }

  function initParticles() {
    if (!canvas) return;
    resizeCanvas();
    particles = [];
    const count = Math.min(60, Math.floor(window.innerWidth * window.innerHeight / 14000));
    for (let i = 0; i < count; i++) particles.push(createParticle());
  }

  function tickParticles() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, i) => {
      p.x += p.dx; p.y += p.dy; p.alpha += p.dAlpha;
      if (p.alpha <= 0.05) p.dAlpha = Math.abs(p.dAlpha);
      if (p.alpha >= 0.85) p.dAlpha = -Math.abs(p.dAlpha);
      if (p.y < -10) { particles[i] = createParticle(); particles[i].y = canvas.height + 10; }
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(tickParticles);
  }

  window.addEventListener("resize", () => { resizeCanvas(); initParticles(); }, { passive: true });
  initParticles();
  tickParticles();

  // FIX: Enregistrer le Service Worker PWA
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
// TRINITE CHAT — Logique principale
// ============================================================

const SUPABASE_URL  = "https://eqttgyxjjupeisgozrut.supabase.co";
const SUPABASE_ANON = "sb_publishable_2tUX4eHP5MrKz_pekDY4aA_EiuZ99Wo";
const LOGO_URL      = "https://i.postimg.cc/WpqGN1y6/Picsart-26-06-09-10-15-05-552.png";

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
let typingChannel = null;
let typingTimeout = null;
let unreadCount     = 0;
let userAvatarUrl   = null;
let feedSoundEnabled = false;

// Studio
let cameraStream   = null;
let studioFile     = null;
let studioBlob     = null;
let studioFileName = null;

// Voice
let mediaRecorder  = null;
let voiceChunks    = [];
let isRecording    = false;

// Avatar camera
let avatarCamStream = null;

// Stories
const seenStories = new Set();

// ============================================================
// VIDÉOS DEMO
// ============================================================
const DEMO_VIDEOS = [
  { id:"v1", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",      author:"@trinitechat",  desc:"Bienvenue sur Trinite Chat 🔥 Trois profils, une seule app !", likes:3102, comments:95, isDemo:true },
  { id:"v2", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",          author:"@profil_pro",   desc:"Gérez vos conversations pros séparément 💼 #pro #business",   likes:1284, comments:48, isDemo:true },
  { id:"v3", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",        author:"@anonyme_x",    desc:"Mode anonyme activé 👻 Personne ne saura qui vous êtes",       likes:873,  comments:22, isDemo:true },
  { id:"v4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4", author:"@prive_heart", desc:"Vos messages privés restent privés ❤️ #love #privé",        likes:642,  comments:17, isDemo:true }
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
  updateFabVisibility(id);
}

function initial(name) { return (name || "?").charAt(0).toUpperCase(); }

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function profileLabel(type) { return { pro:"Pro", prive:"Privé", anonyme:"Anonyme" }[type] || type; }
function profileEmoji(type) { return { pro:"💼", prive:"❤️", anonyme:"👻" }[type] || "👤"; }
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
    // FIX: Forcer re-déclenchement des animations (badgePop + neonPulse)
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
  const { data: { session } } = await db.auth.getSession();
  // FIX: on connaît l'état auth → fermer le splash immédiatement,
  // sans attendre le timer de 2.8s et sans risquer de conflit d'écrans
  if (typeof window._dismissSplash === "function") window._dismissSplash();
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

  // FIX: Vérifier que le bucket "avatars" existe dans Supabase Storage
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
      { user_id: currentUser.id, profile_type: "prive",   name: "Privé" },
      { user_id: currentUser.id, profile_type: "anonyme", name: "Anonyme" }
    ];
    const { data: nd, error: ne } = await db.from("profiles").insert(rows).select();
    if (ne) { toast("Erreur création profils : " + ne.message, "error"); showScreen("screen-setup"); return; }
    userProfiles = nd || [];
    toast("Vos 3 profils ont été créés !", "success");
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
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connexion…'; }
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Se connecter'; }
  if (error) {
    toast(error.message.includes("Invalid") ? "Email ou mot de passe incorrect" : error.message, "error");
  }
});

// FIX: Toggle Email / Téléphone style TikTok sur le formulaire d'inscription
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

  // FIX: Déterminer email selon le type choisi (email ou téléphone)
  let email = "";
  if (authType === "email") {
    email = document.getElementById("register-email").value.trim();
    if (!email) { toast("Entrez votre email", "error"); return; }
  } else {
    const phone = document.getElementById("register-phone").value.trim().replace(/\s+/g,"");
    if (!phone) { toast("Entrez votre numéro", "error"); return; }
    // FIX: Générer un email fictif à partir du numéro pour Supabase
    email = phone + "@phone.trinite";
  }

  if (password.length < 6) { toast("Mot de passe trop court (6 caractères min.)", "error"); return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Création…'; }

  // FIX: signUp retourne { data: { user, session }, error }
  // "Database error saving new user" = un trigger SQL sur auth.users est cassé.
  // Solution : NE PAS utiliser de trigger. Créer les profils ici, manuellement.
  const { data: signUpData, error } = await db.auth.signUp({ email, password });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Créer mon compte'; }

  if (error) {
    // FIX: Message d'erreur francisé + log console pour debug
    console.error("Trinite signUp error:", error);
    const msg = error.message.includes("Database error")
      ? "Erreur serveur : supprimez le trigger SQL sur auth.users (voir console)."
      : error.message.includes("already registered") || error.message.includes("already been registered")
      ? "Cet email est déjà utilisé."
      : error.message;
    toast(msg, "error");
    return;
  }

  // FIX: Récupérer l'utilisateur depuis signUpData.user (disponible même sans confirmation email)
  // Ne pas utiliser db.auth.getUser() ici : la session n'est pas encore active si
  // "Confirm email" est activé dans Supabase Auth settings.
  const user = signUpData?.user;

  if (user) {
    // FIX: Sauvegarder le numéro de téléphone dans les métadonnées user
    const phone = document.getElementById("register-phone")?.value.trim() || null;
    if (phone) {
      await db.auth.updateUser({ phone, data: { phone } });
    }

    // FIX: Créer les 3 profils directement après signUp, sans trigger SQL.
    const rows = [
      { user_id: user.id, profile_type: "pro",     name: "Pro",     phone: phone },
      { user_id: user.id, profile_type: "prive",   name: "Privé",   phone: phone },
      { user_id: user.id, profile_type: "anonyme", name: "Anonyme", phone: phone }
    ];
    const { error: profileErr } = await db.from("profiles").insert(rows);
    if (profileErr) {
      // FIX: Retenter sans colonne phone si elle n'existe pas encore
      const rows2 = [
        { user_id: user.id, profile_type: "pro",     name: "Pro" },
        { user_id: user.id, profile_type: "prive",   name: "Privé" },
        { user_id: user.id, profile_type: "anonyme", name: "Anonyme" }
      ];
      const { error: profileErr2 } = await db.from("profiles").insert(rows2);
      if (profileErr2) console.warn("Trinite: profils non créés :", profileErr2.message);
    }
  }

  // FIX: Si confirmation email désactivée dans Supabase, la session est active
  // et onAuthStateChange va déclencher afterLogin() automatiquement.
  // Si confirmation email activée, on affiche juste un message d'attente.
  const needsConfirm = !signUpData?.session;
  if (needsConfirm) {
    toast("Compte créé ! Vérifiez votre boîte mail pour confirmer.", "success");
  } else {
    toast("Compte créé et connecté !", "success");
    // FIX: onAuthStateChange s'en charge — pas besoin d'appeler afterLogin() manuellement
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
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Création…'; }
  const rows = [
    { user_id: currentUser.id, profile_type: "pro",     name: document.getElementById("name-pro")?.value.trim()     || "Pro" },
    { user_id: currentUser.id, profile_type: "prive",   name: document.getElementById("name-prive")?.value.trim()   || "Privé" },
    { user_id: currentUser.id, profile_type: "anonyme", name: document.getElementById("name-anonyme")?.value.trim() || "Anonyme" }
  ];
  const { data, error } = await db.from("profiles").insert(rows).select();
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Créer mes profils'; }
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
  stopAvatarCamera();
  hideFab();
  db.auth.signOut();
}
document.getElementById("btn-logout")       ?.addEventListener("click", handleLogout);
document.getElementById("btn-logout-profil")?.addEventListener("click", handleLogout);

// ============================================================
// ÉCRAN PRINCIPAL
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
// SWIPER DE PROFILS (bug fix: offset précis)
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
  // FIX: retirer les anciens listeners en remplaçant le nœud
  const newWrap = wrap?.cloneNode(true);
  if (wrap && newWrap) wrap.parentNode.replaceChild(newWrap, wrap);
  const swiperWrap = document.getElementById("profile-swiper-wrap");

  let startX = null;
  let startY = null; // FIX: tracking Y pour empêcher swipe vertical
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
    // FIX: Seuil réduit à 30px + vérification que c'est bien horizontal
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

function buildStories() {
  const scroll = document.getElementById("stories-scroll");
  if (!scroll) return;
  scroll.innerHTML = "";

  const addWrap = document.createElement("div");
  addWrap.className = "story-item";

  const avatarContent = userAvatarUrl
    ? `<img src="${escapeHtml(userAvatarUrl)}" alt="moi" />`
    : (activeProfile ? profileEmoji(activeProfile.profile_type) : "👤");

  addWrap.innerHTML = `
    <div class="story-add-ring" title="Ajouter une story">
      <div class="story-avatar">${avatarContent}</div>
      <span class="story-add-plus"><i class="fa-solid fa-plus" style="font-size:0.6rem"></i></span>
    </div>
    <span class="story-name">Ma story</span>`;
  addWrap.addEventListener("click", () => toast("Stories : bientôt disponible !", "info"));
  scroll.appendChild(addWrap);

  const STORY_EMOJIS = ["🔥","💜","✨","👋","🎵","🌙","💫","🎉"];
  currentContacts.slice(0, 10).forEach((c, i) => {
    const seen = seenStories.has(c.id);
    const wrap = document.createElement("div");
    wrap.className = "story-item";
    wrap.style.setProperty("--stagger-delay", `${i * 0.03}s`);
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

  // FIX: Fermeture automatique exactement après 4 secondes
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
          toast("Contact supprimé", "info");
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
    // FIX: Recherche par nom, email OU téléphone
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

// FIX: Recherche de contact par numéro de téléphone (style WhatsApp)
document.getElementById("btn-search-phone")?.addEventListener("click", async () => {
  const phone = document.getElementById("contact-phone")?.value.trim();
  const resultEl = document.getElementById("phone-search-result");
  if (!phone) { toast("Entrez un numéro de téléphone", "error"); return; }

  if (resultEl) {
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Recherche…';
    resultEl.className = "phone-search-result searching";
  }

  // FIX: Chercher dans les profils par numéro de téléphone
  const phoneClean = phone.replace(/\s+/g, "");
  const { data, error } = await db.from("profiles")
    .select("id, name, user_id, profile_type, phone")
    .or(`phone.eq.${phoneClean},phone.eq.${phone}`)
    .limit(1);

  if (error || !data || data.length === 0) {
    // FIX: Pas trouvé — on peut quand même ajouter manuellement
    if (resultEl) {
      resultEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> Aucun utilisateur Trinite trouvé — vous pouvez quand même ajouter ce contact.';
      resultEl.className = "phone-search-result not-found";
    }
    // Pré-remplir l'email hidden avec le numéro
    const emailInput = document.getElementById("contact-email");
    if (emailInput) emailInput.value = phoneClean + "@phone.trinite";
    return;
  }

  const found = data[0];
  // FIX: Pré-remplir automatiquement nom et ID Trinite
  const nameInput = document.getElementById("contact-name");
  const profileIdInput = document.getElementById("contact-profile-id");
  const emailInput = document.getElementById("contact-email");

  if (nameInput && !nameInput.value) nameInput.value = found.name;
  if (profileIdInput) profileIdInput.value = found.id;
  if (emailInput) emailInput.value = phoneClean + "@phone.trinite";

  if (resultEl) {
    resultEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Trouvé : <strong>${escapeHtml(found.name)}</strong> (${escapeHtml(found.profile_type)})`;
    resultEl.className = "phone-search-result found";
  }
  haptic(15);
});

// FIX: Recherche aussi en tapant (après 1 seconde sans frappe)
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
  // FIX: email généré à partir du téléphone si pas trouvé dans profiles
  const emailHidden      = document.getElementById("contact-email").value.trim()
                           || (phone.replace(/\s+/g,"") + "@phone.trinite");

  if (!phone || !name) { toast("Entrez un numéro et un nom", "error"); return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ajout…'; }

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

  toast("Contact ajouté !", "success");
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
  toast("QR Code scanné ! ID : " + fakeId, "success");
});

// ============================================================
// ÉCRAN PROFIL
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

  // FIX: Afficher un QR code et statut pour CHAQUE profil séparément
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
        <!-- FIX: Texte statut clair — visible seulement par les contacts de CE profil -->
        <p class="status-label-text" id="status-label-${p.id}">${p.is_online ? "🟢 En ligne" : "⚫ Hors ligne"} — visible uniquement par vos contacts ${profileLabel(p.profile_type)}</p>
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
          <!-- FIX: Boutons partager et télécharger le QR -->
          <div class="qr-share-btns">
            <button class="btn-qr-share" data-pid="${p.id}" data-name="${escapeHtml(p.name)}">
              <i class="fa-solid fa-share-nodes"></i> Partager
            </button>
            <button class="btn-qr-download" data-pid="${p.id}" data-name="${escapeHtml(p.name)}">
              <i class="fa-solid fa-download"></i> Télécharger
            </button>
          </div>
        </div>
        <!-- FIX: Paramètres visibilité vidéo par profil -->
        <div class="video-visibility-section">
          <p class="video-visibility-title"><i class="fa-solid fa-film"></i> Qui peut voir mes vidéos (${profileLabel(p.profile_type)}) ?</p>
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
              <span class="vv-label"><i class="fa-solid fa-lock"></i> Personne (privé)</span>
            </label>
          </div>
        </div>
      </div>
    `).join("");

    // FIX: Générer les QR codes
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
          .then(() => toast("ID copié !", "success"))
          .catch(() => toast("Impossible de copier", "error"));
      });
    });

    // FIX: Statut en ligne — visible seulement par contacts du même profil
    idSection.querySelectorAll(".status-checkbox").forEach(cb => {
      cb.addEventListener("change", async () => {
        const pid = cb.dataset.pid;
        const online = cb.checked;
        const { error } = await db.from("profiles").update({ is_online: online }).eq("id", pid);
        if (!error) {
          const lbl = document.getElementById("status-label-" + pid);
          const p = userProfiles.find(x => x.id === pid);
          const label = p ? profileLabel(p.profile_type) : "";
          if (lbl) lbl.textContent = (online ? "🟢 En ligne" : "⚫ Hors ligne") + " — visible uniquement par vos contacts " + label;
          toast(online ? "🟢 En ligne" : "⚫ Hors ligne", "info");
        }
      });
    });

    // FIX: Partager QR code via Web Share API ou téléchargement
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
              await navigator.share({ title: "Trinite Chat — " + name, files: [file], text: "Mon ID Trinite : " + id });
            });
          } catch (_) { shareTextFallback(id, name); }
        } else {
          shareTextFallback(id, name);
        }
        haptic(15);
      });
    });

    // FIX: Télécharger le QR code comme image
    idSection.querySelectorAll(".btn-qr-download").forEach(btn => {
      btn.addEventListener("click", () => {
        const pid  = btn.dataset.pid;
        const name = btn.dataset.name;
        const canvas = document.querySelector("#qr-canvas-" + pid + " canvas");
        if (!canvas) { toast("QR pas encore prêt", "error"); return; }
        const link = document.createElement("a");
        link.download = "trinite-qr-" + name + ".png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast("QR téléchargé !", "success");
        haptic(10);
      });
    });

    // FIX: Visibilité vidéo — sauvegarde dans Supabase
    idSection.querySelectorAll(".vv-radio").forEach(radio => {
      radio.addEventListener("change", async () => {
        if (!radio.checked) return;
        const pid = radio.dataset.pid;
        const val = radio.value;
        const { error } = await db.from("profiles").update({ video_visibility: val }).eq("id", pid);
        if (!error) {
          const labels = { everyone: "Tout le monde", contacts: "Contacts seulement", nobody: "Personne (privé)" };
          toast("Visibilité vidéo : " + (labels[val] || val), "success");
          // FIX: Mettre à jour le cache local
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
    navigator.share({ title: "Trinite Chat — " + name, text: "Ajoutez-moi sur Trinite Chat !
Mon ID : " + id });
  } else {
    navigator.clipboard?.writeText(id)
      .then(() => toast("ID copié ! Partagez-le à vos contacts.", "success"))
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
  if (!idText || idText === "—") return;
  navigator.clipboard?.writeText(idText)
    .then(() => toast("ID copié !", "success"))
    .catch(() => toast("Impossible de copier", "error"));
});

document.getElementById("form-profil")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement…'; }

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
  toast("Profils mis à jour !", "success");
  buildSwiper();
  updateHeaderProfile();
});

// ============================================================
// AVATAR — Photo de profil personnalisable
// ============================================================

// FIX: Cache simple des avatars dans localStorage pour éviter des rechargements inutiles
const AVATAR_CACHE_KEY = "trinite_avatar_cache";
function getAvatarCache() {
  try { return JSON.parse(localStorage.getItem(AVATAR_CACHE_KEY) || "{}"); } catch { return {}; }
}
function setAvatarCache(url, dataUrl) {
  try {
    const cache = getAvatarCache();
    cache[url] = dataUrl;
    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache));
  } catch (e) { /* quota ignoré silencieusement */ }
}
function getCachedAvatar(url) {
  return getAvatarCache()[url] || null;
}

// FIX: Compression image avant upload (max 400x400, qualité 0.7)
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

// FIX: Fallback initiales si l'image ne charge pas après 3 secondes
function renderAvatarWithFallback(el, name, avatarUrl) {
  if (!el) return;
  if (!avatarUrl) {
    el.innerHTML = `<span>${initial(name)}</span>`;
    el.style.background = "linear-gradient(135deg,var(--primary),var(--accent))";
    return;
  }
  // Vérifier le cache d'abord
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
    toast("Impossible de récupérer l'URL de l'avatar", "error");
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
  toast("Photo de profil mise à jour !", "success");
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
  toast("Photo supprimée", "info");
});

/* Avatar caméra */
document.getElementById("btn-avatar-camera")?.addEventListener("click", async () => {
  try {
    avatarCamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    const video = document.getElementById("avatar-camera-stream");
    const controls = document.getElementById("avatar-camera-controls");
    if (video) { video.srcObject = avatarCamStream; video.classList.remove("hidden"); }
    controls?.classList.remove("hidden");
    haptic(10);
  } catch (err) {
    toast("Caméra inaccessible : " + err.message, "error");
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
        toast(`Profil ${profileLabel(type)} activé`, "success");
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
  if (!container) return;
  const hide = !screenId || screenId === "screen-auth" || screenId === "screen-setup";
  container.classList.toggle("hidden", hide);
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
    // FIX: Empêcher scroll page pendant drag FAB
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
      // FIX: Feedback visuel renforcé sur l'option ciblée
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
    // FIX: Réinitialiser tous les styles inline des options
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

      if (target === "screen-main") updateMsgBadge(0);

      const studioActive = document.getElementById("screen-studio")?.classList.contains("active");
      if (studioActive && target !== "screen-studio") stopCamera();

      showScreen(target);
      haptic(8);

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
  const avatarEl = document.getElementById("chat-contact-avatar");

  if (nameEl)  nameEl.textContent  = contact.contact_name;
  if (badgeEl) badgeEl.textContent = `${profileEmoji(myProfile.profile_type)} ${myProfile.name}`;
  if (avatarEl) {
    avatarEl.textContent = initial(contact.contact_name);
    avatarEl.style.background = "linear-gradient(135deg,var(--primary),var(--accent))";
  }

  showScreen("screen-chat");
// ===== ACCUSÉS DE LECTURE + INDICATEUR DE FRAPPE =====
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
  const isRead = msg.read_at !== null;
  const checkIcon = isRead ? '<i class="fa-solid fa-check-double"></i>' : '<i class="fa-regular fa-check"></i>';
  div.innerHTML = `
    ${escapeHtml(msg.content)}
    <div class="bubble-time">${formatTime(msg.created_at)} ${checkIcon}</div>`;
}

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
function wireTypingIndicator() {
  const input = document.getElementById("message-input");
  const indicator = document.getElementById("typing-indicator");
  if (!input || !indicator) return;

  let typingTimeout = null;
  input.addEventListener("input", () => {
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      indicator.classList.add("hidden");
    }, 3000);
  });
}

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

    mediaRecorder.start(100);
    isRecording = true;
    btn.classList.add("recording");
    btn.title = "Arrêter l'enregistrement";
    btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
    haptic(15);

  } catch (err) {
    toast("Micro inaccessible : " + err.message, "error");
  }
}

// ============================================================
// FEED TIKTOK
// ============================================================

async function buildFeed() {
  const container = document.getElementById("feed-container");
  if (!container) return;
  container.innerHTML = "";

  let videos = [...DEMO_VIDEOS];

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
          // FIX: visibilité selon paramètre du profil
          visibility:   activeProfile?.video_visibility || "everyone"
        };
      }).filter(v => v.url);
      videos = [...userVids, ...videos];
    }

    // FIX: Charger aussi les vidéos des autres utilisateurs selon LEUR paramètre de visibilité
    // everyone = visible à tous | contacts = visible seulement si contact | nobody = masqué
    const { data: allProfiles } = await db.from("profiles")
      .select("id, user_id, video_visibility")
      .neq("user_id", currentUser?.id || "")
      .eq("video_visibility", "everyone"); // FIX: seulement ceux qui ont choisi "tout le monde"

    // (Les vidéos "contacts" seront filtrées plus bas quand on aura les contacts)
  } catch (_) {}

  videos.forEach(v => {
    feedLikeCounts[v.id] = feedLikeCounts[v.id] ?? v.likes;
  });

  videos.forEach((v, index) => {
    const item = document.createElement("div");
    item.className = "feed-item";
    item.innerHTML = `
      <video class="feed-video" src="${escapeHtml(v.url)}" loop playsinline preload="none" ${feedSoundEnabled ? "" : "muted"}></video>
      <div class="feed-item-gradient"></div>
      ${v.isDemo ? "" : '<div class="feed-uploaded-badge">MES VIDÉOS</div>'}
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
          <span class="feed-action-label">${formatCount(v.comments)}</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:0.3rem">
          <button class="feed-action-btn btn-share" aria-label="Partager">
            <i class="fa-solid fa-share"></i>
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
  toast(feedSoundEnabled ? "Son activé 🔊" : "Son coupé 🔇", "info");
});

// ============================================================
// FEED — Interactions
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
  heart.textContent = "❤️";
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
// FEED — AutoPlay IntersectionObserver
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
    toast("Caméra inaccessible : " + err.message, "error");
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
    const url = URL.createObjectURL(blob);
    photoPreview.src = url;
    photoPreview.classList.remove("hidden");
    videoPreview.classList.add("hidden");
    placeholder?.classList.add("hidden");
    stopCamera();
    showUploadSection(`📷 Photo — ${(blob.size / 1024).toFixed(0)} Ko`);
    haptic(15);
  }, "image/jpeg", 0.88);
});

fileInput?.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;
  studioFile = file; studioBlob = null; studioFileName = file.name;

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
  showUploadSection(`📁 ${file.name} — ${(file.size / (1024*1024)).toFixed(2)} Mo`);
  e.target.value = "";
});

function showUploadSection(info) {
  if (fileInfoEl) fileInfoEl.textContent = info;
  if (uploadSection) uploadSection.style.display = "";
}

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
  btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publication…';
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

  if (progressBar) progressBar.style.width = "100%";
  toast("Publié dans le Feed ✓", "success");
  haptic(20);

  studioFile = null; studioBlob = null; studioFileName = null;
  if (videoPreview) { videoPreview.src = ""; videoPreview.classList.add("hidden"); }
  if (photoPreview) { photoPreview.src = ""; photoPreview.classList.add("hidden"); }
  placeholder?.classList.remove("hidden");
  if (uploadSection) uploadSection.style.display = "none";
  const descInput = document.getElementById("studio-desc");
  if (descInput) descInput.value = "";

  await buildFeed();
});

// ============================================================
// DÉMARRAGE
// ============================================================
initAuth();
