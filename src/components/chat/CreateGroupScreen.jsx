"use client"

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { MdArrowBack } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { Users, Loader2, Check, Megaphone, Search } from 'lucide-react';

const CreateGroupScreen = ({ onBack, onGroupCreated, isEmbedded = false }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { can, isAllAccess } = usePermissions();

    const canEdit = can('GroupChat', 'edit');
    const hasCreateRights = isAllAccess || canEdit;

    const [groupName, setGroupName] = useState('');
    const [description, setDescription] = useState('');
    const [isReadOnly, setIsReadOnly] = useState(false);
    
    // States for bulk categories and specific users
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    
    const [options, setOptions] = useState({ classes: [], roles: [] });
    const [allUsers, setAllUsers] = useState([]); // Store individual users
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isLoadingOptions, setIsLoadingOptions] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.id || !user?.institutionId) return;
            try {
                // Fetch Categories (Roles/Classes)
                const resOptions = await apiClient.get('/groups/options', {
                    params: { userId: user.id, instId: user.institutionId }
                });
                setOptions(resOptions.data);

                // Fetch All Users for specific selection 
                // (Adjust this endpoint to match your actual users API)
                const resUsers = await apiClient.get('/users', {
                    params: { institutionId: user.institutionId }
                });
                setAllUsers(resUsers.data || []);
                
            } catch (error) {
                console.error("Failed to fetch group options or users");
            } finally {
                setIsLoadingOptions(false);
            }
        };
        fetchData();
    }, [user?.id, user?.institutionId]);

    const toggleCategory = (category) => {
        setSelectedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const toggleUser = (userId) => {
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    // Filter users based on search
    const filteredUsers = allUsers.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateGroup = async () => {
        if (!groupName.trim()) return alert("Group name is required");
        if (selectedCategories.length === 0 && selectedUserIds.length === 0) {
            return alert("Select at least one class, role, or specific member");
        }

        setIsCreating(true);
        try {
            const res = await apiClient.post('/groups', {
                userId: user.id,
                institutionId: user.institutionId,
                name: groupName.trim(),
                description: description.trim(),
                selectedCategories,
                selectedUserIds, // Sending specific users to backend
                isReadOnly
            });

            alert("Success: Group created");
            if (isEmbedded && onGroupCreated) {
                onGroupCreated(res.data.groupId);
            } else {
                navigate('/WhatsAppLayout');
            }
        } catch (error) {
            alert("Error: " + (error.response?.data?.message || "Failed to create group"));
        } finally {
            setIsCreating(false);
        }
    };

    if (!hasCreateRights) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-zinc-50 p-6 animate-in fade-in duration-300">
                <Users className="size-12 text-zinc-300 mb-4" />
                <h2 className="text-xl font-semibold text-zinc-700 tracking-tight">Access Denied</h2>
                <button onClick={onBack} className="mt-6 h-9 px-6 bg-white ring-1 ring-zinc-200 text-zinc-700 font-semibold rounded-md hover:bg-zinc-50 transition-colors shadow-sm">Go Back</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white max-w-2xl mx-auto w-full border-x border-zinc-200 shadow-sm animate-in slide-in-from-right-8 duration-300">
            <div className="flex items-center px-4 py-3 border-b border-zinc-200 bg-zinc-50 shrink-0">
                <button onClick={onBack} className="p-2 mr-2 hover:bg-zinc-200 rounded-full text-zinc-500 hover:text-zinc-900 transition-colors">
                    <MdArrowBack className="size-5" />
                </button>
                <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">New Group</h1>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                            Group Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors"
                            placeholder="e.g. Science Dept. 2026"
                        />
                    </div>
                </div>

                <div className="bg-zinc-50 rounded-lg p-4 ring-1 ring-inset ring-black/5 flex items-start justify-between">
                    <div className="flex flex-col pr-4">
                        <span className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                            <Megaphone className="size-4 text-primary" />
                            Announcement Mode
                        </span>
                        <span className="text-[11px] font-medium text-zinc-500 mt-1 leading-relaxed max-w-sm">
                            Only Admins and authorized roles can send messages.
                        </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
                        <input type="checkbox" className="sr-only peer" checked={isReadOnly} onChange={() => setIsReadOnly(!isReadOnly)} />
                        <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>

                <div className="pt-2">
                    <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-4">Add Members <span className="text-red-500">*</span></label>
                    
                    {isLoadingOptions ? (
                        <div className="flex items-center gap-2 text-zinc-500 text-sm font-medium p-4 bg-zinc-50 rounded-lg ring-1 ring-inset ring-black/5 justify-center">
                            <Loader2 className="size-4 animate-spin text-primary" /> Loading options...
                        </div>
                    ) : (
                        <div className="space-y-8">
                            
                            {/* BULK CATEGORY SECTION */}
                            <div className="space-y-6">
                                {isAllAccess && (
                                    <div className="space-y-2.5">
                                        <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Institution Wide (Bulk)</h3>
                                        <button onClick={() => toggleCategory('All')} className={`px-4 py-1.5 rounded-full text-xs font-semibold ring-1 ring-inset transition-all ${ selectedCategories.includes('All') ? 'bg-primary text-white ring-primary shadow-sm' : 'bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 hover:ring-zinc-300'}`}>
                                            Entire Institution
                                        </button>
                                    </div>
                                )}

                                {options.roles.length > 0 && (
                                    <div className="space-y-2.5">
                                        <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Staff Roles (Bulk)</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {options.roles.map(role => (
                                                <button key={`role-${role}`} onClick={() => toggleCategory(role)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ring-inset transition-all flex items-center gap-1.5 ${selectedCategories.includes(role) ? 'bg-indigo-600 text-white ring-indigo-600 shadow-sm' : 'bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 hover:ring-zinc-300'}`}>
                                                    {role} {selectedCategories.includes(role) && <Check className="size-3" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <hr className="border-zinc-200" />

                            {/* SPECIFIC INDIVIDUALS SECTION */}
                            <div className="space-y-4">
                                <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Specific Individuals</h3>
                                
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                    <input 
                                        type="text" 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search by name or role..." 
                                        className="w-full h-9 pl-9 pr-3 text-sm border border-zinc-200 rounded-md outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                </div>

                                <div className="max-h-48 overflow-y-auto border border-zinc-200 rounded-md divide-y divide-zinc-100 bg-white custom-scrollbar">
                                    {filteredUsers.length === 0 ? (
                                        <p className="p-3 text-xs text-zinc-500 text-center">No users found.</p>
                                    ) : (
                                        filteredUsers.map(u => (
                                            <div 
                                                key={u.id} 
                                                onClick={() => toggleUser(u.id)}
                                                className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-zinc-50 transition-colors ${selectedUserIds.includes(u.id) ? 'bg-indigo-50/50' : ''}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-zinc-900">{u.name}</span>
                                                    <span className="text-[11px] text-zinc-500">{u.role}</span>
                                                </div>
                                                {selectedUserIds.includes(u.id) && <Check className="size-4 text-indigo-600" />}
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                    {selectedUserIds.length} specific member(s) selected
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 shrink-0">
                <button
                    onClick={handleCreateGroup}
                    disabled={isCreating || !groupName.trim() || (selectedCategories.length === 0 && selectedUserIds.length === 0)}
                    className="w-full h-10 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-semibold transition-colors disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                >
                    {isCreating ? <Loader2 className="size-4 animate-spin shrink-0" /> : null}
                    {isCreating ? 'Creating...' : 'Create Group'}
                </button>
            </div>
        </div>
    );
};

export default CreateGroupScreen;