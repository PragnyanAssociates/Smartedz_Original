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
  Edit3, X, Send, Check, Smile, Paperclip, Reply, Trash2, AlertCircle, FileText, File, Archive, Image as ImageIcon, MoreVertical, Settings, Loader2, CheckCheck, Shield, Megaphone, Pin
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { getProfileImageSource } from "../../utils/imageHelpers";
import { v4 as uuidv4 } from 'uuid';

const THEME = { myMessageBg: "bg-primary/10 ring-1 ring-primary/20 shadow-sm", otherMessageBg: "bg-white ring-1 ring-black/5 shadow-sm" };
const MESSAGES_PER_PAGE = 20; 

const getLocalISOString = () => {
    const now = new Date(); const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    return new Date(now.getTime() - offsetMs).toISOString().slice(0, 19); 
};

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

  const hasEditRights = isAllAccess || canEdit || (user?.id === group.created_by);
  const hasGlobalDelete = isAllAccess || canDelete;
  const isReadOnlyMode = group.is_read_only === 1 || group.is_read_only === true;
  const canSendMessages = !isReadOnlyMode || hasEditRights;

  useEffect(() => {
    if (providedGroup) {
        setGroup(providedGroup);
        setMessages([]); 
        setNewMessage(""); 
        setReplyingTo(null); 
        setEditingMessage(null);
        setPage(1);
        setHasMore(true);
        initialLoadDone.current = false;
    }
  }, [providedGroup]);

  const markAsSeen = useCallback(async () => {
    if (!group?.id || !user?.id) return;
    try {
        await apiClient.post(`/groups/${group.id}/seen`, { userId: user.id });
    } catch (error) {}
  }, [group.id, user?.id]);

  useEffect(() => {
    if (!group?.id) return;
    const fetchGroupDetails = async () => {
        if (!user?.id) return;
        try {
            const response = await apiClient.get(`/groups/${group.id}/details`, {
                params: { userId: user.id }
            });
            if (response.data) {
                const fetchedDetails = response.data.group || response.data;
                setGroup(prev => ({ ...prev, ...fetchedDetails }));
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
          let allMessages;
          if (pageNum === 1) { allMessages = fetchedMessages; } 
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

  useEffect(() => {
    if (group?.id) { fetchHistory(1); }
    
    socketRef.current = io(SERVER_URL, { transports: ["websocket"] });
    socketRef.current.on("connect", () => { socketRef.current?.emit("joinGroup", { groupId: group.id }); });
    
    socketRef.current.on("groupDeleted", (deletedGroupId) => { if (deletedGroupId === group.id || parseInt(deletedGroupId) === parseInt(group.id)) { if (onBack) onBack(); } });

    socketRef.current.on("newMessage", (msg) => {
      if (String(msg.group_id) === String(group.id)) {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.clientMessageId === msg.clientMessageId);
          if (idx !== -1) { const newMsgs = [...prev]; newMsgs[idx] = msg; return newMsgs; }
          return [...prev, msg];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    });

    socketRef.current.on("messageDeleted", ({ messageId, deletedBy }) => {
        setMessages((prev) => prev.map((msg) => msg.id === messageId ? { ...msg, is_deleted: true, deleted_by: deletedBy, message_text: null, file_url: null, file_name: null, file_size: null } : msg));
    });
    
    socketRef.current.on("messageEdited", (msg) => { if (msg.group_id === group.id) setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m))); });
    return () => { socketRef.current?.disconnect(); };
  }, [group.id, fetchHistory, onBack]); 

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

  const sendMessage = (type, text, url, clientMessageId, fileName, fileSize, fileMimeType) => {
    if (!user || !socketRef.current || !canSendMessages) return;
    const tempId = clientMessageId || uuidv4();
    if (!clientMessageId) {
        setMessages(prev => [...prev, {
            id: tempId, clientMessageId: tempId, user_id: user.id, full_name: user.fullName,
            profile_image_url: user.profileImageUrl, group_id: group.id, message_type: type,
            file_url: url, file_name: fileName, file_size: fileSize, message_text: text, timestamp: getLocalISOString(),
            status: 'sending', reply_to_message_id: replyingTo ? replyingTo.id : null,
            reply_sender_name: replyingTo ? replyingTo.full_name : null,
            reply_text: replyingTo ? (replyingTo.message_type === 'text' ? replyingTo.message_text : 'Media') : null, reply_type: replyingTo ? replyingTo.message_type : null
        }]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
    socketRef.current.emit('sendMessage', { userId: user.id, groupId: group.id, messageType: type, messageText: text, fileUrl: url, fileName: fileName, fileSize: fileSize, fileMimeType: fileMimeType, replyToMessageId: replyingTo ? replyingTo.id : null, clientMessageId: tempId });
    if (type === 'text') setNewMessage(''); setReplyingTo(null);
  };

  const uploadFile = async (file, type) => {
    if (!user || !canSendMessages) return;

    // Strict 3MB limit
    const MAX_SIZE = 3 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        alert("This file is too large! Please select a file under 3MB.");
        return;
    }

    const clientMessageId = uuidv4();
    setMessages(prev => [...prev, { id: clientMessageId, clientMessageId: clientMessageId, user_id: user.id, full_name: user.fullName, profile_image_url: user.profileImageUrl, group_id: group.id, message_type: type, file_url: null, localUri: URL.createObjectURL(file), file_name: file.name, file_size: file.size, message_text: null, timestamp: getLocalISOString(), status: 'uploading', progress: 0 }]);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    const reader = new FileReader();
    reader.onloadend = async () => {
        const payload = {
            userId: user.id,
            media: reader.result,
            fileName: file.name,
            fileSize: file.size,
            fileMimeType: file.type
        };

        try {
            const res = await apiClient.post('/groups/media', payload, { 
                onUploadProgress: (pe) => { 
                    if (pe.total) {
                        setMessages(prev => prev.map(msg => msg.clientMessageId === clientMessageId ? { ...msg, progress: Math.round((pe.loaded * 100) / pe.total) } : msg)); 
                    }
                } 
            });
            sendMessage(type, null, res.data.fileUrl, clientMessageId, file.name, res.data.fileSize, res.data.fileMimeType);
        } catch (error) { 
            alert("Upload Failed. " + (error.response?.data?.message || "")); 
            setMessages(prev => prev.map(msg => msg.clientMessageId === clientMessageId ? { ...msg, status: 'failed' } : msg)); 
        }
    };
    reader.readAsDataURL(file);
  };

  const handlePickImageVideo = (e) => { const file = e.target.files[0]; if (!file) return; const type = file.type.startsWith("video") ? "video" : "image"; uploadFile(file, type); e.target.value = ""; setAttachmentModalVisible(false); };
  const handlePickDocument = (e) => { const file = e.target.files[0]; if (!file) return; uploadFile(file, 'file'); e.target.value = ""; setAttachmentModalVisible(false); };

  const handleSend = () => {
    if (!newMessage.trim() || !canSendMessages) return;
    if (editingMessage) { socketRef.current?.emit("editMessage", { messageId: editingMessage.id, newText: newMessage.trim(), userId: user?.id, groupId: group.id }); setEditingMessage(null); } 
    else { sendMessage('text', newMessage.trim(), null); }
    setNewMessage("");
  };

  const handleKeyPress = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  
  const onLongPressMessage = (e, message) => { 
    e.preventDefault();
    e.stopPropagation();
    if (!user || message.status === 'uploading' || message.is_deleted) return; 

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
    
    // In Base64 storage, fileUrl IS the base64 string, not a relative path.
    // If it's a URL starting with HTTP or /, append SERVER_URL. Otherwise it's Base64.
    const isBase64 = fileUrl.startsWith('data:');
    const fullUrl = isBase64 ? fileUrl : SERVER_URL + fileUrl;
    
    try {
      setOptionsModalVisible(false);
      
      if (action === 'view') {
        const ext = fileName?.split('.').pop()?.toLowerCase();
        const officeExts = ['xls', 'xlsx', 'doc', 'docx', 'ppt', 'pptx'];

        if (['pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            // For Base64, we can directly open it in a new tab if it's an image/pdf
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

      // Updated Source URI logic to handle Base64 strings correctly
      const isBase64 = item.file_url && item.file_url.startsWith('data:');
      const sourceUri = item.localUri || (item.file_url ? (isBase64 ? item.file_url : SERVER_URL + item.file_url) : null);
      
      if (!sourceUri && (isImageOrVideo || isFile)) return <div className="flex items-center gap-2 p-3 text-red-600 bg-red-50 rounded-md"><AlertCircle className="size-4" /><span className="text-sm">Media not available</span></div>;
      
      const renderUploadOverlay = () => { if (item.status !== 'uploading' && item.status !== 'failed') return null; return <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center rounded-lg">{item.status === 'uploading' && <><div className="animate-spin rounded-full size-8 border-b-2 border-white" /><span className="text-white mt-2 font-bold text-sm">{item.progress || 0}%</span></>}{item.status === 'failed' && <><AlertCircle className="size-8 text-white" /><span className="text-white mt-2 font-bold text-sm">Failed</span></>}</div>; };

      if (item.message_type === 'image') return <div className="relative cursor-pointer" onClick={(e) => { e.stopPropagation(); setFullScreenImage(sourceUri); }}><img src={sourceUri} className="w-64 h-64 rounded-md object-cover" alt="Shared" />{renderUploadOverlay()}</div>;
      if (item.message_type === 'video') return <div className="relative"><video src={sourceUri} className="w-64 h-64 rounded-md object-cover" controls={!item.status} muted playsInline onError={(e) => setVideoErrors(prev => ({ ...prev, [item.id]: true }))} />{renderUploadOverlay()}</div>;
      if (item.message_type === 'file') {
        const iconInfo = getFileIcon(item.file_name); const IconComponent = iconInfo.icon;
        return (
           <div className={`rounded-md p-3 w-64 overflow-hidden flex flex-col gap-2 ${isMyMessage ? 'bg-white/60' : 'bg-zinc-50'}`}>
               <div className="flex items-center gap-3">
                   <div className="relative"><IconComponent className={`size-8 ${iconInfo.color}`} />{renderUploadOverlay()}</div>
                   <div className="flex-1 min-w-0">
                       <div className="text-sm font-semibold text-zinc-900 truncate">{item.file_name}</div>
                       <div className="text-[11px] font-medium text-zinc-500 mt-0.5">{formatFileSize(item.file_size)}</div>
                   </div>
               </div>
               {!item.status && (
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

    const key = item.id ? item.id.toString() : item.clientMessageId;
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
              {isMyMessage && !item.is_deleted && <span className={isImageOrVideo ? "text-white" : "text-primary"}><CheckCheck className="size-3.5 inline-block" /></span>}
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
            {replyingTo && <div className="absolute bottom-full left-0 right-0 bg-white/95 backdrop-blur-sm p-3 border-l-4 border-primary flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] px-4"><div className="flex-1 min-w-0 pr-4"><div className="text-xs font-semibold text-primary mb-0.5">{replyingTo.reply_sender_name}</div><div className="text-sm text-zinc-500 truncate">{replyingTo.message_text}</div></div><button onClick={cancelReply} className="p-1 hover:bg-zinc-100 rounded-md transition-colors"><X className="size-4 text-zinc-400" /></button></div>}
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
                        </div>
                    </>
                )}
            </div>

            <div className="flex-1 bg-zinc-50 ring-1 ring-inset ring-zinc-200 focus-within:ring-primary/40 rounded-md flex items-center px-4 py-2 transition-shadow">
                <textarea className="w-full bg-transparent outline-none text-sm text-zinc-900 resize-none max-h-24 min-h-[20px] custom-scrollbar placeholder:text-zinc-400" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Type a message..." rows={1} onFocus={() => setIsEmojiPickerOpen(false)} />
            </div>

            <input type="file" accept="image/*,video/*" className="hidden" id="chat-media-upload" onChange={handlePickImageVideo} />
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt" className="hidden" id="chat-document-upload" onChange={handlePickDocument} />
            
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