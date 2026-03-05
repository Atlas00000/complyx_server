import { prisma } from '../../utils/db';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  userId: string | null;
  role: string;
  content: string;
  metadata: unknown;
  createdAt: Date;
}

export interface ChatSessionRecord {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
}

/**
 * Create a new chat session for a user. Returns the created session.
 */
export async function createSession(userId: string, title?: string | null): Promise<ChatSessionRecord> {
  const session = await prisma.chatSession.create({
    data: {
      userId,
      title: title ?? null,
    },
  });
  return {
    id: session.id,
    userId: session.userId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessageAt: session.lastMessageAt,
  };
}

/**
 * Get a session by id if it belongs to the user, or null.
 */
export async function getSession(sessionId: string, userId: string): Promise<ChatSessionRecord | null> {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) return null;
  return {
    id: session.id,
    userId: session.userId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastMessageAt: session.lastMessageAt,
  };
}

/**
 * Create a session or return existing one by id (if id provided and owned by user).
 * If sessionId is not provided or not found, creates a new session.
 */
export async function createOrGetSession(
  userId: string,
  sessionId?: string | null,
  title?: string | null
): Promise<ChatSessionRecord> {
  if (sessionId) {
    const existing = await getSession(sessionId, userId);
    if (existing) return existing;
  }
  return createSession(userId, title);
}

/**
 * Append a message to a chat session. Updates session lastMessageAt.
 * Ensures session belongs to userId.
 */
export async function saveMessage(
  sessionId: string,
  userId: string,
  role: string,
  content: string,
  metadata?: unknown
): Promise<ChatMessageRecord | null> {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) return null;

  const message = await prisma.chatMessage.create({
    data: {
      sessionId,
      userId,
      role,
      content,
      metadata: metadata ?? undefined,
    },
  });

  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { lastMessageAt: message.createdAt, updatedAt: new Date() },
  });

  return {
    id: message.id,
    sessionId: message.sessionId,
    userId: message.userId,
    role: message.role,
    content: message.content,
    metadata: message.metadata as unknown,
    createdAt: message.createdAt,
  };
}

/**
 * List messages for a session (owned by userId), ordered by createdAt asc.
 * Supports limit and optional cursor (message id) for pagination.
 */
export async function getMessages(
  sessionId: string,
  userId: string,
  limit: number = DEFAULT_PAGE_SIZE,
  cursor?: string | null
): Promise<{ messages: ChatMessageRecord[]; nextCursor: string | null }> {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) {
    return { messages: [], nextCursor: null };
  }

  const take = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);

  const messages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: take + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasMore = messages.length > take;
  const list = hasMore ? messages.slice(0, take) : messages;
  const nextCursor = hasMore && list.length > 0 ? list[list.length - 1].id : null;

  return {
    messages: list.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      userId: m.userId,
      role: m.role,
      content: m.content,
      metadata: m.metadata as unknown,
      createdAt: m.createdAt,
    })),
    nextCursor,
  };
}

/**
 * List chat sessions for a user, most recent first. Pagination via limit and offset.
 */
export async function listSessions(
  userId: string,
  limit: number = DEFAULT_PAGE_SIZE,
  offset: number = 0
): Promise<{ sessions: ChatSessionRecord[]; total: number }> {
  const take = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
  const skip = Math.max(0, offset);

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where: { userId },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take,
      skip,
    }),
    prisma.chatSession.count({ where: { userId } }),
  ]);

  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      lastMessageAt: s.lastMessageAt,
    })),
    total,
  };
}
