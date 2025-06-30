const username = sessionStorage.getItem('username');
const roomKey = sessionStorage.getItem('roomKey');

if (!username) {
    window.location.href = '/';
}

const socket = io({
    transports: ['websocket'],
    upgrade: false
});

const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const usersList = document.getElementById('users-list');
const modeSwitchButton = document.getElementById('mode-switch-button');
const replyPreview = document.getElementById('reply-preview');
let typingTimeout;
let isTyping = false;
let replyingTo = null;

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '👏'];

const emojiButton = document.getElementById('emoji-button');

const EMOJIS = [
    '😀', '😂', '😍', '👍', '😢', '😡', '🥳', '🤩', '🤔', '🙌', 
    '😊', '😇', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', 
    '🤪', '😝', '🤑', '🤭', '🤫', '🤐', '🤨', '😐', '😑', '😶',
    '👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✋', '🤚', '🖐️', 
    '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👊', '🤛', '🤜',
    '👋', '❤️', '💖', '💕', '💘', '💝', '💓', '💗', '💞', '💟', 
    '🧡', '💛', '💚', '💙', '💜', '��', '🤍', '🤎'
]; 

const fileInput = document.getElementById('file-input');
const uploadButton = document.getElementById('upload-button');

const ALLOWED_TYPES = {
    'image/jpeg': '🖼️',
    'image/png': '🖼️',
    'image/gif': '🖼️',
    'image/webp': '🖼️',
    'application/zip': '📁',
    'application/x-zip-compressed': '📁',
    'application/pdf': '📄',
    'text/plain': '📝',
    'application/msword': '📄',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📄',
    'application/vnd.ms-excel': '📊',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
    'application/vnd.ms-powerpoint': '📑',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📑'
};

const MAX_FILE_SIZE = 500 * 1024 * 1024;

function setTheme(theme) {
    const htmlElement = document.documentElement;
    if (theme === 'dark') {
        htmlElement.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        if (modeSwitchButton) {
            modeSwitchButton.innerHTML = '<span class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg></span>';
            modeSwitchButton.title = 'Switch to Light Mode';
        }
    } else {
        htmlElement.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        if (modeSwitchButton) {
            modeSwitchButton.innerHTML = '<span class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/></svg></span>';
            modeSwitchButton.title = 'Switch to Dark Mode';
        }
    }
}

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    setTheme(savedTheme);
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme('dark');
} else {
    setTheme('light');
}

if (modeSwitchButton) {
    modeSwitchButton.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('theme') || 'light';
        setTheme(currentTheme === 'light' ? 'dark' : 'light');
    });
}

const emojiPicker = document.createElement('div');
emojiPicker.className = 'emoji-picker';
emojiPicker.style.display = 'none'; 

EMOJIS.forEach(emoji => {
    const button = document.createElement('button');
    button.textContent = emoji;
    button.className = 'emoji-picker-button';
    button.onclick = (e) => {
        e.stopPropagation();
        const start = messageInput.selectionStart;
        const end = messageInput.selectionEnd;
        const text = messageInput.value;
        messageInput.value = text.substring(0, start) + emoji + text.substring(end);
        messageInput.focus();
        messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
    };
    emojiPicker.appendChild(button);
});
document.body.appendChild(emojiPicker);

emojiButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = emojiButton.getBoundingClientRect();
    const inputContainer = document.querySelector('.message-input-container');
    const inputRect = inputContainer.getBoundingClientRect();

    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'grid' : 'none';
    
    if (emojiPicker.style.display === 'grid') {
        emojiPicker.style.position = 'fixed';
        emojiPicker.style.bottom = `${window.innerHeight - inputRect.top + 5}px`;
        emojiPicker.style.left = `${inputRect.left + 10}px`;
        emojiPicker.style.right = 'auto';
        emojiPicker.style.zIndex = '1001';
    }
});

document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && e.target !== emojiButton) {
        emojiPicker.style.display = 'none';
    }
});

const reactionPicker = document.createElement('div');
reactionPicker.className = 'reaction-picker';
reactionPicker.style.display = 'none';
reactionPicker.style.zIndex = '1002';

