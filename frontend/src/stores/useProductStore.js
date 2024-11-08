import { create } from "zustand";
import toast from "react-hot-toast";
import axios from "../lib/axios";

export const useProductStore = create((set, get) => ({
    products: [],
    loading: false,
    error: null,

    setProduct: (products) => ({ set: products }),

    getProducts: async () => {
        set({ loading: true });
        try {
            const response = await axios.get("/products");
            set({ products: response.data.products, loading: false });
        } catch (error) {
            set({ error: "Failed to fetch products", loading: false });
            toast.error(
                error.response.data.error || "Failed to fetch products",
            );
        }
    },
    addProduct: async (product) => {
        set({ loading: true });
        try {
            const res = await axios.post("/products", product);
            set((prevState) => ({
                products: [...prevState.products, res.data],
                loading: false,
            }));
        } catch (error) {
            toast.error(error.response.data.error);
            set({ loading: false });
        }
    },

    deleteProduct: async (id) => {
        set({ loading: true });
        try {
            await axios.delete(`/products/${id}`);
            get().getProducts();
        } catch (error) {
            toast.error(
                error.response.data.error || "Failed to delete product",
            );
        }
    },

    fetchProductsByCategory: async (cat) => {
        set({ loading: true });
        try {
            const response = await axios.get(`/products/category/${cat}`);
            set({ products: response.data.products, loading: false });
        } catch (error) {
            set({ error: "Failed to fetch products", loading: false });
            toast.error(
                error.response.data.error || "Failed to fetch products",
            );
        }
    },
    toggleFeaturedProduct: async (id) => {
        try {
            const response = await axios.patch(`/products/${id}`);
            if (response.status === 200) {
                set((state) => ({
                    products: state.products.map((product) =>
                        product.id === id
                            ? { ...product, isFeatured: !product.isFeatured }
                            : product,
                    ),
                }));
            }
        } catch (error) {
            toast.error(
                error.response.data.error || "Failed to toggle featured",
            );
        }
    },

    fetchFeaturedProducts: async () => {
        set({ loading: true });

        try {
            const response = await axios.get("/products/featured");
            set({ products: response.data.products, loading: false });
        } catch (error) {
            set({ error: "Failed to fetch products", loading: false });
            toast.error(
                error.response.data.error || "Failed to fetch products",
            );
        }
    },
}));
