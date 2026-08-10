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

function setSignedIn(isSignedIn) {
  authStatus.textContent = isSignedIn ? "signed in" : "not signed in";
  authStatus.classList.toggle("on", isSignedIn);
  authView.classList.toggle("hidden", isSignedIn);
  appView.classList.toggle("hidden", !isSignedIn);
}

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
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

async function playChannel(id, name) {
  playerOverlay.classList.remove("hidden");
  playerMsg.textContent = "fetching stream...";
  nowPlaying.textContent = name;
  try {
    const data = await api(`/channels/${id}/stream`);
    playerMsg.textContent = "";
    loadIntoPlayer(data.streamUrl);
  } catch (err) {
    playerMsg.textContent = err.message;
  }
}

document.getElementById("closePlayer").addEventListener("click", () => {
  video.pause();
  video.removeAttribute("src");
  video.load();
  playerOverlay.classList.add("hidden");
});

function loadIntoPlayer(url) {
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
  } else {
    playerMsg.textContent = "This browser can't play HLS streams.";
  }
}

setSignedIn(!!token);
if (token) loadChannels();
