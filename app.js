const defaults = {
  name: "梦角",
  quotes: [
    "我刚刚看见这个，忽然想到你。",
    "嗯，我在。你慢慢说。",
    "这句话我想留到晚上再认真回你。",
    "今天有一点忙，但不是不想回。",
    "你发来的字我有读到。",
    "如果我沉默一会儿，不代表我离开。",
    "我想听你继续讲。",
    "刚才在路上，风很轻。",
    "这张字卡我会收好。",
    "我可能会晚点回，但我会回来。",
    "你不要急，我在想怎么说。",
    "有些话我读了两遍。",
    "我现在只想给你一个很短的回应：我在。",
    "这件事我没有立刻的答案，但我愿意陪你想。",
    "我喜欢你这样写给我。"
  ].join("\n"),
  readChance: 62,
  instantReadChance: 18,
  replyChance: 72,
  activeChance: 2,
  delayPace: 1,
  typing: true,
  avatarData: "",
  myAvatarData: "",
  wallpaperData: "",
  extraData: {}
};

const storeKey = "local-card-chat-v3";
const legacyKeys = ["local-card-chat-v2", "local-card-chat-v1"];
const statuses = ["在DR", "在身边", "在忙", "在线", "在睡觉"];
const statusWeights = [
  { status: "在线", weight: 34 },
  { status: "在身边", weight: 24 },
  { status: "在忙", weight: 20 },
  { status: "在DR", weight: 12 },
  { status: "在睡觉", weight: 10 }
];

const state = {
  settings: { ...defaults },
  messages: [],
  contactStatus: "在线",
  lastActiveSentAt: 0,
  typingId: "",
  activeTimer: 0,
  statusTimer: 0,
  midnightTimer: 0,
  pendingTimers: []
};

const el = {
  messages: document.getElementById("messages"),
  composer: document.getElementById("composer"),
  messageInput: document.getElementById("messageInput"),
  contactName: document.getElementById("contactName"),
  contactStatus: document.getElementById("contactStatus"),
  avatar: document.getElementById("avatar"),
  activeSendBtn: document.getElementById("activeSendBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  resetBtn: document.getElementById("resetBtn"),
  nameInput: document.getElementById("nameInput"),
  quotesInput: document.getElementById("quotesInput"),
  readChance: document.getElementById("readChance"),
  instantReadChance: document.getElementById("instantReadChance"),
  replyChance: document.getElementById("replyChance"),
  activeChance: document.getElementById("activeChance"),
  delayPace: document.getElementById("delayPace"),
  typingSwitch: document.getElementById("typingSwitch"),
  readChanceValue: document.getElementById("readChanceValue"),
  instantReadChanceValue: document.getElementById("instantReadChanceValue"),
  replyChanceValue: document.getElementById("replyChanceValue"),
  activeChanceValue: document.getElementById("activeChanceValue"),
  delayPaceValue: document.getElementById("delayPaceValue")
};

window.addEventListener("load", initChatSystem);

function initChatSystem() {
  loadLocalData();
  bindChatEvents();
  bindSettings();
  syncSettingsUI();
  updateIdentity();
  updateContactStatus(state.contactStatus || pickStatus());
  renderMessages();
  resumeUnreadChecks();
  startStatusLoop();
  scheduleMidnightRefresh();
  scheduleActiveMessageCheck({ initial: true });
}

function bindChatEvents() {
  el.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    sendUserMessage();
  });

  el.messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendUserMessage();
    }
  });

  el.activeSendBtn.addEventListener("click", () => contactSendBatch({ forced: true }));
  el.settingsBtn.addEventListener("click", () => document.body.classList.add("settings-open"));
  el.closeSettingsBtn.addEventListener("click", () => document.body.classList.remove("settings-open"));
  el.resetBtn.addEventListener("click", resetSettings);
}

function bindSettings() {
  [
    el.nameInput,
    el.quotesInput,
    el.readChance,
    el.instantReadChance,
    el.replyChance,
    el.activeChance,
    el.delayPace,
    el.typingSwitch
  ].forEach((control) => {
    control.addEventListener("input", () => {
      state.settings = {
        ...state.settings,
        name: el.nameInput.value.trim() || defaults.name,
        quotes: el.quotesInput.value,
        readChance: Number(el.readChance.value),
        instantReadChance: Number(el.instantReadChance.value),
        replyChance: Number(el.replyChance.value),
        activeChance: Number(el.activeChance.value),
        delayPace: Number(el.delayPace.value),
        typing: el.typingSwitch.checked
      };
      saveLocalData();
      updateLabels();
      updateIdentity();
      scheduleActiveMessageCheck();
    });
  });
}

