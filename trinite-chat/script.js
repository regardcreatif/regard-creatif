// ============================================================
// TRINITE CHAT — script.js
// Supabase Auth + Profils + Contacts + Chat temps réel + Feed TikTok
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

// Feed
let feedItems = [];
let feedLiked = {};
let feedLikeCounts = {};
let lastTapTime = {};
let swipeStart  = null;

const DEMO_VIDEOS = [
  {
    id: "v1",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    author: "@trinitechat",
    desc: "Bienvenue sur Trinite Chat 🎉 Trois profils, une seule app !",
    likes: 1284, comments: 48
  },
  {
    id: "v2",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    author: "@profil_pro",
    desc: "Gérez vos conversations pros séparément 💼",
    likes: 873, comments: 22
  },
  {
    id: "v3",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    author: "@anonyme_x",
    desc: "Mode anonyme activé 👻 Personne ne saura qui vous êtes",
    likes: 3102, comments: 95
  },
  {
    id: "v4",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    author: "@prive_heart",
    desc: "Vos messages privés restent privés ❤️",
    likes: 642, comments: 17
  }
];

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
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function profileLabel(type) {
  return { pro:"Pro", prive:"Privé", anonyme:"Anonyme" }[type] || type;
}

function profileEmoji(type) {
  return { pro:"💼", prive:"❤️", anonyme:"👻" }[type] || "👤";
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

  db.auth.onAuthStateChange(async (_e, session) => {
    if (session) {
      currentUser = session.user;
      await afterLogin();
    } else {
      currentUser = null; userProfiles = []; activeProfile = null;
      showScreen("screen-auth");
    }
  });
}

async function afterLogin() {
  const { data, error } = await db.from("profiles").select("*").eq("user_id", currentUser.id);
  if (error) { toast("Erreur chargement profils: " + error.message, "error"); return; }

  if (!data || data.length === 0) {
    // Créer automatiquement 3 profils par défaut
    const rows = [
      { user_id: currentUser.id, profile_type: "pro",     name: "Pro" },
      { user_id: currentUser.id, profile_type: "prive",   name: "Privé" },
      { user_id: currentUser.id, profile_type: "anonyme", name: "Anonyme" }
    ];
    const { data: nd, error: ne } = await db.from("profiles").insert(rows).select();
    if (ne) { toast("Erreur création profils: " + ne.message, "error"); showScreen("screen-setup"); return; }
    userProfiles = nd || [];
    toast("Vos 3 profils ont été créés !", "success");
  } else {
    userProfiles = data;
  }

  await loadMainScreen();
}

// Formulaire connexion
document.getElementById("form-login")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn  = e.target.querySelector("button");
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (btn) { btn.disabled = true; btn.textContent = "Connexion…"; }
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (btn) { btn.disabled = false; btn.textContent = "Se connecter"; }
  if (error) toast(error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : error.message, "error");
});

// Formulaire inscription
document.getElementById("form-register")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  const email    = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  if (btn) { btn.disabled = true; btn.textContent = "Création…"; }
  const { error } = await db.auth.signUp({ email, password });
  if (btn) { btn.disabled = false; btn.textContent = "Créer mon compte"; }
  if (error) toast(error.message, "error");
  else toast("Compte créé ! Vous pouvez vous connecter.", "success");
});

// Onglets connexion/inscription
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.tab;
    document.getElementById("form-login")   ?.classList.toggle("hidden", which !== "login");
    document.getElementById("form-register")?.classList.toggle("hidden", which !== "register");
  });
});

// Déconnexion
function handleLogout() {
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  db.auth.signOut();
}
document.getElementById("btn-logout")       ?.addEventListener("click", handleLogout);
document.getElementById("btn-logout-profil")?.addEventListener("click", handleLogout);

// ============================================================
// SETUP PROFILS (formulaire manuel)
// ============================================================

