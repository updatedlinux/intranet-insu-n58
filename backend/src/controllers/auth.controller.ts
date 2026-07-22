import type { Request, Response, NextFunction } from 'express';
import {
  changePassword as changePasswordService,
  login as loginService,
  logoutSession,
} from '../services/auth.service';
import { auditLogout } from '../services/audit.service';
import { clearAuthCookie, setAuthCookie } from '../utils/cookies';
import { getAuditContext } from '../utils/audit-context';
import { requestPasswordReset, resetPasswordWithToken } from '../services/password-reset.service';
import {
  validateChangePasswordBody,
  validateForgotPasswordBody,
  validateResetPasswordBody,
} from '../validators/auth.validator';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    const result = await loginService(email ?? '', password ?? '', getAuditContext(req));
    setAuthCookie(res, result.token);

    res.json({
      user: result.user,
      mustChangePassword: result.mustChangePassword,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  if (req.user) {
    await logoutSession(req.user.id);
    await auditLogout(req.user.id, getAuditContext(req));
  }
  clearAuthCookie(res);
  res.status(204).send();
}

export function me(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: { message: 'No autenticado' } });
    return;
  }

  const { roleName, ...publicUser } = req.user;
  void roleName;
  res.json({ user: publicUser });
}

/** Alias semántico de /me para consulta de perfil propio */
export function profile(req: Request, res: Response): void {
  me(req, res);
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const email = validateForgotPasswordBody(req.body as { email?: string });
    const result = await requestPasswordReset(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { token, newPassword } = validateResetPasswordBody(
      req.body as { token?: string; newPassword?: string; confirmPassword?: string },
    );
    const result = await resetPasswordWithToken(token, newPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'No autenticado' } });
      return;
    }

    const { currentPassword, newPassword } = validateChangePasswordBody(
      req.body as { currentPassword?: string; newPassword?: string; confirmPassword?: string },
    );

    const user = await changePasswordService(req.user.id, currentPassword, newPassword);
    res.json({ user, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    next(error);
  }
}
