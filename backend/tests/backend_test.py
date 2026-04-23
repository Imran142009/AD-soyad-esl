"""
Backend tests for 'Ad, Soyad, Şəhər' multiplayer game.
Covers: REST endpoints (auth, rooms, leaderboard, profile, admin) + WebSocket game flow.
Uses pre-seeded DB sessions (see /app/memory/test_credentials.md).
"""
import os
import asyncio
import json
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback reading frontend env (BASE_URL must exist for tests)
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

ADMIN_TOKEN = "TEST_tok_admin"
P1_TOKEN = "TEST_tok_p1"
P2_TOKEN = "TEST_tok_p2"


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- categories ----------
class TestCategories:
    def test_categories_returns_seven(self):
        r = requests.get(f"{BASE_URL}/api/categories", timeout=10)
        assert r.status_code == 200
        data = r.json()
        cats = data["categories"]
        assert len(cats) == 7
        keys = {c["key"] for c in cats}
        assert keys == {"ad", "soyad", "seher", "olke", "bitki", "heyvan", "esya"}
        for c in cats:
            assert c["label"] and isinstance(c["label"], str)


# ---------- auth ----------
class TestAuth:
    def test_session_missing_session_id(self):
        r = requests.post(f"{BASE_URL}/api/auth/session", json={}, timeout=10)
        assert r.status_code == 400

    def test_me_without_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_with_bearer(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(ADMIN_TOKEN), timeout=10)
        assert r.status_code == 200
        u = r.json()
        assert u["user_id"] == "test-admin"
        assert u["is_admin"] is True

    def test_me_with_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=H("bogus_tok"), timeout=10)
        assert r.status_code == 401