REACTIONS.forEach(emoji => {
    const button = document.createElement('button');
    button.textContent = emoji;
    button.className = 'reaction-button';
    button.onclick = (e) => {
        e.stopPropagation();
        const messageId = reactionPicker.dataset.messageId;
        socket.emit('add reaction', { messageId, reaction: emoji });
        reactionPicker.style.display = 'none';
    };
    reactionPicker.appendChild(button);
});
document.body.appendChild(reactionPicker);

document.addEventListener('click', (e) => {
    if (!reactionPicker.contains(e.target) && !e.target.closest('.message-content')) {
        reactionPicker.style.display = 'none';
    }
});

socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('join', { username, roomKey });
    
    const roomIdDisplay = document.getElementById('room-id-display');
    if (roomKey) {
        roomIdDisplay.textContent = `Room ID: ${roomKey}`;
    } else {
        roomIdDisplay.textContent = 'Room ID: public';
    }
});

socket.on('users update', (users) => {
    usersList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        const nameBox = document.createElement('span');
        nameBox.className = 'user-transparent-box';
        nameBox.textContent = user.username;
        li.appendChild(nameBox);
        if (user.online) {
            li.classList.add('online');
        }
        if (user.username === username) {
            li.classList.add('current-user');
        }
        usersList.appendChild(li);
    });
});

socket.on('user joined', (data) => {
    showNotification(`${data.username} joined the chat`);
    const userElement = Array.from(usersList.children)
        .find(li => li.textContent === data.username);
    if (userElement) {
        userElement.classList.add('online');
    }
});

socket.on('user left', (data) => {
    showNotification(`${data.username} left the chat`);
    const userElement = Array.from(usersList.children)
        .find(li => li.textContent === data.username);
    if (userElement) {
        userElement.classList.remove('online');
    }
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

socket.on('chat message', (msgData) => {
    appendMessage(msgData, msgData.username === username);
});

socket.on('file uploaded', (fileData) => {
    appendMessage({
        type: 'file',
        username: fileData.username,
        fileName: fileData.originalName,
        fileType: fileData.fileType,
        fileSize: fileData.fileSize,
        fileUrl: fileData.fileUrl,
        timestamp: fileData.timestamp
    }, fileData.username === username);
});

function showReactionPicker(event, messageId) {
    const rect = event.target.getBoundingClientRect();
    reactionPicker.style.display = 'flex';
    reactionPicker.style.top = `${rect.top - 50}px`;
    reactionPicker.style.left = `${rect.left}px`;
    reactionPicker.dataset.messageId = messageId;
}

function enableMessageEditing(messageDiv, msgData) {
    const messageText = messageDiv.querySelector('.message-text');
    const originalText = messageText.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'message-edit-input';
    input.value = originalText;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'edit-actions';

    const saveButton = document.createElement('button');
    saveButton.className = 'edit-button';
    saveButton.textContent = 'Save';
    saveButton.onclick = () => {
        const newText = input.value.trim();
        if (newText && newText !== originalText) {
            socket.emit('edit message', { messageId: msgData.id, newText });
        }
        cancelMessageEditing(messageDiv, originalText);
    };

    const cancelButton = document.createElement('button');
    cancelButton.className = 'cancel-button';
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = () => cancelMessageEditing(messageDiv, originalText);

    actionsDiv.appendChild(saveButton);
    actionsDiv.appendChild(cancelButton);

    messageText.replaceWith(input);
    messageDiv.appendChild(actionsDiv);
    input.focus();
}

function cancelMessageEditing(messageDiv, originalText) {
    const input = messageDiv.querySelector('.message-edit-input');
    const actionsDiv = messageDiv.querySelector('.edit-actions');
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = originalText;

    input.replaceWith(messageText);
    actionsDiv.remove();
}

socket.on('reaction update', ({ messageId, reactions }) => {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        let reactionsContainer = messageDiv.querySelector('.reactions-container');
        if (!reactionsContainer) {
            reactionsContainer = document.createElement('div');
            reactionsContainer.className = 'reactions-container';
            messageDiv.querySelector('.message-content').appendChild(reactionsContainer);
        }
        
        reactionsContainer.innerHTML = '';
        
        reactions.forEach(({ emoji, users }) => {
            const reactionDiv = document.createElement('div');
            reactionDiv.className = 'reaction';
            reactionDiv.innerHTML = `${emoji} ${users.length}`;
            reactionDiv.title = users.join(', ');
            
            reactionDiv.onclick = (e) => {
                e.stopPropagation();
                socket.emit('add reaction', { messageId, reaction: emoji });
            };
            
            if (users.includes(username)) {
                reactionDiv.classList.add('active');
            }
            
            reactionsContainer.appendChild(reactionDiv);
        });
    }
});

socket.on('notification', (message) => {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    messagesContainer.appendChild(notification);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.remove();
        }
    }, 5000);
});

