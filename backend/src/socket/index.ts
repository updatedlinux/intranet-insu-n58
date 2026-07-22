import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import cookie from 'cookie';
import { config } from '../config';
import { getAuthCookieName } from '../utils/cookies';
import { verifyAccessToken } from '../utils/jwt';
import { getAuthenticatedUser } from '../services/auth.service';
import { isSessionActive } from '../services/session.service';
import type { AuthenticatedUser } from '../types/auth';
import {
  clearUserViewing,
  getUserRoomIdsForSocket,
  markRoomReadService,
  sendMessageService,
  setUserViewingRoom,
} from '../services/chat.service';

let io: Server | null = null;

const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function getIo(): Server | null {
  return io;
}

async function authenticateSocket(socket: Socket): Promise<AuthenticatedUser> {
  const raw = socket.handshake.headers.cookie ?? '';
  const cookies = cookie.parse(raw);
  const token = cookies[getAuthCookieName()];
  if (!token) throw new Error('No autenticado');

  const payload = verifyAccessToken(token);
  const valid = await isSessionActive(payload.sub, payload.jti);
  if (!valid) throw new Error('Sesión expirada');

  return getAuthenticatedUser(payload.sub);
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use(async (socket, next) => {
    try {
      const user = await authenticateSocket(socket);
      socket.data.user = user;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error('Auth failed'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user as AuthenticatedUser;
    socket.join(`user:${user.id}`);

    try {
      const roomIds = await getUserRoomIdsForSocket(user.id);
      for (const roomId of roomIds) {
        socket.join(`room:${roomId}`);
      }
      socket.emit('rooms_joined', { roomIds });
    } catch (error) {
      console.error('[socket] join_rooms error:', error);
    }

    socket.on('join_rooms', async () => {
      try {
        const roomIds = await getUserRoomIdsForSocket(user.id);
        for (const roomId of roomIds) {
          socket.join(`room:${roomId}`);
        }
        socket.emit('rooms_joined', { roomIds });
      } catch {
        socket.emit('error_message', { message: 'No se pudieron cargar las salas' });
      }
    });

    socket.on('viewing_room', async (payload: { roomId?: number }) => {
      const roomId = Number(payload?.roomId);
      if (!Number.isInteger(roomId) || roomId <= 0) return;
      setUserViewingRoom(user.id, roomId);
      try {
        await markRoomReadService(user, roomId);
        io?.to(`room:${roomId}`).emit('room_read', { roomId, userId: user.id });
      } catch {
        /* ignore */
      }
    });

    socket.on('leave_viewing', () => {
      clearUserViewing(user.id);
    });

    socket.on(
      'send_message',
      async (payload: {
        roomId?: number;
        messageText?: string;
        fileUrl?: string;
        fileName?: string;
        fileType?: string;
      }) => {
        try {
          const roomId = Number(payload?.roomId);
          if (!Number.isInteger(roomId) || roomId <= 0) {
            socket.emit('error_message', { message: 'Sala inválida' });
            return;
          }
          const message = await sendMessageService(user, roomId, payload);
          io?.to(`room:${roomId}`).emit('new_message', message);
          io?.to(`room:${roomId}`).emit('room_updated', {
            roomId,
            lastMessageAt: message.createdAt,
          });
        } catch (error) {
          socket.emit('error_message', {
            message: error instanceof Error ? error.message : 'Error al enviar',
          });
        }
      },
    );

    socket.on('typing', (payload: { roomId?: number; isTyping?: boolean }) => {
      const roomId = Number(payload?.roomId);
      if (!Number.isInteger(roomId) || roomId <= 0) return;
      const key = `${roomId}:${user.id}`;
      if (typingTimers.has(key)) {
        clearTimeout(typingTimers.get(key)!);
        typingTimers.delete(key);
      }
      socket.to(`room:${roomId}`).emit('typing', {
        roomId,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        isTyping: Boolean(payload?.isTyping),
      });
      if (payload?.isTyping) {
        typingTimers.set(
          key,
          setTimeout(() => {
            socket.to(`room:${roomId}`).emit('typing', {
              roomId,
              userId: user.id,
              userName: `${user.firstName} ${user.lastName}`.trim(),
              isTyping: false,
            });
            typingTimers.delete(key);
          }, 3000),
        );
      }
    });

    socket.on('mark_as_read', async (payload: { roomId?: number }) => {
      const roomId = Number(payload?.roomId);
      if (!Number.isInteger(roomId) || roomId <= 0) return;
      try {
        await markRoomReadService(user, roomId);
        io?.to(`room:${roomId}`).emit('room_read', { roomId, userId: user.id });
      } catch {
        /* ignore */
      }
    });

    socket.on('disconnect', () => {
      clearUserViewing(user.id);
    });
  });

  console.log('[socket] Socket.io inicializado');
  return io;
}

export async function closeSocketServer(): Promise<void> {
  if (!io) return;

  await new Promise<void>((resolve) => {
    io!.close(() => resolve());
  });
  io = null;
  typingTimers.clear();
  console.log('[socket] Socket.io cerrado');
}
