import { Router } from 'express';
import { AuthController } from '../controllers/authController';

const router = Router();

// Lazy initialization - create controller when first request is made
let authController: AuthController | null = null;

const getAuthController = (): AuthController => {
  if (!authController) {
    authController = new AuthController();
  }
  return authController;
};

// Register endpoint
router.post('/register', (req, res) => {
  getAuthController().register(req, res);
});

// Login endpoint
router.post('/login', (req, res) => {
  getAuthController().login(req, res);
});

// Logout endpoint
router.post('/logout', (req, res) => {
  getAuthController().logout(req, res);
});

// Verify email endpoint
router.get('/verify-email', (req, res) => {
  getAuthController().verifyEmail(req, res);
});

// Forgot password endpoint
router.post('/forgot-password', (req, res) => {
  getAuthController().forgotPassword(req, res);
});

// Reset password endpoint
router.post('/reset-password', (req, res) => {
  getAuthController().resetPassword(req, res);
});

// Get current user endpoint
router.get('/me', (req, res) => {
  getAuthController().getCurrentUser(req, res);
});

// Refresh token endpoint
router.post('/refresh-token', (req, res) => {
  getAuthController().refreshToken(req, res);
});

export default router;
