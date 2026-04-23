# Ad, Soyad, Şəhər — Mobil (Expo)

Real-time çoxoyunçulu "Ad, Soyad, Şəhər..." oyununun Expo Go ilə işləyən mobil versiyası. Web tətbiqi ilə **eyni backend**-i istifadə edir.

## Quraşdırma (yerli maşında)

Ön tələblər:
- Node.js 18+ və Yarn
- Telefonunuzda **Expo Go** (iOS App Store / Google Play)

```bash
cd /app/mobile
yarn install
yarn start:tunnel      # tunnel rejimi — fərqli şəbəkələrdən QR skan etməyə imkan verir
# və ya:
yarn start             # yerli Wi-Fi şəbəkəsi ilə
```

Terminalda çıxan **QR kodu** Expo Go ilə skan edin.

## Mühit dəyişənləri

`/app/mobile/.env`:
```
EXPO_PUBLIC_BACKEND_URL=https://azure-word-battle.preview.emergentagent.com
```

Faylı dəyişsəniz, `yarn start -c` (cache təmizləmə ilə) yenidən başladın.

## Xüsusiyyətlər

- Emergent Google Auth (Expo AuthSession, dərin bağlantı ilə)
- Lobi: özəl/açıq otaq yarat, 6 simvollu kodla qoşul, açıq otaqlar siyahısı
- Oyun otağı: canlı WebSocket axını, timer, STOP!, səsvermə, bal animasiyaları
- Lider cədvəli (günlük/həftəlik/bütün zaman)
- Profil: statistika + oyun tarixçəsi
- Çıxış düyməsi

## Arxitektura

- **Backend**: Web tətbiqi ilə eyni FastAPI backend (`EXPO_PUBLIC_BACKEND_URL/api`).
- **Session**: `expo-secure-store` → `Authorization: Bearer` başlığı avtomatik əlavə olunur.
- **WebSocket**: `wss://<backend>/api/ws/{code}?token=<session_token>`.
- **Naviqasiya**: React Navigation (Native Stack + Bottom Tabs).
- **Stil**: `expo-blur` + pastel rəng palitrası ilə dark glassmorphism.

## Dəyişənlər

- `/app/mobile/src/lib/theme.js` — rəng və məsafə sistemi
- `/app/mobile/src/lib/api.js` — axios + WebSocket URL helper
- `/app/mobile/src/lib/auth.js` — Emergent Google Auth axını

## Admin paneli
Admin yalnız web versiyasında mövcuddur (`/admin`), mobildə deyil.

## Bilinən Kaviatlar
- Production build üçün `app.json`-dakı bundleIdentifier və package dəyişdirilməlidir.
- Tunnel rejimi `ngrok` ilə işləyir; korporativ şəbəkələrdə bloklana bilər.
