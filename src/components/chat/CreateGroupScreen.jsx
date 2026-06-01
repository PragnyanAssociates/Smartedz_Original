"use client"

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { MdArrowBack } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { Users, Loader2, Check, Megaphone } from 'lucide-react';

const CreateGroupScreen = ({ onBack, onGroupCreated, isEmbedded = false }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { can, isAllAccess } = usePermissions();

    const canEdit = can('GroupChat', 'edit');
    const hasCreateRights = isAllAccess || canEdit;

    const [groupName, setGroupName] = useState('');
    const [description, setDescription] = useState('');
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState([]);

    const [options, setOptions] = useState({ classes: [], roles: [] });
    const [isLoadingOptions, setIsLoadingOptions] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        const fetchOptions = async () => {
            if (!user?.id || !user?.institutionId) return;
            try {
                const res = await apiClient.get('/groups/options', {
                    params: { userId: user.id, instId: user.institutionId }
                });
                setOptions(res.data);
            } catch (error) {
                console.error("Failed to fetch group options");
            } finally {
                setIsLoadingOptions(false);
            }
        };
        fetchOptions();
    }, [user?.id, user?.institutionId]);

    const toggleCategory = (category) => {
        setSelectedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) return alert("Group name is required");
        if (selectedCategories.length === 0) return alert("Select at least one class or role");

        setIsCreating(true);
        try {
            const res = await apiClient.post('/groups', {
                userId: user.id,
                institutionId: user.institutionId,
                name: groupName.trim(),
                description: description.trim(),
                selectedCategories,
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
                <p className="text-sm text-zinc-500 mt-2 text-center max-w-md leading-relaxed">You do not have the required permissions to create new groups.</p>
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
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                            Description <span className="text-zinc-400 normal-case tracking-normal ml-1">(Optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors resize-none"
                            placeholder="What is this group for?"
                            rows={3}
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
                            <Loader2 className="size-4 animate-spin text-primary" /> Loading categories...
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {isAllAccess && (
                                <div className="space-y-2.5">
                                    <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Institution Wide</h3>
                                    <button
                                        onClick={() => toggleCategory('All')}
                                        className={`px-4 py-1.5 rounded-full text-xs font-semibold ring-1 ring-inset transition-all ${
                                            selectedCategories.includes('All') 
                                            ? 'bg-primary text-white ring-primary shadow-sm' 
                                            : 'bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 hover:ring-zinc-300'
                                        }`}
                                    >
                                        Entire Institution
                                    </button>
                                </div>
                            )}

                            {options.roles.length > 0 && (
                                <div className="space-y-2.5">
                                    <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Staff Roles</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {options.roles.map(role => (
                                            <button
                                                key={`role-${role}`}
                                                onClick={() => toggleCategory(role)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ring-inset transition-all flex items-center gap-1.5 ${
                                                    selectedCategories.includes(role) 
                                                    ? 'bg-indigo-600 text-white ring-indigo-600 shadow-sm' 
                                                    : 'bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 hover:ring-zinc-300'
                                                }`}
                                            >
                                                {role} {selectedCategories.includes(role) && <Check className="size-3" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {options.classes.length > 0 && (
                                <div className="space-y-2.5">
                                    <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Classes (Students)</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {options.classes.map(cls => (
                                            <button
                                                key={`class-${cls}`}
                                                onClick={() => toggleCategory(cls)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ring-inset transition-all flex items-center gap-1.5 ${
                                                    selectedCategories.includes(cls) 
                                                    ? 'bg-emerald-600 text-white ring-emerald-600 shadow-sm' 
                                                    : 'bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 hover:ring-zinc-300'
                                                }`}
                                            >
                                                {cls} {selectedCategories.includes(cls) && <Check className="size-3" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 shrink-0">
                <button
                    onClick={handleCreateGroup}
                    disabled={isCreating || !groupName.trim() || selectedCategories.length === 0}
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