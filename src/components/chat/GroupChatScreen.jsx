"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
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

const THEME = { myMessageBg: "bg-[#d9fdd3]", otherMessageBg: "bg-white" };
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
    case 'pdf': return { icon: FileText, color: 'text-red-600' };
    case 'doc': case 'docx': return { icon: FileText, color: 'text-blue-600' };
    case 'xls': case 'xlsx': return { icon: FileText, color: 'text-green-600' };
    case 'ppt': case 'pptx': return { icon: FileText, color: 'text-orange-600' };
    case 'zip': case 'rar': return { icon: Archive, color: 'text-yellow-600' };
    default: return { icon: File, color: 'text-gray-600' };
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

  // Unified Permissions Check
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
  }, [group.id]);

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
      if (error.response && (error.response.status === 404 || error.response.status === 400)) { if (onBack) onBack(); }
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [group.id, markAsSeen, onBack]);

  useEffect(() => {
    if (group?.id) { fetchHistory(1); }
    
    socketRef.current = io(SERVER_URL, { transports: ["websocket"] });
    socketRef.current.on("connect", () => { socketRef.current?.emit("joinGroup", { groupId: group.id }); });
    
    socketRef.current.on("groupDeleted", (deletedGroupId) => { if (deletedGroupId === group.id || parseInt(deletedGroupId) === parseInt(group.id)) { if (onBack) onBack(); } });

    socketRef.current.on("newMessage", (msg) => {
      if (msg.group_id === group.id) {
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

  useLayoutEffect(() => {
    if (loading) return;
    if (isPaginationLoadRef.current && messagesContainerRef.current) {
        const newScrollHeight = messagesContainerRef.current.scrollHeight;
        const diff = newScrollHeight - prevScrollHeightRef.current;
        messagesContainerRef.current.scrollTop = diff;
        isPaginationLoadRef.current = false;
    } else if (!initialLoadDone.current && processedData.length > 0) {
        const bannerElement = document.getElementById('unread-banner');
        if (bannerElement) bannerElement.scrollIntoView({ behavior: 'auto', block: 'center' });
        else messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
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
    const clientMessageId = uuidv4();
    setMessages(prev => [...prev, { id: clientMessageId, clientMessageId: clientMessageId, user_id: user.id, full_name: user.fullName, profile_image_url: user.profileImageUrl, group_id: group.id, message_type: type, file_url: null, localUri: URL.createObjectURL(file), file_name: file.name, file_size: file.size, message_text: null, timestamp: getLocalISOString(), status: 'uploading', progress: 0 }]);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });const formData = new FormData();
formData.append('media', file);
formData.append('userId', user.id); 
    try {
      const res = await apiClient.post('/groups/media', formData, { headers: { 'Content-Type': 'multipart/form-data' }, onUploadProgress: (pe) => { if (pe.total) setMessages(prev => prev.map(msg => msg.clientMessageId === clientMessageId ? { ...msg, progress: Math.round((pe.loaded * 100) / pe.total) } : msg)); } });
      sendMessage(type, null, res.data.fileUrl, clientMessageId, file.name, res.data.fileSize, res.data.fileMimeType);
    } catch (error) { alert("Upload Failed."); setMessages(prev => prev.map(msg => msg.clientMessageId === clientMessageId ? { ...msg, status: 'failed' } : msg)); }
  };

  const handlePickImageVideo = (e) => { const file = e.target.files[0]; if (!file) return; const type = file.type.startsWith("video") ? "video" : "image"; uploadFile(file, type); e.target.value = ""; setAttachmentModalVisible(false); };
  const handlePickDocument = (e) => { const file = e.target.files[0]; if (!file) return; uploadFile(file, 'file'); e.target.value = ""; setAttachmentModalVisible(false); };
  
  const showAttachmentMenu = () => { setAttachmentModalVisible(true); };

  const handleSend = () => {
    if (!newMessage.trim() || !canSendMessages) return;
    if (editingMessage) { socketRef.current?.emit("editMessage", { messageId: editingMessage.id, newText: newMessage.trim(), userId: user?.id, groupId: group.id }); setEditingMessage(null); } 
    else { sendMessage('text', newMessage.trim(), null); }
    setNewMessage("");
  };

  const handleKeyPress = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  
  const onLongPressMessage = (message) => { 
    if (!user || message.status === 'uploading' || message.is_deleted) return; 
    setSelectedMessage(message); 
    setOptionsModalVisible(true); 
  };
  
  const handleDeleteMessage = (messageId) => { socketRef.current?.emit("deleteMessage", { messageId, userId: user?.id, groupId: group.id }); };

  const downloadAndOpenFile = async (fileUrl, fileName, action) => {
    if (!fileUrl) return alert("No file available.");
    const fullUrl = SERVER_URL + fileUrl;
    try {
      setOptionsModalVisible(false);
      if (action === 'view') { const ext = fileName?.split('.').pop()?.toLowerCase(); if (['pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) { window.open(fullUrl, '_blank'); return; } else { action = 'download'; } }
      if (action === 'download') { const res = await fetch(fullUrl); const blob = await res.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.style.display = 'none'; a.href = url; a.download = fileName || `download-${Date.now()}`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a); }
    } catch (err) { alert("Error downloading file."); }
  };

  const cancelReply = () => setReplyingTo(null); const cancelEdit = () => { setEditingMessage(null); setNewMessage(""); };

  const renderMessageItem = (item) => {
    if (item.type === 'date') return <div key={item.id} className="flex justify-center my-4"><div className="bg-[#f0f2f5] px-3 py-1.5 rounded-lg shadow-sm"><span className="text-xs text-[#54656f] font-medium uppercase">{item.date}</span></div></div>;
    
    if (item.type === 'unread_banner') return (
        <div key={item.id} id="unread-banner" className="flex justify-center my-4 w-full">
            <div className="bg-[#e7fce3] px-3 py-1 rounded-full shadow-sm flex justify-center border border-[#d9fdd3]">
                <span className="text-xs text-[#00a884] font-bold">Unread Messages</span>
            </div>
        </div>
    );

    const isMyMessage = item.user_id === user?.id;
    const isImageOrVideo = ['image', 'video'].includes(item.message_type) && !item.is_deleted;
    const isFile = item.message_type === 'file' && !item.is_deleted;
    const messageTime = new Date(item.timestamp).toLocaleTimeString('en-US', { hour: "numeric", minute: "2-digit", hour12: true });

    const renderContent = () => {
      // Unified Moderation Tombstone
      if (item.is_deleted) {
          const removedByMe = item.deleted_by === user?.id;
          return (
              <div className="text-sm italic text-gray-500 p-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-400" />
                  {removedByMe ? "You deleted this message" : "Removed by Moderator"}
              </div>
          );
      }

      const sourceUri = item.localUri || (item.file_url ? SERVER_URL + item.file_url : null);
      if (!sourceUri && (isImageOrVideo || isFile)) return <div className="flex items-center gap-2 p-3 text-red-600 bg-red-50 rounded-lg"><AlertCircle className="w-5 h-5" /><span className="text-sm">Media not available</span></div>;
      
      const renderUploadOverlay = () => { if (item.status !== 'uploading' && item.status !== 'failed') return null; return <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center rounded-lg">{item.status === 'uploading' && <><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" /><span className="text-white mt-2 font-bold text-base">{item.progress || 0}%</span></>}{item.status === 'failed' && <><AlertCircle className="w-10 h-10 text-white" /><span className="text-white mt-2 font-bold text-base">Failed</span></>}</div>; };

      if (item.message_type === 'image') return <div className="relative cursor-pointer" onClick={(e) => { e.stopPropagation(); setFullScreenImage(sourceUri); }}><img src={sourceUri} className="w-64 h-64 rounded-lg object-cover" alt="Shared" />{renderUploadOverlay()}</div>;
      if (item.message_type === 'video') return <div className="relative"><video src={sourceUri} className="w-64 h-64 rounded-lg object-cover" controls={!item.status} muted playsInline onError={(e) => setVideoErrors(prev => ({ ...prev, [item.id]: true }))} />{renderUploadOverlay()}</div>;
      if (item.message_type === 'file') {
        const iconInfo = getFileIcon(item.file_name); const IconComponent = iconInfo.icon;
        return (
           <div className="bg-white/50 rounded-lg p-3 w-64 overflow-hidden flex flex-col gap-2">
               <div className="flex items-center gap-3">
                   <div className="relative"><IconComponent className={`w-10 h-10 ${iconInfo.color}`} />{renderUploadOverlay()}</div>
                   <div className="flex-1 min-w-0">
                       <div className="text-sm font-medium text-gray-900 truncate">{item.file_name}</div>
                       <div className="text-xs text-gray-500 mt-0.5">{formatFileSize(item.file_size)}</div>
                   </div>
               </div>
               {!item.status && (
                   <div className="flex gap-4 border-t border-gray-200 pt-2 mt-1">
                       <button onClick={(e) => {e.stopPropagation(); downloadAndOpenFile(item.file_url, item.file_name, 'view');}} className="text-xs text-blue-600 font-medium hover:underline">View</button>
                       <button onClick={(e) => {e.stopPropagation(); downloadAndOpenFile(item.file_url, item.file_name, 'download');}} className="text-xs text-blue-600 font-medium hover:underline">Download</button>
                   </div>
               )}
           </div>
        );
      }
      return <span className="text-sm sm:text-base text-gray-900 break-words whitespace-pre-wrap leading-relaxed">{item.message_text}</span>;
    };

    const key = item.id ? item.id.toString() : item.clientMessageId;
    return (
      <div key={key} className={`flex flex-row my-1 px-4 sm:px-8 items-start ${isMyMessage ? "justify-end" : "justify-start"}`}>
        {!isMyMessage && <img src={getProfileImageSource(item.profile_image_url)} alt="User" className="w-8 h-8 rounded-full mr-2 mt-1 bg-gray-200 flex-shrink-0" />}
        <div className={`relative max-w-[85%] sm:max-w-[65%] cursor-pointer shadow-sm ${isMyMessage ? (isImageOrVideo ? "rounded-lg" : `${THEME.myMessageBg} rounded-lg rounded-tr-none p-2 px-3`) : (isImageOrVideo ? "rounded-lg" : `${THEME.otherMessageBg} rounded-lg rounded-tl-none p-2 px-3`)} ${item.is_deleted ? 'bg-slate-50 border border-slate-200 shadow-none' : ''}`} onContextMenu={(e) => { e.preventDefault(); onLongPressMessage(item); }} onClick={() => onLongPressMessage(item)}>
          
          {item.is_pinned && !item.is_deleted && <div className="absolute -top-2 -right-2 bg-yellow-100 text-yellow-600 rounded-full p-1 shadow-sm border border-yellow-200"><Pin className="w-3 h-3" /></div>}
          
          {!isMyMessage && !isImageOrVideo && !isFile && !item.is_deleted && <div className="text-xs font-bold text-[#54656f] mb-1">{item.full_name}</div>}
          
          {item.reply_to_message_id && !isImageOrVideo && !item.is_deleted && <div className={`mb-2 p-2 rounded-md border-l-4 bg-black/5 border-[#00a884]`}><div className="text-xs font-bold text-[#00a884]">{item.reply_sender_name}</div><div className="text-xs text-gray-600 truncate">{item.reply_type === 'text' ? item.reply_text : 'Media'}</div></div>}
          
          {renderContent()}
          
          <div className={`${(isImageOrVideo) ? 'absolute bottom-2 right-2 bg-black/40 text-white px-1.5 rounded-full' : 'float-right ml-2 mt-1'} flex items-center gap-1 text-[11px] ${(isImageOrVideo) ? 'text-white' : 'text-gray-500'}`}>
              {!!item.is_edited && !item.is_deleted && <span>Edited</span>}
              <span>{messageTime}</span>
              {isMyMessage && !item.is_deleted && <span className={isImageOrVideo ? "text-white" : "text-[#53bdeb]"}><CheckCheck className="w-3.5 h-3.5 inline-block" /></span>}
          </div>
        </div>
      </div>
    );
  };

  const renderOptionsModal = () => {
    if (!selectedMessage) return null;
    const isMyMessage = selectedMessage.user_id === user?.id;
    const canDeleteThisMessage = isMyMessage || hasGlobalDelete;

    return (
      <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${isOptionsModalVisible ? '' : 'hidden'}`}>
        <div className="bg-white rounded-lg p-2 w-72 max-w-[90%] shadow-xl">
          {canSendMessages && <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 rounded-md" onClick={() => { setReplyingTo(selectedMessage); setOptionsModalVisible(false); }}><Reply className="w-5 h-5 text-slate-600" /><span className="text-slate-700">Reply</span></button>}
          {isMyMessage && selectedMessage.message_type === 'text' && <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 rounded-md" onClick={() => { setEditingMessage(selectedMessage); setNewMessage(selectedMessage.message_text); setOptionsModalVisible(false); }}><Edit3 className="w-5 h-5 text-slate-600" /><span className="text-slate-700">Edit</span></button>}
          {canDeleteThisMessage && <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 rounded-md" onClick={() => { if (window.confirm('Delete message?')) { handleDeleteMessage(selectedMessage.id); setOptionsModalVisible(false); } }}><Trash2 className="w-5 h-5 text-red-500" /><span className="text-red-600">Delete</span></button>}
          <div className="h-px bg-slate-100 my-1"></div>
          <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 rounded-md" onClick={() => setOptionsModalVisible(false)}><X className="w-5 h-5 text-slate-600" /><span className="text-slate-700">Cancel</span></button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#efeae2]">
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-90" onClick={() => setFullScreenImage(null)}>
          <button className="absolute top-4 right-4 p-2 text-white hover:text-gray-300" onClick={(e) => { e.stopPropagation(); setFullScreenImage(null); }}><X className="w-8 h-8" /></button>
          <img src={fullScreenImage} className="max-w-full max-h-full object-contain p-4" alt="Full screen view" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {renderOptionsModal()} 
      
      {/* Attachment Menu (Hidden if Read-Only) */}
      {isAttachmentModalVisible && canSendMessages && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 max-w-[90%] shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-6 text-center">Attach to chat</h3>
            <div className="grid grid-cols-2 gap-4">
              <button className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 rounded-xl transition-colors" onClick={() => document.getElementById('chat-media-upload').click()}><div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center"><ImageIcon className="w-7 h-7 text-purple-600" /></div><span className="text-sm font-medium text-gray-700">Photos & Videos</span></button>
              <button className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 rounded-xl transition-colors" onClick={() => document.getElementById('chat-document-upload').click()}><div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center"><FileText className="w-7 h-7 text-indigo-600" /></div><span className="text-sm font-medium text-gray-700">Document</span></button>
            </div>
            <div className="flex justify-center mt-6"><button className="px-6 py-2 text-slate-500 hover:text-slate-700 font-medium" onClick={() => setAttachmentModalVisible(false)}>Cancel</button></div>
          </div>
        </div>
      )}

      {/* Header Menu */}
      {isGroupMenuVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-2 w-64 max-w-[90%] shadow-xl">
            <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 rounded-md" onClick={() => { setGroupMenuVisible(false); if (isEmbedded && onOpenSettings) { onOpenSettings(); } else { navigate(`/GroupSettingsScreen`, { state: { group } }); } }}>
              <Settings className="w-5 h-5 text-slate-600" />
              <span className="text-slate-700">Settings</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 rounded-md" onClick={() => setGroupMenuVisible(false)}><X className="w-5 h-5 text-slate-600" /><span className="text-slate-700">Close</span></button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="h-16 bg-[#f0f2f5] border-b border-slate-200 px-4 flex items-center justify-between flex-shrink-0 z-10">
        {isEmbedded && onBack && <button onClick={onBack} className="md:hidden mr-3 p-1 rounded-full hover:bg-slate-200 text-slate-600"><MdArrowBack className="w-6 h-6" /></button>}
        <div className="flex items-center flex-1 cursor-pointer" onClick={() => setGroupMenuVisible(true)}>
          <img src={getProfileImageSource(group.group_dp_url)} alt="Group" className="w-10 h-10 rounded-full mr-3 bg-slate-200 object-cover" />
          <div className="flex flex-col">
              <span className="font-semibold text-slate-800 text-base leading-tight flex items-center gap-2">
                  {group.name} {isReadOnlyMode && <Megaphone className="w-4 h-4 text-gray-500" />}
              </span>
              <span className="text-xs text-slate-500">Tap for group info</span>
          </div>
        </div>
        <button onClick={() => setGroupMenuVisible(true)} className="p-2 hover:bg-slate-200 rounded-full"><MoreVertical className="w-5 h-5 text-[#54656f]" /></button>
      </div>

      {/* Message List */}
      <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative bg-[#efeae2] bg-opacity-50 min-h-0">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundRepeat: 'repeat' }}></div>
        
        {isFetchingMore && <div className="flex justify-center p-2 z-20"><Loader2 className="w-6 h-6 animate-spin text-[#00a884]" /></div>}

        {loading ? (
            <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884]" /></div>
        ) : (
            <div className="flex flex-col py-4 relative z-10">
                {processedData.length > 0 ? (
                    processedData.map(renderMessageItem)
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
                          <div className="w-32 h-32 bg-[#e9edef] rounded-full flex items-center justify-center mb-4"><Smile className="w-12 h-12 text-slate-400" /></div>
                          <h3 className="text-lg font-medium text-gray-700">No messages yet</h3>
                          <p className="text-sm text-gray-500 max-w-xs mt-2">Send a message to start the conversation.</p>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
        )}
      </div>

      {/* Input Area (Dynamic Notice Board Logic) */}
      {canSendMessages ? (
          <div className="bg-[#f0f2f5] px-4 py-2 flex items-center gap-2 flex-shrink-0 z-10 relative">
            {replyingTo && <div className="absolute bottom-full left-0 right-0 bg-white/95 backdrop-blur-sm p-2 border-l-4 border-[#00a884] flex justify-between items-center shadow-sm px-4"><div className="flex-1"><div className="text-xs font-bold text-[#00a884]">{replyingTo.reply_sender_name}</div><div className="text-sm text-gray-500 truncate">{replyingTo.message_text}</div></div><button onClick={cancelReply}><X className="w-5 h-5 text-gray-500" /></button></div>}
            {editingMessage && <div className="absolute bottom-full left-0 right-0 bg-blue-50 p-2 border-l-4 border-blue-500 flex justify-between items-center px-4"><span className="text-blue-600 font-medium">Editing message...</span><button onClick={cancelEdit}><X className="w-5 h-5 text-blue-400" /></button></div>}
            
            <button onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)} className="p-2 text-[#54656f] hover:bg-slate-200 rounded-full"><Smile className="w-6 h-6" /></button>
            <button onClick={showAttachmentMenu} className="p-2 text-[#54656f] hover:bg-slate-200 rounded-full"><Paperclip className="w-6 h-6" /></button>
            
            <div className="flex-1 bg-white rounded-lg flex items-center px-4 py-2">
                <textarea className="w-full bg-transparent outline-none text-slate-900 resize-none max-h-24 min-h-[24px]" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder="Type a message" rows={1} onFocus={() => setIsEmojiPickerOpen(false)} />
            </div>

            <input type="file" accept="image/*,video/*" className="hidden" id="chat-media-upload" onChange={handlePickImageVideo} />
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt" className="hidden" id="chat-document-upload" onChange={handlePickDocument} />
            
            <button className="p-2 text-[#54656f] hover:bg-slate-200 rounded-full" onClick={handleSend} disabled={!newMessage.trim() && !editingMessage}>{editingMessage ? <Check className="w-6 h-6 text-[#00a884]" /> : <Send className="w-6 h-6" />}</button>
          </div>
      ) : (
          <div className="bg-[#f0f2f5] px-4 py-4 flex items-center justify-center flex-shrink-0 z-10 border-t border-slate-200">
              <div className="bg-white px-6 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Only Admins can send messages</span>
              </div>
          </div>
      )}

      {isEmojiPickerOpen && canSendMessages && <div className="absolute bottom-16 left-4 z-50 shadow-lg rounded-lg overflow-hidden"><EmojiPicker onEmojiClick={(emojiData) => { setNewMessage((prev) => prev + emojiData.emoji); setIsEmojiPickerOpen(false); }} width={300} height={400} /></div>}
    </div>
  );
};

export default GroupChatScreen;