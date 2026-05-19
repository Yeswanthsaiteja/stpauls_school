"""
firebase_auth.py
FastAPI dependency that verifies a Firebase ID token on every protected route.
Usage:
    from middleware.firebase_auth import require_auth
    @router.get("/protected")
    async def endpoint(user=Depends(require_auth)):
        return {"uid": user["uid"], "role": user.get("role")}
"""
import os
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

# Lazy-load firebase_admin so server starts even without credentials configured
_firebase_initialized = False

def _init_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return
    try:
        import firebase_admin
        from firebase_admin import credentials
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
        else:
            cred = credentials.ApplicationDefault()
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("Firebase Admin SDK initialized")
    except Exception as e:
        logger.warning("Firebase Admin SDK not initialized: %s", e)


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """Dependency: verify Firebase ID token. Returns decoded token dict."""
    _init_firebase()

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    token = credentials.credentials
    try:
        from firebase_admin import auth as firebase_auth
        decoded = firebase_auth.verify_id_token(token)
        return decoded  # contains uid, email, role (custom claims), tenantId
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def optional_auth(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """Like require_auth but returns None instead of raising if no token."""
    if not credentials:
        return None
    try:
        return await require_auth(credentials)
    except HTTPException:
        return None
