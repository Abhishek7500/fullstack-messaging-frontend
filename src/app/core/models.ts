export interface UserProfile {
  id: number;
  username: string;
  email: string;
  displayName: string;
  avatarColor: string;
  createdAt: string;
  online: boolean;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  user: UserProfile;
}

export interface Conversation {
  id: number;
  type: 'DIRECT' | 'GROUP';
  title: string;
  participants: UserProfile[];
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: number | null;
  unreadCount: number;
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderAvatarColor: string;
  content: string;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  last: boolean;
}

export interface TypingEvent {
  conversationId: number;
  userId: number;
  displayName: string;
  typing: boolean;
}

export interface PresenceEvent {
  userId: number;
  username: string;
  online: boolean;
}
