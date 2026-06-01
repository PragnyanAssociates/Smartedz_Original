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
import { MessageSquare, ShieldAlert } from 'lucide-react';

const WhatsAppLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { can, isAllAccess } = usePermissions();
    const hasReadAccess = isAllAccess || can('GroupChat', 'read');

    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(location.state?.selectedGroup || null);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    
    // -- NEW STATE: Tracks if the settings panel is open
    const [isViewingSettings, setIsViewingSettings] = useState(false); 
    
    const [loading, setLoading] = useState(true);

    const socketRef = useRef(null);

    // Your fetchGroups and user.id logic left completely untouched
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

        socketRef.current = io(SERVER_URL, { transports: ["websocket"] });

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
        setIsViewingSettings(false); // -- Close settings if picking a new group
    };

    const handleBackToList = () => {
        setSelectedGroup(null);
        setIsCreatingGroup(false);
        setIsViewingSettings(false); // -- Reset settings state
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
                        className="mt-6 h-9 px-6 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-semibold shadow-sm transition-colors w-full">
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    const isMobile = window.innerWidth < 768;
    const showSidebar = !isMobile || (!selectedGroup && !isCreatingGroup);
    const showMainArea = !isMobile || selectedGroup || isCreatingGroup;

    return (
        <div className="flex h-[calc(100vh-64px)] w-full bg-zinc-50 overflow-hidden animate-in fade-in duration-300">
            {showSidebar && (
                <div className={`${isMobile ? 'w-full' : 'w-80 lg:w-96'} h-full flex-shrink-0 z-10 bg-white border-r border-zinc-200`}>
                    <GroupListScreen
                        groups={groups}
                        onSelectGroup={handleSelectGroup}
                        selectedGroup={selectedGroup}
                        onCreateGroup={() => {
                            setIsCreatingGroup(true);
                            setSelectedGroup(null);
                            setIsViewingSettings(false);
                        }}
                        loading={loading}
                    />
                </div>
            )}

            {showMainArea && (
                <div className="flex-1 h-full w-full relative z-0 bg-zinc-50">
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
                        // -- Renders Settings seamlessly in the right panel
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
                            onOpenSettings={() => setIsViewingSettings(true)} // -- THIS STOPS THE URL REDIRECT
                        />
                    ) : (
                        <div className="hidden md:flex flex-col items-center justify-center h-full bg-zinc-50 border-b-[6px] border-primary">
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
            )}
        </div>
    );
};

export default WhatsAppLayout;