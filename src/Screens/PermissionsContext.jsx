import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { useAuth } from '../context/AuthContext';
import { TAB_TO_MODULE, MODULES } from './Modules';

// =====================================================================
//  PermissionsContext
//  Holds the permission rows for the currently-logged-in user.
//  Super Admin and Developer are always granted full access — they
//  bypass the database lookup entirely.
// =====================================================================

const PermissionsContext = createContext(null);

// Roles that always see everything regardless of the permissions table
const ALL_ACCESS_ROLES = ['Super Admin', 'Developer'];

export function PermissionsProvider({ children }) {
  const { user } = useAuth();
  const [perms, setPerms] = useState({});      // { moduleName: { can_read, can_edit, can_delete, is_hidden } }
  const [loading, setLoading] = useState(true);

  const isAllAccess = !!user && ALL_ACCESS_ROLES.includes(user.role);

  const loadPermissions = useCallback(async () => {
    if (!user) { setPerms({}); setLoading(false); return; }

    // Super Admin / Developer → synthesize full access for every module
    if (isAllAccess) {
      const full = {};
      MODULES.forEach(m => {
        full[m.module_name] = {
          can_read: true, can_edit: true, can_delete: true, is_hidden: false
        };
      });
      setPerms(full);
      setLoading(false);
      return;
    }

    // Everyone else → fetch from the server based on their role
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/my-permissions/${user.id}`);
      const rows = await res.json();
      const map = {};
      // Default every module to "no access" unless a row exists
      MODULES.forEach(m => {
        map[m.module_name] = {
          can_read: false, can_edit: false, can_delete: false, is_hidden: true
        };
      });
      // Apply server rows on top
      (rows || []).forEach(r => {
        map[r.module_name] = {
          can_read:   !!r.can_read,
          can_edit:   !!r.can_edit,
          can_delete: !!r.can_delete,
          is_hidden:  !!r.is_hidden
        };
      });
      setPerms(map);
    } catch (e) {
      console.error('Failed to load permissions:', e);
      // Fail closed: deny everything on network error
      const closed = {};
      MODULES.forEach(m => {
        closed[m.module_name] = { can_read: false, can_edit: false, can_delete: false, is_hidden: true };
      });
      setPerms(closed);
    }
    setLoading(false);
  }, [user, isAllAccess]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  // -------- Helpers consumed by sidebar / pages / row actions ---------
  const can = (moduleName, action) => {
    if (isAllAccess) return true;
    const p = perms[moduleName];
    if (!p) return false;
    if (p.is_hidden) return false;
    switch (action) {
      case 'read':   return p.can_read;
      case 'edit':   return p.can_edit;
      case 'delete': return p.can_delete;
      case 'view':   return p.can_read || p.can_edit || p.can_delete; // any access
      default:       return false;
    }
  };

  const isVisible = (moduleName) => {
    if (isAllAccess) return true;
    const p = perms[moduleName];
    if (!p) return false;
    if (p.is_hidden) return false;
    // Visible only if at least one of read/edit/delete is granted
    return p.can_read || p.can_edit || p.can_delete;
  };

  return (
    <PermissionsContext.Provider value={{
      perms, loading, isAllAccess,
      can, isVisible,
      refreshPermissions: loadPermissions
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);