function syncSettingsUI() {
  el.nameInput.value = state.settings.name;
  el.quotesInput.value = state.settings.quotes;
  el.readChance.value = state.settings.readChance;
  el.instantReadChance.value = state.settings.instantReadChance;
  el.replyChance.value = state.settings.replyChance;
  el.activeChance.value = state.settings.activeChance;
  el.delayPace.value = state.settings.delayPace;
  el.typingSwitch.checked = state.settings.typing;
  updateLabels();
}

function updateLabels() {
  const activeLabels = ["关", "低", "中", "高", "很高"];
  const paceLabels = ["快一点", "自然", "慢一点"];
  el.readChanceValue.textContent = `${state.settings.readChance}%`;
  el.instantReadChanceValue.textContent = `${state.settings.instantReadChance}%`;
  el.replyChanceValue.textContent = `${state.settings.replyChance}%`;
  el.activeChanceValue.textContent = activeLabels[state.settings.activeChance] || "中";
  el.delayPaceValue.textContent = paceLabels[state.settings.delayPace] || "自然";
}

function updateIdentity() {
  const name = state.settings.name || defaults.name;
  el.contactName.textContent = name;
  el.avatar.textContent = state.settings.avatarData ? "" : name.trim().slice(0, 1) || "字";
  el.avatar.style.backgroundImage = state.settings.avatarData ? `url("${state.settings.avatarData}")` : "";
  document.body.style.backgroundImage = state.settings.wallpaperData
    ? `url("${state.settings.wallpaperData}")`
    : "";
}

function sendUserMessage() {
  const text = el.messageInput.value.trim();
  if (!text) return;

  const message = addMessage("out", text, "未读");
  el.messageInput.value = "";
  maybeReadAndReply(message);
}

function maybeReadAndReply(message) {
  if (message.sender !== "out" || message.status === "已读") return;
  if (!chance(state.settings.readChance)) return;

  const instant = chance(state.settings.instantReadChance);
  const readDelay = instant ? randomBetween(300, 1800) : randomBetween(12000, 110000);

  queueTimer(() => {
    if (!state.messages.some((item) => item.id === message.id && item.status === "未读")) return;
    message.status = "已读";
    message.readAt = new Date().toISOString();
    saveLocalData();
    renderMessages();

    if (canContactReplyNow() && chance(state.settings.replyChance)) {
      const replyDelay = instant ? randomBetween(900, 9000) : randomBetween(...getReplyDelayRange());
      scheduleContactBatch(replyDelay);
    } else {
      scheduleActiveMessageCheck();
    }
  }, readDelay);
}

function scheduleContactBatch(delay) {
  if (state.settings.typing) {
    queueTimer(showTyping, Math.max(500, delay - randomBetween(1800, 9000)));
  }

  queueTimer(() => {
    hideTyping();
    contactSendBatch();
  }, delay);
}

function contactSendBatch(options = {}) {
  if (!options.forced && !canContactReplyNow()) {
    scheduleActiveMessageCheck();
    return;
  }

  const total = options.forced ? randomBetween(1, 3) : pickActiveMessageCount();
  const sendNext = (index) => {
    addMessage("in", pickQuote(), "已读");
    if (!options.forced) {
      state.lastActiveSentAt = Date.now();
      saveLocalData();
    }

    if (index + 1 < total && chance(78)) {
      const gap = randomBetween(3200, 22000);
      if (state.settings.typing && gap > 4200) {
        queueTimer(showTyping, Math.max(700, gap - randomBetween(1200, 3200)));
      }
      queueTimer(() => {
        hideTyping();
        sendNext(index + 1);
      }, gap);
      return;
    }

    hideTyping();
    scheduleActiveMessageCheck();
  };

  updateContactStatus(options.forced ? "在线" : state.contactStatus);
  sendNext(0);
}

function scheduleActiveMessageCheck(options = {}) {
  clearTimeout(state.activeTimer);
  if (!state.settings.activeChance) return;

  const checkDelay = options.initial
    ? randomBetween(18000, 70000)
    : randomBetween(...getActiveCheckRange());

  state.activeTimer = setTimeout(() => {
    updateContactStatus(pickStatus());
    const activeOdds = getNaturalActiveOdds();

    if (canContactReplyNow() && chance(activeOdds)) {
      const sendDelay = randomBetween(...getActiveSendDelayRange());
      if (state.settings.typing) {
        queueTimer(showTyping, Math.max(900, sendDelay - randomBetween(1800, 8500)));
      }
      queueTimer(() => {
        hideTyping();
        contactSendBatch();
      }, sendDelay);
      return;
    }

    scheduleActiveMessageCheck();
  }, checkDelay);
}

