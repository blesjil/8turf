interface SessionUser {
  user: { id: string; role?: string | null };
}

// null ⇒ admin ⇒ no ownership filter; queries use ($n::text IS NULL OR user_id = $n)
export function ownerScope(session: SessionUser): string | null {
  return session.user.role === 'admin' ? null : session.user.id;
}

export function isAdmin(session: SessionUser): boolean {
  return session.user.role === 'admin';
}
