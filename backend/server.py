"""
FastAPI backend for "Ad, Soyad, Şəhər" multiplayer word game.
- Emergent Google Auth (cookie session)
- Rooms REST API
- Real-time WebSocket for game rooms
- Leaderboard / Profile / Admin
"""
from __future__ import annotations
import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from game import game_manager, Player, Room, CATEGORIES, CATEGORY_LABELS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("adsoyad")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Ad Soyad Şəhər")
api = APIRouter(prefix="/api")

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_COOKIE = "session_token"
SESSION_DAYS = 7


class RoomCreate(BaseModel):
    is_private: bool = False


async def _get_session_token(request: Request) -> Optional[str]:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        return token
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return None


async def _validate_session(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        return None
    if user.get("is_banned"):
        return None
    return user


async def require_user(request: Request) -> dict:
    token = await _get_session_token(request)
    user = await _validate_session(token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_admin(request: Request) -> dict:
    user = await require_user(request)
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin required")
    return user


@api.post("/auth/session")
async def auth_session(request: Request, response: Response):
    """
    REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    Exchange session_id (from Emergent OAuth redirect fragment) for a persistent session.
    """
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = data.get("email")
    name = data.get("name") or email
    picture = data.get("picture") or ""
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Invalid auth payload")

    admin_emails = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        update = {"name": name, "picture": picture}
        if email.lower() in admin_emails and not existing.get("is_admin"):
            update["is_admin"] = True
        await db.users.update_one({"user_id": user_id}, {"$set": update})
    else:
        first_user = await db.users.count_documents({}) == 0
        is_admin = first_user or email.lower() in admin_emails
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "is_admin": is_admin,
            "is_banned": False,
            "is_muted": False,
            "total_points": 0,
            "games_played": 0,
            "games_won": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    response.set_cookie(
        key=SESSION_COOKIE,
        value=session_token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user}


@api.get("/auth/me")
async def auth_me(request: Request):
    user = await require_user(request)
    return user


@api.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = await _get_session_token(request)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@api.post("/rooms")
async def create_room(payload: RoomCreate, request: Request):
    user = await require_user(request)
    room = game_manager.create_room(host_id=user["user_id"], is_private=payload.is_private)
    return {"code": room.code, "is_private": room.is_private}


@api.get("/rooms/public")
async def public_rooms(request: Request):
    await require_user(request)
    return {"rooms": game_manager.list_public_rooms()}


@api.get("/rooms/{code}")
async def get_room_info(code: str, request: Request):
    await require_user(request)
    room = game_manager.get_room(code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room.to_state()


@api.get("/leaderboard")
async def leaderboard(period: str = "all"):
    now = datetime.now(timezone.utc)
    start: Optional[datetime] = None
    if period == "daily":
        start = now - timedelta(days=1)
    elif period == "weekly":
        start = now - timedelta(days=7)

    pipeline = []
    if start:
        pipeline.append({"$match": {"ended_at": {"$gte": start.isoformat()}}})
    pipeline.extend([
        {"$unwind": "$scores"},
        {"$group": {
            "_id": "$scores.user_id",
            "name": {"$last": "$scores.name"},
            "picture": {"$last": "$scores.picture"},
            "points": {"$sum": "$scores.score"},
            "games": {"$sum": 1},
            "wins": {"$sum": {"$cond": [{"$eq": ["$scores.rank", 1]}, 1, 0]}},
        }},
        {"$sort": {"points": -1}},
        {"$limit": 50},
    ])
    rows = await db.matches.aggregate(pipeline).to_list(100)
    result = []
    for r in rows:
        result.append({
            "user_id": r["_id"],
            "name": r.get("name") or "",
            "picture": r.get("picture") or "",
            "points": r.get("points", 0),
            "games": r.get("games", 0),
            "wins": r.get("wins", 0),
        })
    return {"period": period, "entries": result}


@api.get("/profile/me")
async def profile_me(request: Request):
    user = await require_user(request)
    uid = user["user_id"]
    matches = await db.matches.find(
        {"scores.user_id": uid},
        {"_id": 0}
    ).sort("ended_at", -1).limit(20).to_list(20)
    wins = 0
    for m in matches:
        ranked = sorted(m.get("scores", []), key=lambda s: s.get("score", 0), reverse=True)
        if ranked and ranked[0]["user_id"] == uid:
            wins += 1
    games = len(matches)
    return {
        "user": user,
        "stats": {
            "total_points": user.get("total_points", 0),
            "games_played": user.get("games_played", games),
            "games_won": user.get("games_won", wins),
            "win_rate": round((wins / games) * 100, 1) if games else 0,
        },
        "matches": matches,
    }


@api.get("/admin/users")
async def admin_users(request: Request):
    await require_admin(request)
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"users": users}


@api.post("/admin/users/{user_id}/ban")
async def admin_ban(user_id: str, request: Request):
    await require_admin(request)
    body = await request.json()
    banned = bool(body.get("banned", True))
    await db.users.update_one({"user_id": user_id}, {"$set": {"is_banned": banned}})
    if banned:
        await db.user_sessions.delete_many({"user_id": user_id})
    return {"ok": True, "banned": banned}


@api.post("/admin/users/{user_id}/mute")
async def admin_mute(user_id: str, request: Request):
    await require_admin(request)
    body = await request.json()
    muted = bool(body.get("muted", True))
    await db.users.update_one({"user_id": user_id}, {"$set": {"is_muted": muted}})
    return {"ok": True, "muted": muted}


@api.get("/admin/words")
async def admin_words_list(request: Request, category: Optional[str] = None):
    await require_admin(request)
    q = {"category": category} if category else {}
    words = await db.dictionary_words.find(q, {"_id": 0}).sort("word", 1).to_list(2000)
    return {"words": words}


@api.post("/admin/words")
async def admin_words_add(request: Request):
    await require_admin(request)
    body = await request.json()
    category = (body.get("category") or "").strip().lower()
    word = (body.get("word") or "").strip()
    if category not in CATEGORIES or not word:
        raise HTTPException(status_code=400, detail="Invalid category or word")
    entry = {
        "id": f"word_{uuid.uuid4().hex[:10]}",
        "category": category,
        "word": word,
        "word_lower": word.lower(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.dictionary_words.update_one(
        {"category": category, "word_lower": word.lower()},
        {"$setOnInsert": entry},
        upsert=True,
    )
    return {"ok": True, "entry": entry}


@api.delete("/admin/words/{word_id}")
async def admin_words_delete(word_id: str, request: Request):
    await require_admin(request)
    await db.dictionary_words.delete_one({"id": word_id})
    return {"ok": True}


@api.get("/categories")
async def categories_route():
    return {"categories": [{"key": k, "label": CATEGORY_LABELS[k]} for k in CATEGORIES]}


@api.websocket("/ws/{code}")
async def game_ws(ws: WebSocket, code: str, token: Optional[str] = Query(None)):
    await ws.accept()
    auth_token = token or ws.cookies.get(SESSION_COOKIE)
    user = await _validate_session(auth_token) if auth_token else None
    if not user:
        await ws.send_json({"type": "error", "error": "unauthorized"})
        await ws.close(code=4401)
        return

    room = game_manager.get_room(code)
    if not room:
        await ws.send_json({"type": "error", "error": "room_not_found"})
        await ws.close(code=4404)
        return

    player = Player(
        user_id=user["user_id"],
        name=user.get("name", "Player"),
        picture=user.get("picture", ""),
        ws=ws,
        is_host=(user["user_id"] == room.host_id),
    )
    try:
        await game_manager.join(code, player)
        await ws.send_json({"type": "state", "room": room.to_state()})
        await ws.send_json({"type": "chat_history", "messages": room.chat[-50:]})

        while True:
            msg = await ws.receive_json()
            mtype = msg.get("type")
            uid = user["user_id"]
            if mtype == "chat":
                if user.get("is_muted"):
                    await ws.send_json({"type": "error", "error": "muted"})
                    continue
                await game_manager.chat(room, uid, msg.get("text", ""))
            elif mtype == "settings":
                await game_manager.update_settings(
                    room, uid,
                    timer_seconds=msg.get("timer_seconds"),
                    total_rounds=msg.get("total_rounds"),
                    categories=msg.get("categories"),
                )
            elif mtype == "start_round":
                await game_manager.start_round(room, uid)
            elif mtype == "submit_word":
                await game_manager.submit_word(room, uid, msg.get("category", ""), msg.get("word", ""))
            elif mtype == "stop":
                await game_manager.call_stop(room, uid)
            elif mtype == "vote":
                await game_manager.submit_vote(
                    room, uid,
                    msg.get("target_user_id", ""),
                    msg.get("category", ""),
                    bool(msg.get("approve", False)),
                )
            elif mtype == "finalize_round":
                await game_manager.finalize_round(room, uid)
            elif mtype == "next_round":
                await game_manager.next_round(room, uid)
            elif mtype == "end_game":
                if uid == room.host_id:
                    await game_manager.end_game(room)
            elif mtype == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("WS error: %s", e)
    finally:
        try:
            await game_manager.leave(room, user["user_id"])
        except Exception:
            pass


async def _persist_game_end(room: Room):
    if not room.final_scores:
        return
    scores = []
    for idx, s in enumerate(room.final_scores):
        scores.append({
            "user_id": s["user_id"],
            "name": s["name"],
            "picture": s["picture"],
            "score": s["score"],
            "rank": idx + 1,
        })
    match_doc = {
        "id": f"match_{uuid.uuid4().hex[:12]}",
        "room_code": room.code,
        "categories": room.categories,
        "timer_seconds": room.timer_seconds,
        "rounds": room.total_rounds,
        "scores": scores,
        "ended_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.matches.insert_one(match_doc)
    for idx, s in enumerate(scores):
        inc = {"total_points": s["score"], "games_played": 1}
        if idx == 0 and len(scores) > 1:
            inc["games_won"] = 1
        await db.users.update_one({"user_id": s["user_id"]}, {"$inc": inc})


game_manager.set_on_game_end(_persist_game_end)


app.include_router(api)

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("email", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("user_id")
        await db.matches.create_index("ended_at")
        await db.matches.create_index("scores.user_id")
        await db.dictionary_words.create_index([("category", 1), ("word_lower", 1)], unique=True)
    except Exception as e:
        logger.warning("Index creation: %s", e)
    logger.info("Startup OK")


@app.on_event("shutdown")
async def shutdown():
    client.close()
