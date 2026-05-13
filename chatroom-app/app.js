const ROOMS = [
  {
    id: "lobby",
    name: "大廳交流",
    topic: "自由聊天與新朋友報到",
    description: "適合輕鬆聊天、公告集合與快速互動，文字與圖片都可以直接分享。",
    modeTitle: "自由交流模式",
    modeCopy: "這裡是最開放的房間，適合打招呼、貼近況與分享生活照片。",
    placeholder: "和大家打聲招呼、分享近況或貼上今天的照片心得",
    uploadLabel: "上傳文字 / 圖片",
    uploadHint: "可附加圖片與文字檔，適合自由分享，建議單檔 15 MB 內。",
    accept: "image/*,.txt,.md,.json,.csv",
    rules: ["不限聊天主題", "可上傳圖片", "適合公告與快速互動"],
    reactionTitle: "大廳互動",
    reactions: ["👏", "🔥", "🎉", "❤️", "😂", "👋"],
    theme: "lobby",
    quickActionTitle: "大廳快捷",
    quickActions: [
      { label: "打招呼", template: "大家好，我是＿＿＿，很高興加入這個聊天室。" },
      { label: "活動通知", template: "活動提醒：\n時間：\n地點：\n重點：\n需要回覆者請留言。" },
      { label: "近況分享", template: "今天想和大家分享一件小事：" }
    ],
    requireText: false,
    allowedKinds: ["image", "text"]
  },
  {
    id: "ideas",
    name: "點子討論",
    topic: "產品、企劃與靈感交流",
    description: "用來收斂提案與視覺靈感，偏向有內容的討論，重點是文字提案與圖片輔助。",
    modeTitle: "提案討論模式",
    modeCopy: "建議用文字描述問題、解法與價值，也可以附圖片草圖。",
    placeholder: "建議格式：問題 / 想法 / 預期效果，例如：想新增簽到功能，讓活動報到更快",
    uploadLabel: "上傳提案圖片 / 文字",
    uploadHint: "此房間主打提案討論，允許圖片與文字檔。",
    accept: "image/*,.txt,.md,.json,.csv",
    rules: ["需有文字內容", "允許圖片草圖", "可附提案文字檔"],
    reactionTitle: "提案回饋",
    reactions: ["💡", "🚀", "📌", "✅", "🤔", "👏"],
    theme: "ideas",
    quickActionTitle: "提案模板",
    quickActions: [
      { label: "新功能提案", template: "問題：\n想法：\n預期效果：\n需要資源：" },
      { label: "流程優化", template: "目前卡點：\n調整建議：\n預估收益：" },
      { label: "命名投票", template: "提案名稱：\n候選方案 A：\n候選方案 B：\n請大家回覆偏好與原因。" }
    ],
    requireText: true,
    allowedKinds: ["image", "text"]
  },
  {
    id: "study",
    name: "學習共創",
    topic: "課程、筆記與提問互助",
    description: "專門給課程、筆記與作業交流使用，強調教材、重點整理與問答互助。",
    modeTitle: "學習筆記模式",
    modeCopy: "適合貼重點整理、問題紀錄與教材圖片，也能上傳講義文字檔。",
    placeholder: "輸入學習問題、重點摘要或作業討論內容，例如：今天的重點是 API 串接流程",
    uploadLabel: "上傳筆記 / 教材圖片",
    uploadHint: "此房間適合上傳文字檔與圖片教材，建議整理重點後再發送。",
    accept: "image/*,.txt,.md,.json,.csv",
    rules: ["適合提問與整理筆記", "允許教材圖片與文字檔", "建議避免閒聊"],
    reactionTitle: "學習回應",
    reactions: ["📚", "✍️", "💯", "🧠", "🙋", "✅"],
    theme: "study",
    quickActionTitle: "學習模板",
    quickActions: [
      { label: "我要提問", template: "問題：\n我目前理解：\n卡住的地方：" },
      { label: "重點筆記", template: "今日重點：\n1. \n2. \n3. \n延伸想法：" },
      { label: "作業討論", template: "作業題目：\n目前進度：\n需要協助：" }
    ],
    requireText: false,
    allowedKinds: ["image", "text"]
  }
];

const POLL_INTERVAL = 3000;
const PRESENCE_INTERVAL = 12000;
const TYPING_IDLE_MS = 2200;
const LAST_READ_KEY = "wave-room-last-read";