# ---------- leaderboard ----------
class TestLeaderboard:
    @pytest.mark.parametrize("period", ["daily", "weekly", "all"])
    def test_leaderboard(self, period):
        r = requests.get(f"{BASE_URL}/api/leaderboard", params={"period": period}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["period"] == period
        assert isinstance(d["entries"], list)


# ---------- rooms ----------
class TestRooms:
    def test_create_public_room_and_listed(self):
        r = requests.post(f"{BASE_URL}/api/rooms", headers=H(P1_TOKEN),
                          json={"is_private": False}, timeout=10)
        assert r.status_code == 200
        body = r.json()
        code = body["code"]
        assert len(code) == 6
        assert body["is_private"] is False

        lr = requests.get(f"{BASE_URL}/api/rooms/public", headers=H(P1_TOKEN), timeout=10)
        assert lr.status_code == 200
        codes = [x["code"] for x in lr.json()["rooms"]]
        assert code in codes

        # GET room state
        gr = requests.get(f"{BASE_URL}/api/rooms/{code}", headers=H(P1_TOKEN), timeout=10)
        assert gr.status_code == 200
        state = gr.json()
        assert state["code"] == code
        assert state["state"] == "lobby"
        assert state["host_id"] == "test-player1"

    def test_create_private_room_not_in_public(self):
        r = requests.post(f"{BASE_URL}/api/rooms", headers=H(P2_TOKEN),
                          json={"is_private": True}, timeout=10)
        assert r.status_code == 200
        code = r.json()["code"]
        lr = requests.get(f"{BASE_URL}/api/rooms/public", headers=H(P2_TOKEN), timeout=10)
        codes = [x["code"] for x in lr.json()["rooms"]]
        assert code not in codes

    def test_get_unknown_room_404(self):
        r = requests.get(f"{BASE_URL}/api/rooms/ZZZZZZ", headers=H(P1_TOKEN), timeout=10)
        assert r.status_code == 404

    def test_create_room_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/rooms", json={"is_private": False}, timeout=10)
        assert r.status_code == 401


# ---------- profile ----------
class TestProfile:
    def test_profile_me(self):
        r = requests.get(f"{BASE_URL}/api/profile/me", headers=H(P1_TOKEN), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["user_id"] == "test-player1"
        assert "stats" in d and "matches" in d
        assert isinstance(d["matches"], list)

    def test_profile_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/profile/me", timeout=10)
        assert r.status_code == 401


# ---------- admin ----------
class TestAdmin:
    def test_admin_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=H(P1_TOKEN), timeout=10)
        assert r.status_code == 403

    def test_admin_users_list(self):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=H(ADMIN_TOKEN), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json()["users"], list)

    def test_admin_words_crud(self):
        # Add
        r = requests.post(f"{BASE_URL}/api/admin/words", headers=H(ADMIN_TOKEN),
                          json={"category": "ad", "word": "TEST_Ali"}, timeout=10)
        assert r.status_code == 200
        wid = r.json()["entry"]["id"]

        # List
        lr = requests.get(f"{BASE_URL}/api/admin/words", headers=H(ADMIN_TOKEN),
                         params={"category": "ad"}, timeout=10)
        assert lr.status_code == 200
        assert any(w.get("id") == wid for w in lr.json()["words"])

        # Delete
        dr = requests.delete(f"{BASE_URL}/api/admin/words/{wid}", headers=H(ADMIN_TOKEN), timeout=10)
        assert dr.status_code == 200

        # Verify removed
        lr2 = requests.get(f"{BASE_URL}/api/admin/words", headers=H(ADMIN_TOKEN),
                          params={"category": "ad"}, timeout=10)
        assert not any(w.get("id") == wid for w in lr2.json()["words"])

    def test_admin_words_invalid_category(self):
        r = requests.post(f"{BASE_URL}/api/admin/words", headers=H(ADMIN_TOKEN),
                          json={"category": "bogus", "word": "x"}, timeout=10)
        assert r.status_code == 400

    def test_admin_ban_and_mute_cycle(self):
        # Mute player2
        r = requests.post(f"{BASE_URL}/api/admin/users/test-player2/mute",
                          headers=H(ADMIN_TOKEN), json={"muted": True}, timeout=10)
        assert r.status_code == 200 and r.json()["muted"] is True
        # Unmute
        r = requests.post(f"{BASE_URL}/api/admin/users/test-player2/mute",
                          headers=H(ADMIN_TOKEN), json={"muted": False}, timeout=10)
        assert r.status_code == 200 and r.json()["muted"] is False

        # Ban/unban - we'll ban then unban to avoid breaking other tests
        r = requests.post(f"{BASE_URL}/api/admin/users/test-player2/ban",
                          headers=H(ADMIN_TOKEN), json={"banned": True}, timeout=10)
        assert r.status_code == 200 and r.json()["banned"] is True
        # session should have been cleared; but re-auth via /me should fail
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(P2_TOKEN), timeout=10)
        assert me.status_code == 401
        # Unban
        r = requests.post(f"{BASE_URL}/api/admin/users/test-player2/ban",
                          headers=H(ADMIN_TOKEN), json={"banned": False}, timeout=10)
        assert r.status_code == 200 and r.json()["banned"] is False

        # Re-seed session for player2 for subsequent tests
        import pymongo
        cl = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        cl[os.environ.get("DB_NAME", "test_database")].user_sessions.update_one(
            {"session_token": P2_TOKEN},
            {"$set": {"user_id": "test-player2", "session_token": P2_TOKEN,
                      "expires_at": "2099-01-01T00:00:00+00:00"}},
            upsert=True,
        )
        me2 = requests.get(f"{BASE_URL}/api/auth/me", headers=H(P2_TOKEN), timeout=10)
        assert me2.status_code == 200


# ---------- logout ----------
class TestLogout:
    def test_logout_clears_session(self):
        # Create a fresh ephemeral session for admin to logout w/o breaking others
        import pymongo
        cl = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = cl[os.environ.get("DB_NAME", "test_database")]
        tok = "TEST_tok_logout"
        db.user_sessions.update_one(
            {"session_token": tok},
            {"$set": {"user_id": "test-admin", "session_token": tok,
                      "expires_at": "2099-01-01T00:00:00+00:00"}},
            upsert=True,
        )
        r = requests.post(f"{BASE_URL}/api/auth/logout", headers=H(tok), timeout=10)
        assert r.status_code == 200
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=H(tok), timeout=10)
        assert me.status_code == 401


