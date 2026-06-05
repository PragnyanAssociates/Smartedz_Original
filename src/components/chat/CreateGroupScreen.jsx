"use client"

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { MdArrowBack } from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../Screens/PermissionsContext';
import { Users, Loader2, Check, Megaphone, ChevronDown, ChevronRight } from 'lucide-react';

const CreateGroupScreen = ({ onBack, onGroupCreated, isEmbedded = false }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { can, isAllAccess } = usePermissions();

    const canEdit = can('GroupChat', 'edit');
    const hasCreateRights = isAllAccess || canEdit;

    const [groupName, setGroupName] = useState('');
    const [description, setDescription] = useState('');
    const [isReadOnly, setIsReadOnly] = useState(false);
    
    // Selection States
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]); 
    
    // Accordion State
    const [expandedSection, setExpandedSection] = useState(null);

    // Data States
    const [options, setOptions] = useState({ classes: [], roles: [] });
    const [usersList, setUsersList] = useState([]); 
    const [isLoadingOptions, setIsLoadingOptions] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        const fetchOptions = async () => {
            if (!user?.id || !user?.institutionId) return;
            try {
                const [resOptions, resUsers] = await Promise.all([
                    apiClient.get('/groups/options', { params: { userId: user.id, instId: user.institutionId } }),
                    apiClient.get('/groups/users-options', { params: { instId: user.institutionId } })
                ]);
                
                setOptions(resOptions.data);
                setUsersList(resUsers.data);
            } catch (error) {
                console.error("Failed to fetch group options or users");
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

    const toggleUser = (userId) => {
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const toggleSection = (section) => {
        setExpandedSection(prev => prev === section ? null : section);
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) return alert("Group name is required");
        if (selectedCategories.length === 0 && selectedUserIds.length === 0) {
            return alert("Select at least one class, role, or specific individual.");
        }

        setIsCreating(true);
        try {
            const res = await apiClient.post('/groups', {
                userId: user.id,
                institutionId: user.institutionId,
                name: groupName.trim(),
                description: description.trim(),
                selectedCategories,
                selectedUserIds,
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

    // Helper to render accordion lists
    const renderAccordionSection = (title, items, isClass = false) => {
        if (!items || items.length === 0) return null;

        return (
            <div className="space-y-2.5">
                <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">{title}</h3>
                <div className="space-y-2">
                    {items.map(categoryName => {
                        const isExpanded = expandedSection === categoryName;
                        const isCategorySelected = selectedCategories.includes(categoryName);
                        
                        // Filter users for this specific role or class
                        const categoryUsers = usersList.filter(u => 
                            isClass ? u.class_name === categoryName : u.role === categoryName
                        );

                        return (
                            <div key={categoryName} className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-sm transition-all">
                                
                                {/* Accordion Header */}
                                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-50 transition-colors" onClick={() => toggleSection(categoryName)}>
                                    <div className="flex items-center gap-2">
                                        <div className="text-zinc-400">
                                            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                        </div>
                                        <span className="text-sm font-semibold text-zinc-800">{categoryName}</span>
                                        <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full font-medium">{categoryUsers.length}</span>
                                    </div>
                                    
                                    {/* Select Entire Category Button */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleCategory(categoryName); }}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${
                                            isCategorySelected 
                                            ? 'bg-primary/10 text-primary hover:bg-primary/20' 
                                            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                                        }`}
                                    >
                                        {isCategorySelected ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>

                                {/* Expanded Individual Users List */}
                                {isExpanded && categoryUsers.length > 0 && (
                                    <div className="p-3 bg-zinc-50/50 border-t border-zinc-100 flex flex-wrap gap-2">
                                        {categoryUsers.map(u => {
                                            const isUserSelected = selectedUserIds.includes(u.id) || isCategorySelected;
                                            return (
                                                <button
                                                    key={`user-${u.id}`}
                                                    onClick={() => { if (!isCategorySelected) toggleUser(u.id); }}
                                                    disabled={isCategorySelected}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ring-inset transition-all flex items-center gap-1.5 ${
                                                        isUserSelected 
                                                        ? 'bg-blue-600 text-white ring-blue-600 shadow-sm opacity-100' 
                                                        : 'bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50'
                                                    } ${isCategorySelected && !selectedUserIds.includes(u.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    {u.name} {isUserSelected && <Check className="size-3" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {isExpanded && categoryUsers.length === 0 && (
                                    <div className="p-3 bg-zinc-50/50 border-t border-zinc-100 text-xs text-zinc-400 italic">
                                        No individuals found.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
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
                            <Loader2 className="size-4 animate-spin text-primary" /> Loading options...
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

                            {renderAccordionSection('Staff Roles', options.roles, false)}
                            {renderAccordionSection('Classes (Students)', options.classes, true)}
                            
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