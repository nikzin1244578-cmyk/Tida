// TIDA AI - Complete JavaScript Application (FIXED)
// Configuration
const CONFIG = {
  OPENROUTER_API_KEY:
    "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",
  MODEL: "google/gemini-2.0-flash-exp:free", // Using a more reliable free model
  API_URL: "https://openrouter.ai/api/v1/chat/completions",
  SITE_URL: window.location.origin || "https://tida-ai.com",
  SITE_NAME: "TIDA AI Chat",
};

// State Management
const state = {
  currentUser: null,
  currentChatId: null,
  chats: [],
  messages: [],
};

// DOM Elements
const elements = {
  loginModal: document.getElementById("loginModal"),
  sidebar: document.getElementById("sidebar"),
  overlay: document.getElementById("overlay"),
  mobileMenuBtn: document.getElementById("mobileMenuBtn"),
  userAvatar: document.getElementById("userAvatar"),
  userName: document.getElementById("userName"),
  userEmail: document.getElementById("userEmail"),
  userStatus: document.getElementById("userStatus"),
  logoutBtn: document.getElementById("logoutBtn"),
  newChatBtn: document.getElementById("newChatBtn"),
  deleteAllBtn: document.getElementById("deleteAllBtn"),
  chatHistory: document.getElementById("chatHistory"),
  chatCount: document.getElementById("chatCount"),
  chatBox: document.getElementById("chatBox"),
  welcomeMessage: document.getElementById("welcomeMessage"),
  userInput: document.getElementById("userInput"),
  sendBtn: document.getElementById("sendBtn"),
  clearBtn: document.getElementById("clearBtn"),
  voiceBtn: document.getElementById("voiceBtn"),
};

// Initialize Application
function init() {
  loadFromLocalStorage();
  setupEventListeners();
  checkLoginStatus();
}

// Event Listeners
function setupEventListeners() {
  elements.mobileMenuBtn.addEventListener("click", toggleSidebar);
  elements.overlay.addEventListener("click", closeSidebar);
  elements.newChatBtn.addEventListener("click", createNewChat);
  elements.deleteAllBtn.addEventListener("click", deleteAllChats);
  elements.logoutBtn.addEventListener("click", logout);
  elements.sendBtn.addEventListener("click", sendMessage);
  elements.clearBtn.addEventListener("click", clearInput);
  elements.voiceBtn.addEventListener("click", startVoiceInput);
  elements.userInput.addEventListener("input", autoResizeTextarea);
  elements.userInput.addEventListener("keydown", handleKeyDown);
}

// Authentication
function checkLoginStatus() {
  const user = localStorage.getItem("tidaUser");
  if (user) {
    state.currentUser = JSON.parse(user);
    showMainInterface();
  } else {
    elements.loginModal.classList.add("show");
  }
}

function handleGoogleSignIn(response) {
  const payload = parseJwt(response.credential);
  state.currentUser = {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    picture: payload.picture,
    provider: "google",
  };
  localStorage.setItem("tidaUser", JSON.stringify(state.currentUser));
  showMainInterface();
}

function devLogin() {
  state.currentUser = {
    id: "dev_" + Date.now(),
    name: "Guest User",
    email: "guest@tida.ai",
    picture: null,
    provider: "guest",
  };
  localStorage.setItem("tidaUser", JSON.stringify(state.currentUser));
  showMainInterface();
}

function logout() {
  if (
    confirm(
      "Are you sure you want to logout? Your chats will be saved locally."
    )
  ) {
    localStorage.removeItem("tidaUser");
    state.currentUser = null;
    elements.loginModal.classList.add("show");
    updateUserProfile();
  }
}

function showMainInterface() {
  elements.loginModal.classList.remove("show");
  updateUserProfile();
  if (state.chats.length === 0) {
    createNewChat();
  } else {
    loadChat(state.chats[0].id);
  }
  renderChatHistory();
}

