export const MIN_PASSWORD_LENGTH = 8;
export const RECOMMENDED_PASSWORD_LENGTH = 15;
export const PASSWORD_HINT = "Usa entre 8 y 128 caracteres. Te recomendamos 15 o más para mayor seguridad.";

export function validNewPassword(password) {
  const length = Array.from(password).length;
  return length >= MIN_PASSWORD_LENGTH && length <= 128 && Boolean(password.trim());
}