# ---------- WebSocket game flow ----------
async def _recv_until(ws, type_name, timeout=5.0, collect=False):
    """Receive messages until a given type arrives. If collect=True, returns list of all messages."""
    msgs = []
    end = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < end:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=end - asyncio.get_event_loop().time())
        except asyncio.TimeoutError:
            break
        m = json.loads(raw)
        msgs.append(m)
        if m.get("type") == type_name:
            return (msgs if collect else m)
    raise AssertionError(f"Did not receive message type '{type_name}' within {timeout}s. Got: {[m.get('type') for m in msgs]}")


async def _drain(ws, duration=0.5):
    end = asyncio.get_event_loop().time() + duration
    msgs = []
    while asyncio.get_event_loop().time() < end:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=end - asyncio.get_event_loop().time())
            msgs.append(json.loads(raw))
        except asyncio.TimeoutError:
            break
    return msgs


@pytest.mark.asyncio
async def test_ws_unauthorized():
    async with websockets.connect(f"{WS_URL}/api/ws/ABCDEF?token=bad") as ws:
        raw = await asyncio.wait_for(ws.recv(), timeout=5)
        m = json.loads(raw)
        assert m.get("type") == "error"
        assert m.get("error") == "unauthorized"


@pytest.mark.asyncio
async def test_ws_room_not_found():
    async with websockets.connect(f"{WS_URL}/api/ws/NOSUCH?token={P1_TOKEN}") as ws:
        raw = await asyncio.wait_for(ws.recv(), timeout=5)
        m = json.loads(raw)
        assert m.get("type") == "error"
        assert m.get("error") == "room_not_found"