socket.on('typing', (username) => {
    if (!isTyping) {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.textContent = `${username} is typing...`;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        isTyping = true;
    }
});

socket.on('stop typing', () => {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
        isTyping = false;
    }
});

socket.on('userList', (users) => {
    usersList.innerHTML = '';
    users.forEach(user => {
        const userItem = document.createElement('li');
        userItem.className = 'user-box';
        const dot = document.createElement('span');
        dot.className = 'user-dot';
        dot.textContent = '•';
        const nameBox = document.createElement('span');
        nameBox.className = 'user-transparent-box';
        let displayName = user.username || user;
        if (displayName === username) {
            displayName += ' (You)';
        }
        nameBox.textContent = displayName;
        if (user.username === username) {
            nameBox.style.color = 'black';
            dot.style.color = 'black';
        } else {
            nameBox.style.color = '#006400'; // dark green
            dot.style.color = '#006400';
        }
        userItem.appendChild(dot);
        userItem.appendChild(nameBox);
        if (user.username === username) {
            userItem.classList.add('current-user');
        }
        usersList.appendChild(userItem);
    });
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
    if (error.includes('Maximum number of reactions')) {
        const notification = document.createElement('div');
        notification.className = 'notification reaction-limit';
        notification.textContent = error;
        messagesContainer.appendChild(notification);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    } else {
        alert(error);
    }
});

socket.on('message deleted', ({ messageId }) => {
    const messageElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    }
});

socket.on('message edited', ({ messageId, newText }) => {
    const messageElement = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        const messageTextElement = messageElement.querySelector('.message-text');
        if (messageTextElement) {
            messageTextElement.textContent = newText;
        }
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        const messageId = Date.now().toString();
        const messageData = {
            id: messageId,
            username,
            message,
            timestamp: new Date().toISOString(),
            status: 'sent'
        };

        if (replyingTo) {
            messageData.replyTo = {
                id: replyingTo.id,
                username: replyingTo.username,
                message: replyingTo.message || replyingTo.text
            };
            clearReplyTo();
        }

        socket.emit('chat message', messageData);
        messageInput.value = '';
        socket.emit('stop typing');
    }
}

sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); 
        sendMessage();
    }
});

messageInput.addEventListener('input', () => {
    clearTimeout(typingTimeout);
    socket.emit('typing', username);
    
    typingTimeout = setTimeout(() => {
        socket.emit('stop typing');
    }, 3000);
});

window.addEventListener('beforeunload', () => {
    socket.disconnect();
});

document.getElementById('exit-button').addEventListener('click', () => {
    sessionStorage.removeItem('username');
    window.location.href = '/';
});

function updateMessageStatusIcon(iconElement, status) {
    iconElement.classList.remove('sent', 'delivered', 'seen');
    iconElement.classList.add(status);
    if (status === 'sent') {
        iconElement.innerHTML = '✓';
        iconElement.title = 'Sent';
        iconElement.style.color = '#999';
    } else if (status === 'delivered') {
        iconElement.innerHTML = '✓✓';
        iconElement.title = 'Delivered';
        iconElement.style.color = '#999';
    } else if (status === 'seen') {
        iconElement.innerHTML = '✓✓';
        iconElement.title = 'Seen';
        iconElement.style.color = '#4a90e2';
    }
}

const messageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && entry.target.classList.contains('received')) {
            const messageId = entry.target.dataset.messageId;
            if (messageId) {
                socket.emit('message_seen', { messageId });
                messageObserver.unobserve(entry.target);
            }
        }
    });
}, { threshold: 0.5 });

socket.on('message_status_update', ({ messageId, status, seenTime }) => {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        const statusIcon = messageDiv.querySelector('.message-status');
        const timestampDiv = messageDiv.querySelector('.timestamp');
        if (statusIcon) {
            updateMessageStatusIcon(statusIcon, status);
            if (status === 'seen' && seenTime && timestampDiv) {
                timestampDiv.textContent += ` Seen ${new Date(seenTime).toLocaleTimeString('en-US', { 
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true 
                })}`;
                timestampDiv.classList.add('seen-time');
            }
        }
    }
});

