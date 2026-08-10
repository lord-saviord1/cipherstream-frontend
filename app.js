// Points at the deployed CipherStream backend on Vercel.
const API_BASE = "https://cipherstream-backend.vercel.app/api";

let token = localStorage.getItem("cs_token") || null;

const authStatus = document.getElementById("authStatus");
const authPanel = document.getElementById("authPanel");
const channelsPanel = document.getElementById("channelsPanel");
const playerPanel = document.getElementById("playerPanel");
const authMsg = document.getElementById("authMsg");
const channelList = document.getElementById("channelList");
const video = document.getElementById("video");
const nowPlaying = document.getElementById("nowPlaying");
const playerMsg = document.getElementById("playerMsg");

function setSignedIn(isSignedIn) {
  authStatus.textContent = isSignedIn ? "signed in" : "not signed in";
  authStatus.classList.toggle("on", isSignedIn);
  authPanel.classList.toggle("hidden", isSignedIn);
  channelsPanel.classList.toggle("hidden", !isSignedIn);
  playerPanel.classList.toggle("hidden", !isSignedIn);
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
    const data = await api("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    token = data.token;
    localStorage.setItem("cs_token", token);
    authMsg.textContent = "signed up.";
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
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    token = data.token;
    localStorage.setItem("cs_token", token);
    authMsg.textContent = "logged in.";
    setSignedIn(true);
    loadChannels();
  } catch (err) {
    authMsg.textContent = err.message;
  }
});

async function loadChannels() {
  channelList.innerHTML = "loading...";
  try {
    const data = await api("/channels");
    channelList.innerHTML = "";
    data.channels.forEach((ch) => {
      const row = document.createElement("div");
      row.className = "channel-row";
      row.innerHTML = `
        <div class="meta">
          <span class="name">${ch.displayName}</span>
          <span class="sub">${ch.category}</span>
        </div>
        <div>
          <span class="tier-tag ${ch.tier === "free" ? "free" : ""}">${ch.tier}</span>
          <button data-id="${ch._id}">Watch</button>
        </div>
      `;
      row.querySelector("button").addEventListener("click", () => playChannel(ch._id, ch.displayName));
      channelList.appendChild(row);
    });
  } catch (err) {
    channelList.textContent = err.message;
  }
}

async function playChannel(id, name) {
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