@pytest.mark.asyncio
async def test_full_game_flow_two_players():
    # Host (player1) creates the room
    r = requests.post(f"{BASE_URL}/api/rooms", headers=H(P1_TOKEN),
                      json={"is_private": False}, timeout=10)
    assert r.status_code == 200
    code = r.json()["code"]

    ws1 = await websockets.connect(f"{WS_URL}/api/ws/{code}?token={P1_TOKEN}")
    ws2 = await websockets.connect(f"{WS_URL}/api/ws/{code}?token={P2_TOKEN}")

    try:
        # Both get state + chat_history
        m1 = await _recv_until(ws1, "state", timeout=5)
        assert m1["room"]["code"] == code
        await _drain(ws1, 0.5)
        await _drain(ws2, 0.5)

        # Host sets single letter category via settings: use only "ad" and "soyad" to keep it simple
        await ws1.send(json.dumps({
            "type": "settings",
            "timer_seconds": 30,
            "total_rounds": 1,
            "categories": ["ad", "soyad"],
        }))
        # Drain state broadcast
        st = await _recv_until(ws1, "state", timeout=5)
        assert st["room"]["categories"] == ["ad", "soyad"]
        assert st["room"]["timer_seconds"] == 30
        assert st["room"]["total_rounds"] == 1
        await _drain(ws2, 0.5)

        # Chat message - broadcast
        await ws1.send(json.dumps({"type": "chat", "text": "hello"}))
        chat2 = await _recv_until(ws2, "chat", timeout=5)
        assert chat2["message"]["text"] == "hello"
        await _drain(ws1, 0.2)

        # Host starts round
        await ws1.send(json.dumps({"type": "start_round"}))
        st = await _recv_until(ws1, "state", timeout=5)
        assert st["room"]["state"] == "playing"
        letter = st["room"]["current_letter"]
        assert letter and len(letter) == 1
        await _drain(ws2, 0.5)

        # Both submit words starting with letter (player1 unique, both same for "soyad")
        await ws1.send(json.dumps({"type": "submit_word", "category": "ad",
                                    "word": letter + "lmaz"}))  # unique for p1
        await ws2.send(json.dumps({"type": "submit_word", "category": "ad",
                                    "word": letter + "ynurx"}))  # unique for p2
        await ws1.send(json.dumps({"type": "submit_word", "category": "soyad",
                                    "word": letter + "liyev"}))  # shared
        await ws2.send(json.dumps({"type": "submit_word", "category": "soyad",
                                    "word": letter + "liyev"}))  # shared
        await asyncio.sleep(0.5)
        await _drain(ws1, 0.3)
        await _drain(ws2, 0.3)

        # Host calls stop -> voting phase
        await ws1.send(json.dumps({"type": "stop"}))
        v1 = await _recv_until(ws1, "voting_phase", timeout=5)
        assert v1["letter"] == letter
        assert len(v1["items"]) == 2 * 2  # 2 players x 2 cats
        await _recv_until(ws1, "state", timeout=3)
        await _drain(ws2, 0.5)

        # No votes submitted -> finalize should still count since words start w/ letter
        await ws1.send(json.dumps({"type": "finalize_round"}))
        rr1 = await _recv_until(ws1, "round_results", timeout=5)
        breakdown = rr1["results"]["breakdown"]
        # Build map for assertions
        def bd(uid, cat):
            return next((b for b in breakdown if b["user_id"] == uid and b["category"] == cat), None)

        # ad: both unique -> both get 10
        assert bd("test-player1", "ad")["valid"] is True
        assert bd("test-player1", "ad")["points"] == 10
        assert bd("test-player2", "ad")["points"] == 10
        # soyad: shared word -> both get 5
        assert bd("test-player1", "soyad")["points"] == 5
        assert bd("test-player2", "soyad")["points"] == 5

        # Drain state + game_end (auto since total_rounds=1)
        msgs = await _drain(ws1, 2.0)
        types = [m.get("type") for m in msgs]
        assert "game_end" in types
        ge = next(m for m in msgs if m.get("type") == "game_end")
        assert len(ge["final_scores"]) == 2
        # Both have 15 points (10+5) -> order arbitrary but all 15
        for s in ge["final_scores"]:
            assert s["score"] == 15

        await _drain(ws2, 0.5)

        # Verify match persisted
        await asyncio.sleep(1.0)
        lb = requests.get(f"{BASE_URL}/api/leaderboard", params={"period": "all"}, timeout=10)
        assert lb.status_code == 200
        entries = lb.json()["entries"]
        uids = {e["user_id"] for e in entries}
        assert "test-player1" in uids or "test-player2" in uids

        # Verify profile shows match
        prof = requests.get(f"{BASE_URL}/api/profile/me", headers=H(P1_TOKEN), timeout=10)
        assert prof.status_code == 200
        assert prof.json()["stats"]["games_played"] >= 1

    finally:
        await ws1.close()
        await ws2.close()


