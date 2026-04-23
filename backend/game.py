"""
In-memory game engine for Ad, Soyad, Şəhər multiplayer game.
Handles rooms, rounds, scoring, voting.
"""
from __future__ import annotations
import asyncio
import random
import string
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from fastapi import WebSocket

# Azerbaijani alphabet (letters likely to yield words)
AZ_LETTERS = list("ABCÇDEƏFGHIİKQLMNOÖPRSŞTUÜVYZ")

# Category keys
CATEGORIES = ["ad", "soyad", "seher", "olke", "bitki", "heyvan", "esya"]

CATEGORY_LABELS = {
    "ad": "Ad",
    "soyad": "Soyad",
    "seher": "Şəhər",
    "olke": "Ölkə",
    "bitki": "Bitki",
    "heyvan": "Heyvan",
    "esya": "Əşya",
}


def generate_room_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


class Player:
    def __init__(self, user_id: str, name: str, picture: str, ws: WebSocket, is_host: bool = False):
        self.user_id = user_id
        self.name = name
        self.picture = picture
        self.ws = ws
        self.is_host = is_host
        self.score = 0
        self.submissions: Dict[str, str] = {}  # category -> word for current round
        self.stopped = False  # pressed STOP!

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "name": self.name,
            "picture": self.picture,
            "is_host": self.is_host,
            "score": self.score,
            "submitted": list(self.submissions.keys()),
            "stopped": self.stopped,
        }


class Room:
    def __init__(self, code: str, host_id: str, is_private: bool):
        self.code = code
        self.host_id = host_id
        self.is_private = is_private
        self.players: Dict[str, Player] = {}
        self.categories: List[str] = list(CATEGORIES)
        self.timer_seconds = 60
        self.total_rounds = 3
        self.current_round = 0
        self.current_letter: Optional[str] = None
        self.state = "lobby"  # lobby | playing | voting | results | ended
        self.round_deadline: Optional[datetime] = None
        # Votes: {target_user_id: {category: {voter_id: bool}}}
        self.votes: Dict[str, Dict[str, Dict[str, bool]]] = {}
        self.last_round_results: Optional[dict] = None
        self.final_scores: Optional[List[dict]] = None
        self.chat: List[dict] = []
        self._timer_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        self.created_at = datetime.now(timezone.utc)

    def to_state(self) -> dict:
        return {
            "code": self.code,
            "host_id": self.host_id,
            "is_private": self.is_private,
            "state": self.state,
            "categories": self.categories,
            "timer_seconds": self.timer_seconds,
            "total_rounds": self.total_rounds,
            "current_round": self.current_round,
            "current_letter": self.current_letter,
            "round_deadline": self.round_deadline.isoformat() if self.round_deadline else None,
            "players": [p.to_dict() for p in self.players.values()],
            "last_round_results": self.last_round_results,
            "final_scores": self.final_scores,
        }


class GameManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self._on_game_end = None  # callback for persistence

    def set_on_game_end(self, cb):
        self._on_game_end = cb

    def create_room(self, host_id: str, is_private: bool) -> Room:
        # Generate unique code
        for _ in range(20):
            code = generate_room_code()
            if code not in self.rooms:
                room = Room(code, host_id, is_private)
                self.rooms[code] = room
                return room
        raise RuntimeError("Could not generate unique room code")

    def get_room(self, code: str) -> Optional[Room]:
        return self.rooms.get(code.upper())

    def list_public_rooms(self) -> List[dict]:
        return [
            {
                "code": r.code,
                "host_name": r.players.get(r.host_id).name if r.host_id in r.players else "?",
                "players": len(r.players),
                "state": r.state,
                "timer_seconds": r.timer_seconds,
                "categories": r.categories,
            }
            for r in self.rooms.values()
            if not r.is_private and r.state in ("lobby", "playing", "voting", "results")
        ]

    async def broadcast(self, room: Room, message: dict, exclude_user: Optional[str] = None):
        dead = []
        for uid, p in room.players.items():
            if exclude_user and uid == exclude_user:
                continue
            try:
                await p.ws.send_json(message)
            except Exception:
                dead.append(uid)
        for uid in dead:
            room.players.pop(uid, None)

    async def join(self, code: str, player: Player) -> Room:
        room = self.get_room(code)
        if not room:
            raise ValueError("Room not found")
        # If player already there, replace the WS connection
        existing = room.players.get(player.user_id)
        if existing:
            existing.ws = player.ws
            existing.name = player.name
            existing.picture = player.picture
            player = existing
        else:
            player.is_host = (player.user_id == room.host_id)
            room.players[player.user_id] = player
        await self.broadcast(room, {"type": "state", "room": room.to_state()})
        return room

    async def leave(self, room: Room, user_id: str):
        if user_id in room.players:
            room.players.pop(user_id, None)
            # Transfer host if host left and there are other players
            if user_id == room.host_id and room.players:
                new_host_id = next(iter(room.players.keys()))
                room.host_id = new_host_id
                room.players[new_host_id].is_host = True
            await self.broadcast(room, {"type": "state", "room": room.to_state()})
            if not room.players:
                # Grace period for reconnection (60s)
                asyncio.create_task(self._cleanup_empty_room(room.code))

    async def _cleanup_empty_room(self, code: str, delay: int = 60):
        await asyncio.sleep(delay)
        room = self.rooms.get(code)
        if room and not room.players:
            self.rooms.pop(code, None)

    async def update_settings(self, room: Room, user_id: str, *, timer_seconds=None, total_rounds=None, categories=None):
        if user_id != room.host_id:
            return
        if room.state != "lobby":
            return
        if timer_seconds in (30, 60, 90):
            room.timer_seconds = timer_seconds
        if isinstance(total_rounds, int) and 1 <= total_rounds <= 10:
            room.total_rounds = total_rounds
        if isinstance(categories, list) and all(c in CATEGORIES for c in categories) and categories:
            room.categories = categories
        await self.broadcast(room, {"type": "state", "room": room.to_state()})

    async def start_round(self, room: Room, user_id: str):
        if user_id != room.host_id:
            return
        if room.state not in ("lobby", "results"):
            return
        if len(room.players) < 1:
            return
        # Pick a letter not used yet? Simple random.
        room.current_letter = random.choice(AZ_LETTERS)
        room.current_round += 1
        room.state = "playing"
        room.last_round_results = None
        room.votes = {}
        for p in room.players.values():
            p.submissions = {}
            p.stopped = False
        from datetime import timedelta
        room.round_deadline = datetime.now(timezone.utc) + timedelta(seconds=room.timer_seconds)
        await self.broadcast(room, {"type": "state", "room": room.to_state()})
        # Start timer
        if room._timer_task and not room._timer_task.done():
            room._timer_task.cancel()
        room._timer_task = asyncio.create_task(self._timer(room))

    async def _timer(self, room: Room):
        try:
            await asyncio.sleep(room.timer_seconds)
            if room.state == "playing":
                await self.end_round_input(room, reason="time")
        except asyncio.CancelledError:
            pass

    async def submit_word(self, room: Room, user_id: str, category: str, word: str):
        if room.state != "playing":
            return
        if category not in room.categories:
            return
        p = room.players.get(user_id)
        if not p:
            return
        word = (word or "").strip()
        if len(word) > 30:
            word = word[:30]
        p.submissions[category] = word
        # Inform others which categories are filled (without the answer)
        await self.broadcast(room, {
            "type": "player_progress",
            "user_id": user_id,
            "submitted": list(p.submissions.keys()),
        })

    async def call_stop(self, room: Room, user_id: str):
        if room.state != "playing":
            return
        p = room.players.get(user_id)
        if not p:
            return
        p.stopped = True
        await self.end_round_input(room, reason="stop", caller=user_id)

    async def end_round_input(self, room: Room, reason: str, caller: Optional[str] = None):
        if room.state != "playing":
            return
        if room._timer_task and not room._timer_task.done():
            room._timer_task.cancel()
        room.state = "voting"
        # Build voting items
        vote_items = []
        for uid, p in room.players.items():
            for cat in room.categories:
                word = p.submissions.get(cat, "").strip()
                vote_items.append({
                    "target_user_id": uid,
                    "target_name": p.name,
                    "category": cat,
                    "word": word,
                })
                room.votes.setdefault(uid, {}).setdefault(cat, {})
        await self.broadcast(room, {
            "type": "voting_phase",
            "reason": reason,
            "caller": caller,
            "items": vote_items,
            "letter": room.current_letter,
        })
        await self.broadcast(room, {"type": "state", "room": room.to_state()})

    async def submit_vote(self, room: Room, voter_id: str, target_user_id: str, category: str, approve: bool):
        if room.state != "voting":
            return
        if voter_id == target_user_id:
            return  # cannot vote on own
        target = room.players.get(target_user_id)
        if not target:
            return
        if category not in room.categories:
            return
        word = target.submissions.get(category, "").strip()
        if not word:
            return  # no word, no vote needed
        room.votes.setdefault(target_user_id, {}).setdefault(category, {})[voter_id] = approve
        # Broadcast vote tally
        votes_for_item = room.votes[target_user_id][category]
        approvals = sum(1 for v in votes_for_item.values() if v)
        rejections = sum(1 for v in votes_for_item.values() if not v)
        await self.broadcast(room, {
            "type": "vote_update",
            "target_user_id": target_user_id,
            "category": category,
            "approvals": approvals,
            "rejections": rejections,
            "voter_id": voter_id,
            "approve": approve,
        })

    async def finalize_round(self, room: Room, user_id: str):
        """Host finalizes votes and calculates scores."""
        if user_id != room.host_id:
            return
        if room.state != "voting":
            return
        await self._calculate_scores(room)

    async def _calculate_scores(self, room: Room):
        letter = (room.current_letter or "").lower()
        # Determine validity per submission: word must start with letter, be non-empty,
        # and majority of other players approve (>= 50%+1). If no votes, default valid if starts with letter.
        valid_map: Dict[str, Dict[str, bool]] = {}
        for uid, p in room.players.items():
            valid_map[uid] = {}
            for cat in room.categories:
                word = p.submissions.get(cat, "").strip()
                if not word:
                    valid_map[uid][cat] = False
                    continue
                # Must start with letter (case-insensitive, Azerbaijani lowercase)
                if not word.lower().startswith(letter):
                    valid_map[uid][cat] = False
                    continue
                votes_for_item = room.votes.get(uid, {}).get(cat, {})
                total_voters = max(1, len(room.players) - 1)
                if votes_for_item:
                    approvals = sum(1 for v in votes_for_item.values() if v)
                    # Majority of actual voters (of those who voted)
                    if len(votes_for_item) >= max(1, (total_voters + 1) // 2):
                        valid_map[uid][cat] = approvals * 2 >= len(votes_for_item)
                    else:
                        # Not enough votes - trust starts-with-letter
                        valid_map[uid][cat] = True
                else:
                    valid_map[uid][cat] = True

        # Compute uniqueness per category
        round_delta: Dict[str, int] = {uid: 0 for uid in room.players}
        breakdown = []
        for cat in room.categories:
            # collect lowercase valid words
            word_counts: Dict[str, int] = {}
            for uid, p in room.players.items():
                if valid_map[uid].get(cat):
                    w = p.submissions.get(cat, "").strip().lower()
                    word_counts[w] = word_counts.get(w, 0) + 1
            for uid, p in room.players.items():
                w = p.submissions.get(cat, "").strip()
                valid = valid_map[uid].get(cat, False)
                points = 0
                if valid:
                    c = word_counts.get(w.lower(), 0)
                    points = 10 if c == 1 else 5
                round_delta[uid] += points
                breakdown.append({
                    "user_id": uid,
                    "category": cat,
                    "word": w,
                    "valid": valid,
                    "points": points,
                })

        for uid, delta in round_delta.items():
            if uid in room.players:
                room.players[uid].score += delta

        room.last_round_results = {
            "round": room.current_round,
            "letter": room.current_letter,
            "breakdown": breakdown,
            "delta": round_delta,
            "totals": {uid: p.score for uid, p in room.players.items()},
        }
        room.state = "results"
        await self.broadcast(room, {"type": "round_results", "results": room.last_round_results})
        await self.broadcast(room, {"type": "state", "room": room.to_state()})

        # Auto end game if last round
        if room.current_round >= room.total_rounds:
            await self.end_game(room)

    async def next_round(self, room: Room, user_id: str):
        if user_id != room.host_id:
            return
        if room.state != "results":
            return
        if room.current_round >= room.total_rounds:
            await self.end_game(room)
            return
        await self.start_round(room, user_id)

    async def end_game(self, room: Room):
        room.state = "ended"
        ranked = sorted(room.players.values(), key=lambda p: p.score, reverse=True)
        room.final_scores = [
            {"user_id": p.user_id, "name": p.name, "picture": p.picture, "score": p.score}
            for p in ranked
        ]
        await self.broadcast(room, {"type": "game_end", "final_scores": room.final_scores})
        await self.broadcast(room, {"type": "state", "room": room.to_state()})
        # Persist
        if self._on_game_end:
            try:
                await self._on_game_end(room)
            except Exception as e:
                print("Persist error:", e)

    async def chat(self, room: Room, user_id: str, text: str):
        p = room.players.get(user_id)
        if not p or not text:
            return
        msg = {
            "user_id": user_id,
            "name": p.name,
            "picture": p.picture,
            "text": text[:300],
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        room.chat.append(msg)
        if len(room.chat) > 100:
            room.chat = room.chat[-100:]
        await self.broadcast(room, {"type": "chat", "message": msg})


game_manager = GameManager()