function resumeUnreadChecks() {
  const recentUnread = state.messages.filter((message) => {
    if (message.sender !== "out" || message.status !== "未读") return false;
    const age = Date.now() - parseDate(message.createdAt).getTime();
    return age < 12 * 60 * 60 * 1000;
  });

  recentUnread.slice(-4).forEach((message) => {
    if (chance(45)) maybeReadAndReply(message);
  });
}

function startStatusLoop() {
  clearTimeout(state.statusTimer);
  const loop = () => {
    state.statusTimer = setTimeout(() => {
      if (!state.typingId) updateContactStatus(pickStatus());
      loop();
    }, randomBetween(90000, 260000));
  };
  loop();
}

function scheduleMidnightRefresh() {
  clearTimeout(state.midnightTimer);
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 1, 0);
  state.midnightTimer = setTimeout(() => {
    renderMessages();
    scheduleMidnightRefresh();
  }, next.getTime() - now.getTime());
}

function updateContactStatus(status) {
  state.contactStatus = statuses.includes(status) ? status : "在线";
  if (!state.typingId) el.contactStatus.textContent = state.contactStatus;
  saveLocalData();
}

function canContactReplyNow() {
  return true;
}

function showTyping() {
  if (state.typingId) return;
  state.typingId = `typing-${Date.now()}`;
  el.contactStatus.textContent = "正在输入...";

  const row = document.createElement("div");
  row.className = "message-row in";
  row.dataset.typing = state.typingId;
  row.appendChild(createMessageAvatar("in"));
  row.insertAdjacentHTML("beforeend", '<div class="typing" aria-label="正在输入"><i></i><i></i><i></i></div>');
  el.messages.appendChild(row);
  scrollToBottom();
}

function hideTyping() {
  if (!state.typingId) return;
  const node = el.messages.querySelector(`[data-typing="${state.typingId}"]`);
  if (node) node.remove();
  state.typingId = "";
  el.contactStatus.textContent = state.contactStatus;
}

function addMessage(sender, text, status) {
  const now = new Date();
  const message = {
    id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
    sender,
    text,
    status,
    createdAt: now.toISOString(),
    readAt: status === "已读" ? now.toISOString() : ""
  };
  state.messages.push(message);
  saveLocalData();
  renderMessages();
  return message;
}

function renderMessages() {
  const typingWasVisible = Boolean(state.typingId);
  hideTyping();
  el.messages.innerHTML = "";

  if (!state.messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "还没有聊天记录";
    el.messages.appendChild(empty);
  }

  let currentDay = "";
  state.messages.forEach((message) => {
    const date = parseDate(message.createdAt);
    const dayLabel = formatDay(date);
    if (dayLabel !== currentDay) {
      currentDay = dayLabel;
      const chip = document.createElement("div");
      chip.className = "day-chip";
      chip.textContent = dayLabel;
      el.messages.appendChild(chip);
    }

    const row = document.createElement("div");
    row.className = `message-row ${message.sender === "out" ? "out" : "in"}`;

    row.appendChild(createMessageAvatar(message.sender));

    const wrap = document.createElement("div");
    wrap.className = "bubble-wrap";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = message.text;

    const meta = document.createElement("div");
    meta.className = "meta";

    const time = document.createElement("span");
    time.textContent = formatTimeWithSeconds(date);
    meta.appendChild(time);

    if (message.sender === "out") {
      const read = document.createElement("span");
      read.className = `read-state ${message.status === "已读" ? "is-read" : ""}`;
      read.textContent = message.status;
      meta.appendChild(read);
    }

    wrap.appendChild(bubble);
    wrap.appendChild(meta);
    row.appendChild(wrap);
    el.messages.appendChild(row);
  });

  if (typingWasVisible) {
    state.typingId = "";
    showTyping();
  }
  scrollToBottom();
}

function pickQuote() {
  const quotes = state.settings.quotes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const source = quotes.length ? quotes : defaults.quotes.split(/\r?\n/);
  return source[Math.floor(Math.random() * source.length)];
}

function pickStatus() {
  const total = statusWeights.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of statusWeights) {
    roll -= item.weight;
    if (roll <= 0) return item.status;
  }
  return "在线";
}