function getFileIcon(type) {
    return ALLOWED_TYPES[type] || '📎';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function createFilePreview(file) {
    const preview = document.createElement('div');
    preview.className = 'file-preview';
    
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = getFileIcon(file.type);
    
    const info = document.createElement('div');
    info.className = 'file-info';
    
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = file.name;
    
    const size = document.createElement('div');
    size.className = 'file-size';
    size.textContent = formatFileSize(file.size);
    
    info.appendChild(name);
    info.appendChild(size);
    preview.appendChild(icon);
    preview.appendChild(info);
    
    return preview;
}

function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

async function handleFileUpload(file) {
    if (file.size > MAX_FILE_SIZE) {
        showNotification('File size exceeds 500MB limit', 'error');
        return;
    }
    
    if (!ALLOWED_TYPES[file.type]) {
        showNotification('File type not supported', 'error');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('username', username);
        
        showNotification('Uploading file...');
        
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        const data = await response.json();
        
        showNotification('File uploaded successfully');
        
        
        
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Failed to upload file', 'error');
    }
}

uploadButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
    fileInput.value = '';
});

function appendMessage(message, isSent = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    messageDiv.dataset.messageId = message.id || Date.now().toString();

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'username';
    usernameDiv.textContent = message.username || username;
    messageContent.appendChild(usernameDiv);

    if (message.replyTo) {
        const replyDiv = document.createElement('div');
        replyDiv.className = 'message-reply';
        const replyUsername = document.createElement('div');
        replyUsername.className = 'username';
        replyUsername.textContent = message.replyTo.username;
        const replyText = document.createElement('div');
        replyText.className = 'message-text';
        replyText.textContent = message.replyTo.message;
        
        replyDiv.addEventListener('click', () => {
            const originalMessage = document.querySelector(`[data-message-id="${message.replyTo.id}"]`);
            if (originalMessage) {
                originalMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                originalMessage.style.animation = 'highlight-message 2s ease-out';
            }
        });
        
        replyDiv.appendChild(replyUsername);
        replyDiv.appendChild(replyText);
        
        messageContent.appendChild(replyDiv);
    }

    if (message.type === 'file') {
        const filePreview = createFilePreview({
            name: message.fileName,
            type: message.fileType,
            size: message.fileSize
        });
        
        const link = document.createElement('a');
        link.href = message.fileUrl;
        link.className = 'file-link';
        link.download = message.fileName;
        link.appendChild(filePreview);
        
        messageContent.appendChild(link);
    } else {
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = message.text || message.message;
        messageContent.appendChild(messageText);
    }

    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    timestampDiv.textContent = new Date(message.timestamp).toLocaleTimeString('en-US', { 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true 
    });
    messageContent.appendChild(timestampDiv);

    const statusIcon = document.createElement('span');
    statusIcon.className = 'message-status';
    messageContent.appendChild(statusIcon);

    if (message.status) {
        updateMessageStatusIcon(statusIcon, message.status);
    } else if (isSent) {
        updateMessageStatusIcon(statusIcon, 'sent');
    }

    const moreMenuWrapper = document.createElement('div');
    moreMenuWrapper.className = 'message-more-menu-wrapper';
    
    const moreBtn = document.createElement('button');
    moreBtn.className = 'message-more-btn';
    moreBtn.innerHTML = '⋮';
    moreBtn.onclick = (e) => {
        e.stopPropagation();
        const dropdown = messageDiv.querySelector('.message-more-dropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        }
    };
    
    const dropdown = document.createElement('div');
    dropdown.className = 'message-more-dropdown';
    
    const replyOption = document.createElement('button');
    replyOption.className = 'message-more-option reply-option';
    replyOption.innerHTML = '<span class="option-icon">↩️</span> Reply';
    replyOption.onclick = () => {
        setReplyTo(message);
        dropdown.style.display = 'none';
    };
    
    dropdown.appendChild(replyOption);

    if (isSent) {
        const editOption = document.createElement('button');
        editOption.className = 'message-more-option';
        editOption.innerHTML = '<span class="option-icon">✏️</span> Edit';
        editOption.onclick = () => {
            enableMessageEditing(messageDiv, message);
            dropdown.style.display = 'none';
        };
        
        const deleteOption = document.createElement('button');
        deleteOption.className = 'message-more-option';
        deleteOption.innerHTML = '<span class="option-icon">🗑️</span> Delete';
        deleteOption.onclick = () => {
            socket.emit('delete message', { messageId: message.id });
            dropdown.style.display = 'none';
        };
        
        dropdown.appendChild(editOption);
        dropdown.appendChild(deleteOption);
    }
    
    moreMenuWrapper.appendChild(moreBtn);
    moreMenuWrapper.appendChild(dropdown);
    messageContent.appendChild(moreMenuWrapper);

    if (message.type !== 'file') {
        messageContent.addEventListener('click', (e) => {
             if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'A' || e.target.closest('a')) {
                return;
            }
            showReactionPicker(e, message.id);
        });
    } else {
          const filePreviewElement = messageContent.querySelector('.file-preview');
          if(filePreviewElement) {
               filePreviewElement.addEventListener('click', (e) => {
                     if (e.target.tagName === 'A' || e.target.closest('a')) {
                        return;
                    }
                   showReactionPicker(e, message.id);
               });
          }
    }

    messageDiv.appendChild(messageContent);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (!isSent && message.id) {
        messageObserver.observe(messageDiv);
    }
}

