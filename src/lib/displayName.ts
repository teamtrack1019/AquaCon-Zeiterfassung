export function workerDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string {
  const name = [user.firstName, user.lastName]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ");
  return name || (user.username || "").trim();
}
