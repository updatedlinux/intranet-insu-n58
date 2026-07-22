import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  fetchChatMessages,
  fetchChatRooms,
  fetchChatUnreadCount,
  getSocketUrl,
  openDirectChat,
  uploadChatFile,
} from '../api/chat';
import type { ChatMessageItem, ChatRoomItem } from '../api/chat.types';
import { useAuth } from './AuthContext';

interface TypingState {
  roomId: number;
  userName: string;
}

interface ChatContextValue {
  rooms: ChatRoomItem[];
  totalUnread: number;
  activeRoomId: number | null;
  messages: ChatMessageItem[];
  loadingRooms: boolean;
  loadingMessages: boolean;
  typing: TypingState | null;
  socketConnected: boolean;
  widgetOpen: boolean;
  setWidgetOpen: (open: boolean) => void;
  selectRoom: (roomId: number | null) => void;
  refreshRooms: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  hasMoreMessages: boolean;
  sendMessage: (text: string) => void;
  sendFile: (file: File) => Promise<void>;
  startDirectChat: (userId: number) => Promise<void>;
  setTyping: (isTyping: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoomItem[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [typing, setTypingState] = useState<TypingState | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const activeRoomRef = useRef<number | null>(null);

  useEffect(() => {
    activeRoomRef.current = activeRoomId;
  }, [activeRoomId]);

  const refreshRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const res = await fetchChatRooms();
      setRooms(res.items);
      setTotalUnread(res.totalUnread);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const loadRoomMessages = useCallback(async (roomId: number, beforeId?: number) => {
    setLoadingMessages(true);
    try {
      const res = await fetchChatMessages(roomId, { beforeId, limit: 40 });
      if (beforeId) {
        setMessages((prev) => [...res.items, ...prev]);
      } else {
        setMessages(res.items);
      }
      setHasMoreMessages(res.hasMore);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const selectRoom = useCallback(
    (roomId: number | null) => {
      setActiveRoomId(roomId);
      setTypingState(null);
      if (roomId) {
        void loadRoomMessages(roomId);
        socketRef.current?.emit('viewing_room', { roomId });
        setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r)));
        void fetchChatUnreadCount().then((r) => setTotalUnread(r.count));
      } else {
        socketRef.current?.emit('leave_viewing');
        setMessages([]);
      }
    },
    [loadRoomMessages],
  );

  const loadMoreMessages = useCallback(async () => {
    if (!activeRoomId || !messages.length || !hasMoreMessages) return;
    await loadRoomMessages(activeRoomId, messages[0]!.id);
  }, [activeRoomId, messages, hasMoreMessages, loadRoomMessages]);

  useEffect(() => {
    if (status !== 'authenticated') {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      setRooms([]);
      setMessages([]);
      setActiveRoomId(null);
      return;
    }

    const socket = io(getSocketUrl(), {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_rooms');
    });

    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('new_message', (msg: ChatMessageItem) => {
      if (msg.roomId === activeRoomRef.current) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
      setRooms((prev) => {
        const updated = prev.map((r) => {
          if (r.id !== msg.roomId) return r;
          const preview = msg.messageText ?? (msg.fileName ? `📎 ${msg.fileName}` : '');
          return {
            ...r,
            lastPreview: preview,
            lastMessageAt: msg.createdAt,
            unreadCount:
              msg.roomId === activeRoomRef.current ? 0 : r.unreadCount + (msg.isOwn ? 0 : 1),
          };
        });
        return [...updated].sort(
          (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
        );
      });
      if (msg.roomId !== activeRoomRef.current && !msg.isOwn) {
        void fetchChatUnreadCount().then((r) => setTotalUnread(r.count));
      }
    });

    socket.on('typing', (payload: { roomId: number; userName: string; isTyping: boolean }) => {
      if (payload.roomId !== activeRoomRef.current) return;
      setTypingState(
        payload.isTyping ? { roomId: payload.roomId, userName: payload.userName } : null,
      );
    });

    socket.on('room_updated', () => {
      void refreshRooms();
    });

    void refreshRooms();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [status, refreshRooms]);

  const sendMessage = useCallback((text: string) => {
    const roomId = activeRoomRef.current;
    if (!roomId || !text.trim()) return;
    socketRef.current?.emit('send_message', { roomId, messageText: text.trim() });
  }, []);

  const sendFile = useCallback(async (file: File) => {
    const roomId = activeRoomRef.current;
    if (!roomId) return;
    const uploaded = await uploadChatFile(roomId, file);
    socketRef.current?.emit('send_message', {
      roomId,
      fileUrl: uploaded.fileUrl,
      fileName: uploaded.fileName,
      fileType: uploaded.fileType,
      messageText: null,
    });
  }, []);

  const startDirectChat = useCallback(
    async (userId: number) => {
      if (user && userId === user.id) return;
      const { room } = await openDirectChat(userId);
      await refreshRooms();
      selectRoom(room.id);
    },
    [refreshRooms, selectRoom, user],
  );

  const setTyping = useCallback((isTyping: boolean) => {
    const roomId = activeRoomRef.current;
    if (!roomId) return;
    socketRef.current?.emit('typing', { roomId, isTyping });
  }, []);

  const value = useMemo(
    () => ({
      rooms,
      totalUnread,
      activeRoomId,
      messages,
      loadingRooms,
      loadingMessages,
      typing,
      socketConnected,
      widgetOpen,
      setWidgetOpen,
      selectRoom,
      refreshRooms,
      loadMoreMessages,
      hasMoreMessages,
      sendMessage,
      sendFile,
      startDirectChat,
      setTyping,
    }),
    [
      rooms,
      totalUnread,
      activeRoomId,
      messages,
      loadingRooms,
      loadingMessages,
      typing,
      socketConnected,
      widgetOpen,
      selectRoom,
      refreshRooms,
      loadMoreMessages,
      hasMoreMessages,
      sendMessage,
      sendFile,
      startDirectChat,
      setTyping,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat debe usarse dentro de ChatProvider');
  return ctx;
}
