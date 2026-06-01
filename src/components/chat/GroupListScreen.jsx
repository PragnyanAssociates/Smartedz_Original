"use client"

import React, { useState } from 'react';
import { Search, Plus, MessageSquare, Loader2, Megaphone } from 'lucide-react';
import { getProfileImageSource } from '../../utils/imageHelpers';
import { usePermissions } from '../../Screens/PermissionsContext';

const GroupListScreen = ({ groups, onSelectGroup, selectedGroup, onCreateGroup, loading }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const { can, isAllAccess } = usePermissions();
    
    const hasCreateRights = isAllAccess || can('GroupChat', 'edit');

    const filteredGroups = groups.filter(g => 
        g.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="px-4 py-3 bg-zinc-50 flex items-center justify-between border-b border-zinc-200 shrink-0">
                <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Chats</h1>
                {hasCreateRights && (
                    <button 
                        onClick={onCreateGroup}
                        className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-full transition-colors shrink-0"
                        title="New Group"
                    >
                        <Plus className="size-5" />
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-zinc-100 shrink-0">
                <div className="relative">
                    <Search className="size-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
                    <input 
                        type="text" 
                        placeholder="Search groups..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 w-full bg-zinc-100/80 text-sm text-zinc-900 rounded-md pl-9 pr-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:bg-white transition-all placeholder:text-zinc-400"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-zinc-400">
                        <Loader2 className="size-6 animate-spin mb-2 text-primary" />
                        <span className="text-sm font-medium">Loading chats...</span>
                    </div>
                ) : filteredGroups.length > 0 ? (
                    filteredGroups.map(group => {
                        const isSelected = selectedGroup?.id === group.id;
                        const unread = group.unread_count > 0;
                        const isReadOnly = group.is_read_only === 1 || group.is_read_only === true;

                        return (
                            <div 
                                key={group.id} 
                                onClick={() => onSelectGroup(group)}
                                className={`flex items-center px-4 py-3 cursor-pointer transition-colors border-b border-zinc-50 ${isSelected ? 'bg-primary/5' : 'hover:bg-zinc-50'}`}
                            >
                                <img 
                                    src={getProfileImageSource(group.group_dp_url)} 
                                    alt="Group DP" 
                                    className="size-12 rounded-full object-cover bg-zinc-100 border border-zinc-200 shrink-0" 
                                />
                                <div className="ml-3 flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h3 className="font-semibold text-zinc-900 text-sm truncate flex items-center gap-1.5">
                                            {group.name}
                                            {isReadOnly && <Megaphone className="size-3 text-zinc-400 shrink-0" />}
                                        </h3>
                                        <span className={`text-[11px] whitespace-nowrap ml-2 font-medium ${unread ? 'text-primary font-semibold' : 'text-zinc-500'}`}>
                                            {renderDate(group.last_message_timestamp || group.created_at)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-0.5">
                                        <p className={`text-[13px] truncate mr-2 ${unread ? 'text-zinc-900 font-medium' : 'text-zinc-500'}`}>
                                            {group.last_message_text || "No messages yet"}
                                        </p>
                                        {unread && (
                                            <div className="min-w-[20px] h-5 px-1.5 bg-primary rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                                                {group.unread_count > 99 ? '99+' : group.unread_count}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-zinc-400">
                        <MessageSquare className="size-8 mb-2 opacity-50" />
                        <span className="text-sm font-medium">No groups found</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupListScreen;