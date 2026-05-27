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
            <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6">
                <Users className="w-12 h-12 text-slate-300 mb-4" />
                <h2 className="text-xl font-semibold text-slate-700">Access Denied</h2>
                <p className="text-slate-500 mt-2 text-center max-w-md">You do not have the required permissions to create new groups.</p>
                <button onClick={onBack} className="mt-6 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Go Back</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white max-w-2xl mx-auto w-full border-x border-slate-200 shadow-sm">
            <div className="flex items-center px-4 py-3 border-b border-slate-200 bg-slate-50">
                <button onClick={onBack} className="p-2 mr-2 hover:bg-slate-200 rounded-full text-slate-600 transition-colors">
                    <MdArrowBack className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-semibold text-slate-800">New Group</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                            placeholder="Enter group name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                            placeholder="What is this group for?"
                            rows={2}
                        />
                    </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex items-start justify-between">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900 flex items-center gap-2">
                            <Megaphone className="w-4 h-4 text-blue-600" />
                            Announcement Mode
                        </span>
                        <span className="text-xs text-slate-500 mt-1 max-w-sm">
                            Only Admins and authorized roles can send messages.
                        </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer mt-1">
                        <input type="checkbox" className="sr-only peer" checked={isReadOnly} onChange={() => setIsReadOnly(!isReadOnly)} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">Add Members</label>
                    {isLoadingOptions ? (
                        <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading categories...</div>
                    ) : (
                        <div className="space-y-4">
                            {isAllAccess && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Institution Wide</h3>
                                    <button
                                        onClick={() => toggleCategory('All')}
                                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${selectedCategories.includes('All') ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                                    >
                                        Entire Institution
                                    </button>
                                </div>
                            )}

                            {options.roles.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Staff Roles</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {options.roles.map(role => (
                                            <button
                                                key={`role-${role}`}
                                                onClick={() => toggleCategory(role)}
                                                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-1 ${selectedCategories.includes(role) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                                            >
                                                {role} {selectedCategories.includes(role) && <Check className="w-3.5 h-3.5" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {options.classes.length > 0 && (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Classes (Students)</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {options.classes.map(cls => (
                                            <button
                                                key={`class-${cls}`}
                                                onClick={() => toggleCategory(cls)}
                                                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors flex items-center gap-1 ${selectedCategories.includes(cls) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                                            >
                                                {cls} {selectedCategories.includes(cls) && <Check className="w-3.5 h-3.5" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
                <button
                    onClick={handleCreateGroup}
                    disabled={isCreating || !groupName.trim() || selectedCategories.length === 0}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                    {isCreating ? 'Creating...' : 'Create Group'}
                </button>
            </div>
        </div>
    );
};

export default CreateGroupScreen;