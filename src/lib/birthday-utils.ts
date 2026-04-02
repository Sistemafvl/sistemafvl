/**
 * Check if today is the driver's birthday (compares month and day only).
 * Uses Brasília timezone (UTC-3).
 */
export const checkIsBirthday = (birthDate: string | null | undefined): boolean => {
  if (!birthDate) return false;
  try {
    const bd = new Date(birthDate + "T12:00:00");
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    return bd.getMonth() === now.getMonth() && bd.getDate() === now.getDate();
  } catch {
    return false;
  }
};
