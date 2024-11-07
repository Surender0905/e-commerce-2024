import { create } from "zustand";
import axios from "../lib/axios";
import { toast } from "react-hot-toast";

export const useUserStore = create((set, get) => ({
    user: null,
    loading: false,
    checkingAuth: true,

    signup: async ({ name, email, password, confirmPassword }) => {
        set({ loading: true });

        if (password !== confirmPassword) {
            set({ loading: false });
            return toast.error("Passwords do not match");
        }

        try {
            set({ loading: true });
            const { data } = await axios.post("/auth/signup", {
                name,
                email,
                password,
                confirmPassword,
            });
            set({ user: data.user, loading: false });
            return data;
        } catch (error) {
            set({ loading: false });
            toast.error(error.response.data.message || "An error occurred");
            return error.response.data;
        }
    },

    login: async ({ email, password }) => {
        set({ loading: true });
        try {
            const { data } = await axios.post("/auth/login", {
                email,
                password,
            });
            set({ user: data.user, loading: false });
            return data;
        } catch (error) {
            set({ loading: false });
            toast.error(error.response.data.message || "An error occurred");
            return error.response.data;
        }
    },

    logout: async () => {
        try {
            await axios.post("/auth/logout");
            set({ user: null });
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    "An error occurred during logout",
            );
        }
    },

    checkAuth: async () => {
        if (get().checkingAuth) return;

        set({ checkingAuth: true });
        try {
            const response = await axios.post("/auth/refresh-token");
            set({ checkingAuth: false });
            return response.data;
        } catch (error) {
            set({ user: null, checkingAuth: false });
            throw error;
        }
    },
}));

// TODO: Implement the axios interceptors for refreshing access token

// Axios interceptor for token refresh
let refreshPromise = null;

axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                // If a refresh is already in progress, wait for it to complete
                if (refreshPromise) {
                    await refreshPromise;
                    return axios(originalRequest);
                }

                // Start a new refresh process
                refreshPromise = useUserStore.getState().refreshToken();
                await refreshPromise;
                refreshPromise = null;

                return axios(originalRequest);
            } catch (refreshError) {
                // If refresh fails, redirect to login or handle as needed
                useUserStore.getState().logout();
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    },
);