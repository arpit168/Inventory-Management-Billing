import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { authAPI } from '../services/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const fetchProfile = useCallback(async (currentToken) => {
    if (!currentToken) {
      setUser(null);
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const { data } = await authAPI.getProfile();
      
      // Only update if request wasn't cancelled
      if (!controller.signal.aborted && data.success) {
        setUser(data.user);
        setError(null);
      }
    } catch (err) {
      // Ignore abort errors (from token change)
      if (err.name === 'AbortError') {
        return;
      }

      // On auth error, clear token
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } else {
        console.error('Failed to fetch profile:', err.message);
        setError('Failed to fetch profile');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  // Fetch profile when token changes
  useEffect(() => {
    fetchProfile(token);

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [token, fetchProfile]);

  const register = useCallback(async (fullName, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authAPI.register({ fullName, email, password, confirmPassword: password });
      return data;
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authAPI.login({ email, password });
      if (data.success) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
      }
      return data;
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const verifyEmail = useCallback(async (token) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authAPI.verifyEmail(token);
      return data;
    } catch (err) {
      const message = err.response?.data?.message || 'Email verification failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authAPI.forgotPassword({ email });
      return data;
    } catch (err) {
      const message = err.response?.data?.message || 'Forgot password request failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (token, password) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authAPI.resetPassword(token, { password, confirmPassword: password });
      return data;
    } catch (err) {
      const message = err.response?.data?.message || 'Password reset failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authAPI.updateProfile(updates);
      if (data.success) {
        setUser(data.user);
      }
      return data;
    } catch (err) {
      const message = err.response?.data?.message || 'Profile update failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authAPI.changePassword({ currentPassword, newPassword });
      return data;
    } catch (err) {
      const message = err.response?.data?.message || 'Password change failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token && !!user,
    register,
    login,
    logout,
    verifyEmail,
    forgotPassword,
    resetPassword,
    updateProfile,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