function updateUserProfile() {
  if (state.currentUser) {
    elements.userName.textContent = state.currentUser.name;
    elements.userEmail.textContent = state.currentUser.email;
    elements.userStatus.classList.add("online");
    elements.logoutBtn.classList.remove("hidden");
    if (state.currentUser.picture) {
      elements.userAvatar.innerHTML = `
        <img src="${state.currentUser.picture}" alt="User Avatar">
        <div class="user-status online"></div>
      `;
    }
  } else {
    elements.userName.textContent = "Guest User";
    elements.userEmail.textContent = "Sign in to save";
    elements.userStatus.classList.remove("online");
    elements.logoutBtn.classList.add("hidden");
  }
}

// Chat Management
function createNewChat() {
  const chatId = "chat_" + Date.now();
  const newChat = {
    id: chatId,
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.chats.unshift(newChat);
  state.currentChatId = chatId;
  state.messages = [];
  saveToLocalStorage();
  renderChatHistory();
  clearChatBox();
  elements.userInput.focus();
}

function loadChat(chatId) {
  const chat = state.chats.find((c) => c.id === chatId);
  if (!chat) return;
  state.currentChatId = chatId;
  state.messages = chat.messages || [];
  renderMessages();
  updateActiveChatItem();
  closeSidebar();
}

function deleteChat(chatId) {
  if (!confirm("Delete this chat?")) return;
  state.chats = state.chats.filter((c) => c.id !== chatId);
  if (state.currentChatId === chatId) {
    if (state.chats.length > 0) {
      loadChat(state.chats[0].id);
    } else {
      createNewChat();
    }
  }
  saveToLocalStorage();
  renderChatHistory();
}

function deleteAllChats() {
  if (!confirm("Delete all chats? This cannot be undone.")) return;
  state.chats = [];
  state.messages = [];
  state.currentChatId = null;
  saveToLocalStorage();
  renderChatHistory();
  createNewChat();
}

function updateChatTitle(chatId, firstMessage) {
  const chat = state.chats.find((c) => c.id === chatId);
  if (chat && chat.messages.length === 1) {
    chat.title =
      firstMessage.substring(0, 50) + (firstMessage.length > 50 ? "..." : "");
    chat.updatedAt = Date.now();
    saveToLocalStorage();
    renderChatHistory();
  }
}

// Message Handling
async function sendMessage() {
  const message = elements.userInput.value.trim();
  if (!message) return;

  // Disable send button to prevent multiple clicks
  elements.sendBtn.disabled = true;
  elements.sendBtn.style.opacity = "0.5";

  addMessage("user", message);
  elements.userInput.value = "";
  autoResizeTextarea();
  showTypingIndicator();

  try {
    const response = await callOpenRouterAPI(state.messages);
    hideTypingIndicator();

    if (response && response.content) {
      addMessage("assistant", response.content);
    } else {
      addMessage(
        "assistant",
        "Sorry, I received an empty response. Please try again."
      );
    }
  } catch (error) {
    hideTypingIndicator();
    console.error("API Error:", error);

    let errorMessage = "Sorry, I encountered an error. ";

    if (error.message.includes("Invalid API key")) {
      errorMessage +=
        "The API key is invalid. Please check your configuration.";
    } else if (error.message.includes("Rate limit")) {
      errorMessage +=
        "⏰ Too many requests! Please wait 10-15 seconds before trying again. Free models have strict rate limits.";
    } else if (error.message.includes("Insufficient credits")) {
      errorMessage +=
        "Insufficient API credits. Please add credits to your OpenRouter account.";
    } else if (error.message.includes("Cannot connect")) {
      errorMessage += error.message;
    } else {
      errorMessage += error.message || "Please try again.";
    }

    addMessage("assistant", errorMessage);
  } finally {
    // Re-enable send button after 2 seconds
    setTimeout(() => {
      elements.sendBtn.disabled = false;
      elements.sendBtn.style.opacity = "1";
    }, 2000);
  }
}

function addMessage(role, content, reasoningDetails = null) {
  const message = { role, content, timestamp: Date.now() };
  if (reasoningDetails) {
    message.reasoning_details = reasoningDetails;
  }
  state.messages.push(message);

  const chat = state.chats.find((c) => c.id === state.currentChatId);
  if (chat) {
    chat.messages = state.messages;
    chat.updatedAt = Date.now();
    if (role === "user" && chat.messages.length === 1) {
      updateChatTitle(chat.id, content);
    }
  }

  saveToLocalStorage();
  renderMessage(message);
  scrollToBottom();
}

// API Integration (FIXED with rate limit handling)
async function callOpenRouterAPI(messages) {
  // Convert messages to API format (only role and content)
  const apiMessages = messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const requestBody = {
    model: CONFIG.MODEL,
    messages: apiMessages,
    temperature: 0.7,
    max_tokens: 2000,
  };

  console.log("=== SENDING REQUEST ===");
  console.log("Model:", CONFIG.MODEL);
  console.log("Messages count:", apiMessages.length);

  try {
    const response = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": CONFIG.SITE_URL,
        "X-Title": CONFIG.SITE_NAME,
      },
      body: JSON.stringify(requestBody),
    });

    console.log("Response Status:", response.status);

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;

      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: { message: errorText } };
      }

      console.error("API Error:", errorData);

      // Specific error handling with rate limit info
      if (response.status === 401) {
        throw new Error("Invalid API key");
      } else if (response.status === 403) {
        throw new Error("Access denied - Check API key permissions");
      } else if (response.status === 429) {
        // Rate limit - provide helpful message
        const retryAfter = response.headers.get("retry-after");
        const waitTime = retryAfter ? `${retryAfter} seconds` : "10-15 seconds";
        throw new Error(
          `Rate limited - Please wait ${waitTime} before trying again. Free models have strict limits (usually 10 requests per minute).`
        );
      } else if (response.status === 402) {
        throw new Error("Insufficient credits");
      } else if (response.status === 400) {
        throw new Error(errorData.error?.message || "Bad request");
      } else if (response.status === 404) {
        throw new Error("Model not found - Try a different model");
      } else if (response.status >= 500) {
        throw new Error("Server error - Try again later");
      } else {
        throw new Error(
          errorData.error?.message || `Error: ${response.status}`
        );
      }
    }

    const data = await response.json();
    console.log("✅ Success! Got response");

    // Validate response structure
    if (!data?.choices?.[0]?.message?.content) {
      console.error("Invalid response:", data);
      throw new Error("Invalid API response format");
    }

    return data.choices[0].message;
  } catch (error) {
    console.error("=== ERROR ===");
    console.error("Type:", error.name);
    console.error("Message:", error.message);

    // Handle fetch/network errors
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error(
        "Cannot connect to API. Possible causes:\n• Internet connection issue\n• CORS blocking (try different browser)\n• Firewall/antivirus blocking\n• OpenRouter API is down"
      );
    }

    // Re-throw with original message
    throw error;
  }
}

