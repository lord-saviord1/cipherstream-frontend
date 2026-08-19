const API_BASE = "https://cipherstream-backend.vercel.app/api";

let token = localStorage.getItem("cs_token") || null;

const authStatus = document.getElementById("authStatus");
const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const authMsg = document.getElementById("authMsg");
const liveGrid = document.getElementById("liveGrid");
const ondemandRows = document.getElementById("ondemandRows");
const playerOverlay = document.getElementById("playerOverlay");
const video = document.getElementById("video");
const nowPlaying = document.getElementById("nowPlaying");
const playerMsg = document.getElementById("playerMsg");
const logoutBtn = document.getElementById("logoutBtn");
const playOverlayBtn = document.getElementById("playOverlayBtn");
const loadingSpinner = document.getElementById("loadingSpinner");

function setSignedIn(isSignedIn) {
  authStatus.textContent = isSignedIn ? "signed in" : "not signed in";
  authStatus.classList.toggle("on", isSignedIn);
  authView.classList.toggle("hidden", isSignedIn);
  appView.classList.toggle("hidden", !isSignedIn);
  logoutBtn.classList.toggle("hidden", !isSignedIn);
}

function logout() {
  token = null;
  localStorage.removeItem("cs_token");
  setSignedIn(false);
}
logoutBtn.addEventListener("click", logout);

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // Expired or invalid token — clear it and send the user back to sign in
    // instead of leaving them stuck on a confusing error.
    logout();
    throw new Error("Your session expired — please sign in again.");
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  authMsg.textContent = "signing up...";
  try {
    const name = document.getElementById("su-name").value;
    const email = document.getElementById("su-email").value;
    const password = document.getElementById("su-password").value;
    const data = await api("/auth/signup", { method: "POST", body: JSON.stringify({ name, email, password }) });
    token = data.token;
    localStorage.setItem("cs_token", token);
    setSignedIn(true);
    loadChannels();
  } catch (err) {
    authMsg.textContent = err.message;
  }
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  authMsg.textContent = "logging in...";
  try {
    const email = document.getElementById("li-email").value;
    const password = document.getElementById("li-password").value;
    const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    token = data.token;
    localStorage.setItem("cs_token", token);
    setSignedIn(true);
    loadChannels();
  } catch (err) {
    authMsg.textContent = err.message;
  }
});

async function loadChannels() {
  liveGrid.innerHTML = "loading...";
  ondemandRows.innerHTML = "";
  try {
    const data = await api("/channels");
    const live = data.channels.filter((c) => c.contentType !== "ondemand");
    const ondemand = data.channels.filter((c) => c.contentType === "ondemand");
    renderLive(live);
    renderOndemand(ondemand);
  } catch (err) {
    liveGrid.textContent = err.message;
  }
}

function renderLive(channels) {
  liveGrid.innerHTML = "";
  channels
    .sort((a, b) => (a.channelNumber || 0) - (b.channelNumber || 0))
    .forEach((ch) => {
      const tile = document.createElement("div");
      tile.className = "live-tile";
      tile.innerHTML = `
        <div class="live-dot"></div>
        <div class="live-number">${ch.channelNumber ?? "—"}</div>
        <div class="live-name">${ch.displayName}</div>
        <div class="live-cat">${ch.category}</div>
      `;
      tile.addEventListener("click", () => playChannel(ch._id, ch.displayName));
      liveGrid.appendChild(tile);
    });
}

function renderOndemand(channels) {
  ondemandRows.innerHTML = "";
  const byCategory = {};
  channels.forEach((c) => {
    byCategory[c.category] = byCategory[c.category] || [];
    byCategory[c.category].push(c);
  });

  Object.entries(byCategory).forEach(([category, items]) => {
    const row = document.createElement("div");
    row.className = "ondemand-row";
    row.innerHTML = `<div class="ondemand-row-title">${category}</div>`;
    const scroll = document.createElement("div");
    scroll.className = "ondemand-scroll";
    items.forEach((ch) => {
      const card = document.createElement("div");
      card.className = "ondemand-card";
      card.innerHTML = `<div class="name">${ch.displayName}</div><div class="cat">${ch.category}</div>`;
      card.addEventListener("click", () => playChannel(ch._id, ch.displayName));
      scroll.appendChild(card);
    });
    row.appendChild(scroll);
    ondemandRows.appendChild(row);
  });
}

let hlsInstance = null;

async function playChannel(id, name) {
  playerOverlay.classList.remove("hidden");
  playerMsg.textContent = "";
  nowPlaying.textContent = name;
  playOverlayBtn.classList.add("hidden");
  loadingSpinner.classList.remove("hidden");
  try {
    const data = await api(`/channels/${id}/stream`);
    loadIntoPlayer(data.streamUrl);
  } catch (err) {
    loadingSpinner.classList.add("hidden");
    playerMsg.textContent = err.message;
  }
}

document.getElementById("closePlayer").addEventListener("click", () => {
  video.pause();
  video.removeAttribute("src");
  video.load();
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  playerOverlay.classList.add("hidden");
  playOverlayBtn.classList.add("hidden");
  loadingSpinner.classList.add("hidden");
});

playOverlayBtn.addEventListener("click", () => {
  playOverlayBtn.classList.add("hidden");
  video.play().catch((err) => {
    playerMsg.textContent = "Couldn't start playback: " + err.message;
  });
});

function loadIntoPlayer(url) {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }

  // No autoplay — mobile browsers block or half-block it (audio-only being
  // a common symptom). Instead we show a tap-to-play button once the
  // stream's actually ready, which works reliably everywhere.
  const showPlayButton = () => {
    loadingSpinner.classList.add("hidden");
    playOverlayBtn.classList.remove("hidden");
  };

  const showError = (msg) => {
    loadingSpinner.classList.add("hidden");
    playOverlayBtn.classList.add("hidden");
    playerMsg.textContent = msg;
  };

  if (Hls.isSupported()) {
    const hls = new Hls();
    hlsInstance = hls;
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, showPlayButton);
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        showError("This stream isn't playable right now (network or source issue).");
      }
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    // Safari's native HLS support
    video.src = url;
    video.addEventListener("loadedmetadata", showPlayButton, { once: true });
    video.addEventListener("error", () => showError("This stream isn't playable right now."), { once: true });
  } else {
    showError("This browser can't play HLS streams.");
  }
}

setSignedIn(!!token);
if (token) loadChannels();
