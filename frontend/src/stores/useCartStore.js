import { create } from "zustand";
import axios from "../lib/axios";
import { toast } from "react-hot-toast";

export const useCartStore = create((set, get) => ({
    cart: [],
    coupon: null,
    total: 0,
    subtotal: 0,
    isCouponApplied: false,
    loading: false,

    getMyCoupon: async () => {
        set({ loading: true });
        try {
            const { data } = await axios.get("/coupon");
            set({ coupon: data, loading: false });
        } catch (error) {
            toast.error("Error while loading coupon");
            console.error(error);
            set({ loading: false });
        }
    },
    applyCoupon: async (code) => {
        set({ loading: true });
        try {
            const { data } = await axios.post("/coupon/validate", { code });
            set({ coupon: data.coupon, loading: false, isCouponApplied: true });
            get().calculateTotals();
            toast.success("Coupon applied successfully");
        } catch (error) {
            toast.error("Error while applying coupon");
            console.error(error);
            set({ loading: false });
        }
    },

    removeCoupon: () => {
        set({ coupon: null, isCouponApplied: false });
        get().calculateTotals();
        toast.success("Coupon removed");
    },

    getCartItems: async () => {
        set({ loading: true });
        try {
            const { data } = await axios.get("/cart");
            console.log(data);
            set({ cart: data, loading: false });

            get().calculateTotals();
        } catch (error) {
            toast.error("Error while loading cart");
            console.error(error);
            set({ loading: false, cart: [] });
        }
    },

    clearCart: () => {
        set({ cart: [], coupon: null, total: 0, subtotal: 0 });
    },

    addToCart: async (product) => {
        set({ loading: true });
        try {
            await axios.post("/cart", { productId: product._id });
            toast.success("Product added to cart");

            set((prevState) => {
                const existingItem = prevState.cart.find(
                    (item) => item._id === product._id,
                );
                const newCart = existingItem
                    ? prevState.cart.map((item) =>
                          item._id === product._id
                              ? { ...item, quantity: item.quantity + 1 }
                              : item,
                      )
                    : [...prevState.cart, { ...product, quantity: 1 }];
                return { cart: newCart };
            });
            get().calculateTotals();
        } catch (error) {
            toast.error("Error while adding product to cart");
            console.error(error);
            set({ loading: false });
        }
    },

    removeFromCart: async (productId) => {
        set({ loading: true });
        try {
            await axios.delete(`/cart/${productId}`);
            toast.success("Product removed from cart");
            set((prevState) => ({
                cart: prevState.cart.filter((item) => item._id !== productId),
            }));
            get().calculateTotals();
        } catch (error) {
            toast.error("Error while removing product from cart");
            console.error(error);
            set({ loading: false });
        }
    },
    updateQuantity: async (productId, quantity) => {
        if (quantity === 0) return get().removeFromCart(productId);

        set({ loading: true });
        try {
            await axios.put(`/cart/${productId}`, { quantity });
            toast.success("Product quantity updated");
            set((prevState) => ({
                cart: prevState.cart.map((item) => {
                    if (item._id === productId) {
                        return { ...item, quantity };
                    }
                    return item;
                }),
            }));
            get().calculateTotals();
        } catch (error) {
            toast.error("Error while updating product quantity");
            console.error(error);
            set({ loading: false });
        }
    },
    calculateTotals: () => {
        const { cart, coupon } = get();
        const subtotal = cart.reduce((total, item) => {
            return total + item.price * item.quantity;
        }, 0);
        let total = subtotal;
        if (coupon) {
            total -= subtotal * (coupon.discountPercentage / 100);
        }
        set({
            subtotal,
            total,
        });
    },
}));