document.getElementById("form-setup")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  if (btn) { btn.disabled = true; btn.textContent = "Création…"; }
  const rows = [
    { user_id: currentUser.id, profile_type: "pro",     name: document.getElementById("name-pro")?.value.trim()     || "Pro" },
    { user_id: currentUser.id, profile_type: "prive",   name: document.getElementById("name-prive")?.value.trim()   || "Privé" },
    { user_id: currentUser.id, profile_type: "anonyme", name: document.getElementById("name-anonyme")?.value.trim() || "Anonyme" }
  ];
  const { data, error } = await db.from("profiles").insert(rows).select();
  if (btn) { btn.disabled = false; btn.textContent = "Créer mes profils"; }
  if (error) { toast("Erreur: " + error.message, "error"); return; }
  userProfiles = data || [];
  toast("Vos 3 identités sont prêtes !", "success");
  await loadMainScreen();
});

// ============================================================
// ÉCRAN PRINCIPAL
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
}

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

  // Swipe horizontal sur le swiper
  const wrap = document.getElementById("profile-swiper-wrap");
  let startX = null;
  wrap?.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
  wrap?.addEventListener("touchend", e => {
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

  const wrap   = document.getElementById("profile-slides");
  const offset = idx * (wrap?.children[0]?.offsetWidth + 12 || 0);
  if (wrap) wrap.style.transform = `translateX(-${offset}px)`;

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
  const { data, error } = await db.from("contacts").select("*")
    .eq("user_id", currentUser.id)
    .eq("assigned_profile_id", activeProfile.id);
  if (error) { toast("Erreur contacts: " + error.message, "error"); return; }
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

// Ajouter un contact
document.getElementById("btn-add-contact")?.addEventListener("click", () => {
  const sel = document.getElementById("contact-profile-select");
  if (sel) {
    sel.innerHTML = "";
    userProfiles.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${profileLabel(p.profile_type)} — ${p.name}`;
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
  const btn       = e.target.querySelector("button");
  const email     = document.getElementById("contact-email")?.value.trim();
  const name      = document.getElementById("contact-name")?.value.trim();
  const profileId = document.getElementById("contact-profile-select")?.value;
  if (btn) { btn.disabled = true; btn.textContent = "Ajout…"; }
  const { error } = await db.from("contacts").insert({ user_id: currentUser.id, contact_email: email, contact_name: name, assigned_profile_id: profileId });
  if (btn) { btn.disabled = false; btn.textContent = "Ajouter"; }
  if (error) { toast("Erreur: " + error.message, "error"); return; }
  toast("Contact ajouté !", "success");
  e.target.reset();
  document.getElementById("modal-add-contact")?.classList.add("hidden");
  if (profileId === activeProfile?.id) await loadContacts();
});

// ============================================================
// NAVIGATION BASSE
// ============================================================

function wireBottomNav() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.screen;
      if (!target) return;
      showScreen(target);
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(`[data-screen="${target}"]`).forEach(b => b.classList.add("active"));
      if (target === "screen-feed") playCurrentFeedVideo();
    });
  });
}

// ============================================================
// ÉCRAN FEED TIKTOK
// ============================================================

let currentFeedIdx = 0;

function buildFeed() {
  const container = document.getElementById("feed-container");
  if (!container) return;
  container.innerHTML = "";

  DEMO_VIDEOS.forEach((v, i) => {
    feedLikeCounts[v.id] = v.likes;
    feedLiked[v.id]      = false;

    const item = document.createElement("div");
    item.className = "feed-item";
    item.dataset.id = v.id;
    item.dataset.idx = i;
    item.innerHTML = `
      <video class="feed-video" src="${v.url}" loop muted playsinline preload="metadata"></video>

      <div class="feed-overlay">
        <div class="feed-meta">
          <p class="feed-author">${escapeHtml(v.author)}</p>
          <p class="feed-desc">${escapeHtml(v.desc)}</p>
        </div>
        <div class="feed-actions">
          <button class="feed-action-btn" data-action="like" data-id="${v.id}">
            <span class="feed-action-icon">🤍</span>
            <span class="feed-action-count" id="lc-${v.id}">${v.likes}</span>
          </button>
          <button class="feed-action-btn" data-action="comment" data-id="${v.id}">
            <span class="feed-action-icon">💬</span>
            <span class="feed-action-count">${v.comments}</span>
          </button>
          <button class="feed-action-btn" data-action="share">
            <span class="feed-action-icon">📤</span>
          </button>
        </div>
      </div>`;

    // Double-tap like
    item.addEventListener("click", e => {
      if (e.target.closest(".feed-actions")) return;
      handleDoubleTap(v.id, item);
    });

    // Swipe
    item.addEventListener("touchstart", e => {
      swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    item.addEventListener("touchend", e => {
      if (!swipeStart) return;
      const dx = e.changedTouches[0].clientX - swipeStart.x;
      const dy = e.changedTouches[0].clientY - swipeStart.y;
      swipeStart = null;
      // Swipe droite → ouvrir chat avec le 1er contact
      if (dx > 60 && Math.abs(dy) < 80 && currentContacts.length > 0 && activeProfile) {
        openChat(currentContacts[0], activeProfile);
      }
    });

    // Boutons action
    item.querySelector("[data-action='like']").addEventListener("click", e => {
      e.stopPropagation();
      toggleLike(v.id, item.querySelector("[data-action='like']"));
    });
    item.querySelector("[data-action='comment']").addEventListener("click", e => {
      e.stopPropagation();
      if (currentContacts.length > 0 && activeProfile) openChat(currentContacts[0], activeProfile);
    });

    container.appendChild(item);
  });

  // Intersection observer pour autoplay
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target.querySelector(".feed-video");
      if (!video) return;
      if (entry.isIntersecting) {
        currentFeedIdx = Number(entry.target.dataset.idx);
        video.play().catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, { threshold: 0.6 });

  container.querySelectorAll(".feed-item").forEach(item => observer.observe(item));
}

function playCurrentFeedVideo() {
  const container = document.getElementById("feed-container");
  if (!container) return;
  const items = container.querySelectorAll(".feed-item");
  if (items[currentFeedIdx]) {
    const v = items[currentFeedIdx].querySelector(".feed-video");
    v?.play().catch(() => {});
  }
}

function handleDoubleTap(videoId, itemEl) {
  const now  = Date.now();
  const last = lastTapTime[videoId] || 0;
  lastTapTime[videoId] = now;

  if (now - last < 300) {
    // Double tap !
    const btn = itemEl.querySelector(`[data-action='like'][data-id='${videoId}']`);
    if (!feedLiked[videoId]) toggleLike(videoId, btn);

    // Afficher cœur animé
    const heart = document.createElement("div");
    heart.className = "heart-anim";
    heart.textContent = "❤️";
    itemEl.appendChild(heart);
    setTimeout(() => heart.remove(), 750);
  }
}

function toggleLike(videoId, btn) {
  feedLiked[videoId] = !feedLiked[videoId];
  const delta = feedLiked[videoId] ? 1 : -1;
  feedLikeCounts[videoId] += delta;

  const icon = btn?.querySelector(".feed-action-icon");
  const cnt  = document.getElementById(`lc-${videoId}`);
  if (icon) icon.textContent = feedLiked[videoId] ? "❤️" : "🤍";
  if (cnt)  cnt.textContent  = feedLikeCounts[videoId];
  if (feedLiked[videoId]) btn?.classList.add("liked");
  else btn?.classList.remove("liked");
}

// ============================================================
// ÉCRAN PROFIL
// ============================================================

function buildProfilScreen() {
  const cards = document.getElementById("profil-cards");
  if (!cards) return;
  cards.innerHTML = "";
  userProfiles.forEach(p => {
    const card = document.createElement("div");
    card.className = "profile-setup-card";
    card.innerHTML = `
      <div class="profile-icon ${p.profile_type}">${profileEmoji(p.profile_type)}</div>
      <div class="field flex1">
        <label>${profileLabel(p.profile_type)}</label>
        <input type="text" value="${escapeHtml(p.name)}" data-profile-id="${p.id}" />
      </div>`;
    cards.appendChild(card);
  });
}

document.getElementById("form-profil")?.addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  if (btn) { btn.disabled = true; btn.textContent = "Sauvegarde…"; }
  const inputs = document.querySelectorAll("#profil-cards input[data-profile-id]");
  for (const input of inputs) {
    const pid  = input.dataset.profileId;
    const name = input.value.trim();
    if (!name) continue;
    const p = userProfiles.find(x => x.id === pid);
    if (p && name !== p.name) {
      await db.from("profiles").update({ name }).eq("id", pid);
      p.name = name;
    }
  }
  if (btn) { btn.disabled = false; btn.textContent = "Enregistrer"; }
  toast("Profils mis à jour !", "success");
  updateHeaderProfile();
  buildSwiper();
}

);

// ============================================================
// CHAT
// ============================================================

function openChat(contact, profile) {
  chatContact   = contact;
  chatMyProfile = profile;

  document.getElementById("chat-contact-name").textContent = contact.contact_name;
  const badge = document.getElementById("chat-profile-badge");
  badge.textContent = profileLabel(profile.profile_type);
  badge.className   = `profile-badge ${profile.profile_type}`;

  showScreen("screen-chat");
  loadMessages();

  if (realtimeChannel) db.removeChannel(realtimeChannel);
  realtimeChannel = db.channel("msg-rt-" + profile.id + "-" + contact.id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, payload => {
      const m = payload.new;
      const ok = (m.from_profile_id === chatMyProfile.id && m.to_profile_id === chatContact.id)
              || (m.from_profile_id === chatContact.id   && m.to_profile_id === chatMyProfile.id);
      if (ok) appendMessage(m);
    })
    .subscribe();
}

async function loadMessages() {
  const container = document.getElementById("messages-container");
  if (!container) return;
  container.innerHTML = "";

  const { data, error } = await db.from("messages").select("*")
    .or(
      `and(from_profile_id.eq.${chatMyProfile.id},to_profile_id.eq.${chatContact.id}),` +
      `and(from_profile_id.eq.${chatContact.id},to_profile_id.eq.${chatMyProfile.id})`
    )
    .order("created_at", { ascending: true });

  if (error) { toast("Erreur messages: " + error.message, "error"); return; }
  (data || []).forEach(appendMessage);
  scrollBottom();
}

function appendMessage(msg) {
  const isMine = msg.from_profile_id === chatMyProfile.id;
  const container = document.getElementById("messages-container");
  if (!container) return;
  const w = document.createElement("div");
  w.className = `bubble-wrapper ${isMine ? "mine" : "theirs"}`;
  w.innerHTML = `
    <div class="bubble">${escapeHtml(msg.content)}</div>
    <span class="bubble-time">${formatTime(msg.created_at)}</span>`;
  container.appendChild(w);
  scrollBottom();
}

function scrollBottom() {
  const c = document.getElementById("messages-container");
  if (c) c.scrollTop = c.scrollHeight;
}

async function sendMessage() {
  const input   = document.getElementById("message-input");
  const content = input?.value.trim();
  if (!content) return;
  input.value = "";
  const { error } = await db.from("messages").insert({
    from_profile_id: chatMyProfile.id,
    to_profile_id:   chatContact.id,
    content
  });
  if (error) { toast("Erreur envoi: " + error.message, "error"); input.value = content; }
}

document.getElementById("btn-send")?.addEventListener("click", sendMessage);
document.getElementById("message-input")?.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

document.getElementById("btn-back")?.addEventListener("click", () => {
  if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
  // Revenir sur l'écran messages
  showScreen("screen-main");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(`[data-screen="screen-main"]`).forEach(b => b.classList.add("active"));
});

// ============================================================
// DÉMARRAGE
// ============================================================
initAuth();