function setReplyTo(message) {
    replyingTo = message;
    const usernameDiv = replyPreview.querySelector('.reply-preview-username');
    const textDiv = replyPreview.querySelector('.reply-preview-text');
    usernameDiv.textContent = message.username;
    textDiv.textContent = message.message || message.text;
    replyPreview.style.display = 'flex';
    messageInput.focus();
}

function clearReplyTo() {
    replyingTo = null;
    replyPreview.style.display = 'none';
}

replyPreview.querySelector('.reply-preview-close').addEventListener('click', clearReplyTo);

socket.on('system notification', ({ type, content, timestamp }) => {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `system-notification ${type}`;
    
    const contentSpan = document.createElement('span');
    contentSpan.className = 'notification-content';
    contentSpan.textContent = content;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'notification-time';
    timeSpan.textContent = new Date(timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    
    notificationDiv.appendChild(contentSpan);
    notificationDiv.appendChild(timeSpan);
    
    messagesContainer.appendChild(notificationDiv);
    notificationDiv.scrollIntoView({ behavior: 'smooth' });
    
    setTimeout(() => {
        if (notificationDiv && notificationDiv.parentNode) {
            notificationDiv.remove();
        }
    }, 5000);
});

const notificationStyles = document.createElement('style');

document.head.appendChild(notificationStyles);

// Layout mode switch logic
function isMobileDevice() {
    return window.matchMedia('(max-width: 768px)').matches || /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

function setLayoutMode(mode) {
    if (mode === 'mobile') {
        document.body.classList.add('mobile-mode');
        localStorage.setItem('layoutMode', 'mobile');
        if (layoutSwitchButton) {
            layoutSwitchButton.innerHTML = '<span class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg></span>';
            layoutSwitchButton.title = 'Switch to Desktop UI';
        }
    } else {
        document.body.classList.remove('mobile-mode');
        localStorage.setItem('layoutMode', 'desktop');
        if (layoutSwitchButton) {
            layoutSwitchButton.innerHTML = '<span class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg></span>';
            layoutSwitchButton.title = 'Switch to Mobile UI';
        }
    }
}

// Add layout switch button
let layoutSwitchButton = document.getElementById('layout-switch-button');
if (!layoutSwitchButton) {
    layoutSwitchButton = document.createElement('button');
    layoutSwitchButton.id = 'layout-switch-button';
    layoutSwitchButton.className = 'mode-switch-button';
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
        headerRight.insertBefore(layoutSwitchButton, headerRight.firstChild);
    }
}

const savedLayoutMode = localStorage.getItem('layoutMode');
if (savedLayoutMode) {
    setLayoutMode(savedLayoutMode);
} else if (isMobileDevice()) {
    setLayoutMode('mobile');
} else {
    setLayoutMode('desktop');
}

layoutSwitchButton.addEventListener('click', () => {
    const currentMode = document.body.classList.contains('mobile-mode') ? 'mobile' : 'desktop';
    setLayoutMode(currentMode === 'mobile' ? 'desktop' : 'mobile');
});

const audioCallBtn = document.getElementById('audio-call-btn');
const videoCallBtn = document.getElementById('video-call-btn');
const callModal = document.getElementById('call-modal');
const callVideoGrid = document.getElementById('call-video-grid');
const muteBtn = document.getElementById('mute-btn');
const videoBtn = document.getElementById('video-btn');
const leaveBtn = document.getElementById('leave-btn');

let inCall = false;
let callType = null;
let localStream = null;
let peers = {};
let callRoomKey = window.roomKey || 'public';

function showCallModal() {
    callModal.style.display = 'flex';
    if (callType === 'video') {
        videoBtn.style.display = '';
    } else {
        videoBtn.style.display = 'none';
    }
}
function hideCallModal() {
    callModal.style.display = 'none';
    callVideoGrid.innerHTML = '';
    miniCallWindow.style.display = 'none';
    miniCallVideoGrid.innerHTML = '';
}

function addVideoStream(id, stream, isLocal = false) {
    let video = document.getElementById('video-' + id);
    if (!video) {
        video = document.createElement('video');
        video.id = 'video-' + id;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = isLocal;
        video.className = isLocal ? 'local-video' : 'remote-video';
        callVideoGrid.appendChild(video);
    }
    video.srcObject = stream;
}
function removeVideoStream(id) {
    const video = document.getElementById('video-' + id);
    if (video) video.remove();
}

async function startCall(type, overrideRoomKey) {
    callType = type;
    callRoomKey = overrideRoomKey || window.roomKey || 'public';
    inCall = true;
    showCallModal();
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: type === 'video',
            audio: true
        });
        addVideoStream(socket.id, localStream, true);
        socket.emit('start-call', { roomKey: callRoomKey, callType: type });
        socket.emit('join-call', { roomKey: callRoomKey });
    } catch (err) {
        alert('Could not access camera/microphone: ' + err.message);
        leaveCall();
    }
}

