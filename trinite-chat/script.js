// ============================================================
// TRINITE CHAT — script.js (version corrigée)
// ============================================================

// ÉTAPE 1 : Connexion Supabase (clé anon)
const SUPABASE_URL = "https://eqttgyxjjupeisgozrut.supabase.co";
const SUPABASE_ANON = "sb_publishable_2tUX4eHP5MrKz_pekDY4aA_EiuZ99Wo";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// ÉTAT GLOBAL
// ============================================================
let currentUser = null;
let userProfiles = [];
let activeProfile = null;
let currentContacts = [];
let chatContact = null;
let chatMyProfile = null;
let realtimeChannel = null;
let swiper = null;

// ============================================================
// UTILITAIRES
// ============================================================

function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type}`;
  setTimeout(() => { el.className = "toast hidden"; }, 3200);
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

function initial(name) {
  return (name || "?").charAt(0).toUpperCase();
}

function profileIcon(type) {
  if (type === "pro") return "fa-solid fa-briefcase";
  if (type === "prive") return "fa-solid fa-heart";
  if (type === "anonyme") return "fa-solid fa-ghost";
  return "fa-solid fa-user";
}

function profileLabel(type) {
  if (type === "pro") return "Pro";
  if (type === "prive") return "Privé";
  if (type === "anonyme") return "Anonyme";
  return type;
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
      currentUser = null;
      userProfiles = [];
      activeProfile = null;
      showScreen("screen-auth");
    }
  });
}

async function afterLogin() {
  console.log("afterLogin - utilisateur:", currentUser?.id);
  
  // FORCER LA CRÉATION DES PROFILS SI NÉCESSAIRE
  const { data: existingProfiles, error: fetchError } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", currentUser.id);

  if (fetchError) {
    console.error("Erreur chargement profils:", fetchError);
    toast("Erreur de chargement des profils: " + fetchError.message, "error");
    return;
  }

  console.log("Profils existants:", existingProfiles);

  if (!existingProfiles || existingProfiles.length === 0) {
    // Création automatique des 3 profils
    console.log("Création automatique des 3 profils...");
    const defaultNames = {
      pro: "Pro",
      prive: "Privé",
      anonyme: "Anonyme"
    };
    
    const rows = [
      { user_id: currentUser.id, profile_type: "pro", name: defaultNames.pro },
      { user_id: currentUser.id, profile_type: "prive", name: defaultNames.prive },
      { user_id: currentUser.id, profile_type: "anonyme", name: defaultNames.anonyme }
    ];
    
    const { data: newProfiles, error: insertError } = await db
      .from("profiles")
      .insert(rows)
      .select();
    
    if (insertError) {
      console.error("Erreur création profils:", insertError);
      toast("Erreur création profils: " + insertError.message, "error");
      showScreen("screen-setup");
      return;
    }
    
    userProfiles = newProfiles || [];
    console.log("Profils créés:", userProfiles);
    toast("Vos 3 profils ont été créés automatiquement !", "success");
    await loadMainScreen();
  } else {
    userProfiles = existingProfiles;
    await loadMainScreen();
  }
}

// Formulaire CONNEXION
const formLogin = document.getElementById("form-login");
if (formLogin) {
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const btn = e.target.querySelector("button");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Connexion…";
    }

    const { error } = await db.auth.signInWithPassword({ email, password });
    
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Se connecter";
    }

    if (error) {
      toast(error.message === "Invalid login credentials"
        ? "Email ou mot de passe incorrect"
        : error.message, "error");
    }
  });
}

// Formulaire INSCRIPTION
const formRegister = document.getElementById("form-register");
if (formRegister) {
  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const btn = e.target.querySelector("button");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Création…";
    }

    const { error } = await db.auth.signUp({ email, password });
    
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Créer mon compte";
    }

    if (error) {
      toast(error.message, "error");
    } else {
      toast("Compte créé ! Vous pouvez vous connecter.", "success");
    }
  });
}

// Tabs connexion/inscription
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.tab;
    const loginForm = document.getElementById("form-login");
    const registerForm = document.getElementById("form-register");
    if (loginForm) loginForm.classList.toggle("hidden", which !== "login");
    if (registerForm) registerForm.classList.toggle("hidden", which !== "register");
  });
});

// Déconnexion
const btnLogout = document.getElementById("btn-logout");
if (btnLogout) {
  btnLogout.addEventListener("click", async () => {
    if (realtimeChannel) db.removeChannel(realtimeChannel);
    await db.auth.signOut();
  });
}

// ============================================================
// PROFILS & SWIPE
// ============================================================

const formSetup = document.getElementById("form-setup");
if (formSetup) {
  formSetup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const namePro = document.getElementById("name-pro")?.value.trim() || "Pro";
    const namePrive = document.getElementById("name-prive")?.value.trim() || "Privé";
    const nameAnonyme = document.getElementById("name-anonyme")?.value.trim() || "Anonyme";
    const btn = e.target.querySelector("button[type=submit]");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Création…";
    }

    const rows = [
      { user_id: currentUser.id, profile_type: "pro", name: namePro },
      { user_id: currentUser.id, profile_type: "prive", name: namePrive },
      { user_id: currentUser.id, profile_type: "anonyme", name: nameAnonyme }
    ];

    const { data, error } = await db.from("profiles").insert(rows).select();
    
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Créer mes profils";
    }

    if (error) {
      toast("Erreur création profils: " + error.message, "error");
      return;
    }

    userProfiles = data || [];
    toast("Vos 3 identités sont prêtes !", "success");
    await loadMainScreen();
  });
}

async function loadMainScreen() {
  showScreen("screen-main");
  buildSwiper();
  activeProfile = userProfiles[0];
  updateHeaderProfile();
  await loadContacts();
}

function buildSwiper() {
  const wrapper = document.getElementById("profile-slides");
  if (!wrapper) return;
  wrapper.innerHTML = "";

  userProfiles.forEach((p) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide";
    slide.innerHTML = `
      <div class="profile-slide">
        <div class="slide-icon ${p.profile_type}">
          <i class="${profileIcon(p.profile_type)}"></i>
        </div>
        <div class="slide-info">
          <span class="slide-name">${escapeHtml(p.name)}</span>
          <span class="slide-type">${profileLabel(p.profile_type)}</span>
        </div>
      </div>`;
    wrapper.appendChild(slide);
  });

  if (swiper) {
    swiper.destroy(true, true);
    swiper = null;
  }

  swiper = new Swiper(".profile-swiper", {
    slidesPerView: 1.15,
    spaceBetween: 12,
    centeredSlides: true,
    pagination: { el: ".swiper-pagination", clickable: true },
    on: {
      slideChange: async () => {
        if (swiper && userProfiles[swiper.activeIndex]) {
          activeProfile = userProfiles[swiper.activeIndex];
          updateHeaderProfile();
          await loadContacts();
        }
      }
    }
  });
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

  const { data, error } = await db
    .from("contacts")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("assigned_profile_id", activeProfile.id);

  if (error) {
    toast("Erreur contacts: " + error.message, "error");
    return;
  }

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

  currentContacts.forEach((c) => {
    const li = document.createElement("li");
    li.className = "contact-item";
    li.innerHTML = `
      <div class="contact-avatar">${escapeHtml(initial(c.contact_name))}</div>
      <div class="contact-info">
        <span class="contact-name-text">${escapeHtml(c.contact_name)}</span>
        <span class="contact-email-text">${escapeHtml(c.contact_email)}</span>
      </div>`;
    li.addEventListener("click", () => openChat(c));
    list.appendChild(li);
  });
}

const btnAddContact = document.getElementById("btn-add-contact");
if (btnAddContact) {
  btnAddContact.addEventListener("click", () => {
    const select = document.getElementById("contact-profile-select");
    if (select) {
      select.innerHTML = "";
      userProfiles.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${profileLabel(p.profile_type)} — ${p.name}`;
        if (p.id === activeProfile?.id) opt.selected = true;
        select.appendChild(opt);
      });
    }
    const modal = document.getElementById("modal-add-contact");
    if (modal) modal.classList.remove("hidden");
  });
}

