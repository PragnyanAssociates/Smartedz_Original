"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GroupListScreen from './GroupListScreen';
import GroupChatScreen from './GroupChatScreen';
import CreateGroupScreen from './CreateGroupScreen';
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
    };

    const handleBackToList = () => {
        setSelectedGroup(null);
        setIsCreatingGroup(false);
        window.history.replaceState({}, document.title);
        fetchGroups();
    };

    if (!hasReadAccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
                <ShieldAlert className="w-16 h-16 text-slate-300 mb-4" />
                <h1 className="text-2xl font-bold text-slate-700">Module Locked</h1>
                <p className="text-slate-500 mt-2">You do not have permission to view group chats.</p>
                <button onClick={() => navigate('/')} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Return Home</button>
            </div>
        );
    }

    const isMobile = window.innerWidth < 768;
    const showSidebar = !isMobile || (!selectedGroup && !isCreatingGroup);
    const showMainArea = !isMobile || selectedGroup || isCreatingGroup;

    return (
        <div className="flex h-screen w-full bg-slate-100 overflow-hidden">
            {showSidebar && (
                <div className={`${isMobile ? 'w-full' : 'w-80 lg:w-96'} h-full flex-shrink-0 z-10 shadow-lg`}>
                    <GroupListScreen
                        groups={groups}
                        onSelectGroup={handleSelectGroup}
                        selectedGroup={selectedGroup}
                        onCreateGroup={() => setIsCreatingGroup(true)}
                        loading={loading}
                    />
                </div>
            )}

            {showMainArea && (
                <div className="flex-1 h-full w-full relative z-0">
                    {isCreatingGroup ? (
                        <CreateGroupScreen
                            onBack={handleBackToList}
                            isEmbedded={true}
                            onGroupCreated={() => {
                                setIsCreatingGroup(false);
                                fetchGroups();
                            }}
                        />
                    ) : selectedGroup ? (
                        <GroupChatScreen
                            providedGroup={selectedGroup}
                            onBack={handleBackToList}
                            isEmbedded={true}
                        />
                    ) : (
                        <div className="hidden md:flex flex-col items-center justify-center h-full bg-[#f0f2f5] border-b-[6px] border-[#00a884]">
                            <div className="w-64 mb-8 opacity-50">
                                <MessageSquare className="w-full h-full text-slate-300" />
                            </div>
                            <h2 className="text-3xl font-light text-[#41525d] mb-4">SmartEdz Web Chat</h2>
                            <p className="text-[#667781] text-sm text-center max-w-md">
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