function leaveCall() {
    inCall = false;
    callType = null;
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    Object.values(peers).forEach(pc => pc.close());
    peers = {};
    hideCallModal();
    socket.emit('leave-call', { roomKey: callRoomKey });
}

function toggleMute() {
    if (localStream) {
        const enabled = !localStream.getAudioTracks()[0].enabled;
        localStream.getAudioTracks().forEach(track => track.enabled = enabled);
        document.getElementById('mic-icon-on').style.display = enabled ? 'none' : '';
        document.getElementById('mic-icon-off').style.display = enabled ? '' : 'none';
    }
}
function toggleVideo() {
    if (localStream) {
        const enabled = !localStream.getVideoTracks()[0].enabled;
        localStream.getVideoTracks().forEach(track => track.enabled = enabled);
        document.getElementById('video-icon-on').style.display = enabled ? 'none' : '';
        document.getElementById('video-icon-off').style.display = enabled ? '' : 'none';
    }
}

if (audioCallBtn) audioCallBtn.onclick = () => { if (!inCall) startCall('audio'); };
if (videoCallBtn) videoCallBtn.onclick = () => { if (!inCall) startCall('video'); };
if (muteBtn) muteBtn.onclick = toggleMute;
if (videoBtn) videoBtn.onclick = toggleVideo;
if (leaveBtn) leaveBtn.onclick = leaveCall;

function createPeerConnection(peerId) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
    pc.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('call-signal', { roomKey: callRoomKey, to: peerId, from: socket.id, data: { candidate: event.candidate } });
        }
    };
    pc.ontrack = event => {
        addVideoStream(peerId, event.streams[0]);
    };
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            removeVideoStream(peerId);
        }
    };
    return pc;
}

socket.on('call-started', ({ initiator, callType: type, roomKey }) => {
    if (!inCall) {
        callType = type;
        callRoomKey = roomKey;
        inCall = true;
        showCallModal();
        navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true })
            .then(stream => {
                localStream = stream;
                addVideoStream(socket.id, localStream, true);
                socket.emit('join-call', { roomKey });
            })
            .catch(err => {
                alert('Could not access camera/microphone: ' + err.message);
                leaveCall();
            });
    }
});

socket.on('call-participants', (participants) => {
    if (!inCall) return;
    Object.keys(peers).forEach(peerId => {
        if (!participants.includes(peerId)) {
            peers[peerId].close();
            removeVideoStream(peerId);
            delete peers[peerId];
        }
    });
    participants.forEach(peerId => {
        if (peerId !== socket.id && !peers[peerId]) {
            const pc = createPeerConnection(peerId);
            peers[peerId] = pc;
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                socket.emit('call-signal', { roomKey: callRoomKey, to: peerId, from: socket.id, data: { sdp: offer } });
            });
        }
    });
});

