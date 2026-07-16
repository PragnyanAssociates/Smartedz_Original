import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { useAuth } from '../context/AuthContext';
import { MODULES } from './Modules';

// =====================================================================
//  PermissionsContext
//  Holds the permission rows for the currently-logged-in user.
//
//  • Developer  — total bypass. Never restricted, never hidden.
//  • Super Admin — always full Read / Edit / Delete, but DOES respect the
//    Hide flag saved in the permissions matrix, so they can drop modules
//    they don't want from their own sidebar. A module with no saved row
//    stays fully visible.
//  • Everyone else — a module with no saved row is HIDDEN. A newly
//    created role therefore starts with an empty sidebar until the Super
//    Admin grants Read in Manage Logins → Permissions.
// =====================================================================

const PermissionsContext = createContext(null);

const FULL_OPEN   = { can_read: true,  can_edit: true,  can_delete: true,  is_hidden: false };
const FULL_CLOSED = { can_read: false, can_edit: false, can_delete: false, is_hidden: true  };

const mapAll = (value) => {
  const m = {};
  MODULES.forEach(mod => { m[mod.module_name] = { ...value }; });
  return m;
};

export function PermissionsProvider({ children }) {
  const { user } = useAuth();
  const [perms, setPerms] = useState({});
  const [loading, setLoading] = useState(true);

  const role = user?.role;
  const isDeveloper  = role === 'Developer';
  const isSuperAdmin = role === 'Super Admin';

  // Full CRUD everywhere they can see — what module screens check to decide
  // between the admin console and a read-only view.
  const isAllAccess = !!user && (isDeveloper || isSuperAdmin);

  const loadPermissions = useCallback(async () => {
    if (!user) { setPerms({}); setLoading(false); return; }

    if (isDeveloper) {
      setPerms(mapAll(FULL_OPEN));
      setLoading(false);
      return;
    }

    // Super Admin starts open so nothing flickers as "no access" while the
    // Hide flags load; a failed fetch simply leaves them fully open.
    setPerms(mapAll(isSuperAdmin ? FULL_OPEN : FULL_CLOSED));
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/my-permissions/${user.id}`);
      const rows = await res.json();

      const map = mapAll(isSuperAdmin ? FULL_OPEN : FULL_CLOSED);
      (rows || []).forEach(r => {
        map[r.module_name] = isSuperAdmin
          ? { ...FULL_OPEN, is_hidden: !!r.is_hidden }   // only Hide applies
          : {
              can_read:   !!r.can_read,
              can_edit:   !!r.can_edit,
              can_delete: !!r.can_delete,
              is_hidden:  !!r.is_hidden
            };
      });
      setPerms(map);
    } catch (e) {
      console.error('Failed to load permissions:', e);
      setPerms(mapAll(isSuperAdmin ? FULL_OPEN : FULL_CLOSED));
    }
    setLoading(false);
  }, [user, isDeveloper, isSuperAdmin]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  const can = (moduleName, action) => {
    if (isDeveloper) return true;
    const p = perms[moduleName];
    // Unknown module (not in MODULES): open for Super Admin, closed for the rest.
    if (!p) return isSuperAdmin;
    if (p.is_hidden) return false;
    switch (action) {
      case 'read':   return p.can_read;
      case 'edit':   return p.can_edit;
      case 'delete': return p.can_delete;
      case 'view':   return p.can_read || p.can_edit || p.can_delete;
      default:       return false;
    }
  };

  const isVisible = (moduleName) => {
    if (isDeveloper) return true;
    const p = perms[moduleName];
    if (!p) return isSuperAdmin;
    if (p.is_hidden) return false;
    return p.can_read || p.can_edit || p.can_delete;
  };

  return (
    <PermissionsContext.Provider value={{ perms, loading, isAllAccess, isSuperAdmin, isDeveloper, can, isVisible, refreshPermissions: loadPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);