"use client"

import React, { useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { usePermissions } from "../../Screens/PermissionsContext"; 
import { MdArrowBack } from 'react-icons/md';
import apiClient from '../../api/client';
import { Camera, Save, Trash2, Eye, EyeOff, Megaphone, Loader2, Image as ImageIcon } from 'lucide-react';
import { getProfileImageSource } from '../../utils/imageHelpers';

const GroupSettingsScreen = ({ group: propGroup, isEmbedded, onBack, onGroupDeleted }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const { can, isAllAccess } = usePermissions();
  const canEdit = can('GroupChat', 'edit');
  const canDelete = can('GroupChat', 'delete');
  
  const initialGroup = propGroup || location.state?.group || {};
  
  const [group, setGroup] = useState(initialGroup);
  const [groupName, setGroupName] = useState(group.name || '');
  const [isReadOnly, setIsReadOnly] = useState(group.is_read_only === 1 || group.is_read_only === true);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isViewerVisible, setViewerVisible] = useState(false);

  // Unified Permissions Check
  const hasEditRights = (user?.id === group.created_by) || canEdit || isAllAccess;
  const hasDeleteRights = (user?.id === group.created_by) || canDelete || isAllAccess;

  const handlePickImage = async (e) => {
    if (!hasEditRights) return;
    
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    setIsSaving(true);
    const formData = new FormData();
    formData.append('group_dp', file);
    
    // Add fallback in case user is not fully loaded
    if (user?.id) {
      formData.append('userId', user.id); 
    }

    try {
      // FIX: Removed the manual Content-Type header so the browser can set the boundary automatically
      const res = await apiClient.post(`/groups/${group.id}/dp`, formData);
      setGroup({ ...group, group_dp_url: res.data.group_dp_url });
      alert('Success: Group DP updated.');
    } catch (error) {
      alert('Upload Failed: ' + (error.response?.data?.message || 'An error occurred.'));
    } finally {
      setIsSaving(false);
      e.target.value = ''; 
    }
  };

  const handleSaveChanges = async () => {
    if (!groupName.trim()) {
      alert('Error: Group name cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.put(`/groups/${group.id}`, {
        userId: user.id,   
        name: groupName.trim(),
        backgroundColor: group.background_color,
        isReadOnly: isReadOnly
      });
      
      const updatedGroup = { ...group, name: groupName.trim(), is_read_only: isReadOnly };
      alert('Success: Group details updated.');
      
      if (isEmbedded && onBack) {
        onBack(); 
      } else {
        navigate('/WhatsAppLayout', { state: { selectedGroup: updatedGroup } });
      }
      
    } catch (error) {
      alert('Save Failed: ' + (error.response?.data?.message || 'An error occurred.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = () => {
    if (window.confirm(
      'Delete Group: Are you sure you want to permanently delete this group? This action cannot be undone.'
    )) {
      performDeleteGroup();
    }
  };

  const performDeleteGroup = async () => {
    try {
      await apiClient.delete(`/groups/${group.id}`, {
        data: { userId: user.id }
      });
      
      alert('Success: Group has been deleted.');
      
      if (isEmbedded && onGroupDeleted) {
        onGroupDeleted();
      } else if (isEmbedded && onBack) {
        onBack();
      } else {
        navigate('/WhatsAppLayout'); 
      }
    } catch (error) {
      alert('Deletion Failed: ' + (error.response?.data?.message || 'An error occurred.'));
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isSaving && hasEditRights) {
      handleSaveChanges();
    }
  };

  const handleBackClick = () => {
    if (isEmbedded && onBack) {
      onBack();
    } else {
      navigate('/WhatsAppLayout', { state: { selectedGroup: group } });
    }
  };

  const imageSourceForDisplay = getProfileImageSource(group.group_dp_url);

  return (
    <div className={`flex flex-col bg-white max-w-2xl mx-auto w-full border-x border-zinc-200 shadow-sm animate-in slide-in-from-right-8 duration-300 ${isEmbedded ? 'h-full' : 'min-h-[calc(100vh-64px)]'}`}>
      
      {/* Full Screen Image Viewer */}
      {isViewerVisible && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setViewerVisible(false)}>
          <div className="relative max-w-4xl w-full h-full flex items-center justify-center p-4">
            <button onClick={() => setViewerVisible(false)} className="absolute top-6 right-6 p-2 text-white/70 hover:text-white transition-colors bg-white/10 rounded-full z-10">
              <EyeOff className="size-6" />
            </button>
            <img src={imageSourceForDisplay} alt="Group profile enlarged" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-zinc-200 bg-zinc-50 shrink-0">
        <button onClick={handleBackClick} className="p-2 mr-2 hover:bg-zinc-200 rounded-full text-zinc-500 hover:text-zinc-900 transition-colors">
          <MdArrowBack className="size-5" />
        </button>
        <h1 className="text-lg font-semibold text-zinc-900 tracking-tight">Group Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
        
        {/* Image Section */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative group">
            <button onClick={() => setViewerVisible(true)} className="relative block">
              <img src={imageSourceForDisplay} alt="Group profile" className="size-32 sm:size-40 rounded-full bg-zinc-100 object-cover cursor-pointer hover:opacity-95 transition-opacity ring-4 ring-white shadow-md" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-full pointer-events-none backdrop-blur-[1px]">
                <Eye className="text-white size-8 drop-shadow-md" />
              </div>
            </button>
            
            {hasEditRights && (
              <div className="absolute bottom-0 right-0 sm:bottom-1 sm:right-1">
                <input type="file" accept="image/*" className="hidden" id="group-dp-upload" onChange={handlePickImage} disabled={isSaving} />
                <label htmlFor="group-dp-upload" className="flex items-center justify-center size-10 sm:size-11 bg-primary hover:bg-primary/90 text-white rounded-full cursor-pointer shadow-lg transition-colors ring-4 ring-white">
                  <Camera className="size-5" />
                </label>
              </div>
            )}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">{group.name}</h2>
            <p className="text-xs font-medium text-zinc-500 mt-1 uppercase tracking-wider">Group Icon</p>
          </div>
        </div>

        {/* Form Section */}
        <div className="space-y-6 pt-4 border-t border-zinc-100">
          
          <div className="space-y-1.5">
            <label htmlFor="groupName" className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!hasEditRights || isSaving}
              placeholder="Enter group name"
              className="h-9 w-full bg-white border border-zinc-200 rounded-md px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm transition-colors disabled:bg-zinc-50 disabled:text-zinc-500"
            />
          </div>

          {/* Broadcast Toggle (Notice Board) */}
          {hasEditRights && (
            <div className="bg-zinc-50 rounded-lg p-4 ring-1 ring-inset ring-black/5 flex items-start justify-between">
              <div className="flex flex-col pr-4">
                <span className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <Megaphone className="size-4 text-primary" />
                  Announcement Mode
                </span>
                <span className="text-[11px] font-medium text-zinc-500 mt-1 leading-relaxed max-w-sm">
                  When enabled, only Admins and authorized roles can send messages.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
                <input type="checkbox" className="sr-only peer" checked={isReadOnly} onChange={() => setIsReadOnly(!isReadOnly)} disabled={isSaving} />
                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-zinc-200 bg-zinc-50 shrink-0 flex flex-col sm:flex-row gap-3">
        {hasEditRights && (
          <button
            onClick={handleSaveChanges}
            disabled={isSaving || !groupName.trim() || (groupName === group.name && isReadOnly === (group.is_read_only === 1 || group.is_read_only === true))}
            className="w-full sm:flex-1 h-12 sm:h-10 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-lg sm:rounded-md font-semibold text-[15px] sm:text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="size-[18px] sm:size-4 animate-spin shrink-0" /> : <Save className="size-[18px] sm:size-4 shrink-0" />}
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        )}

        {hasDeleteRights && (
          <button
            onClick={handleDeleteGroup}
            disabled={isSaving}
            className="w-full sm:flex-1 h-12 sm:h-10 px-6 flex items-center justify-center gap-2 bg-white text-red-600 hover:bg-red-50 ring-1 ring-inset ring-red-200 hover:ring-red-300 rounded-lg sm:rounded-md font-semibold text-[15px] sm:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Trash2 className="size-[18px] sm:size-4 shrink-0" />
            <span>Delete Group</span>
          </button>
        )}
      </div>

    </div>
  );
};

export default GroupSettingsScreen;