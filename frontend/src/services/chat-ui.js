window.SmartSchedule = window.SmartSchedule || {};

window.SmartSchedule.chatUi = (function createChatUi() {
  const apiClient = window.SmartSchedule.apiClient;
  const launcher = document.getElementById('chat-launcher');
  const badge = document.getElementById('chat-launcher-badge');
  const maxMessageLength = 1000;
  const mutedStorageKey = 'smart-schedule-chat-muted';
  const enterToSendStorageKey = 'smart-schedule-chat-enter-to-send';
  let panel = null;
  let form = null;
  let input = null;
  let messageList = null;
  let status = null;
  let latestButton = null;
  let toast = null;
  let socket = null;
  let reconnectTimer = null;
  let currentUser = null;
  let messages = [];
  let unreadCount = 0;
  let isOpen = false;
  let isMuted = window.localStorage.getItem(mutedStorageKey) === 'true';
  let enterToSend = window.localStorage.getItem(enterToSendStorageKey) !== 'false';
  let firstUnreadMessageId = null;
  let unreadPointer = null;
  let conversationPicker = null;
  let people = [];
  let conversations = [];
  let activeConversationId = null;

  const escapeText = (value) => String(value || '').slice(0, maxMessageLength);

  const formatTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const setStatus = (text, tone = '') => {
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone;
  };

  const updateLauncher = () => {
    if (!launcher) return;
    launcher.hidden = !currentUser;
    launcher.classList.toggle('is-unread', unreadCount > 0);
    launcher.classList.toggle('is-muted', isMuted);
    launcher.classList.toggle('is-ready', unreadCount === 0 && !isMuted);
    launcher.setAttribute('aria-expanded', String(isOpen));
    launcher.setAttribute('aria-label', unreadCount > 0
      ? `Open NodyChat, ${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`
      : isMuted ? 'Open NodyChat, notifications muted' : 'Open NodyChat');
    if (badge) {
      badge.hidden = unreadCount === 0;
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    }
  };

  const updateUnreadPointer = () => {
    if (!unreadPointer) return;
    unreadPointer.hidden = !isOpen || unreadCount === 0;
    unreadPointer.textContent = unreadCount === 1
      ? '1 new message since you last opened chat · Jump to first unread'
      : `${unreadCount} new messages since you last opened chat · Jump to first unread`;
  };

  const isAtLatest = () => {
    if (!messageList) return true;
    return messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < 24;
  };

  const updateLatestButton = () => {
    if (!latestButton || !messageList) return;
    latestButton.hidden = isAtLatest();
  };

  const renderMessages = (scrollToLatest = true) => {
    if (!messageList) return;
    const previousScrollTop = messageList.scrollTop;
    messageList.textContent = '';
    if (messages.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'chat-empty';
      empty.textContent = 'No workplace messages yet. Keep the conversation professional and work-related.';
      messageList.appendChild(empty);
      updateLatestButton();
      return;
    }

    messages.forEach((entry) => {
      const item = document.createElement('article');
      item.className = `chat-message${entry.sender?.id === currentUser?.id ? ' is-own' : ''}`;
      item.dataset.messageId = entry.id;
      const heading = document.createElement('div');
      heading.className = 'chat-message-meta';
      const sender = document.createElement('strong');
      sender.textContent = escapeText(entry.sender?.fullName || 'Staff member');
      const time = document.createElement('time');
      time.dateTime = entry.createdAt;
      time.textContent = formatTime(entry.createdAt);
      heading.append(sender, time);
      const body = document.createElement('p');
      body.textContent = escapeText(entry.message);
      item.append(heading, body);
      messageList.appendChild(item);
    });
    messageList.scrollTop = scrollToLatest ? messageList.scrollHeight : previousScrollTop;
    updateLatestButton();
  };

  const renderConversationPicker = () => {
    if (!conversationPicker) return;
    conversationPicker.textContent = '';
    const workplace = conversations.find((conversation) => conversation.kind === 'WORKPLACE');
    if (workplace) {
      const workplaceOption = document.createElement('option');
      workplaceOption.value = workplace.id;
      workplaceOption.textContent = 'Workplace room';
      conversationPicker.appendChild(workplaceOption);
    }
    people.forEach((person) => {
      const option = document.createElement('option');
      option.value = `person:${person.id}`;
      option.textContent = `Message ${person.fullName}`;
      conversationPicker.appendChild(option);
    });
    const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
    if (activeConversation?.kind === 'DIRECT' && activeConversation.other?.id) {
      conversationPicker.value = `person:${activeConversation.other.id}`;
    } else if (activeConversationId) {
      conversationPicker.value = activeConversationId;
    }
  };

  const openConversation = async (value) => {
    if (!value || !socket || socket.readyState !== WebSocket.OPEN) return;
    if (value.startsWith('person:')) {
      try {
        const result = await apiClient.post('/api/v1/chat/conversations', { userId: value.slice(7) });
        socket.send(JSON.stringify({ conversationId: result.conversation.id, type: 'open-conversation' }));
        setStatus('Opening direct conversation…');
      } catch (error) {
        setStatus(error.message || 'The direct conversation could not be opened.', 'error');
      }
      return;
    }
    socket.send(JSON.stringify({ conversationId: value, type: 'open-conversation' }));
  };

  const showToast = (message) => {
    if (!toast || isMuted || isOpen) return;
    toast.textContent = `${message.sender?.fullName || 'New message'} sent a message`;
    toast.hidden = false;
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => { toast.hidden = true; }, 4200);
  };

  const markRead = () => {
    const lastReadMessageId = messages[messages.length - 1]?.id;
    unreadCount = 0;
    firstUnreadMessageId = null;
    updateLauncher();
    updateUnreadPointer();
    if (lastReadMessageId && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ messageId: lastReadMessageId, type: 'read' }));
    }
  };

  const receiveMessage = (message) => {
    if (message.conversationId !== activeConversationId) {
      const conversation = conversations.find((entry) => entry.id === message.conversationId);
      if (conversation) conversation.unreadCount += 1;
      unreadCount += 1;
      updateLauncher();
      updateUnreadPointer();
      showToast(message);
      return;
    }
    const shouldScrollToLatest = isAtLatest();
    messages = [...messages, message].slice(-100);
    renderMessages(shouldScrollToLatest);
    const isOwnMessage = message.sender?.id === currentUser?.id;
    if (isOpen) {
      markRead();
    } else if (isOwnMessage) {
      updateLauncher();
    } else {
      if (unreadCount === 0) firstUnreadMessageId = message.id;
      unreadCount += 1;
      updateLauncher();
      updateUnreadPointer();
      showToast(message);
    }
  };

  const connect = () => {
    if (!currentUser || socket || reconnectTimer) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);
    setStatus('Connecting…');

    socket.addEventListener('open', () => setStatus('Workplace chat · connected', 'success'));
    socket.addEventListener('message', (event) => {
      let payload;
      try { payload = JSON.parse(event.data); } catch (error) { return; }
      if (payload.type === 'history') {
        activeConversationId = payload.conversationId;
        conversations = payload.conversations || conversations;
        people = payload.people || people;
        renderConversationPicker();
        messages = payload.messages || [];
        unreadCount = Number(payload.unreadCount || 0);
        firstUnreadMessageId = payload.firstUnreadMessageId || null;
        renderMessages();
        updateLauncher();
        updateUnreadPointer();
        setStatus('Workplace chat · connected', 'success');
      } else if (payload.type === 'message' && payload.message) {
        receiveMessage(payload.message);
      } else if (payload.type === 'error') {
        setStatus(payload.message || 'Chat error', 'error');
      }
    });
    socket.addEventListener('close', () => {
      socket = null;
      if (currentUser) {
        setStatus('Reconnecting…');
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 2500);
      }
    });
    socket.addEventListener('error', () => setStatus('Chat connection problem', 'error'));
  };

  const togglePanel = () => {
    if (isOpen) closePanel();
    else openPanel();
  };

  const closePanel = () => {
    isOpen = false;
    panel.hidden = true;
    panel.classList.add('is-collapsed');
    updateLauncher();
  };

  const openPanel = () => {
    isOpen = true;
    panel.hidden = false;
    panel.classList.remove('is-collapsed');
    renderMessages();
    updateUnreadPointer();
    input?.focus();
    updateLauncher();
  };

  const buildPanel = () => {
    panel = document.createElement('aside');
    panel.className = 'chat-panel';
    panel.hidden = true;
    panel.classList.add('is-collapsed');
    panel.setAttribute('aria-label', 'NodyChat workplace chat');
    const header = document.createElement('div');
    header.className = 'chat-panel-header';
    const heading = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'NodyChat';
    const copy = document.createElement('p');
    copy.textContent = 'One workplace room for rota and staff updates.';
    heading.append(title, copy);
    const close = document.createElement('button');
    close.className = 'chat-close-button';
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close NodyChat');
    close.addEventListener('click', closePanel);
    header.append(heading, close);
    panel.appendChild(header);

    const notice = document.createElement('p');
    notice.className = 'chat-professional-notice';
    notice.textContent = 'Keep messages professional, respectful, and related to work. Do not share passwords or private customer information.';
    panel.appendChild(notice);

    const conversationLabel = document.createElement('label');
    conversationLabel.className = 'chat-conversation-label';
    conversationLabel.textContent = 'Conversation';
    conversationPicker = document.createElement('select');
    conversationPicker.className = 'chat-conversation-picker';
    conversationPicker.setAttribute('aria-label', 'Choose a NodyChat conversation');
    conversationPicker.addEventListener('change', () => openConversation(conversationPicker.value));
    conversationLabel.appendChild(conversationPicker);
    panel.appendChild(conversationLabel);

    unreadPointer = document.createElement('button');
    unreadPointer.className = 'chat-unread-pointer';
    unreadPointer.type = 'button';
    unreadPointer.hidden = true;
    unreadPointer.addEventListener('click', () => {
      const firstUnread = firstUnreadMessageId
        ? messageList.querySelector(`[data-message-id="${firstUnreadMessageId}"]`)
        : null;
      firstUnread?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      markRead();
    });
    panel.appendChild(unreadPointer);

    messageList = document.createElement('div');
    messageList.className = 'chat-message-list';
    messageList.addEventListener('scroll', updateLatestButton, { passive: true });
    panel.appendChild(messageList);

    latestButton = document.createElement('button');
    latestButton.className = 'chat-latest-button';
    latestButton.type = 'button';
    latestButton.hidden = true;
    latestButton.textContent = '↓';
    latestButton.setAttribute('aria-label', 'Scroll to latest message');
    latestButton.addEventListener('click', () => {
      messageList.scrollTo({ behavior: 'smooth', top: messageList.scrollHeight });
    });
    panel.appendChild(latestButton);

    status = document.createElement('p');
    status.className = 'chat-status';
    panel.appendChild(status);

    form = document.createElement('form');
    form.className = 'chat-compose';
    input = document.createElement('textarea');
    input.maxLength = maxMessageLength;
    input.rows = 2;
    input.placeholder = 'Write a workplace message…';
    input.setAttribute('aria-label', 'Workplace message');
    const actions = document.createElement('div');
    actions.className = 'chat-compose-actions';
    const mute = document.createElement('button');
    mute.className = 'action-button button-ghost chat-mute-button';
    mute.type = 'button';
    const updateMuteLabel = () => { mute.textContent = isMuted ? 'Unmute alerts' : 'Mute alerts'; };
    updateMuteLabel();
    mute.addEventListener('click', () => {
      isMuted = !isMuted;
      window.localStorage.setItem(mutedStorageKey, String(isMuted));
      updateMuteLabel();
      updateLauncher();
    });
    const enterToggle = document.createElement('button');
    enterToggle.className = 'action-button button-ghost chat-enter-toggle';
    enterToggle.type = 'button';
    const updateEnterLabel = () => {
      enterToggle.textContent = enterToSend ? 'Enter sends' : 'Enter adds line';
      enterToggle.setAttribute('aria-pressed', String(enterToSend));
    };
    updateEnterLabel();
    enterToggle.addEventListener('click', () => {
      enterToSend = !enterToSend;
      window.localStorage.setItem(enterToSendStorageKey, String(enterToSend));
      updateEnterLabel();
    });
    const send = document.createElement('button');
    send.className = 'action-button button-primary';
    send.type = 'submit';
    send.textContent = 'Send';
    actions.append(enterToggle, mute, send);
    form.append(input, actions);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && enterToSend && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    input.addEventListener('input', () => {
      if (status?.dataset.tone === 'error' && input.value.trim()) {
        setStatus('Workplace chat · connected', 'success');
      }
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) {
        setStatus('Write a message before sending.', 'error');
        input.focus();
        return;
      }
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setStatus('Chat is not connected yet.', 'error');
        return;
      }
      socket.send(JSON.stringify({ message, type: 'message' }));
      input.value = '';
      setStatus('Message sent.', 'success');
    });
    panel.appendChild(form);
    document.body.append(panel);
    toast = document.createElement('button');
    toast.className = 'chat-toast';
    toast.type = 'button';
    toast.hidden = true;
    toast.addEventListener('click', () => {
      toast.hidden = true;
      if (!isOpen) openPanel();
    });
    document.body.append(toast);
    launcher?.addEventListener('click', togglePanel);
  };

  const sync = async () => {
    if (!panel) buildPanel();
    try {
      const result = await apiClient.get('/api/v1/auth/me');
      const previousUserId = currentUser?.id;
      if (previousUserId && previousUserId !== result.user.id && socket) {
        const previousSocket = socket;
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
        socket = null;
        previousSocket.close();
        messages = [];
        conversations = [];
        people = [];
        activeConversationId = null;
        unreadCount = 0;
      }
      currentUser = result.user;
      updateLauncher();
      connect();
    } catch (error) {
      currentUser = null;
      isOpen = false;
      panel.hidden = true;
      panel.classList.add('is-collapsed');
      if (socket) socket.close();
      socket = null;
      updateLauncher();
    }
  };

  return { sync };
})();