const modalClose = document.getElementById("modal-close");
if (modalClose) {
  modalClose.addEventListener("click", () => {
    const modal = document.getElementById("modal-add-contact");
    if (modal) modal.classList.add("hidden");
  });
}

const modalAddContact = document.getElementById("modal-add-contact");
if (modalAddContact) {
  modalAddContact.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
  });
}

const formAddContact = document.getElementById("form-add-contact");
if (formAddContact) {
  formAddContact.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("contact-email")?.value.trim() || "";
    const name = document.getElementById("contact-name")?.value.trim() || "";
    const profileId = document.getElementById("contact-profile-select")?.value;
    const btn = e.target.querySelector("button");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Ajout…";
    }

    const { error } = await db.from("contacts").insert({
      user_id: currentUser.id,
      contact_email: email,
      contact_name: name,
      assigned_profile_id: profileId
    });

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Ajouter";
    }

    if (error) {
      toast("Erreur: " + error.message, "error");
      return;
    }

    toast("Contact ajouté !", "success");
    if (formAddContact) formAddContact.reset();
    const modal = document.getElementById("modal-add-contact");
    if (modal) modal.classList.add("hidden");

    if (profileId === activeProfile?.id) await loadContacts();
  });
}

// ============================================================
// CHAT
// ============================================================

