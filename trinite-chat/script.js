// ============================================================
// TRINITÉ — script.js
// ============================================================

// ÉTAPE 1 : Connexion Supabase (clé anon uniquement)
const SUPABASE_URL  = "https://eqttgyxjjupeisgozrut.supabase.co";
const SUPABASE_ANON = "sb_publishable_2tUX4eHP5MrKz_pekDY4aA_EiuZ99Wo";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// ÉTAT GLOBAL
// ============================================================
let currentUser     = null;   // utilisateur connecté
let userProfiles    = [];     // ses 3 profils
let activeProfile   = null;   // profil affiché en ce moment
let currentContacts = [];     // contacts du profil actif
let chatContact     = null;   // contact ouvert dans le chat
let chatMyProfile   = null;   // profil actif lors du chat
let realtimeChannel = null;   // abonnement realtime Supabase
let swiper          = null;   // instance Swiper.js

// ============================================================
// UTILITAIRES
// ============================================================

// Affiche un toast en bas de l'écran
function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast ${type}`;
  setTimeout(() => { el.className = "toast hidden"; }, 3200);
}

// Formate une heure depuis un timestamp ISO
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// Affiche un écran, masque les autres
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

// Première lettre en majuscule pour l'avatar
function initial(name) {
  return (name || "?").charAt(0).toUpperCase();
}

// Icône Font Awesome selon le type de profil
function profileIcon(type) {
  if (type === "pro")     return "fa-solid fa-briefcase";
  if (type === "prive")   return "fa-solid fa-heart";
  if (type === "anonyme") return "fa-solid fa-ghost";
  return "fa-solid fa-user";
}

// Label lisible selon le type de profil
function profileLabel(type) {
  if (type === "pro")     return "Pro";
  if (type === "prive")   return "Privé";
  if (type === "anonyme") return "Anonyme";
  return type;
}

// ============================================================
// ÉTAPE 2 : Gestion auth — connexion / inscription / session
// ============================================================

// Vérifie la session au chargement de la page
async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    await afterLogin();
  } else {
    showScreen("screen-auth");
  }

  // Écoute les changements d'état d'authentification
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

// Après connexion réussie : vérifier si les profils existent
async function afterLogin() {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("user_id", currentUser.id);

  if (error) { toast("Erreur de chargement des profils", "error"); return; }

  userProfiles = data || [];

  if (userProfiles.length < 3) {
    // Aucun profil créé → écran de setup
    showScreen("screen-setup");
  } else {
    // Profils existants → écran principal
    await loadMainScreen();
  }
}

// Formulaire CONNEXION
document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Connexion…";

  const { error } = await db.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  btn.textContent = "Se connecter";

  if (error) {
    toast(error.message === "Invalid login credentials"
      ? "Email ou mot de passe incorrect"
      : error.message, "error");
  }
});

// Formulaire INSCRIPTION
document.getElementById("form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email    = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Création…";

  const { error } = await db.auth.signUp({ email, password });
  btn.disabled = false;
  btn.textContent = "Créer mon compte";

  if (error) {
    toast(error.message, "error");
  } else {
    toast("Compte créé ! Vérifiez votre email si nécessaire.", "success");
  }
});

// Basculer entre onglets Connexion / Inscription
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.tab;
    document.getElementById("form-login").classList.toggle("hidden", which !== "login");
    document.getElementById("form-register").classList.toggle("hidden", which !== "register");
  });
});

// Bouton déconnexion
document.getElementById("btn-logout").addEventListener("click", async () => {
  if (realtimeChannel) db.removeChannel(realtimeChannel);
  await db.auth.signOut();
});

// ============================================================
// ÉTAPE 3 : Profils — création initiale et swipe
// ============================================================

// Formulaire de création des 3 profils
document.getElementById("form-setup").addEventListener("submit", async (e) => {
  e.preventDefault();
  const namePro     = document.getElementById("name-pro").value.trim();
  const namePrive   = document.getElementById("name-prive").value.trim();
  const nameAnonyme = document.getElementById("name-anonyme").value.trim();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Création…";

  const rows = [
    { user_id: currentUser.id, profile_type: "pro",     name: namePro     },
    { user_id: currentUser.id, profile_type: "prive",   name: namePrive   },
    { user_id: currentUser.id, profile_type: "anonyme", name: nameAnonyme },
  ];

  const { data, error } = await db.from("profiles").insert(rows).select();
  btn.disabled = false;
  btn.textContent = "Créer mes profils";

  if (error) {
    toast("Erreur lors de la création des profils : " + error.message, "error");
    return;
  }

  userProfiles = data;
  toast("Vos 3 identités sont prêtes !", "success");
  await loadMainScreen();
}); 

// Charge l'écran principal avec le swiper
async function loadMainScreen() {
  showScreen("screen-main");
  buildSwiper();
  activeProfile = userProfiles[0];
  updateHeaderProfile();
  await loadContacts();
}

// Construit les slides du swiper
function buildSwiper() {
  const wrapper = document.getElementById("profile-slides");
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
          <span class="slide-name">${p.name}</span>
          <span class="slide-type">${profileLabel(p.profile_type)}</span>
        </div>
      </div>`;
    wrapper.appendChild(slide);
  });

  // Destruction de l'ancien swiper si nécessaire
  if (swiper) { swiper.destroy(true, true); swiper = null; }

  swiper = new Swiper(".profile-swiper", {
    slidesPerView: 1.15,
    spaceBetween: 12,
    centeredSlides: true,
    pagination: { el: ".swiper-pagination", clickable: true },
    on: {
      slideChange: async () => {
        activeProfile = userProfiles[swiper.activeIndex];
        updateHeaderProfile();
        await loadContacts();
      }
    }
  });
}

