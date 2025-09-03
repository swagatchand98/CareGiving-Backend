import { Router } from 'express';
import {
  getChatByBookingId,
  sendMessage,
  markMessagesAsRead,
  getUserChats
} from '../controllers/chatController';
import { protect } from '../middleware/authMiddleware';
import { catchAsync } from '../middleware/errorHandler';

const router = Router();

// Protect all chat routes - user must be authenticated
router.use(protect);

// Get all chats for the current user
router.get('/', catchAsync(getUserChats));

// Get chat by booking ID
router.get('/booking/:bookingId', catchAsync(getChatByBookingId));

// Send a message in a chat
router.post('/:chatId/messages', catchAsync(sendMessage));

// Mark messages as read
router.patch('/:chatId/messages/read', catchAsync(markMessagesAsRead));

export default router;
