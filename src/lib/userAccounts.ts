export function normalizeUsername(value: string): string {
  const clean = value.trim().toLowerCase();
  return clean.split('@').length > 2 ? clean : clean.replace(/@peie\.com$/, '');
}

export function loginEmail(value: string): string {
  const username = normalizeUsername(value);
  return username.includes('@') ? username : `${username}@peie.com`;
}

export function validateUserAccount(input: { username: string; fullName: string; role: string; password: string; creating: boolean }): string | null {
  const username = normalizeUsername(input.username);
  if (!username || username.length > 254 || !/^[a-z0-9][a-z0-9._+-]*(@[a-z0-9][a-z0-9.-]*\.[a-z]{2,})?$/.test(username)) {
    return 'Usá un nombre de usuario o correo válido, sin espacios.';
  }
  if (!input.fullName.trim()) return 'Completá el nombre del usuario.';
  if (!['admin', 'solicitante', 'encargado', 'logistica'].includes(input.role)) return 'Seleccioná un rol válido.';
  if (input.creating || input.password !== '') {
    if (Array.from(input.password).length < 6 || !input.password.trim() || new TextEncoder().encode(input.password).length > 72) {
      return 'La contraseña debe tener al menos 6 caracteres y hasta 72 bytes.';
    }
  }
  return null;
}

export function accountErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    if ('code' in error && error.code === '23505') return 'Ese usuario ya existe. Revisá la cuenta existente o elegí otro nombre.';
    if (error.message === 'Invalid login credentials') return 'El usuario o la contraseña son incorrectos. Verificá tus datos.';
    if (error.message === 'Email not confirmed') return 'La cuenta todavía no está confirmada. Comunicate con Administración.';
    if (error.message.includes('Database error')) return 'El sistema no pudo validar la cuenta. Comunicate con Administración; no hace falta crear otro usuario.';
    return error.message;
  }
  return fallback;
}
