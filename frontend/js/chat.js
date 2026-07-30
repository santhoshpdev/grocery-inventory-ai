let chatOpen = false;

const SUGGESTIONS = [
  "How many products are low stock?",
  "Which products need attention?",
  "Show inventory summary",
  "Explain the AI prediction",
  "What is the best ML model?",
  "How does forecasting work?",
  "Which products have increasing demand?",
  "What is the forecast for " + displayName('Product_001') + "?",
];

function toggleChat() {
  chatOpen = !chatOpen;
  const panel = document.getElementById('chat-panel');
  const btn = document.getElementById('chat-toggle');
  if (chatOpen) {
    panel.classList.add('open');
    btn.innerHTML = '<i class="fas fa-times"></i>';
    document.getElementById('chat-input')?.focus();
  } else {
    panel.classList.remove('open');
    btn.innerHTML = '<i class="fas fa-robot"></i>';
  }
}

function addMessage(text, role) {
  const msgs = document.getElementById('chat-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  const content = document.createElement('div');
  content.className = 'chat-msg-content';
  content.textContent = text;
  div.appendChild(content);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
  const msgs = document.getElementById('chat-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'chat-msg assistant';
  div.id = 'chat-typing';
  div.innerHTML = '<div class="chat-typing-indicator"><span></span><span></span><span></span></div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('chat-typing');
  if (el) el.remove();
}

function showSuggestions() {
  const msgs = document.getElementById('chat-messages');
  if (!msgs) return;
  const existing = document.getElementById('chat-suggestions');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = 'chat-suggestions';
  div.id = 'chat-suggestions';
  div.innerHTML = SUGGESTIONS.map((q, idx) =>
    `<button class="chat-suggestion-btn" data-idx="${idx}">${q}</button>`
  ).join('');
  div.querySelectorAll('.chat-suggestion-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => sendSuggestion(SUGGESTIONS[idx]));
  });
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function hideSuggestions() {
  const el = document.getElementById('chat-suggestions');
  if (el) el.remove();
}

function sendSuggestion(text) {
  const input = document.getElementById('chat-input');
  if (input) input.value = text;
  sendChat();
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input?.value?.trim();
  if (!text) return;
  input.value = '';
  hideSuggestions();
  addMessage(text, 'user');
  showTyping();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Server error' }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    const data = await res.json();
    hideTyping();
    addMessage(data.message, 'assistant');
  } catch (err) {
    hideTyping();
    addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('chat-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
  }
  const panel = document.getElementById('chat-panel');
  if (panel) {
    const firstMsg = panel.querySelector('.chat-msg');
    if (firstMsg) {
      setTimeout(showSuggestions, 500);
    }
  }
});
