# PRD — Ad, Soyad, Şəhər (real-time multiplayer word game)

## Original problem statement
Build a production-ready, real-time multiplayer word game based on the Azerbaijani classic "Ad, Soyad, Şəhər...". Tech: Next.js / Node / Socket.IO / PostgreSQL / JWT. Core features: lobby with 6-char private/public rooms, host controls (categories, timer 30/60/90s), 7 categories, random letter per round, unique/shared/invalid scoring, dictionary validation, leaderboard, profile, admin dashboard. Style: modern glassmorphism dark-blue pastel, mobile-first.

### User decisions (locked in)
- Stack: **React + FastAPI + MongoDB + WebSocket (native FastAPI)** (instead of Next.js/Express/Postgres).
- Auth: **Emergent-managed Google OAuth** (cookie session).
- Word validation: **players vote** (no server dictionary validation; admin dictionary still managed for future use).
- Multiplayer only (no bots).
- Design: glassmorphism dark-blue pastel (kept).

## Architecture
- Backend: FastAPI + Motor, REST under `/api/*`, game WebSocket at `/api/ws/{code}`.
- Game state: in-memory `GameManager` (rooms persisted to `matches` collection on game_end).
- MongoDB collections: `users`, `user_sessions`, `matches`, `dictionary_words`.
- Frontend: React + React Router 7 + shadcn/ui + Tailwind. Routes: `/`, `/auth/callback`, `/lobby`, `/room/:code`, `/leaderboard`, `/profile`, `/admin`.
- Fonts: Cabinet Grotesk (display), Outfit (body), JetBrains Mono (mono).

## What's been implemented (2026-02-23)
- Emergent Google Auth: `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`. Cookie-based with Bearer fallback.
- First user auto-promoted to admin; `ADMIN_EMAILS` env also grants admin.
- Rooms: `POST /api/rooms`, `GET /api/rooms/public`, `GET /api/rooms/{code}`.
- Game WebSocket: join/leave, chat, settings (host), start_round, submit_word, stop, vote, finalize_round (host), next_round (host), end_game (host), reconnect with 60s grace for empty rooms.
- Scoring engine: unique +10, shared +5, invalid (wrong letter or rejected by majority vote) 0.
- Leaderboard: `/api/leaderboard?period=daily|weekly|all` aggregated from `matches`.
- Profile: `/api/profile/me` stats + match history.
- Admin: users ban/mute, dictionary CRUD (`/api/admin/*`).
- Frontend pages: Landing (hero + marquee + CTA), Lobby (bento create/join + public rooms), Game Room (live grid, STOP!, voting, results, final scores, chat), Leaderboard (tabs), Profile (stats + history), Admin (users table + dictionary).
- Tested: 26/26 backend pytest cases pass (including full 2-player WS flow).

## Next action items (backlog)
- **P1**: Add optional LLM-backed dictionary fallback when votes are insufficient (Claude Sonnet 4.5 via Emergent key).
- **P1**: Persist active rooms to Redis for horizontal scale + survive restarts.
- **P2**: Server-initiated heartbeat (ping/pong) to detect dead sockets sooner.
- **P2**: Shareable room invite link; QR code for mobile.
- **P2**: Emoji reactions in chat; round replay timeline.
- **P3**: Seasonal rankings / ELO; friends system.

## Known minor caveats
- Active rooms live only in memory (backend restart drops them).
- Mute state not pushed live; checked per message.
- Auth cookie requires HTTPS (works on preview/prod; not on local HTTP).