@pytest.mark.asyncio
async def test_ws_invalid_word_gets_zero_when_not_start_with_letter():
    """Scoring rule: invalid 0 when word doesn't start with letter."""
    r = requests.post(f"{BASE_URL}/api/rooms", headers=H(P1_TOKEN),
                      json={"is_private": True}, timeout=10)
    code = r.json()["code"]
    ws1 = await websockets.connect(f"{WS_URL}/api/ws/{code}?token={P1_TOKEN}")
    ws2 = await websockets.connect(f"{WS_URL}/api/ws/{code}?token={P2_TOKEN}")
    try:
        await _recv_until(ws1, "state", 5)
        await _drain(ws1, 0.3); await _drain(ws2, 0.3)
        await ws1.send(json.dumps({"type": "settings", "timer_seconds": 30,
                                    "total_rounds": 1, "categories": ["ad"]}))
        await _recv_until(ws1, "state", 3); await _drain(ws2, 0.3)

        await ws1.send(json.dumps({"type": "start_round"}))
        st = await _recv_until(ws1, "state", 5)
        letter = st["room"]["current_letter"]
        await _drain(ws2, 0.3)

        # Submit intentionally-wrong prefix for p1; valid for p2
        wrong_letter = "X" if letter.upper() != "X" else "A"
        await ws1.send(json.dumps({"type": "submit_word", "category": "ad",
                                    "word": wrong_letter + "unknown"}))
        await ws2.send(json.dumps({"type": "submit_word", "category": "ad",
                                    "word": letter + "yqqqq"}))
        await asyncio.sleep(0.3)
        await _drain(ws1, 0.3); await _drain(ws2, 0.3)

        await ws1.send(json.dumps({"type": "stop"}))
        await _recv_until(ws1, "voting_phase", 5)
        await _recv_until(ws1, "state", 3)
        await _drain(ws2, 0.3)

        await ws1.send(json.dumps({"type": "finalize_round"}))
        rr = await _recv_until(ws1, "round_results", 5)
        bd = {(b["user_id"], b["category"]): b for b in rr["results"]["breakdown"]}
        assert bd[("test-player1", "ad")]["valid"] is False
        assert bd[("test-player1", "ad")]["points"] == 0
        assert bd[("test-player2", "ad")]["valid"] is True
        assert bd[("test-player2", "ad")]["points"] == 10
    finally:
        await ws1.close(); await ws2.close()


@pytest.mark.asyncio
async def test_ws_reconnect_resilience():
    """Disconnect and reconnect same user while another player stays; should rejoin cleanly.
    NOTE: Current implementation deletes empty rooms instantly, so this scenario requires
    at least one player to remain connected during the reconnect (documented separately).
    """
    r = requests.post(f"{BASE_URL}/api/rooms", headers=H(P1_TOKEN),
                      json={"is_private": True}, timeout=10)
    code = r.json()["code"]
    ws1 = await websockets.connect(f"{WS_URL}/api/ws/{code}?token={P1_TOKEN}")
    ws2 = await websockets.connect(f"{WS_URL}/api/ws/{code}?token={P2_TOKEN}")
    await _recv_until(ws1, "state", 5)
    await _recv_until(ws2, "state", 5)
    await _drain(ws1, 0.3); await _drain(ws2, 0.3)

    # p1 disconnects abruptly
    await ws1.close()
    await asyncio.sleep(0.3)

    # p1 reconnects - host should still be p1 since p2 is still there keeping the room alive
    ws1b = await websockets.connect(f"{WS_URL}/api/ws/{code}?token={P1_TOKEN}")
    try:
        m = await _recv_until(ws1b, "state", 5)
        assert m["room"]["code"] == code
        uids = {p["user_id"] for p in m["room"]["players"]}
        assert "test-player1" in uids
        assert "test-player2" in uids
    finally:
        await ws1b.close()
        await ws2.close()


@pytest.mark.asyncio
async def test_ws_solo_reconnect_room_destroyed_bug():
    """Documents current behavior: single-player room is destroyed instantly on disconnect,
    preventing reconnection. This is a reconnection-resiliency issue to flag for main agent.
    """
    r = requests.post(f"{BASE_URL}/api/rooms", headers=H(P1_TOKEN),
                      json={"is_private": True}, timeout=10)
    code = r.json()["code"]
    ws1 = await websockets.connect(f"{WS_URL}/api/ws/{code}?token={P1_TOKEN}")
    await _recv_until(ws1, "state", 5)
    await ws1.close()
    await asyncio.sleep(0.5)
    # REST check: room should no longer exist (current behavior)
    gr = requests.get(f"{BASE_URL}/api/rooms/{code}", headers=H(P1_TOKEN), timeout=10)
    assert gr.status_code == 404, (
        "Room unexpectedly survived solo disconnect; previously rooms were dropped immediately."
    )
