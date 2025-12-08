import express from 'express';
import { authenticate as authMiddleware, requireAdmin } from '../middleware/authMiddleware.js';
import {
  // Product Management (Admin)
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  
  // Product Browsing (Public)
  getProducts,
  getCategories,
  
  // Cart Management (User)
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  
  // Payment Processing
  createPaymentIntent,
  
  // Order Management (User)
  createOrder,
  getOrders,
  getOrderById,
  
  // Admin Order Management
  getAllOrders,
  updateOrderStatus,
  getStoreStats
} from '../controllers/storeController.js';

const router = express.Router();

// Public Routes - Product Browsing
router.get('/products', getProducts);
router.get('/products/:id', getProductById);
router.get('/categories', getCategories);

// Protected Routes - Cart Management (Requires Authentication)
router.post('/cart', authMiddleware, addToCart);
router.get('/cart', authMiddleware, getCart);
router.put('/cart/:id', authMiddleware, updateCartItem);
router.delete('/cart/:id', authMiddleware, removeFromCart);
router.delete('/cart', authMiddleware, clearCart);

// Protected Routes - Payment Processing
router.post('/payment-intent', authMiddleware, createPaymentIntent);

// Protected Routes - Order Management (Requires Authentication)
router.post('/orders', authMiddleware, createOrder);
router.get('/orders', authMiddleware, getOrders);
router.get('/orders/:id', authMiddleware, getOrderById);

// Admin Routes - Product Management (Requires Authentication - Add admin check if needed)
router.post('/admin/products', authMiddleware, requireAdmin, createProduct);
router.put('/admin/products/:id', authMiddleware, requireAdmin, updateProduct);
router.delete('/admin/products/:id', authMiddleware, requireAdmin, deleteProduct);

// Admin Routes - Order Management
router.get('/admin/orders', authMiddleware, requireAdmin, getAllOrders);
router.put('/admin/orders/:id/status', authMiddleware, requireAdmin, updateOrderStatus);
router.get('/admin/stats', authMiddleware, requireAdmin, getStoreStats);

export default router;
