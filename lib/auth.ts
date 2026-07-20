import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { recordAudit } from './audit';

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const githubId = process.env.AUTH_GITHUB_ID ?? process.env.GITHUB_CLIENT_ID;
const githubSecret = process.env.AUTH_GITHUB_SECRET ?? process.env.GITHUB_CLIENT_SECRET;

if (!githubId || !githubSecret) {
  throw new Error(
    'Missing GitHub OAuth credentials. Set AUTH_GITHUB_ID/AUTH_GITHUB_SECRET (or GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET) in .env.local'
  );
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) return true;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: githubId,
      clientSecret: githubSecret,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) {
        recordAudit('login', { success: false, reason: 'no_email', provider: account?.provider }, 'unknown').catch(() => {});
        return false;
      }
      const allowed = ALLOWED_EMAILS.includes(user.email.toLowerCase());
      if (!allowed) {
        recordAudit('login', { success: false, reason: 'not_allowed', provider: account?.provider }, user.email).catch(() => {});
        return false;
      }
      recordAudit('login', { success: true, provider: account?.provider }, user.email).catch(() => {});
      return true;
    },
    async session({ session }) {
      return session;
    },
  },
  session: {
    maxAge: 30 * 24 * 60 * 60,
  },
  trustHost: true,
});
