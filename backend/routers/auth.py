"""Auth router: login con credenciales en .env + JWT con rol en payload.

Expone también el dependency `get_current_user` que el resto de routers usa
para proteger sus endpoints.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from models.schemas import CurrentUser, LoginRequest, LoginResponse, Role

router = APIRouter(prefix="/auth", tags=["auth"])

_bearer = HTTPBearer(auto_error=True)


def _credentials() -> dict[Role, str]:
    return {
        "creador": os.environ["CREADOR_PASSWORD"],
        "aprobador_a": os.environ["APROBADOR_A_PASSWORD"],
        "aprobador_b": os.environ["APROBADOR_B_PASSWORD"],
    }


def _jwt_config() -> tuple[str, str, int]:
    return (
        os.environ["JWT_SECRET"],
        os.environ.get("JWT_ALGORITHM", "HS256"),
        int(os.environ.get("JWT_EXPIRES_HOURS", "8")),
    )


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest) -> LoginResponse:
    expected = _credentials().get(req.username)
    if not expected or expected != req.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    secret, algorithm, expires_hours = _jwt_config()
    payload = {
        "sub": req.username,
        "role": req.username,
        "exp": datetime.now(tz=timezone.utc) + timedelta(hours=expires_hours),
    }
    token = jwt.encode(payload, secret, algorithm=algorithm)
    return LoginResponse(access_token=token, role=req.username, username=req.username)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    """Dependency que valida el JWT y devuelve el usuario actual."""
    secret, algorithm, _ = _jwt_config()
    try:
        payload = jwt.decode(creds.credentials, secret, algorithms=[algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        ) from exc

    return CurrentUser(**payload)


def require_role(*allowed: Role):
    """Factory de dependencies. Uso: Depends(require_role('rol'))."""

    def _checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rol requerido: {' | '.join(allowed)}",
            )
        return user

    return _checker
