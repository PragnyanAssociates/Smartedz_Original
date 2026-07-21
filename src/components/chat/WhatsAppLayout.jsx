"use client"
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GroupListScreen from './GroupListScreen';
import GroupChatScreen from './GroupChatScreen';
import CreateGroupScreen from './CreateGroupScreen';
import GroupSettingsScreen from './GroupSettingsScreen'; 
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { io } from "socket.io-client";
import { SERVER_URL } from "../../apiConfig";
import { MessageSquare, ShieldAlert, Plus, HelpCircle, X, ShieldCheck } from 'lucide-react';
const WhatsAppLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { can, isAllAccess } = usePermissions();
    const hasReadAccess = isAllAccess || can('GroupChat', 'read');
    const canManage = isAllAccess || can('GroupChat', 'edit');
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(location.state?.selectedGroup || null);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [isViewingSettings, setIsViewingSettings] = useState(false); 
    const [loading, setLoading] = useState(true);
    const socketRef = useRef(null);
    const fetchGroups = useCallback(async () => {
        if (!hasReadAccess || !user?.id || !user?.institutionId) return;
        try {
            const res = await apiClient.get('/groups', {
                params: { userId: user.id, instId: user.institutionId }
            });
            setGroups(res.data);
            if (selectedGroup) {
                const updatedTarget = res.data.find(g => g.id === selectedGroup.id);
                if (updatedTarget) setSelectedGroup(updatedTarget);
            }
        } catch (error) {
            console.error("Failed to fetch groups");
        } finally {
            setLoading(false);
        }
    }, [hasReadAccess, user?.id, user?.institutionId]);
    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);
    useEffect(() => {
        if (!hasReadAccess) return;
        // Allow the polling -> websocket upgrade (more robust behind Railway's
        // proxy than forcing websocket-only).
        socketRef.current = io(SERVER_URL, { transports: ["polling", "websocket"] });
        socketRef.current.on('updateGroupList', () => {
            fetchGroups();
        });
        return () => {
            socketRef.current?.disconnect();
        };
    }, [hasReadAccess, fetchGroups]);
    const handleSelectGroup = (group) => {
        setSelectedGroup(group);
        setIsCreatingGroup(false);
        setIsViewingSettings(false);
    };
    const handleBackToList = () => {
        setSelectedGroup(null);
        setIsCreatingGroup(false);
        setIsViewingSettings(false);
        window.history.replaceState({}, document.title);
        fetchGroups();
    };
    if (!hasReadAccess) {
        return (
            <div className="flex flex-col items-center justify-center flex-1 h-full min-h-[calc(100vh-64px)] bg-zinc-50 p-6">
                <div className="bg-white p-8 rounded-lg ring-1 ring-black/5 shadow-sm max-w-md w-full text-center flex flex-col items-center">
                    <ShieldAlert className="size-12 text-zinc-300 mb-4" />
                    <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Module Locked</h1>
                    <p className="text-sm text-zinc-500 mt-2 leading-relaxed">You do not have permission to view group chats.</p>
                    <button onClick={() => navigate('/')} 
                        className="mt-6 h-9 px-6 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-semibold shadow-sm transition-colors">
                        Return Home
                    </button>
                </div>
            </div>
        );
    }
    const isActivityActive = selectedGroup || isCreatingGroup || isViewingSettings;
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 flex flex-col h-[calc(100vh-64px)]">
            
            {/* HEADER AREA - Now includes the Create Group button on the right */}
            <header className="flex items-start sm:items-center justify-between mb-2 sm:mb-0 shrink-0 gap-4">
                <div className="flex flex-col min-w-0">
                    <h1 className="text-xl font-semibold text-zinc-900 tracking-tight flex items-center gap-2 truncate">
                        <MessageSquare className="text-primary size-5 shrink-0" />
                         Chat
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1 truncate">Communicate and collaborate seamlessly across your institution.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <GroupChatHelp canManage={canManage} />
                    <button 
                        onClick={() => {
                            setIsCreatingGroup(true);
                            setSelectedGroup(null);
                            setIsViewingSettings(false);
                        }} 
                        className="h-9 px-3 sm:px-4 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 shrink-0"
                    >
                        <Plus className="size-4" />
                        <span className="hidden sm:inline">New Group</span>
                    </button>
                </div>
            </header>
            {/* CORE LAYOUT WRAPPER */}
            <div className="flex flex-1 w-full bg-zinc-50 overflow-hidden ring-1 ring-black/5 sm:rounded-lg shadow-sm min-h-0">
                
                {/* LEFT PANEL: Group List */}
                <div className={`
                    ${isActivityActive ? 'hidden lg:flex' : 'flex'} 
                    w-full lg:w-80 xl:w-96 flex-col flex-shrink-0 z-10 bg-white border-r border-zinc-200
                `}>
                    <GroupListScreen
                        groups={groups}
                        onSelectGroup={handleSelectGroup}
                        selectedGroup={selectedGroup}
                        loading={loading}
                    />
                </div>
                {/* RIGHT PANEL: Main Area */}
                <div className={`
                    ${!isActivityActive ? 'hidden lg:flex' : 'flex'} 
                    flex-1 flex-col h-full min-w-0 relative z-0 bg-zinc-50
                `}>
                    {isCreatingGroup ? (
                        <CreateGroupScreen
                            onBack={handleBackToList}
                            isEmbedded={true}
                            onGroupCreated={() => {
                                setIsCreatingGroup(false);
                                fetchGroups();
                            }}
                        />
                    ) : isViewingSettings && selectedGroup ? (
                        <GroupSettingsScreen 
                            group={selectedGroup}
                            isEmbedded={true}
                            onBack={() => setIsViewingSettings(false)}
                            onGroupDeleted={() => {
                                setIsViewingSettings(false);
                                setSelectedGroup(null);
                                fetchGroups();
                            }}
                        />
                    ) : selectedGroup ? (
                        <GroupChatScreen
                            providedGroup={selectedGroup}
                            onBack={handleBackToList}
                            isEmbedded={true}
                            onOpenSettings={() => setIsViewingSettings(true)}
                        />
                    ) : (
                        <div className="hidden lg:flex flex-col items-center justify-center h-full bg-zinc-50 border-b-[6px] border-primary">
                            <div className="w-48 mb-8 opacity-20">
                                <MessageSquare className="w-full h-full text-zinc-400" strokeWidth={1} />
                            </div>
                            <h2 className="text-2xl font-medium text-zinc-800 mb-3 tracking-tight">SmartEdz Web Chat</h2>
                            <p className="text-zinc-500 text-sm text-center max-w-md leading-relaxed">
                                Send and receive messages, files, and updates seamlessly across your institution.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default WhatsAppLayout;

// =====================================================================
//  GroupChatHelp — "How to use" guide (same theme as ReportsHelp).
//  Users who can create/manage groups get the manage guide; everyone
//  else gets the view one.
// =====================================================================
const GUIDES = {
  manage: {
    title: 'Chat',
    steps: [
      ['1 \u00b7 Your groups', 'The left panel lists every group you\u2019re in. Unread messages show a count, and a megaphone icon marks announcement-only groups. Search filters the list by name.'],
      ['2 \u00b7 Open & message', 'Tap a group to read and send messages \u2014 type and press Enter, add emojis, or use the paperclip for photos, videos and documents (up to 3 MB each).'],
      ['3 \u00b7 Reply, edit, delete', 'Tap or long-press a message for Reply, Edit (your own text) and Delete. The chat header opens group info and settings.'],
      ['4 \u00b7 New Group', 'New Group lets you name it, add a photo, and pick members by class, role or specific individuals. Turn on Announcement Mode to make it post-only for admins.'],
      ['5 \u00b7 Manage a group', 'From a group\u2019s settings you can rename it, change its photo, add or remove members, toggle Announcement Mode, and delete the group.'],
    ],
    note: 'Announcement Mode means only admins and authorized roles can post \u2014 everyone else can read. Creating groups, managing members and deleting depend on your permissions.'
  },
  view: {
    title: 'Chat',
    steps: [
      ['1 \u00b7 Your groups', 'The left panel lists every group you\u2019re in. An unread count sits on the right, and a megaphone icon marks announcement-only groups. Search filters by name.'],
      ['2 \u00b7 Open & message', 'Tap a group to read and send messages \u2014 type and press Enter, add emojis, or use the paperclip for photos, videos and documents (up to 3 MB each).'],
      ['3 \u00b7 Reply, edit, delete', 'Tap or long-press a message for Reply, Edit (your own text) and Delete. The chat header opens group info.'],
      ['4 \u00b7 Announcement groups', 'A megaphone means only admins and authorized roles can post in that group \u2014 you\u2019ll be able to read it but not send.'],
    ],
    note: 'Creating and managing groups is limited to admins and users with the right permissions.'
  }
};

function GroupChatHelp({ canManage = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const content = canManage ? GUIDES.manage : GUIDES.view;

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-primary ring-1 ring-zinc-200 px-2.5 py-1.5 rounded-md hover:bg-zinc-50 transition-colors shrink-0 ${className}`}>
        <HelpCircle className="size-3.5" /> How to use
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg ring-1 ring-black/5 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="bg-primary text-white px-5 py-3 flex items-center justify-between sticky top-0">
              <span className="text-sm font-bold flex items-center gap-2"><HelpCircle className="size-4" /> {content.title}</span>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="size-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              {content.steps.map(([t, d], i) => (
                <div key={i} className="rounded-md ring-1 ring-zinc-100 bg-zinc-50/60 p-3">
                  <p className="text-xs font-semibold text-zinc-800">{t}</p>
                  <p className="text-[11px] text-zinc-600 leading-relaxed mt-1">{d}</p>
                </div>
              ))}
              <div className="rounded-md bg-blue-50/60 ring-1 ring-blue-100 p-3 flex gap-2">
                <ShieldCheck className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">{content.note}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}