const state = {
  clientId: sessionStorage.getItem("wave-room-client-id") || crypto.randomUUID(),
  nickname: localStorage.getItem("wave-room-nickname") || "",
  activeRoomId: getRoomIdFromUrl(),
  messages: [],
  roomMessages: {},
  members: [],
  typers: [],
  pendingAttachments: [],
  isTyping: false,
  isSending: false,
  hasStarted: false,
  unreadCounts: {},
  lastReadAtByRoom: loadLastReadMap()
};

sessionStorage.setItem("wave-room-client-id", state.clientId);

const nameModal = document.querySelector("#name-modal");
const nameForm = document.querySelector("#name-form");
const nameInput = document.querySelector("#name-input");
const nameError = document.querySelector("#name-error");
const roomList = document.querySelector("#room-list");
const roomTemplate = document.querySelector("#room-template");
const roomCount = document.querySelector("#room-count");
const activeRoomName = document.querySelector("#active-room-name");
const activeRoomDescription = document.querySelector("#active-room-description");
const roomLinkLabel = document.querySelector("#room-link-label");
const copyRoomLinkButton = document.querySelector("#copy-room-link-button");
const roomModeTitle = document.querySelector("#room-mode-title");
const roomModeCopy = document.querySelector("#room-mode-copy");
const roomRuleList = document.querySelector("#room-rule-list");
const presenceCount = document.querySelector("#presence-count");
const memberCount = document.querySelector("#member-count");
const memberList = document.querySelector("#member-list");
const memberTemplate = document.querySelector("#member-template");
const messageList = document.querySelector("#message-list");
const quickActionTitle = document.querySelector("#quick-action-title");
const quickActionList = document.querySelector("#quick-action-list");
const messageTemplate = document.querySelector("#message-template");
const messageForm = document.querySelector("#message-form");
const composerLabel = document.querySelector("#composer-label");
const messageInput = document.querySelector("#message-input");
const typingIndicator = document.querySelector("#typing-indicator");
const emojiRow = document.querySelector("#emoji-row");
const reactionTitle = document.querySelector("#reaction-title");
const changeNicknameButton = document.querySelector("#change-nickname-button");
const attachmentInput = document.querySelector("#attachment-input");
const attachmentPreview = document.querySelector("#attachment-preview");
const uploadButtonLabel = document.querySelector("#upload-button-label");
const uploadHint = document.querySelector("#upload-hint");
const sendButton = document.querySelector(".send-button");

let typingTimeoutId = null;
let pollIntervalId = null;
let presenceIntervalId = null;

bootstrap().catch((error) => {
  typingIndicator.textContent = error.message || "聊天室載入失敗，請稍後再試。";
});

async function bootstrap() {
  renderRooms();
  renderAll();
  bindEvents();

  if (state.nickname) {
    await startSession();
    return;
  }

  openNameModal();
}