// Met à jour le nom dans l'en-tête
function updateHeaderProfile() {
  const el = document.getElementById("active-profile-name");
  if (activeProfile) el.textContent = activeProfile.name;
}

// ============================================================
// ÉTAPE 4 : Contacts — affichage et ajout
// ============================================================

// Charge les contacts du profil actif
async function loadContacts() {
  if (!activeProfile) return;

  const { data, error } = await db
    .from("contacts")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("assigned_profile_id", activeProfile.id);

  if (error) { toast("Erreur contacts : " + error.message, "error"); return; }

  currentContacts = data || [];
  renderContacts();
}

// Affiche la liste des contacts dans le DOM
function renderContacts() {
  const list = document.getElementById("contact-list");
  list.innerHTML = "";

  if (currentContacts.length === 0) {
    list.innerHTML = '<li class="empty-state">Aucun contact pour ce profil</li>';
    return;
  }

  currentContacts.forEach((c) => {
    const li = document.createElement("li");
    li.className = "contact-item";
    li.innerHTML = `
      <div class="contact-avatar">${initial(c.contact_name)}</div>
      <div class="contact-info">
        <span class="contact-name-text">${c.contact_name}</span>
        <span class="contact-email-text">${c.contact_email}</span>
      </div>`;
    li.addEventListener("click", () => openChat(c));
    list.appendChild(li);
  });
}

