export interface ChatRoomItem {
  id: number;
  name: string | null;
  isGroup: boolean;
  areaId: number | null;
  areaName: string | null;
  lastMessageAt: string;
  lastPreview: string;
  unreadCount: number;
  peer: {
    id: number;
    fullName: string;
    avatarUrl: string | null;
    areaName: string | null;
  } | null;
}

export interface ChatMessageItem {
  id: number;
  roomId: number;
  senderId: number;
  senderName: string;
  senderAvatarUrl: string | null;
  messageText: string | null;
  fileName: string | null;
  fileType: string | null;
  fileCategory: 'image' | 'pdf' | 'other' | null;
  hasFile: boolean;
  createdAt: string;
  isOwn: boolean;
}

export type ChatListTab = 'recent' | 'contacts' | 'groups';
