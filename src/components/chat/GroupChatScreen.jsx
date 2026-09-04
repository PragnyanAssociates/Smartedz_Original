"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom"; 
import { useAuth } from "../../context/AuthContext.jsx";
import { usePermissions } from "../../Screens/PermissionsContext"; 
import { MdArrowBack } from 'react-icons/md';
import apiClient from "../../api/client";
import { SERVER_URL } from "../../apiConfig";
import { io } from "socket.io-client";
import { 
  Edit3, X, Send, Check, Smile, Paperclip, Reply, Trash2, AlertCircle, FileText, File, Archive, Image as ImageIcon, MoreVertical, Settings, Loader2, CheckCheck, Shield, Megaphone, Pin, RotateCcw, Clock3
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { getProfileImageSource } from "../../utils/imageHelpers";
import { v4 as uuidv4 } from 'uuid';

const THEME = { myMessageBg: "bg-primary/10 ring-1 ring-primary/20 shadow-sm", otherMessageBg: "bg-white ring-1 ring-black/5 shadow-sm" };
const MESSAGES_PER_PAGE = 20; 

// =====================================================================
//  Upload settings
//  Keep MAX_FILE_BYTES in step with MAX_CHAT_UPLOAD_BYTES on the server.
//
//  Files are POSTed to /groups/media, which saves the message and
//  broadcasts it. They are NEVER pushed through the socket - Socket.IO's
//  default frame limit is 1 MB, so a base64 file was being dropped in
//  flight, which is what left uploads spinning at 100%.
// =====================================================================
const MAX_FILE_BYTES   = 10 * 1024 * 1024;   // 10 MB
const UPLOAD_TIMEOUT   = 5 * 60 * 1000;      // 5 minutes for a slow line
const IMAGE_MAX_DIM    = 1600;               // downscale long edge before sending
const IMAGE_QUALITY    = 0.82;
const IMAGE_SKIP_BELOW = 400 * 1024;         // already small - send as-is

const getLocalISOString = () => new Date().toISOString();

const formatDateSeparator = (dateString) => {
  const messageDate = new Date(dateString);
  const today = new Date(); const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  messageDate.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0); yesterday.setHours(0, 0, 0, 0);
  if (messageDate.getTime() === today.getTime()) return 'Today';
  if (messageDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return messageDate.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (fileName) => {
  const extension = fileName?.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf': return { icon: FileText, color: 'text-red-500' };
    case 'doc': case 'docx': return { icon: FileText, color: 'text-blue-600' };
    case 'xls': case 'xlsx': return { icon: FileText, color: 'text-emerald-600' };
    case 'ppt': case 'pptx': return { icon: FileText, color: 'text-orange-500' };
    case 'zip': case 'rar': return { icon: Archive, color: 'text-amber-500' };
    default: return { icon: File, color: 'text-zinc-500' };
  }
};

// Shrink photos before upload the way WhatsApp does. A 4 MB camera shot
// becomes a few hundred KB, so the upload finishes in a fraction of the
// time. GIFs and already-small images are left untouched.
const compressImage = (file) => new Promise((resolve) => {
  if (!file.type?.startsWith('image/') || file.type === 'image/gif') return resolve(file);
  if (file.size <= IMAGE_SKIP_BELOW) return resolve(file);

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    try {
      const longEdge = Math.max(img.width, img.height);
      const scale = Math.min(1, IMAGE_MAX_DIM / (longEdge || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) return resolve(file);
        const name = (file.name || 'photo').replace(/\.(png|webp|bmp|heic|heif|tiff?)$/i, '.jpg');
        resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
      }, 'image/jpeg', IMAGE_QUALITY);
    } catch (_) { resolve(file); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  img.src = url;
});

const readAsDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read this file.'));
  reader.readAsDataURL(file);
});

// Circular progress used on photo/video bubbles while they upload.
const ProgressRing = ({ value = 0 }) => {
  const r = 18;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <svg className="size-12 -rotate-90" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} stroke="rgba(255,255,255,0.35)" strokeWidth="3" fill="none" />
      <circle cx="22" cy="22" r={r} stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
        style={{ transition: 'stroke-dashoffset 0.2s linear' }} />
    </svg>
  );
};

const GroupChatScreen = ({ providedGroup, onBack, isEmbedded = false, onOpenSettings }) => {
  const { user } = useAuth();
  const navigate = useNavigate(); 
  
  const { can, isAllAccess } = usePermissions();
  const canEdit = can('GroupChat', 'edit');
  const canDelete = can('GroupChat', 'delete');
  
  const [group, setGroup] = useState(providedGroup || {});
  const [messages, setMessages] = useState([]);
  const [lastSeenTime, setLastSeenTime] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isAttachmentModalVisible, setAttachmentModalVisible] = useState(false);
  const [videoErrors, setVideoErrors] = useState({});
  const [isGroupMenuVisible, setGroupMenuVisible] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const initialLoadDone = useRef(false);
  
  const prevScrollHeightRef = useRef(0);
  const isPaginationLoadRef = useRef(false);

  // Live uploads: the original File is kept so Retry can resend without
  // asking the user to pick it again, and the AbortController lets Cancel
  // stop a transfer mid-flight.
  const pendingUploadsRef = useRef(new Map());     // clientMessageId -> { file, type, replyId }
  const uploadControllersRef = useRef(new Map());  // clientMessageId -> AbortController

  // --- UPDATED PERMISSIONS LOGIC ---
  const isSystemAdmin = user?.role === 'Super Admin' || user?.role === 'Developer';
  const isCreator = Boolean(user?.id && group?.created_by && String(user?.id) === String(group?.created_by));
  const hasEditRights = isAllAccess || isSystemAdmin || isCreator;
  const hasGlobalDelete = isAllAccess || canDelete || isSystemAdmin;
  const isReadOnlyMode = group?.is_read_only == 1;
  const canSendMessages = !isReadOnlyMode || hasEditRights;
  // ---------------------------------

  useEffect(() => {
    if (providedGroup) {
      setGroup({
        ...providedGroup,
        is_read_only: providedGroup.is_read_only == 1, // normalize here too
      });
      setMessages([]);
      setNewMessage("");
      setReplyingTo(null);
      setEditingMessage(null);
      setPage(1);
      setHasMore(true);
      initialLoadDone.current = false;
      // Switching groups abandons any transfer still in flight.
      uploadControllersRef.current.forEach(c => { try { c.abort(); } catch (_) {} });
      uploadControllersRef.current.clear();
      pendingUploadsRef.current.clear();
    }
  }, [providedGroup]);

  // Abort everything still uploading when the screen goes away.
  useEffect(() => () => {
    uploadControllersRef.current.forEach(c => { try { c.abort(); } catch (_) {} });
    uploadControllersRef.current.clear();
    pendingUploadsRef.current.clear();
  }, []);

  const markAsSeen = useCallback(async () => {
    if (!group?.id || !user?.id) return;
    try {
        await apiClient.post(`/groups/${group.id}/seen`, { userId: user.id });
    } catch (error) {}
  }, [group.id, user?.id]);

 // Replace the details useEffect with this:
