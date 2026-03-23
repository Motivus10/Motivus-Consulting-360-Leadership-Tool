import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('motivus_token'));
  const [adminName, setAdminName] = useState(localStorage.getItem('motivus_name'));

  const login = (tok, name) => {
    localStorage.setItem('motivus_token', tok);
    localStorage.setItem('motivus_name', name);
    setToken(tok);
    setAdminName(name);
  };

  const logout = () => {
    localStorage.removeItem('motivus_token');
    localStorage.removeItem('motivus_name');
    setToken(null);
    setAdminName(null);
  };

  return (
    <AuthContext.Provider value={{ token, adminName, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