function createMessageAvatar(sender) {
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";

  if (sender === "out") {
    avatar.textContent = state.settings.myAvatarData ? "" : "我";
    if (state.settings.myAvatarData) {
      avatar.style.backgroundImage = `url("${state.settings.myAvatarData}")`;
    }
    return avatar;
  }

  const name = state.settings.name || defaults.name;
  avatar.textContent = state.settings.avatarData ? "" : name.trim().slice(0, 1) || "字";
  if (state.settings.avatarData) {
    avatar.style.backgroundImage = `url("${state.settings.avatarData}")`;
  }
  return avatar;
}

function getReplyDelayRange() {
  const ranges = [
    [7000, 30000],
    [18000, 105000],
    [50000, 240000]
  ];
  return ranges[state.settings.delayPace] || ranges[1];
}

function getActiveCheckRange() {
  const ranges = [
    [0, 0],
    [240000, 900000],
    [150000, 660000],
    [105000, 480000],
    [75000, 360000]
  ];
  return ranges[state.settings.activeChance] || ranges[2];
}

function getActiveSendDelayRange() {
  const ranges = [
    [0, 0],
    [22000, 110000],
    [16000, 85000],
    [11000, 62000],
    [7000, 42000]
  ];
  return ranges[state.settings.activeChance] || ranges[2];
}

function getNaturalActiveOdds() {
  const base = [0, 10, 20, 32, 44][state.settings.activeChance] || 20;
  const lastMessage = state.messages[state.messages.length - 1];
  const lastMessageAge = lastMessage ? Date.now() - parseDate(lastMessage.createdAt).getTime() : Infinity;
  const activeCooldown = Date.now() - state.lastActiveSentAt;
  let odds = base;

  if (activeCooldown < 8 * 60 * 1000) return 0;
  if (lastMessage?.sender === "in" && lastMessageAge < 14 * 60 * 1000) odds -= 18;
  if (lastMessage?.sender === "out" && lastMessageAge < 4 * 60 * 1000) odds += 10;
  if (lastMessageAge > 45 * 60 * 1000) odds += 8;
  const hour = new Date().getHours();
  if (hour >= 1 && hour < 7) odds -= 26;
  if (hour >= 22 || hour < 1) odds -= 6;
  if (hour >= 12 && hour <= 23) odds += 4;

  return Math.max(0, Math.min(70, odds));
}

function pickActiveMessageCount() {
  const roll = Math.random();
  if (roll < 0.58) return 1;
  if (roll < 0.9) return 2;
  return 3;
}

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function chance(percent) {
  return Math.random() * 100 < percent;
}

function queueTimer(fn, delay) {
  const timer = setTimeout(() => {
    state.pendingTimers = state.pendingTimers.filter((item) => item !== timer);
    fn();
  }, delay);
  state.pendingTimers.push(timer);
  return timer;
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDay(date) {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatTimeWithSeconds(date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function loadLocalData() {
  const saved = readStoredData(storeKey) || readFirstLegacyData();
  const savedSettings = saved?.settings || saved || {};
  state.settings = containsMojibake(savedSettings.name) || containsMojibake(savedSettings.quotes)
    ? { ...defaults }
    : { ...defaults, ...savedSettings };
  state.messages = normalizeMessages(saved?.messages || []).filter((message) => !containsMojibake(message.text));
  state.contactStatus = statuses.includes(saved?.contactStatus) ? saved.contactStatus : pickStatus();
  state.lastActiveSentAt = Number(saved?.lastActiveSentAt) || 0;
  saveLocalData();
}

function readFirstLegacyData() {
  for (const key of legacyKeys) {
    const data = readStoredData(key);
    if (data) return data;
  }
  return null;
}

function readStoredData(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && typeof message.text === "string")
    .map((message) => {
      const createdAt = message.createdAt || message.time || new Date().toISOString();
      return {
        id: message.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sender: message.sender === "out" ? "out" : "in",
        text: message.text,
        status: message.status === "未读" ? "未读" : "已读",
        createdAt: parseDate(createdAt).toISOString(),
        readAt: message.readAt || ""
      };
    });
}

function containsMojibake(value) {
  if (typeof value !== "string") return false;
  return /[ÂÃ]|æ|ç|è|ä|å|œ|±|¼|½|¾|¯|œ|||/.test(value);
}

function saveLocalData() {
  localStorage.setItem(storeKey, JSON.stringify({
    settings: state.settings,
    messages: state.messages,
    contactStatus: state.contactStatus,
    lastActiveSentAt: state.lastActiveSentAt,
    savedAt: new Date().toISOString()
  }));
}

function resetSettings() {
  state.settings = { ...defaults };
  saveLocalData();
  syncSettingsUI();
  updateIdentity();
  scheduleActiveMessageCheck();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    el.messages.scrollTop = el.messages.scrollHeight;
  });
}