useEffect(() => {
  if (!group?.id || !user?.id) return;
  const fetchGroupDetails = async () => {
    try {
      const response = await apiClient.get(`/groups/${group.id}/details`, {
        params: { userId: user.id }
      });
      if (response.data) {
        const fetchedDetails = response.data.group || response.data;
        setGroup(prev => ({
          ...prev,
          ...fetchedDetails,
          // Normalize to a real boolean so === checks always work
          is_read_only: fetchedDetails.is_read_only == 1,
        }));
      }
    } catch (error) {}
  };
  fetchGroupDetails();
}, [group.id, user?.id]);

  const fetchHistory = useCallback(async (pageNum = 1) => {
    if (pageNum === 1) setLoading(true);
    else setIsFetchingMore(true);

    try {
      const response = await apiClient.get(`/groups/${group.id}/history`, {
        params: { page: pageNum, limit: MESSAGES_PER_PAGE, userId: user.id }
      });
      
      const fetchedMessages = response.data.messages || response.data || [];
      const fetchedLastSeen = response.data.lastSeen || null;

      if (fetchedMessages.length < MESSAGES_PER_PAGE) { setHasMore(false); }

      setMessages((prevMessages) => {
          // Anything still uploading is local-only - keep it on screen.
          const inFlight = prevMessages.filter(m => m.clientMessageId && !m.id_confirmed && ['preparing', 'uploading', 'processing', 'failed', 'sending'].includes(m.status));
          let allMessages;
          if (pageNum === 1) { allMessages = [...fetchedMessages, ...inFlight]; } 
          else {
              if (messagesContainerRef.current) {
                  prevScrollHeightRef.current = messagesContainerRef.current.scrollHeight;
                  isPaginationLoadRef.current = true;
              }
              allMessages = [...fetchedMessages, ...prevMessages];
          }
          const uniqueMessages = Array.from(new Map(allMessages.map((m) => [m.id || m.clientMessageId, m])).values());
          uniqueMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          return uniqueMessages;
      });

      if (pageNum === 1) { setLastSeenTime(fetchedLastSeen); markAsSeen(); }

   } catch (error) {
      if (error.response && (error.response.status === 404 || error.response.status === 400 || error.response.status === 403)) { if (onBack) onBack(); }
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [group.id, markAsSeen, onBack, user?.id]);

  // Keep the latest fetchHistory / onBack in refs so the socket effect below
  // can stay tied to [group.id] ONLY. Without this, the socket effect's deps
  // (fetchHistory + onBack) change identity on every parent re-render — and
  // the parent re-renders on every 'updateGroupList' event — so the socket
  // kept disconnecting/reconnecting mid-handshake ("WebSocket is closed
  // before the connection is established"). Refs break that churn.
  const fetchHistoryRef = useRef(fetchHistory);
  const onBackRef = useRef(onBack);
  useEffect(() => { fetchHistoryRef.current = fetchHistory; }, [fetchHistory]);
  useEffect(() => { onBackRef.current = onBack; }, [onBack]);

useEffect(() => {
    if (!group?.id) return;

    fetchHistoryRef.current(1);

    // Allow the polling -> websocket upgrade instead of forcing websocket-only.
    // Websocket-only skips the handshake transport and races the connection
    // open/close behind Railway's proxy, which is what produced the warning.
    const socket = io(SERVER_URL, { transports: ["polling", "websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => { 
        socket.emit("joinGroup", { groupId: group.id }); 
    });
    
    socket.on("groupDeleted", (deletedGroupId) => { 
        if (deletedGroupId === group.id || parseInt(deletedGroupId) === parseInt(group.id)) { 
            if (onBackRef.current) onBackRef.current(); 
        } 
    });

    socket.on("newMessage", (msg) => {
        if (String(msg.group_id) !== String(group.id)) return;
        setMessages(prev => {
            // Swap the optimistic bubble for the saved row...
            if (msg.clientMessageId) {
                const idx = prev.findIndex(m => m.clientMessageId && m.clientMessageId === msg.clientMessageId);
                if (idx !== -1) {
                    const next = [...prev];
                    next[idx] = { ...msg, status: undefined, progress: undefined, id_confirmed: true };
                    return next;
                }
            }
            // ...and never show the same row twice if the HTTP response and
            // the broadcast both land.
            if (prev.some(m => m.id && String(m.id) === String(msg.id))) return prev;
            return [...prev, { ...msg, id_confirmed: true }];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    socket.on("messageDeleted", ({ messageId, deletedBy }) => {
        setMessages((prev) => prev.map((msg) => msg.id === messageId ? { 
            ...msg, is_deleted: true, deleted_by: deletedBy, 
            message_text: null, file_url: null, file_name: null, file_size: null 
        } : msg));
    });
    
    socket.on("messageEdited", (msg) => { 
        if (String(msg.group_id) === String(group.id)) setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m))); 
    });

    socket.on("messageError", ({ message, clientMessageId }) => {
        if (clientMessageId) {
            setMessages(prev => prev.filter(m => m.clientMessageId !== clientMessageId));
        }
        alert(message || 'You cannot send messages in this group.');
    });

   return () => { 
    socket.off('messageError');
    socket.disconnect(); 
};
}, [group.id]);

  const handleScroll = (e) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop === 0 && hasMore && !loading && !isFetchingMore) {
        const nextPage = page + 1; setPage(nextPage); fetchHistory(nextPage);
    }
  };

  const processedData = useMemo(() => {
    if (messages.length === 0) return [];
    const processed = [];
    let lastDate = ''; let unreadBannerAdded = false;
    messages.forEach(message => {
      const messageDate = new Date(message.timestamp).toLocaleDateString();
      if (messageDate !== lastDate) { processed.push({ type: 'date', id: `date-${messageDate}`, date: formatDateSeparator(message.timestamp) }); lastDate = messageDate; }
      if (!unreadBannerAdded && lastSeenTime && message.user_id !== user?.id) {
         if (new Date(message.timestamp).getTime() > new Date(lastSeenTime).getTime()) { processed.push({ type: 'unread_banner', id: 'unread-banner' }); unreadBannerAdded = true; }
      }
      processed.push({ ...message, type: 'message' });
    });
    return processed;
  }, [messages, lastSeenTime, user?.id]);

  // How many transfers are running right now (shown above the composer).
  const activeUploads = useMemo(
    () => messages.filter(m => ['preparing', 'uploading', 'processing'].includes(m.status)).length,
    [messages]
  );

  useEffect(() => {
    if (loading) return;
    if (isPaginationLoadRef.current && messagesContainerRef.current) {
        const newScrollHeight = messagesContainerRef.current.scrollHeight;
        const diff = newScrollHeight - prevScrollHeightRef.current;
        messagesContainerRef.current.scrollTop = diff;
        isPaginationLoadRef.current = false;
    } else if (!initialLoadDone.current && processedData.length > 0) {
        setTimeout(() => {
            const bannerElement = document.getElementById('unread-banner');
            if (bannerElement) bannerElement.scrollIntoView({ behavior: 'auto', block: 'center' });
            else messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 150);
        initialLoadDone.current = true;
    }
  }, [messages, loading, processedData]);

  // Patch one optimistic bubble in place.
  const patchMessage = useCallback((clientMessageId, changes) => {
    setMessages(prev => prev.map(m => m.clientMessageId === clientMessageId ? { ...m, ...changes } : m));
  }, []);

  const removeMessage = useCallback((clientMessageId) => {
    setMessages(prev => prev.filter(m => m.clientMessageId !== clientMessageId));
  }, []);

  // ---- TEXT messages still go over the socket (small + instant) -------
  const sendTextMessage = (text) => {
    if (!user || !socketRef.current || !canSendMessages) return;
    const tempId = uuidv4();
    const replySnapshot = replyingTo;

    setMessages(prev => [...prev, {
        id: tempId, clientMessageId: tempId, user_id: user.id, full_name: user.fullName,
        profile_image_url: user.profileImageUrl, group_id: group.id, message_type: 'text',
        file_url: null, file_name: null, file_size: null, message_text: text, timestamp: getLocalISOString(),
        status: 'sending', reply_to_message_id: replySnapshot ? replySnapshot.id : null,
        reply_sender_name: replySnapshot ? replySnapshot.full_name : null,
        reply_text: replySnapshot ? (replySnapshot.message_type === 'text' ? replySnapshot.message_text : 'Media') : null,
        reply_type: replySnapshot ? replySnapshot.message_type : null
    }]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    socketRef.current.emit('sendMessage', {
        userId: user.id, groupId: group.id, messageType: 'text', messageText: text,
        fileUrl: null, fileName: null, fileSize: null, fileMimeType: null,
        replyToMessageId: replySnapshot ? replySnapshot.id : null, clientMessageId: tempId
    });

    setNewMessage('');
    setReplyingTo(null);
  };

  // ---- FILE uploads go over HTTP, with live progress ------------------
  const startUpload = useCallback(async (clientMessageId) => {
    const job = pendingUploadsRef.current.get(clientMessageId);
    if (!job) return;

    const controller = new AbortController();
    uploadControllersRef.current.set(clientMessageId, controller);
    patchMessage(clientMessageId, { status: 'preparing', progress: 0, error: null });

    try {
      // Compress photos first - this is most of the speed win.
      const prepared = job.type === 'image' ? await compressImage(job.file) : job.file;
      if (controller.signal.aborted) return;

      if (prepared.size > MAX_FILE_BYTES) {
        patchMessage(clientMessageId, { status: 'failed', error: `This file is ${formatFileSize(prepared.size)}. The limit is ${formatFileSize(MAX_FILE_BYTES)}.` });
        uploadControllersRef.current.delete(clientMessageId);
        return;
      }

      const dataUrl = await readAsDataURL(prepared);
      if (controller.signal.aborted) return;

      patchMessage(clientMessageId, {
        status: 'uploading', progress: 0,
        file_name: prepared.name, file_size: prepared.size
      });

      const res = await apiClient.post('/groups/media', {
        groupId: group.id,
        messageType: job.type,
        media: dataUrl,
        fileName: prepared.name,
        fileSize: prepared.size,
        fileMimeType: prepared.type,
        replyToMessageId: job.replyId || null,
        clientMessageId
      }, {
        signal: controller.signal,
        timeout: UPLOAD_TIMEOUT,
        onUploadProgress: (pe) => {
          if (!pe.total) return;
          const pct = Math.round((pe.loaded * 100) / pe.total);
          // Hold at 99 until the server actually confirms, then flip to
          // "Sending..." - so 100% never sits there meaning nothing.
          if (pct >= 100) patchMessage(clientMessageId, { status: 'processing', progress: 100 });
          else patchMessage(clientMessageId, { status: 'uploading', progress: pct });
        }
      });

      const saved = res?.data?.message;
      if (saved) {
        setMessages(prev => {
          // The socket broadcast may have beaten the HTTP response here.
          if (prev.some(m => m.id && String(m.id) === String(saved.id))) {
            return prev.filter(m => m.clientMessageId !== clientMessageId || (m.id && String(m.id) === String(saved.id)));
          }
          return prev.map(m => m.clientMessageId === clientMessageId
            ? { ...saved, clientMessageId, status: undefined, progress: undefined, id_confirmed: true }
            : m);
        });
      } else {
        patchMessage(clientMessageId, { status: undefined, progress: undefined });
      }

      pendingUploadsRef.current.delete(clientMessageId);
      uploadControllersRef.current.delete(clientMessageId);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);

    } catch (error) {
      uploadControllersRef.current.delete(clientMessageId);
      const cancelled = error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED' || controller.signal.aborted;
      if (cancelled) { removeMessage(clientMessageId); pendingUploadsRef.current.delete(clientMessageId); return; }

      const status = error?.response?.status;
      const message =
        status === 413 ? `Too large to send. The limit is ${formatFileSize(MAX_FILE_BYTES)}.`
        : status === 403 ? (error?.response?.data?.message || 'You cannot send files in this group.')
        : error?.code === 'ECONNABORTED' ? 'Upload timed out. Check your connection and retry.'
        : (error?.response?.data?.message || 'Upload failed. Tap to retry.');
      patchMessage(clientMessageId, { status: 'failed', error: message });
    }
  }, [group.id, patchMessage, removeMessage]);

  const queueUpload = (file, type) => {
    if (!user || !canSendMessages) return;

    // Hard stop above the cap, with the real numbers in the message.
    if (file.size > MAX_FILE_BYTES) {
      alert(`"${file.name}" is ${formatFileSize(file.size)}.\nThe maximum is ${formatFileSize(MAX_FILE_BYTES)}, so it can't be sent.`);
      return;
    }

    const clientMessageId = uuidv4();
    const replySnapshot = replyingTo;
    pendingUploadsRef.current.set(clientMessageId, {
      file, type, replyId: replySnapshot ? replySnapshot.id : null
    });

    setMessages(prev => [...prev, {
      id: clientMessageId, clientMessageId, user_id: user.id, full_name: user.fullName,
      profile_image_url: user.profileImageUrl, group_id: group.id, message_type: type,
      file_url: null, localUri: URL.createObjectURL(file), file_name: file.name,
      file_size: file.size, message_text: null, timestamp: getLocalISOString(),
      status: 'preparing', progress: 0,
      reply_to_message_id: replySnapshot ? replySnapshot.id : null,
      reply_sender_name: replySnapshot ? replySnapshot.full_name : null,
      reply_text: replySnapshot ? (replySnapshot.message_type === 'text' ? replySnapshot.message_text : 'Media') : null,
      reply_type: replySnapshot ? replySnapshot.message_type : null
    }]);
    setReplyingTo(null);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    startUpload(clientMessageId);
  };

  const cancelUpload = (clientMessageId) => {
    const controller = uploadControllersRef.current.get(clientMessageId);
    if (controller) { try { controller.abort(); } catch (_) {} }
    uploadControllersRef.current.delete(clientMessageId);
    pendingUploadsRef.current.delete(clientMessageId);
    removeMessage(clientMessageId);
  };

  const retryUpload = (clientMessageId) => {
    if (!pendingUploadsRef.current.has(clientMessageId)) { removeMessage(clientMessageId); return; }
    startUpload(clientMessageId);
  };

  // Multiple files at once, like WhatsApp's picker.
  const handlePickImageVideo = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => queueUpload(file, file.type.startsWith('video') ? 'video' : 'image'));
    e.target.value = "";
    setAttachmentModalVisible(false);
  };
  const handlePickDocument = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => queueUpload(file, 'file'));
    e.target.value = "";
    setAttachmentModalVisible(false);
  };

  const handleSend = () => {
    if (!newMessage.trim() || !canSendMessages) return;
    if (editingMessage) {
      socketRef.current?.emit("editMessage", { messageId: editingMessage.id, newText: newMessage.trim(), userId: user?.id, groupId: group.id });
      setEditingMessage(null);
      setNewMessage("");
      return;
    }
    sendTextMessage(newMessage.trim());
  };

  const handleKeyPress = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  
  const onLongPressMessage = (e, message) => { 
    e.preventDefault();
    e.stopPropagation();
    if (!user || ['preparing', 'uploading', 'processing', 'failed'].includes(message.status) || message.is_deleted) return; 

    let clickX = e.clientX || (e.touches && e.touches[0].clientX);
    let clickY = e.clientY || (e.touches && e.touches[0].clientY);

    if (!clickX || !clickY) {
        const rect = e.currentTarget.getBoundingClientRect();
        clickX = rect.left + (rect.width / 2);
        clickY = rect.top + (rect.height / 2);
    }

    const menuWidth = 200;
    const menuHeight = 180;
    let left = clickX;
    let top = clickY;

    if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 16;
    }
    if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 16;
    }

    setMenuPosition({ top, left });
    setSelectedMessage(message); 
    setOptionsModalVisible(true); 
  };
  
  const handleDeleteMessage = (messageId) => { socketRef.current?.emit("deleteMessage", { messageId, userId: user?.id, groupId: group.id }); };

  const downloadAndOpenFile = async (fileUrl, fileName, action) => {
    if (!fileUrl) return alert("No file available.");
    
    const isBase64 = fileUrl.startsWith('data:');
    const fullUrl = isBase64 ? fileUrl : SERVER_URL + fileUrl;
    
    try {
      setOptionsModalVisible(false);
      
      if (action === 'view') {
        const ext = fileName?.split('.').pop()?.toLowerCase();
        const officeExts = ['xls', 'xlsx', 'doc', 'docx', 'ppt', 'pptx'];

        if (['pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            if (isBase64) {
                const win = window.open();
                if(win) win.document.write(`<iframe src="${fullUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                return;
            }
            window.open(fullUrl, '_blank');
            return;
        } else if (!isBase64 && officeExts.includes(ext)) {
          const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
          window.open(googleViewerUrl, '_blank');
          return;
        } else {
          action = 'download'; 
        }
      }

      if (action === 'download') {
        const res = await fetch(fullUrl);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName || `download-${Date.now()}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) { 
      alert("Error downloading file."); 
    }
  };

  const cancelReply = () => setReplyingTo(null); const cancelEdit = () => { setEditingMessage(null); setNewMessage(""); };

  const renderMessageItem = (item) => {
    if (item.type === 'date') return <div key={item.id} className="flex justify-center my-4"><div className="bg-white ring-1 ring-black/5 px-3 py-1 rounded-md shadow-sm"><span className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">{item.date}</span></div></div>;
    
    if (item.type === 'unread_banner') return (
        <div key={item.id} id="unread-banner" className="flex justify-center my-4 w-full">
            <div className="bg-primary/10 px-3 py-1 rounded-full shadow-sm flex justify-center border border-primary/20">
                <span className="text-[11px] text-primary font-semibold uppercase tracking-wider">Unread Messages</span>
            </div>
        </div>
    );

    const isMyMessage = item.user_id === user?.id;
    const isImageOrVideo = ['image', 'video'].includes(item.message_type) && !item.is_deleted;
    const isFile = item.message_type === 'file' && !item.is_deleted;
    const messageTime = new Date(item.timestamp).toLocaleTimeString('en-US', { hour: "numeric", minute: "2-digit", hour12: true });

    const busy = ['preparing', 'uploading', 'processing'].includes(item.status);
    const failed = item.status === 'failed';
    const statusLabel =
      item.status === 'preparing' ? 'Preparing...'
      : item.status === 'uploading' ? `${item.progress || 0}%`
      : item.status === 'processing' ? 'Sending...'
      : '';

    const renderContent = () => {
      if (item.is_deleted) {
          const removedByMe = item.deleted_by === user?.id;
          return (
              <div className="text-xs italic text-zinc-400 p-2 flex items-center gap-1.5">
                  <Shield className="size-3.5 text-zinc-300" />
                  {removedByMe ? "You deleted this message" : "Removed by Moderator"}
              </div>
          );
      }

      const isBase64 = item.file_url && item.file_url.startsWith('data:');
      const sourceUri = item.localUri || (item.file_url ? (isBase64 ? item.file_url : SERVER_URL + item.file_url) : null);
      
      if (!sourceUri && (isImageOrVideo || isFile)) return <div className="flex items-center gap-2 p-3 text-red-600 bg-red-50 rounded-md"><AlertCircle className="size-4" /><span className="text-sm">Media not available</span></div>;
      
      // Live upload overlay: ring + percentage + cancel, or retry on failure.
      const renderUploadOverlay = () => {
        if (!busy && !failed) return null;
        return (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-lg gap-1 px-3 text-center">
            {busy && (
              <>
                <div className="relative flex items-center justify-center">
                  <ProgressRing value={item.status === 'uploading' ? (item.progress || 0) : (item.status === 'processing' ? 100 : 8)} />
                  <button onClick={(e) => { e.stopPropagation(); cancelUpload(item.clientMessageId); }}
                    className="absolute inset-0 flex items-center justify-center text-white hover:scale-110 transition-transform" title="Cancel upload">
                    <X className="size-4" />
                  </button>
                </div>
                <span className="text-white text-xs font-semibold tabular-nums">{statusLabel}</span>
              </>
            )}
            {failed && (
              <>
                <AlertCircle className="size-7 text-white" />
                <span className="text-white text-[11px] font-medium leading-snug">{item.error || 'Upload failed'}</span>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={(e) => { e.stopPropagation(); retryUpload(item.clientMessageId); }}
                    className="inline-flex items-center gap-1 bg-white/90 hover:bg-white text-zinc-800 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors">
                    <RotateCcw className="size-3" /> Retry
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); cancelUpload(item.clientMessageId); }}
                    className="text-white/80 hover:text-white text-[11px] font-semibold px-2 py-1">
                    Discard
                  </button>
                </div>
              </>
            )}
          </div>
        );
      };

      if (item.message_type === 'image') return <div className="relative cursor-pointer" onClick={(e) => { if (busy || failed) return; e.stopPropagation(); setFullScreenImage(sourceUri); }}><img src={sourceUri} className="w-64 h-64 rounded-md object-cover" alt="Shared" />{renderUploadOverlay()}</div>;
      if (item.message_type === 'video') return <div className="relative"><video src={sourceUri} className="w-64 h-64 rounded-md object-cover" controls={!busy && !failed} muted playsInline onError={(e) => setVideoErrors(prev => ({ ...prev, [item.id]: true }))} />{renderUploadOverlay()}</div>;
      if (item.message_type === 'file') {
        const iconInfo = getFileIcon(item.file_name); const IconComponent = iconInfo.icon;
        return (
           <div className={`rounded-md p-3 w-64 overflow-hidden flex flex-col gap-2 ${isMyMessage ? 'bg-white/60' : 'bg-zinc-50'}`}>
               <div className="flex items-center gap-3">
                   <IconComponent className={`size-8 shrink-0 ${iconInfo.color}`} />
                   <div className="flex-1 min-w-0">
                       <div className="text-sm font-semibold text-zinc-900 truncate">{item.file_name}</div>
                       <div className="text-[11px] font-medium text-zinc-500 mt-0.5">{formatFileSize(item.file_size)}</div>
                   </div>
               </div>

               {/* Live progress bar for documents */}
               {busy && (
                 <div className="space-y-1.5">
                   <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                     <div className="h-full bg-primary rounded-full transition-[width] duration-200"
                       style={{ width: `${item.status === 'preparing' ? 8 : (item.progress || 0)}%` }} />
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-semibold text-zinc-500 tabular-nums">{statusLabel}</span>
                     <button onClick={(e) => { e.stopPropagation(); cancelUpload(item.clientMessageId); }}
                       className="text-[10px] font-semibold text-zinc-500 hover:text-red-600 transition-colors">Cancel</button>
                   </div>
                 </div>
               )}

               {failed && (
                 <div className="space-y-1.5">
                   <p className="text-[10px] font-semibold text-red-600 leading-snug">{item.error || 'Upload failed'}</p>
                   <div className="flex items-center gap-3">
                     <button onClick={(e) => { e.stopPropagation(); retryUpload(item.clientMessageId); }}
                       className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                       <RotateCcw className="size-3" /> Retry
                     </button>
                     <button onClick={(e) => { e.stopPropagation(); cancelUpload(item.clientMessageId); }}
                       className="text-[11px] font-semibold text-zinc-500 hover:text-red-600 transition-colors">Discard</button>
                   </div>
                 </div>
               )}

               {!busy && !failed && (
                   <div className="flex gap-4 border-t border-zinc-200/60 pt-2 mt-1">
                       <button onClick={(e) => {e.stopPropagation(); downloadAndOpenFile(item.file_url, item.file_name, 'view');}} className="text-xs text-primary font-semibold hover:underline">View</button>
                       <button onClick={(e) => {e.stopPropagation(); downloadAndOpenFile(item.file_url, item.file_name, 'download');}} className="text-xs text-primary font-semibold hover:underline">Download</button>
                   </div>
               )}
           </div>
        );
      }
      return <span className="text-sm text-zinc-800 break-words whitespace-pre-wrap leading-relaxed">{item.message_text}</span>;
    };

    const key = item.clientMessageId || (item.id ? item.id.toString() : undefined);
    return (
      <div key={key} className={`flex flex-row my-1 px-4 sm:px-6 items-start ${isMyMessage ? "justify-end" : "justify-start"}`}>
        {!isMyMessage && <img src={getProfileImageSource(item.profile_image_url)} alt="User" className="size-8 rounded-full mr-2.5 mt-0.5 bg-zinc-200 flex-shrink-0 object-cover" />}
        
<div className={`relative max-w-[85%] sm:max-w-[65%] cursor-pointer ${isMyMessage ? (isImageOrVideo ? "bg-white rounded-lg shadow-sm ring-1 ring-black/5" : `${THEME.myMessageBg} rounded-lg rounded-tr-none p-2.5`) : (isImageOrVideo ? "bg-white rounded-lg shadow-sm ring-1 ring-black/5" : `${THEME.otherMessageBg} rounded-lg rounded-tl-none p-2.5`)} ${item.is_deleted ? 'bg-zinc-50 border border-zinc-200 shadow-none' : ''}`}
          onContextMenu={(e) => onLongPressMessage(e, item)} 
          onClick={(e) => onLongPressMessage(e, item)}
        >
          
          {!!item.is_pinned && !item.is_deleted && <div className="absolute -top-2 -right-2 bg-amber-100 text-amber-600 rounded-full p-1 shadow-sm border border-amber-200"><Pin className="size-3" /></div>}
          
        {!isMyMessage && !item.is_deleted && <div className={`text-[11px] font-semibold text-zinc-500 mb-1 ${isImageOrVideo || isFile ? 'px-2 pt-1.5' : ''}`}>{item.full_name}</div>}
          {!!item.reply_to_message_id && !isImageOrVideo && !item.is_deleted && <div className="mb-2 p-2 rounded-md border-l-4 bg-black/5 border-primary"><div className="text-[11px] font-semibold text-primary mb-0.5">{item.reply_sender_name}</div><div className="text-xs text-zinc-600 truncate">{item.reply_type === 'text' ? item.reply_text : 'Media'}</div></div>}
          
          {renderContent()}
          
          <div className={`${(isImageOrVideo) ? 'absolute bottom-2 right-2 bg-black/50 text-white px-1.5 rounded-full backdrop-blur-sm' : 'float-right ml-3 mt-1.5'} flex items-center gap-1 text-[10px] font-medium ${(isImageOrVideo) ? 'text-white' : 'text-zinc-400'}`}>
              {!!item.is_edited && !item.is_deleted && <span>Edited</span>}
              <span>{messageTime}</span>
              {isMyMessage && !item.is_deleted && (
                busy ? <Clock3 className="size-3.5 inline-block opacity-70" />
                : item.status === 'sending' ? <Clock3 className="size-3.5 inline-block opacity-70" />
                : failed ? <AlertCircle className="size-3.5 inline-block text-red-500" />
                : <span className={isImageOrVideo ? "text-white" : "text-primary"}><CheckCheck className="size-3.5 inline-block" /></span>
              )}
          </div>
        </div>
      </div>
    );
  };

  const renderOptionsModal = () => {
    if (!selectedMessage) return null;
    const isMyMessage = selectedMessage.user_id === user?.id;
    const canDeleteThisMessage = isMyMessage || hasGlobalDelete;

    return createPortal(
      <div 
        className={`fixed inset-0 z-[100] ${isOptionsModalVisible ? '' : 'hidden'}`} 
        onClick={() => setOptionsModalVisible(false)}
      >
        <div 
          className="absolute bg-white rounded-lg py-1 w-48 shadow-xl ring-1 ring-black/5 animate-in zoom-in-95 duration-200"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {canSendMessages && <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors" onClick={() => { setReplyingTo(selectedMessage); setOptionsModalVisible(false); }}><Reply className="size-4 text-zinc-500" /><span className="text-sm font-medium text-zinc-700">Reply</span></button>}
          {isMyMessage && selectedMessage.message_type === 'text' && <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors" onClick={() => { setEditingMessage(selectedMessage); setNewMessage(selectedMessage.message_text); setOptionsModalVisible(false); }}><Edit3 className="size-4 text-zinc-500" /><span className="text-sm font-medium text-zinc-700">Edit</span></button>}
          {canDeleteThisMessage && <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors" onClick={() => { if (window.confirm('Delete message?')) { handleDeleteMessage(selectedMessage.id); setOptionsModalVisible(false); } }}><Trash2 className="size-4 text-red-500" /><span className="text-sm font-medium text-red-600">Delete</span></button>}
          <div className="h-px bg-zinc-100 my-1"></div>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors" onClick={() => setOptionsModalVisible(false)}><X className="size-4 text-zinc-500" /><span className="text-sm font-medium text-zinc-700">Cancel</span></button>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50">
      
      {fullScreenImage && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setFullScreenImage(null)}>
          <button className="absolute top-6 right-6 p-2 text-white/70 hover:text-white transition-colors bg-white/10 rounded-full" onClick={(e) => { e.stopPropagation(); setFullScreenImage(null); }}>
            <X className="size-6" />
          </button>
          <img src={fullScreenImage} className="max-w-full max-h-full object-contain p-4" alt="Full screen view" onClick={(e) => e.stopPropagation()} />
        </div>,
        document.body
      )}

      {renderOptionsModal()} 
      
      {/* Header */}
      <div className="h-16 bg-white border-b border-zinc-200 px-4 flex items-center justify-between flex-shrink-0 z-30">
        {isEmbedded && onBack && <button onClick={onBack} className="md:hidden mr-3 p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 transition-colors"><MdArrowBack className="size-6" /></button>}
        
        {/* Clickable Group Profile Area */}
        <div className="flex items-center flex-1 cursor-pointer" onClick={() => {
             if (isEmbedded && onOpenSettings) { onOpenSettings(); } 
             else { navigate(`/GroupSettingsScreen`, { state: { group } }); }
        }}>
          <img src={getProfileImageSource(group.group_dp_url)} alt="Group" className="size-10 rounded-full mr-3 bg-zinc-100 object-cover ring-1 ring-black/5" />
          <div className="flex flex-col min-w-0 pr-4">
              <span className="font-semibold text-zinc-900 text-sm leading-tight flex items-center gap-1.5 truncate">
                  {group.name} {isReadOnlyMode && <Megaphone className="size-3.5 text-zinc-400 shrink-0" />}
              </span>
              <span className="text-[11px] font-medium text-zinc-500 mt-0.5 truncate">Tap for group info</span>
          </div>
        </div>
        
        {/* Three Dots & Dropdown Menu Container */}
        <div className="relative">
          <button onClick={() => setGroupMenuVisible(!isGroupMenuVisible)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <MoreVertical className="size-5 text-zinc-500" />
          </button>
          
          {isGroupMenuVisible && (
              <>
                  <div className="fixed inset-0 z-40" onClick={() => setGroupMenuVisible(false)}></div>
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-md shadow-lg ring-1 ring-black/5 py-1 w-48 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <button 
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-zinc-50 transition-colors text-left"
                          onClick={() => { 
                              setGroupMenuVisible(false); 
                              if (isEmbedded && onOpenSettings) { onOpenSettings(); } 
                              else { navigate(`/GroupSettingsScreen`, { state: { group } }); } 
                          }}
                      >
                          <Settings className="size-4 text-zinc-500" />
                          <span className="text-zinc-700 font-medium text-sm">Group Settings</span>
                      </button>
                  </div>
              </>
          )}
        </div>
      </div>

      {/* Message List */}
      <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto custom-scrollbar relative bg-zinc-50/50 min-h-0">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundRepeat: 'repeat' }}></div>
        
        {isFetchingMore && <div className="flex justify-center p-3 z-20"><Loader2 className="size-5 animate-spin text-primary" /></div>}

        {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="size-8 animate-spin text-primary" /></div>
        ) : (
            <div className="flex flex-col py-4 relative z-10">
                {processedData.length > 0 ? (
                    processedData.map(renderMessageItem)
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                          <div className="size-24 bg-white ring-1 ring-black/5 rounded-full flex items-center justify-center mb-4 shadow-sm"><Smile className="size-10 text-zinc-300" /></div>
                          <h3 className="text-base font-semibold text-zinc-700">No messages yet</h3>
                          <p className="text-sm font-medium text-zinc-500 max-w-xs mt-2 leading-relaxed">Send a message to start the conversation.</p>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
        )}
      </div>

      {/* Input Area (Dynamic Notice Board Logic) */}
      {canSendMessages ? (
          <div className="bg-white border-t border-zinc-200 px-4 py-3 flex items-end gap-3 flex-shrink-0 z-20 relative">
            {/* Live transfer banner */}
            {activeUploads > 0 && !replyingTo && !editingMessage && (
              <div className="absolute bottom-full left-0 right-0 bg-primary/5 px-4 py-2 flex items-center gap-2 border-t border-primary/10">
                <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                <span className="text-[11px] font-semibold text-primary">
                  Sending {activeUploads} {activeUploads === 1 ? 'file' : 'files'}...
                </span>
              </div>
            )}
            {replyingTo && <div className="absolute bottom-full left-0 right-0 bg-white/95 backdrop-blur-sm p-3 border-l-4 border-primary flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] px-4"><div className="flex-1 min-w-0 pr-4"><div className="text-xs font-semibold text-primary mb-0.5">{replyingTo.full_name}</div><div className="text-sm text-zinc-500 truncate">{replyingTo.message_type === 'text' ? replyingTo.message_text : 'Media'}</div></div><button onClick={cancelReply} className="p-1 hover:bg-zinc-100 rounded-md transition-colors"><X className="size-4 text-zinc-400" /></button></div>}
            {editingMessage && <div className="absolute bottom-full left-0 right-0 bg-primary/5 p-3 border-l-4 border-primary flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] px-4"><span className="text-primary text-sm font-medium">Editing message...</span><button onClick={cancelEdit} className="p-1 hover:bg-primary/10 rounded-md transition-colors"><X className="size-4 text-primary" /></button></div>}
            
            {/* Anchored Emoji Picker Wrapper */}
            <div className="relative flex items-center pb-1 shrink-0">
                <button onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"><Smile className="size-5" /></button>
                {isEmojiPickerOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsEmojiPickerOpen(false)}></div>
                        <div className="absolute bottom-full left-0 mb-4 z-50 shadow-xl ring-1 ring-black/5 rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <EmojiPicker onEmojiClick={(emojiData) => { setNewMessage((prev) => prev + emojiData.emoji); setIsEmojiPickerOpen(false); }} width={300} height={400} />
                        </div>
                    </>
                )}
            </div>

            {/* Anchored Attachment Popup Menu */}
            <div className="relative flex items-center pb-1 shrink-0">
                <button onClick={() => setAttachmentModalVisible(!isAttachmentModalVisible)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"><Paperclip className="size-5" /></button>
                
                {isAttachmentModalVisible && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setAttachmentModalVisible(false)}></div>
                        <div className="absolute bottom-full left-0 mb-4 z-50 bg-white rounded-lg shadow-xl ring-1 ring-black/5 p-4 w-72 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="grid grid-cols-2 gap-3">
                                <button className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-50 rounded-md transition-colors border border-transparent hover:border-zinc-200" onClick={() => { setAttachmentModalVisible(false); document.getElementById('chat-media-upload').click(); }}>
                                    <div className="size-12 bg-purple-100 rounded-full flex items-center justify-center ring-1 ring-purple-200"><ImageIcon className="size-5 text-purple-600" /></div>
                                    <span className="text-xs font-semibold text-zinc-700">Photos & Videos</span>
                                </button>
                                <button className="flex flex-col items-center gap-2 p-3 hover:bg-zinc-50 rounded-md transition-colors border border-transparent hover:border-zinc-200" onClick={() => { setAttachmentModalVisible(false); document.getElementById('chat-document-upload').click(); }}>
                                    <div className="size-12 bg-indigo-100 rounded-full flex items-center justify-center ring-1 ring-indigo-200"><FileText className="size-5 text-indigo-600" /></div>
                                    <span className="text-xs font-semibold text-zinc-700">Document</span>
                                </button>
                            </div>
                            <p className="text-[10px] font-medium text-zinc-400 text-center mt-3">Up to {formatFileSize(MAX_FILE_BYTES)} per file. Photos are compressed automatically.</p>
                        </div>
                    </>
                )}
            </div>

            <div className="flex-1 bg-zinc-50 ring-1 ring-inset ring-zinc-200 focus-within:ring-primary/40 rounded-md flex items-center px-4 py-2 transition-shadow">
                <textarea className="w-full bg-transparent outline-none text-sm text-zinc-900 resize-none max-h-24 min-h-[20px] custom-scrollbar placeholder:text-zinc-400" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Type a message..." rows={1} onFocus={() => setIsEmojiPickerOpen(false)} />
            </div>

            <input type="file" accept="image/*,video/*" multiple className="hidden" id="chat-media-upload" onChange={handlePickImageVideo} />
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt" multiple className="hidden" id="chat-document-upload" onChange={handlePickDocument} />
            
            <div className="pb-1 shrink-0">
                <button className={`p-2 rounded-full transition-colors ${!newMessage.trim() && !editingMessage ? 'text-zinc-400 cursor-not-allowed' : 'text-white bg-primary hover:bg-primary/90 shadow-sm'}`} onClick={handleSend} disabled={!newMessage.trim() && !editingMessage}>
                    {editingMessage ? <Check className="size-5" /> : <Send className="size-5 ml-0.5" />}
                </button>
            </div>
          </div>
      ) : (
          <div className="bg-zinc-50 px-4 py-3 flex items-center justify-center flex-shrink-0 z-10 border-t border-zinc-200">
              <div className="bg-white px-5 py-2.5 rounded-md ring-1 ring-black/5 shadow-sm flex items-center gap-2">
                  <Megaphone className="size-4 text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-600">Only Admins can send messages</span>
              </div>
          </div>
      )}
    </div>
  );
};

export default GroupChatScreen;