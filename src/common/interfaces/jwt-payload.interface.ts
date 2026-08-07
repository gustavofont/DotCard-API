/**
 * Shape of the access token issued by AuthForge. DotCard-API only ever
 * validates this token — it never signs one.
 */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}