socket.on('call-signal', async ({ from, data }) => {
    if (!inCall) return;
    let pc = peers[from];
    if (!pc) {
        pc = createPeerConnection(from);
        peers[from] = pc;
    }
    if (data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('call-signal', { roomKey: callRoomKey, to: from, from: socket.id, data: { sdp: answer } });
        }
    } else if (data.candidate) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {}
    }
});

socket.on('call-ended', ({ roomKey }) => {
    if (inCall && callRoomKey === roomKey) {
        leaveCall();
    }
});

// --- Minimize/Restore Call Logic ---
const minimizeCallBtn = document.getElementById('minimize-call-btn');
const miniCallWindow = document.getElementById('mini-call-window');
const miniCallVideoGrid = document.getElementById('mini-call-video-grid');
const restoreCallBtn = document.getElementById('restore-call-btn');
const miniMuteBtn = document.getElementById('mini-mute-btn');
const miniMicIconOn = document.getElementById('mini-mic-icon-on');
const miniMicIconOff = document.getElementById('mini-mic-icon-off');
const miniLeaveBtn = document.getElementById('mini-leave-btn');

if (minimizeCallBtn) minimizeCallBtn.onclick = () => {
    document.getElementById('call-modal').style.display = 'none';
    miniCallWindow.style.display = 'flex';
    // Move video elements to mini window
    while (callVideoGrid.firstChild) {
        miniCallVideoGrid.appendChild(callVideoGrid.firstChild);
    }
};
if (restoreCallBtn) restoreCallBtn.onclick = () => {
    miniCallWindow.style.display = 'none';
    document.getElementById('call-modal').style.display = 'flex';
    // Move video elements back to modal
    while (miniCallVideoGrid.firstChild) {
        callVideoGrid.appendChild(miniCallVideoGrid.firstChild);
    }
};
if (miniMuteBtn) miniMuteBtn.onclick = () => {
    toggleMute();
    // Sync icon state
    if (localStream && localStream.getAudioTracks()[0].enabled) {
        miniMicIconOn.style.display = 'none';
        miniMicIconOff.style.display = '';
    } else {
        miniMicIconOn.style.display = '';
        miniMicIconOff.style.display = 'none';
    }
};
if (miniLeaveBtn) miniLeaveBtn.onclick = () => {
    leaveCall();
    miniCallWindow.style.display = 'none';
};

// --- Incoming Call Modal Logic ---
const incomingCallModal = document.getElementById('incoming-call-modal');
const incomingCallUsername = document.getElementById('incoming-call-username');
const incomingCallType = document.getElementById('incoming-call-type');
const incomingCallAvatar = document.getElementById('incoming-call-avatar');
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');
let pendingCall = null;

// Listen for incoming call
socket.on('incoming-call', ({ from, username, callType, roomKey }) => {
    if (inCall) {
        socket.emit('call-response', { to: from, accepted: false, roomKey });
        return;
    }
    pendingCall = { from, username, callType, roomKey };
    incomingCallUsername.textContent = username;
    incomingCallType.textContent = callType === 'video' ? 'Video Call' : 'Audio Call';
    incomingCallAvatar.textContent = username ? username[0].toUpperCase() : '?';
    incomingCallModal.style.display = 'flex';
});

if (acceptCallBtn) acceptCallBtn.onclick = () => {
    if (!pendingCall) return;
    incomingCallModal.style.display = 'none';
    socket.emit('call-response', { to: pendingCall.from, accepted: true, callType: pendingCall.callType, roomKey: pendingCall.roomKey });
    // Do NOT call startCall here. Wait for call-started event.
    pendingCall = null;
};
if (rejectCallBtn) rejectCallBtn.onclick = () => {
    if (!pendingCall) return;
    incomingCallModal.style.display = 'none';
    socket.emit('call-response', { to: pendingCall.from, accepted: false, roomKey: pendingCall.roomKey });
    pendingCall = null;
};
// Listen for call response if you are the caller
socket.on('call-response', ({ from, accepted }) => {
    if (!accepted) {
        showNotification(`${from} rejected your call`, 'error');
        leaveCall();
    }
});