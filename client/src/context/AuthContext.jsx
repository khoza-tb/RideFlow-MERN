
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      try {
        const response = await api.get("/auth/me");

        if (active) {
          setUser(response.data.user ?? null);
        }
      } catch (error) {
        if (active) {
          setUser(null);

          if (error.response?.status !== 401) {
            console.error(
              "AUTH SESSION CHECK ERROR:",
              error.response?.data || error.message
            );
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  const login = async (data) => {
    try {
      const response = await api.post("/auth/login", data);
      const authenticatedUser = response.data.user;

      if (!authenticatedUser) {
        throw new Error(
          "The server did not return an authenticated user."
        );
      }

      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error.response?.data || error.message
      );

      throw error;
    }
  };

  const register = async (data) => {
    try {
      const response = await api.post("/auth/register", data);
      const registeredUser = response.data.user;

      if (!registeredUser) {
        throw new Error(
          "The server did not return the registered user."
        );
      }

      setUser(registeredUser);
      return registeredUser;
    } catch (error) {
      console.error(
        "REGISTRATION ERROR:",
        error.response?.data || error.message
      );

      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error(
        "LOGOUT REQUEST ERROR:",
        error.response?.data || error.message
      );
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside an AuthProvider."
    );
  }

  return context;
};