function bindEvents() {
  nameForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nickname = nameInput.value.trim();

    if (!nickname) {
      nameError.hidden = false;
      nameInput.focus();
      return;
    }

    state.nickname = nickname;
    localStorage.setItem("wave-room-nickname", nickname);
    closeNameModal();

    if (state.hasStarted) {
      await syncPresence();
      await refreshState();
    } else {
      await startSession();
    }
  });

  roomList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-room-id]");
    if (!button) {
      return;
    }

    state.activeRoomId = button.dataset.roomId;
    syncRoomUrl();
    await syncPresence();
    await refreshState();
    renderAll();
  });

  messageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.isSending) {
      return;
    }

    const body = messageInput.value.trim();
    const room = getRoomById(state.activeRoomId);
    if (!body && state.pendingAttachments.length === 0) {
      return;
    }

    if (room.requireText && !body) {
      typingIndicator.textContent = "此聊天室需先輸入文字說明，再附上提案圖片或檔案。";
      return;
    }

    state.isSending = true;
    updateSendButton();

    try {
      const formData = new FormData();
      formData.set("roomId", state.activeRoomId);
      formData.set("authorId", state.clientId);
      formData.set("authorName", state.nickname);
      formData.set("body", body);

      for (const file of state.pendingAttachments) {
        formData.append(`attachment_${file.name}`, file);
      }

      const response = await fetch("/api/messages", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "送出訊息失敗");
      }

      messageInput.value = "";
      clearPendingAttachments();
      autosizeComposer();
      setTyping(false);
      await refreshState();
    } catch (error) {
      typingIndicator.textContent = error.message || "訊息送出失敗";
    } finally {
      state.isSending = false;
      updateSendButton();
    }
  });

  messageInput.addEventListener("input", async () => {
    autosizeComposer();
    const nextTyping = Boolean(messageInput.value.trim());
    if (nextTyping !== state.isTyping) {
      await setTyping(nextTyping);
    } else if (nextTyping) {
      resetTypingTimeout();
    }
  });

  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      messageForm.requestSubmit();
    }
  });

  changeNicknameButton.addEventListener("click", async () => {
    openNameModal(state.nickname);
  });

  emojiRow.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-emoji]");
    if (!button || state.isSending) {
      return;
    }

    messageInput.value = button.dataset.emoji;
    messageForm.requestSubmit();
  });

  quickActionList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-quick-action]");
    if (!button) {
      return;
    }

    const room = getRoomById(state.activeRoomId);
    const action = room.quickActions.find((item) => item.label === button.dataset.quickAction);
    if (!action) {
      return;
    }

    applyQuickAction(action.template);
  });

  copyRoomLinkButton.addEventListener("click", async () => {
    const roomLink = getRoomLink(state.activeRoomId);

    try {
      await navigator.clipboard.writeText(roomLink);
      roomLinkLabel.textContent = "已複製聊天室連結";
      window.setTimeout(() => {
        roomLinkLabel.textContent = getRoomLink(state.activeRoomId);
      }, 1400);
    } catch {
      roomLinkLabel.textContent = roomLink;
    }
  });

  attachmentInput.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []).slice(0, 4);
    const room = getRoomById(state.activeRoomId);
    const nextFiles = files.filter((file) => room.allowedKinds.includes(mapFileKind(file)));

    if (nextFiles.length !== files.length) {
      typingIndicator.textContent = "目前聊天室不支援其中部分附件類型，已自動略過。";
    }

    state.pendingAttachments = nextFiles;
    renderAttachmentPreview();
  });

  window.addEventListener("popstate", async () => {
    state.activeRoomId = getRoomIdFromUrl();
    await syncPresence();
    await refreshState();
  });

  window.addEventListener("beforeunload", () => {
    if (!state.hasStarted) {
      return;
    }

    fetch(`/api/presence?clientId=${encodeURIComponent(state.clientId)}`, {
      method: "DELETE",
      keepalive: true
    }).catch(() => {});
  });
}

async function startSession() {
  if (state.hasStarted) {
    return;
  }

  state.hasStarted = true;
  await syncPresence();
  await refreshState();
  startBackgroundSync();
}

function startBackgroundSync() {
  pollIntervalId = window.setInterval(() => {
    refreshState().catch(() => {});
  }, POLL_INTERVAL);

  presenceIntervalId = window.setInterval(() => {
    syncPresence().catch(() => {});
  }, PRESENCE_INTERVAL);
}

async function refreshState() {
  const roomPayloads = await Promise.all(
    ROOMS.map(async (room) => {
      const url = new URL("/api/state", window.location.origin);
      url.searchParams.set("roomId", room.id);
      url.searchParams.set("clientId", state.clientId);

      const response = await fetch(url, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "讀取聊天室資料失敗");
      }

      return { roomId: room.id, payload };
    })
  );

  for (const { roomId, payload } of roomPayloads) {
    state.roomMessages[roomId] = payload.messages || [];
    if (roomId === state.activeRoomId) {
      state.messages = payload.messages || [];
      state.members = payload.members || [];
      state.typers = payload.typers || [];
    }
  }

  markActiveRoomAsRead();
  updateUnreadCounts();
  renderAll();
}

async function syncPresence() {
  await fetch("/api/presence", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      clientId: state.clientId,
      nickname: state.nickname,
      roomId: state.activeRoomId,
      typing: state.isTyping
    })
  });
}

async function setTyping(nextTyping) {
  state.isTyping = nextTyping;
  resetTypingTimeout();
  await syncPresence();
  await refreshState();
}

function resetTypingTimeout() {
  if (typingTimeoutId) {
    clearTimeout(typingTimeoutId);
    typingTimeoutId = null;
  }

  if (!state.isTyping) {
    return;
  }

  typingTimeoutId = window.setTimeout(() => {
    setTyping(false).catch(() => {});
  }, TYPING_IDLE_MS);
}

