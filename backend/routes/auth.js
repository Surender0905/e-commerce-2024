import express from 'express';

const router = express.Router();

import {
  logout,
  register,
  login,
  refreshToken,
  getProfile,
} from '../controllers/auth.js';
import { protectRoute } from '../middleware/auth.middleware.js';

///register route
router.post('/register', register);

///login route
router.post('/login', login);

///logout route

router.get('/logout', logout);

router.post('/refresh-token', refreshToken);

router.get('/profile', protectRoute, getProfile);
export default router;