// Ouvre la modal d'ajout de contact
document.getElementById("btn-add-contact").addEventListener("click", () => {
  // Remplit le select avec les profils disponibles
  const select = document.getElementById("contact-profile-select");
  select.innerHTML = "";
  userProfiles.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${profileLabel(p.profile_type)} — ${p.name}`;
    if (p.id === activeProfile?.id) opt.selected = true;
    select.appendChild(opt);
  });
  document.getElementById("modal-add-contact").classList.remove("hidden");
});

// Ferme la modal
document.getElementById("modal-close").addEventListener("click", () => {
  document.getElementById("modal-add-contact").classList.add("hidden");
});
document.getElementById("modal-add-contact").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
});

// Formulaire ajout de contact
document.getElementById("form-add-contact").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email      = document.getElementById("contact-email").value.trim();
  const name       = document.getElementById("contact-name").value.trim();
  const profileId  = document.getElementById("contact-profile-select").value;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  btn.textContent = "Ajout…";

  const { error } = await db.from("contacts").insert({
    user_id: currentUser.id,
    contact_email: email,
    contact_name: name,
    assigned_profile_id: profileId,
  });

  btn.disabled = false;
  btn.textContent = "Ajouter";

  if (error) {
    toast("Erreur : " + error.message, "error");
    return;
  }

  toast("Contact ajouté !", "success");
  document.getElementById("form-add-contact").reset();
  document.getElementById("modal-add-contact").classList.add("hidden");

  // Recharge les contacts si le profil sélectionné est celui actif
  if (profileId === activeProfile?.id) await loadContacts();
});

// ============================================================
// ÉTAPE 5 : Messages temps réel — chat
// ============================================================

// Ouvre le chat avec un contact
async function openChat(contact) {
  chatContact   = contact;
  chatMyProfile = activeProfile;

  document.getElementById("chat-contact-name").textContent = contact.contact_name;
  const badge = document.getElementById("chat-profile-badge");
  badge.textContent = profileLabel(chatMyProfile.profile_type);
  badge.className = `profile-badge ${chatMyProfile.profile_type}`;

  showScreen("screen-chat");

  // Charge les messages existants
  await loadMessages();

  // Abonnement Realtime pour les nouveaux messages
  if (realtimeChannel) db.removeChannel(realtimeChannel);

  realtimeChannel = db.channel("messages-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const msg = payload.new;
        // N'affiche que les messages de cette conversation
        const isRelevant =
          (msg.from_profile_id === chatMyProfile.id && msg.to_profile_id === contact.contact_email) ||
          (msg.from_profile_id === contact.contact_email && msg.to_profile_id === chatMyProfile.id) ||
          (msg.from_profile_id === chatMyProfile.id) ||
          (msg.to_profile_id === chatMyProfile.id);

        if (isRelevant) appendMessage(msg);
      }
    )
    .subscribe();
}

// Charge les messages de la conversation courante
async function loadMessages() {
  const container = document.getElementById("messages-container");
  container.innerHTML = "";

  const { data, error } = await db
    .from("messages")
    .select("*")
    .or(
      `and(from_profile_id.eq.${chatMyProfile.id},to_profile_id.eq.${chatContact.id}),` +
      `and(from_profile_id.eq.${chatContact.id},to_profile_id.eq.${chatMyProfile.id})`
    )
    .order("created_at", { ascending: true });

  if (error) { toast("Erreur messages : " + error.message, "error"); return; }

  (data || []).forEach(appendMessage);
  scrollToBottom();
}

// Ajoute une bulle de message dans le DOM
function appendMessage(msg) {
  const isMine = msg.from_profile_id === chatMyProfile.id;
  const container = document.getElementById("messages-container");

  const wrapper = document.createElement("div");
  wrapper.className = `bubble-wrapper ${isMine ? "mine" : "theirs"}`;
  wrapper.innerHTML = `
    <div class="bubble">${escapeHtml(msg.content)}</div>
    <span class="bubble-time">${formatTime(msg.created_at)}</span>`;

  container.appendChild(wrapper);
  scrollToBottom();
}

// Protège le contenu contre les injections XSS
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Fait défiler vers le bas du chat
function scrollToBottom() {
  const c = document.getElementById("messages-container");
  c.scrollTop = c.scrollHeight;
}

// Envoie un message
document.getElementById("btn-send").addEventListener("click", sendMessage);
document.getElementById("message-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

async function sendMessage() {
  const input = document.getElementById("message-input");
  const content = input.value.trim();
  if (!content) return;

  input.value = "";

  const { error } = await db.from("messages").insert({
    from_profile_id: chatMyProfile.id,
    to_profile_id: chatContact.id,
    content,
  });

  if (error) {
    toast("Erreur envoi : " + error.message, "error");
    input.value = content; // Restaure le texte en cas d'erreur
  }
}

// Bouton retour depuis le chat
document.getElementById("btn-back").addEventListener("click", () => {
  if (realtimeChannel) { db.removeChannel(realtimeChannel); realtimeChannel = null; }
  showScreen("screen-main");
});

// ============================================================
// DÉMARRAGE
// ============================================================
initAuth();