function renderAll() {
  const room = getRoomById(state.activeRoomId);
  document.body.dataset.room = room.theme;
  activeRoomName.textContent = room.name;
  activeRoomDescription.textContent = room.description;
  roomLinkLabel.textContent = getRoomLink(state.activeRoomId);
  roomModeTitle.textContent = room.modeTitle;
  roomModeCopy.textContent = room.modeCopy;
  composerLabel.textContent = room.requireText ? "輸入提案內容" : "輸入訊息";
  messageInput.placeholder = room.placeholder;
  uploadButtonLabel.textContent = room.uploadLabel;
  uploadHint.textContent = room.uploadHint;
  attachmentInput.accept = room.accept;
  reactionTitle.textContent = room.reactionTitle;
  quickActionTitle.textContent = room.quickActionTitle;
  renderRooms();
  renderRoomRules(room);
  renderReactions(room);
  renderQuickActions(room);
  renderMessages();
  renderMembers();
  renderTyping();
  updateSendButton();
}

function renderRooms() {
  roomList.innerHTML = "";
  roomCount.textContent = String(ROOMS.length);

  for (const room of ROOMS) {
    const fragment = roomTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".room-card");
    const unreadBadge = fragment.querySelector(".room-unread");
    button.dataset.roomId = room.id;
    button.dataset.roomTheme = room.theme;
    button.querySelector(".room-name").textContent = room.name;
    button.querySelector(".room-topic").textContent = room.topic;

    const unreadCount = state.unreadCounts[room.id] || 0;
    unreadBadge.hidden = unreadCount === 0;
    unreadBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);

    if (room.id === state.activeRoomId) {
      button.classList.add("is-active");
    } else if (unreadCount > 0) {
      button.classList.add("has-unread");
    }

    roomList.append(fragment);
  }
}

function renderMessages() {
  messageList.innerHTML = "";

  for (const message of state.messages) {
    const fragment = messageTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".message-card");
    const author = fragment.querySelector(".message-author");
    const time = fragment.querySelector(".message-time");
    const body = fragment.querySelector(".message-body");
    const attachments = fragment.querySelector(".message-attachments");

    author.textContent = message.authorName;
    time.textContent = formatTime(message.createdAt);
    body.textContent = message.body || "";
    body.hidden = !message.body;
    renderAttachments(attachments, message.attachments || []);

    if (message.authorId === state.clientId) {
      card.classList.add("is-self");
    }

    if (message.type === "system") {
      card.classList.add("is-system");
    }

    messageList.append(fragment);
  }

  messageList.scrollTop = messageList.scrollHeight;
}

function renderMembers() {
  memberList.innerHTML = "";
  memberCount.textContent = String(state.members.length);
  presenceCount.textContent = `${state.members.length} 人在線`;

  for (const member of state.members) {
    const fragment = memberTemplate.content.cloneNode(true);
    fragment.querySelector(".member-avatar").textContent = member.nickname.slice(0, 1).toUpperCase();
    fragment.querySelector(".member-name").textContent = member.nickname;
    memberList.append(fragment);
  }
}

function renderTyping() {
  const names = state.typers.map((item) => item.nickname);
  typingIndicator.textContent = names.length ? `${names.join("、")} 正在輸入中...` : "目前沒有人正在輸入";
}

function renderRoomRules(room) {
  roomRuleList.innerHTML = "";

  for (const rule of room.rules) {
    const chip = document.createElement("span");
    chip.className = "room-rule-chip";
    chip.textContent = rule;
    roomRuleList.append(chip);
  }
}

function renderReactions(room) {
  emojiRow.innerHTML = "";

  for (const emoji of room.reactions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-button";
    button.dataset.emoji = emoji;
    button.textContent = emoji;
    emojiRow.append(button);
  }
}

function renderQuickActions(room) {
  quickActionList.innerHTML = "";

  for (const action of room.quickActions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-action-button";
    button.dataset.quickAction = action.label;
    button.textContent = action.label;
    quickActionList.append(button);
  }
}

function applyQuickAction(template) {
  const current = messageInput.value.trim();
  messageInput.value = current ? `${current}\n\n${template}` : template;
  autosizeComposer();
  messageInput.focus();
  messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
}

