import { type JWTPayload, createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { type MiddlewareHandler } from 'hono';
import { problemResponse } from '../api/problem.mts';
import process from 'node:process';

const DEFAULT_ISSUER = 'https://localhost:8843/realms/javascript';
const DEFAULT_CLIENT_ID = 'javascript-client';
const SERVICE_UNAVAILABLE = 503;
const UNAVAILABLE_JWKS_ERRORS = new Set(['ERR_JWKS_INVALID', 'ERR_JWKS_TIMEOUT']);

type KeycloakRoleOptions = {
  role: string;
  issuer?: string;
  clientId?: string;
};

type VerificationResult = { payload: JWTPayload } | { response: Response };
type VerifyTokenOptions = {
  token: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
  issuer: string;
  clientId: string;
  instance: string;
};
type AuthorizationProblemOptions = {
  status: number;
  title: string;
  detail: string;
  instance: string;
  challenge?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const authorizationProblem = (options: AuthorizationProblemOptions): Response => {
  const { challenge, ...problemOptions } = options;
  const response = problemResponse(problemOptions);
  if (challenge !== undefined) {
    response.headers.set('WWW-Authenticate', challenge);
  }
  return response;
};

const unauthorized = (instance: string, invalidToken = false): Response =>
  authorizationProblem({
    status: 401,
    title: 'Unauthorized',
    detail: invalidToken
      ? 'The bearer access token is invalid or expired.'
      : 'A valid bearer access token is required.',
    instance,
    challenge: invalidToken ? 'Bearer error="invalid_token"' : 'Bearer',
  });

const keycloakUnavailable = (instance: string): Response =>
  authorizationProblem({
    status: SERVICE_UNAVAILABLE,
    title: 'Service Unavailable',
    detail: 'Keycloak token verification is temporarily unavailable.',
    instance,
  });

const verifyAccessToken = async ({
  token,
  jwks,
  issuer,
  clientId,
  instance,
}: VerifyTokenOptions): Promise<VerificationResult> => {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      issuer,
    });
    if (payload['azp'] !== clientId) {
      return { response: unauthorized(instance, true) };
    }
    return { payload };
  } catch (error) {
    if (error instanceof errors.JOSEError) {
      return {
        response: UNAVAILABLE_JWKS_ERRORS.has(error.code)
          ? keycloakUnavailable(instance)
          : unauthorized(instance, true),
      };
    }
    if (error instanceof TypeError) {
      return { response: keycloakUnavailable(instance) };
    }
    throw error;
  }
};

const hasClientRole = (payload: JWTPayload, clientId: string, role: string): boolean => {
  const resourceAccess = payload['resource_access'];
  if (!isRecord(resourceAccess)) {
    return false;
  }
  const { [clientId]: clientAccess } = resourceAccess;
  if (!isRecord(clientAccess)) {
    return false;
  }
  const { roles } = clientAccess;
  return Array.isArray(roles) && roles.includes(role);
};

export const requireKeycloakRole = ({
  role,
  issuer = process.env['KEYCLOAK_ISSUER'] ?? DEFAULT_ISSUER,
  clientId = process.env['KEYCLOAK_CLIENT_ID'] ?? DEFAULT_CLIENT_ID,
}: KeycloakRoleOptions): MiddlewareHandler => {
  const normalizedIssuer = issuer.replace(/\/+$/u, '');
  const jwks = createRemoteJWKSet(new URL(`${normalizedIssuer}/protocol/openid-connect/certs`));

  return async (context, next) => {
    const authorization = context.req.header('Authorization');
    const token = authorization?.match(/^Bearer\s+(?<token>\S+)$/iu)?.groups?.['token'];
    if (token === undefined) {
      return unauthorized(context.req.path);
    }

    const verification = await verifyAccessToken({
      token,
      jwks,
      issuer: normalizedIssuer,
      clientId,
      instance: context.req.path,
    });
    if ('response' in verification) {
      return verification.response;
    }
    if (!hasClientRole(verification.payload, clientId, role)) {
      return authorizationProblem({
        status: 403,
        title: 'Forbidden',
        detail: 'The access token does not grant the required client role.',
        instance: context.req.path,
      });
    }
    return next();
  };
};
