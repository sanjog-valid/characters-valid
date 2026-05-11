export const VALID_EMAIL_DOMAIN = "valid.co";

export function isValidCompanyEmail(email?: string | null) {
  return Boolean(email?.toLowerCase().endsWith(`@${VALID_EMAIL_DOMAIN}`));
}