// UI Rendering
function renderMessages() {
  clearChatBox();
  state.messages.forEach((msg) => renderMessage(msg));
  scrollToBottom();
}

function renderMessage(message) {
  elements.welcomeMessage.classList.add("hidden");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${message.role}`;
  const avatarIcon =
    message.role === "user"
      ? '<i class="fas fa-user"></i>'
      : '<i class="fas fa-robot"></i>';
  const label = message.role === "user" ? "You" : "TIDA AI";
  const formattedContent = formatMessageContent(message.content);

  messageDiv.innerHTML = `
    <div class="message-content-wrapper">
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-bubble">
        <div class="message-label">${label}</div>
        <div class="message-text">${formattedContent}</div>
      </div>
    </div>
  `;

  elements.chatBox.appendChild(messageDiv);

  messageDiv.querySelectorAll("pre").forEach((pre) => {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
    copyBtn.onclick = () => copyCode(pre, copyBtn);
    pre.appendChild(copyBtn);
  });
}

function formatMessageContent(content) {
  let formatted = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  formatted = formatted.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (match, lang, code) => {
      return `<pre><code class="language-${
        lang || "plaintext"
      }">${code.trim()}</code></pre>`;
    }
  );
  formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
  formatted = formatted.replace(/\n/g, "<br>");
  return formatted;
}