function renderAttachmentPreview() {
  attachmentPreview.innerHTML = "";
  attachmentPreview.hidden = state.pendingAttachments.length === 0;

  for (const file of state.pendingAttachments) {
    const item = document.createElement("article");
    item.className = "attachment-item";

    const title = document.createElement("strong");
    title.textContent = file.name;
    item.append(title);

    const meta = document.createElement("p");
    meta.className = "attachment-meta";
    meta.textContent = `${getAttachmentKind(file)} / ${formatBytes(file.size)}`;
    item.append(meta);

    appendLocalPreview(item, file);
    attachmentPreview.append(item);
  }
}

function renderAttachments(container, attachments) {
  container.innerHTML = "";
  if (!attachments.length) {
    return;
  }

  for (const attachment of attachments) {
    const wrap = document.createElement("div");
    wrap.className = "message-attachment";
    appendRemoteAttachment(wrap, attachment);
    container.append(wrap);
  }
}

function appendLocalPreview(container, file) {
  const kind = getAttachmentKind(file).toLowerCase();
  if (kind === "image") {
    const img = document.createElement("img");
    img.className = "attachment-image";
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    container.append(img);
    return;
  }

  const text = document.createElement("p");
  text.className = "attachment-text";
  text.textContent = "文字檔將以附件形式送出。";
  container.append(text);
}

function appendRemoteAttachment(container, attachment) {
  if (attachment.kind === "image") {
    const img = document.createElement("img");
    img.className = "attachment-image";
    img.alt = attachment.name;
    img.src = attachment.url;
    container.append(img);
    return;
  }

  if (attachment.previewText) {
    const pre = document.createElement("pre");
    pre.className = "attachment-text-block";
    pre.textContent = attachment.previewText;
    container.append(pre);
  }

  const link = document.createElement("a");
  link.href = attachment.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.className = "attachment-download";
  link.textContent = `下載 ${attachment.name}`;
  container.append(link);
}

function clearPendingAttachments() {
  state.pendingAttachments = [];
  attachmentInput.value = "";
  renderAttachmentPreview();
}

function autosizeComposer() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 160)}px`;
}

function updateSendButton() {
  sendButton.disabled = state.isSending;
  sendButton.textContent = state.isSending ? "送出中..." : "送出";
}

function loadLastReadMap() {
  try {
    const raw = localStorage.getItem(LAST_READ_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLastReadMap() {
  localStorage.setItem(LAST_READ_KEY, JSON.stringify(state.lastReadAtByRoom));
}

function markActiveRoomAsRead() {
  const activeMessages = state.roomMessages[state.activeRoomId] || [];
  const lastIncoming = [...activeMessages]
    .reverse()
    .find((message) => message.authorId !== state.clientId && message.type !== "system");

  if (!lastIncoming) {
    state.unreadCounts[state.activeRoomId] = 0;
    return;
  }

  state.lastReadAtByRoom[state.activeRoomId] = lastIncoming.createdAt;
  state.unreadCounts[state.activeRoomId] = 0;
  saveLastReadMap();
}

function updateUnreadCounts() {
  const nextCounts = {};

  for (const room of ROOMS) {
    if (room.id === state.activeRoomId) {
      nextCounts[room.id] = 0;
      continue;
    }

    const lastReadAt = state.lastReadAtByRoom[room.id] ? new Date(state.lastReadAtByRoom[room.id]).getTime() : 0;
    const messages = state.roomMessages[room.id] || [];
    nextCounts[room.id] = messages.filter((message) => {
      if (message.authorId === state.clientId || message.type === "system") {
        return false;
      }

      return new Date(message.createdAt).getTime() > lastReadAt;
    }).length;
  }

  state.unreadCounts = nextCounts;
}

function openNameModal(defaultValue = "") {
  nameModal.hidden = false;
  nameInput.value = defaultValue;
  nameError.hidden = true;
  window.setTimeout(() => {
    nameInput.focus();
    nameInput.select();
  }, 30);
}

function closeNameModal() {
  nameModal.hidden = true;
  nameError.hidden = true;
}

function getRoomById(roomId) {
  return ROOMS.find((room) => room.id === roomId) || ROOMS[0];
}

function getRoomIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room");
  return ROOMS.some((room) => room.id === roomId) ? roomId : ROOMS[0].id;
}

function syncRoomUrl() {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("room", state.activeRoomId);
  window.history.pushState({}, "", nextUrl);
}

function getRoomLink(roomId) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  return url.toString();
}

function getAttachmentKind(file) {
  if (file.type.startsWith("image/")) {
    return "IMAGE";
  }

  return "TEXT";
}

function mapFileKind(file) {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  return "text";
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatBytes(size) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
