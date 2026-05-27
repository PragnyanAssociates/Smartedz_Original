"use client"

import React, { useState } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { usePermissions } from "../../Screens/PermissionsContext"; 
import { MdArrowBack } from 'react-icons/md';
import apiClient from '../../api/client';
import { Camera, Save, Trash2, Eye, EyeOff, Megaphone } from 'lucide-react';
import { getProfileImageSource } from '../../utils/imageHelpers';

const getContainerClasses = () => {
  return "w-full max-w-7xl 2xl:max-w-[85vw] mx-auto px-3 sm:px-4 md:px-6 lg:px-8";
};

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
formData.append('userId', user.id); 

    try {
      const res = await apiClient.post(`/groups/${group.id}/dp`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
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
    <div className={`${isEmbedded ? 'h-full w-full overflow-y-auto' : 'min-h-screen'} bg-slate-50`}>
      
      {isViewerVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" onClick={() => setViewerVisible(false)}>
          <div className="relative max-w-4xl w-full h-full flex items-center justify-center">
            <button onClick={() => setViewerVisible(false)} className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black bg-opacity-50 rounded-full p-2 z-10">
              <EyeOff className="w-6 h-6" />
            </button>
            <img src={imageSourceForDisplay} alt="Group profile enlarged" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}

      <main className={`${getContainerClasses()} py-6 sm:py-8`}>
        <div className="mb-6">
          <button onClick={handleBackClick} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors" title="Go Back">
            <MdArrowBack className="text-lg" />
            <span>Back to Chat</span>
          </button>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden p-6 md:p-8">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Image Section */}
              <div className="flex flex-col items-center md:items-start">
                <label className="block text-base font-medium text-slate-900 mb-2 text-center md:text-left">
                  Group Icon
                </label>
                <div className="relative group">
                  <button onClick={() => setViewerVisible(true)} className="relative block">
                    <img src={imageSourceForDisplay} alt="Group profile" className="w-36 h-36 rounded-full bg-gray-200 object-cover cursor-pointer hover:opacity-95 transition-opacity border-4 border-white shadow-md" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 rounded-full pointer-events-none">
                        <Eye className="text-white w-6 h-6 drop-shadow-md" />
                    </div>
                  </button>
                  
                  {hasEditRights && (
                    <div className="absolute bottom-1 right-1">
                      <input type="file" accept="image/*" className="hidden" id="group-dp-upload" onChange={handlePickImage} disabled={isSaving} />
                      <label htmlFor="group-dp-upload" className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-lg transition-colors border-2 border-white">
                        <Camera className="w-5 h-5" />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Section */}
              <div className="md:col-span-2 flex flex-col gap-6">
                
                {/* Group Name */}
                <div>
                  <label htmlFor="groupName" className="block text-sm font-medium text-slate-700 mb-2">Group Name</label>
                  <input
                    type="text"
                    id="groupName"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={!hasEditRights || isSaving}
                    placeholder="Enter group name"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-slate-900 bg-white disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                {/* Broadcast Toggle (Notice Board) */}
                {hasEditRights && (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900 flex items-center gap-2">
                           <Megaphone className="w-4 h-4 text-blue-600" />
                           Announcement Mode
                        </span>
                        <span className="text-xs text-slate-500 mt-1 max-w-sm">
                          When enabled, only Admins and authorized roles can send messages.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer mt-1">
                        <input type="checkbox" className="sr-only peer" checked={isReadOnly} onChange={() => setIsReadOnly(!isReadOnly)} disabled={isSaving} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100 mt-2">
                  {hasEditRights && (
                    <button
                      onClick={handleSaveChanges}
                      disabled={isSaving}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  )}

                  {hasDeleteRights && (
                    <button
                      onClick={handleDeleteGroup}
                      disabled={isSaving}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span>Delete Group</span>
                    </button>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default GroupSettingsScreen;