export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const ACCESS_TOKEN_HEADER = 'Authorization';
export const ACCESS_TOKEN_PREFIX = 'Bearer ';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

export function getRefreshTokenCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'lax' as const : 'lax' as const,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  };
}

