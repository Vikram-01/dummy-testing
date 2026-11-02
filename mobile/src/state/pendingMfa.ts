/** Holds the short-lived MFA challenge token in memory between the login and MFA screens. Never persisted. */
let pending: { token: string; email: string; at: number } | null = null;

export const pendingMfa = {
  set: (token: string, email: string) => {
    pending = { token, email, at: Date.now() };
  },
  get: () => (pending && Date.now() - pending.at < 5 * 60_000 ? pending : null),
  clear: () => {
    pending = null;
  },
};