async function openChat(contact) {
  chatContact = contact;
  chatMyProfile = activeProfile;

  const nameEl = document.getElementById("chat-contact-name");
  const badge = document.getElementById("chat-profile-badge");
  if (nameEl) nameEl.textContent = contact.contact_name;
  if (badge) {
    badge.textContent = profileLabel(chatMyProfile.profile_type);
    badge.className = `profile-badge ${chatMyProfile.profile_type}`;
  }

  showScreen("screen-chat");
  await loadMessages();

  if (realtimeChannel) db.removeChannel(realtimeChannel);

  realtimeChannel = db.channel("messages-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const msg = payload.new;
        const isRelevant =
          (msg.from_profile_id === chatMyProfile.id && msg.to_profile_id === chatContact.id) ||
          (msg.from_profile_id === chatContact.id && msg.to_profile_id === chatMyProfile.id);
        if (isRelevant) appendMessage(msg);
      }
    )
    .subscribe();
}

async function loadMessages() {
  const container = document.getElementById("messages-container");
  if (!container) return;
  container.innerHTML = "";

  const { data, error } = await db
    .from("messages")
    .select("*")
    .or(
      `and(from_profile_id.eq.${chatMyProfile.id},to_profile_id.eq.${chatContact.id}),` +
      `and(from_profile_id.eq.${chatContact.id},to_profile_id.eq.${chatMyProfile.id})`
    )
    .order("created_at", { ascending: true });

  if (error) {
    toast("Erreur messages: " + error.message, "error");
    return;
  }

  (data || []).forEach(appendMessage);
  scrollToBottom();
}

function appendMessage(msg) {
  const isMine = msg.from_profile_id === chatMyProfile.id;
  const container = document.getElementById("messages-container");
  if (!container) return;

  const wrapper = document.createElement("div");
  wrapper.className = `bubble-wrapper ${isMine ? "mine" : "theirs"}`;
  wrapper.innerHTML = `
    <div class="bubble">${escapeHtml(msg.content)}</div>
    <span class="bubble-time">${formatTime(msg.created_at)}</span>`;
  container.appendChild(wrapper);
  scrollToBottom();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scrollToBottom() {
  const c = document.getElementById("messages-container");
  if (c) c.scrollTop = c.scrollHeight;
}

const btnSend = document.getElementById("btn-send");
const messageInput = document.getElementById("message-input");

if (btnSend && messageInput) {
  btnSend.addEventListener("click", sendMessage);
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

async function sendMessage() {
  const input = document.getElementById("message-input");
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  input.value = "";

  const { error } = await db.from("messages").insert({
    from_profile_id: chatMyProfile.id,
    to_profile_id: chatContact.id,
    content
  });

  if (error) {
    toast("Erreur envoi: " + error.message, "error");
    input.value = content;
  }
}

const btnBack = document.getElementById("btn-back");
if (btnBack) {
  btnBack.addEventListener("click", () => {
    if (realtimeChannel) {
      db.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    showScreen("screen-main");
  });
}

// ============================================================
// DÉMARRAGE
// ============================================================
initAuth();