function renderChatHistory() {
  elements.chatHistory.innerHTML = "";
  elements.chatCount.textContent = state.chats.length;

  state.chats.forEach((chat) => {
    const chatItem = document.createElement("div");
    chatItem.className = "chat-item";
    if (chat.id === state.currentChatId) {
      chatItem.classList.add("active");
    }
    const date = new Date(chat.updatedAt);
    const timeStr = formatTime(date);

    chatItem.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${chat.title}
          </div>
          <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">
            ${timeStr}
          </div>
        </div>
        <button onclick="deleteChat('${chat.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px; opacity: 0.7; transition: opacity 0.2s;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    chatItem.onclick = (e) => {
      if (!e.target.closest("button")) {
        loadChat(chat.id);
      }
    };
    elements.chatHistory.appendChild(chatItem);
  });
}

function updateActiveChatItem() {
  document.querySelectorAll(".chat-item").forEach((item) => {
    item.classList.remove("active");
  });
  const activeItem = Array.from(document.querySelectorAll(".chat-item")).find(
    (item) => item.onclick.toString().includes(state.currentChatId)
  );
  if (activeItem) {
    activeItem.classList.add("active");
  }
}

// Utility Functions
function showTypingIndicator() {
  const typingDiv = document.createElement("div");
  typingDiv.className = "message assistant";
  typingDiv.id = "typingIndicator";
  typingDiv.innerHTML = `
    <div class="message-content-wrapper">
      <div class="message-avatar"><i class="fas fa-robot"></i></div>
      <div class="message-bubble">
        <div class="message-label">TIDA AI</div>
        <div class="message-text">
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  elements.chatBox.appendChild(typingDiv);
  scrollToBottom();
}

function hideTypingIndicator() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) indicator.remove();
}

function clearChatBox() {
  elements.chatBox.innerHTML = "";
  elements.welcomeMessage.classList.remove("hidden");
  elements.chatBox.appendChild(elements.welcomeMessage);
}

function clearInput() {
  elements.userInput.value = "";
  autoResizeTextarea();
  elements.userInput.focus();
}

function autoResizeTextarea() {
  const textarea = elements.userInput;
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
}

function handleKeyDown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function scrollToBottom() {
  elements.chatBox.scrollTop = elements.chatBox.scrollHeight;
}

function toggleSidebar() {
  elements.sidebar.classList.toggle("open");
  elements.overlay.classList.toggle("show");
}

function closeSidebar() {
  elements.sidebar.classList.remove("open");
  elements.overlay.classList.remove("show");
}

function copyCode(pre, btn) {
  const code = pre.querySelector("code").textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => {
      btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
    }, 2000);
  });
}

function startVoiceInput() {
  if ("webkitSpeechRecognition" in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.lang = "km-KH";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      elements.voiceBtn.style.color = "#ef4444";
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      elements.userInput.value = transcript;
      autoResizeTextarea();
    };

    recognition.onend = () => {
      elements.voiceBtn.style.color = "";
    };

    recognition.start();
  } else {
    alert("Voice input is not supported in your browser.");
  }
}

function formatTime(date) {
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function parseJwt(token) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );
  return JSON.parse(jsonPayload);
}

// Local Storage
function saveToLocalStorage() {
  try {
    localStorage.setItem("tidaChats", JSON.stringify(state.chats));
    localStorage.setItem("tidaCurrentChatId", state.currentChatId);
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
}

function loadFromLocalStorage() {
  try {
    const chats = localStorage.getItem("tidaChats");
    const currentChatId = localStorage.getItem("tidaCurrentChatId");
    if (chats) state.chats = JSON.parse(chats);
    if (currentChatId) state.currentChatId = currentChatId;
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
  }
}

// Global functions for HTML onclick handlers
window.handleGoogleSignIn = handleGoogleSignIn;
window.devLogin = devLogin;
window.deleteChat = deleteChat;

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
