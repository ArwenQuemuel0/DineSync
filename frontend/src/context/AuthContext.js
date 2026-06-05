import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
  } from 'react';
  
  import AsyncStorage from '@react-native-async-storage/async-storage';
  
  import {
    loginUser,
    tableOnline,
    tableHeartbeat,
    tableOffline,
  } from '../api/dinesync';
  
  const AuthContext = createContext();
  
  // =========================
  // STAFF LOGOUT PASSWORD
  // =========================
  
  const STAFF_LOGOUT_PASSWORD =
    'dinesync123';
  
  // =========================
  // AUTO RESTORE SESSION
  // false = always show login screen on app open.
  // Order history still persists because staff
  // logout no longer closes the table session.
  // =========================

  const AUTO_RESTORE_SESSION = false;
  
  export const AuthProvider = ({ children }) => {
    const [user, setUser] =
      useState(null);
  
    const [token, setToken] =
      useState(null);
  
    const [loading, setLoading] =
      useState(true);
  
    const heartbeatRef =
      useRef(null);
  
    useEffect(() => {
      loadSavedAuth();
  
      return () => {
        stopHeartbeat();
      };
    }, []);
  
    const loadSavedAuth = async () => {
      try {
        const savedToken =
          await AsyncStorage.getItem('token');
  
        const savedUser =
          await AsyncStorage.getItem('user');
  
        if (
          AUTO_RESTORE_SESSION &&
          savedToken &&
          savedUser
        ) {
          const parsedUser =
            JSON.parse(savedUser);
  
          setToken(savedToken);
          setUser(parsedUser);
  
          if (
            parsedUser.role ===
              'table_customer' &&
            parsedUser.table_number
          ) {
            try {
              await tableOnline();
              startHeartbeat();
            } catch (error) {
              console.log(
                'Table online restore error:',
                error?.response?.data ||
                  error.message
              );
            }
          }
        }
      } catch (error) {
        console.log(
          'Load auth error:',
          error
        );
      } finally {
        setLoading(false);
      }
    };
  
    const login = async (
      email,
      password
    ) => {
      try {
        const responseData =
          await loginUser(
            email,
            password
          );
  
        const loginToken =
          responseData.token ||
          responseData.access_token ||
          responseData.data?.token;
  
        const loginUserData =
          responseData.user ||
          responseData.data?.user;
  
        if (
          !loginToken ||
          !loginUserData
        ) {
          return {
            success: false,
            message:
              'Invalid login response from server.',
          };
        }
  
        if (
          loginUserData.role !==
          'table_customer'
        ) {
          return {
            success: false,
            message:
              'Only table accounts can access the tablet ordering app.',
          };
        }
  
        if (
          !loginUserData.table_number
        ) {
          return {
            success: false,
            message:
              'This account has no assigned table number.',
          };
        }
  
        await AsyncStorage.setItem(
          'token',
          loginToken
        );
  
        await AsyncStorage.setItem(
          'user',
          JSON.stringify(loginUserData)
        );
  
        setToken(loginToken);
        setUser(loginUserData);
  
        await tableOnline();
        startHeartbeat();
  
        return {
          success: true,
          user: loginUserData,
        };
      } catch (error) {
        console.log(
          'Login error:',
          error?.response?.data ||
            error.message
        );
  
        return {
          success: false,
          message:
            error?.response?.data?.message ||
            'Login failed. Please check the email and password.',
        };
      }
    };
  
    const startHeartbeat = () => {
      stopHeartbeat();
  
      heartbeatRef.current =
        setInterval(async () => {
          try {
            await tableHeartbeat();
  
            console.log(
              'Heartbeat sent'
            );
          } catch (error) {
            console.log(
              'Heartbeat error:',
              error?.response?.data ||
                error.message
            );
          }
        }, 30000);
    };
  
    const stopHeartbeat = () => {
      if (heartbeatRef.current) {
        clearInterval(
          heartbeatRef.current
        );
  
        heartbeatRef.current = null;
      }
    };
  
    const logout = async (
      staffPassword
    ) => {
      if (
        staffPassword !==
        STAFF_LOGOUT_PASSWORD
      ) {
        return {
          success: false,
          message:
            'Incorrect staff password.',
        };
      }
  
      try {
        stopHeartbeat();
  
        try {
          await tableOffline();
        } catch (error) {
          console.log(
            'Table offline error:',
            error?.response?.data ||
              error.message
          );
        }
  
        await AsyncStorage.removeItem(
          'token'
        );
  
        await AsyncStorage.removeItem(
          'user'
        );
  
        setToken(null);
        setUser(null);
  
        return {
          success: true,
        };
      } catch (error) {
        console.log(
          'Logout error:',
          error
        );
  
        return {
          success: false,
          message: 'Logout failed.',
        };
      }
    };
  
    return (
      <AuthContext.Provider
        value={{
          user,
          token,
          loading,
          login,
          logout,
          isLoggedIn:
            !!user && !!token,
          tableNumber:
            user?.table_number,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };
  
  export const useAuth = () => {
    return useContext(AuthContext);
  };