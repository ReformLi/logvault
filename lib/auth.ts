import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

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

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: githubId,
      clientSecret: githubSecret,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      return ALLOWED_EMAILS.length === 0 || ALLOWED_EMAILS.includes(user.email.toLowerCase());
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
