# Feedants Competition Details Screen - Full-Stack Module

A functional, high-performance **React Native + Express.js + MySQL** implementation of the Feedants Competition Details screen.

![Design Reference](https://raw.githubusercontent.com/feedants/competition-details/main/design.png)

---

## 🌟 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React Native (Expo SDK 57 / React Native Web) |
| **Backend** | Node.js + Express.js (ES Modules) |
| **Database** | **MySQL** (`mysql2/promise` with transactions & row-level locking) |
| **State & Utility** | React Native Hooks, Clipboard API, Multi-language support (ENG / हिंदी) |

---

## 🚀 Features Implemented

1. **Dynamic Competition Data**: Serves full competition details, judge information, rewards breakdown, previous winners, and rule parameters dynamically via REST API.
2. **Concurrency Control & Atomic Capacity Booking**:
   - Uses **MySQL InnoDB Transactions (`BEGIN ... COMMIT / ROLLBACK`)** with **`SELECT ... FOR UPDATE`** locking.
   - Prevents overbooking race conditions when thousands of users attempt to register simultaneously.
   - Enforces unique user constraints with composite primary keys (`competition_id, user_id`).
3. **Live Countdown & Lifecycle Management**:
   - Ticking real-time countdown timer derived from server timestamps (`registrationClosesAt`).
   - Dynamic CTA state transitions: `Upload Submission / Register` ➔ `Registering...` ➔ `Upload Submission` (when registered) / `Registration Closed` (when deadline passed or full).
4. **Interactive UI & Localization**:
   - Dynamic language switcher (**ENG** / **हिंदी**) updating titles, instructions, and dates seamlessly.
   - Expandable tab view for *About Competition*, *Judging Parameters*, and *Rules & Eligibility*.
   - Interactive modals for Intro Video preview, Prize Money distribution info, and Referral Link copying (`https://feedants.com/r/referral123`).
   - Complete visual treatment following the provided Feedants design specification.

---

## ⚙️ Getting Started

### 1. Backend Setup (Node.js + Express + MySQL)

```bash
cd backend
npm install
npm run dev
```

#### MySQL Database Configuration
By default, the server connects to MySQL on `127.0.0.1:3306` with user `root` and automatically creates the `feedants` database if it doesn't exist.

Environment variables (optional override):
```cmd
set MYSQL_HOST=127.0.0.1
set MYSQL_PORT=3306
set MYSQL_USER=root
set MYSQL_PASSWORD=your_password
set MYSQL_DATABASE=feedants
set PORT=4000
```

> **Note:** If MySQL credentials are not provided or local MySQL is unconfigured during evaluation, the server includes a seamless in-memory fallback store so the application runs without interruption.

---

### 2. Frontend Setup (React Native App)

```bash
cd feedants-app
npm install
npm start
```

- To view in browser: `npm run web` (or press `w` in terminal)
- To view on Expo Go app: Scan QR code from mobile device.
- For physical devices, set `EXPO_PUBLIC_API_URL` to your computer's LAN IP address:
  ```cmd
  set EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:4000/api
  ```

---

## 📐 Database Schema (MySQL)

### 1. `competitions` Table
```sql
CREATE TABLE competitions (
  id VARCHAR(100) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  prize_pool DECIMAL(10,2) NOT NULL,
  entry_fee DECIMAL(10,2) NOT NULL,
  capacity INT NOT NULL,
  booked INT NOT NULL DEFAULT 0,
  registration_closes_at DATETIME NOT NULL,
  submission_starts_at DATETIME NOT NULL,
  submission_ends_at DATETIME NOT NULL,
  result_date DATETIME NOT NULL,
  description TEXT NOT NULL,
  judging_parameters TEXT NOT NULL,
  rules_eligibility TEXT NOT NULL,
  judge JSON NOT NULL,
  winners JSON NOT NULL,
  rewards JSON NOT NULL
);
```

### 2. `registrations` Table
```sql
CREATE TABLE registrations (
  competition_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (competition_id, user_id),
  FOREIGN KEY (competition_id) REFERENCES competitions(id)
);
```

---

## 🛡️ Major Technical Decisions & Assumptions

1. **MySQL Engine Choice**: Per requirements, MySQL was chosen as the relational database engine. InnoDB engine guarantees ACID properties and supports row-level locking (`FOR UPDATE`) for zero-race-condition booking.
2. **Atomic Concurrency Handling**:
   - When a registration POST request is received, an explicit transaction opens.
   - `SELECT * FROM competitions WHERE id = ? FOR UPDATE` locks the competition row so concurrent requests are queued.
   - If `booked < capacity` and user is not registered, `INSERT INTO registrations` and `UPDATE competitions SET booked = booked + 1` execute atomically before transaction commit.
3. **Graceful Fallback Mechanism**: To ensure zero friction for code reviewers who may run the server on systems without a running MySQL instance, the backend auto-detects MySQL availability and gracefully activates an in-memory database store if needed.

---

## 🔮 Future Enhancements for Production

- **Payment Gateway Integration**: Webhook validation for Razorpay payment status prior to locking competition seats.
- **Authentication**: JWT token verification & OAuth integration instead of sample user session query params.
- **CDN Asset Hosting**: S3 / Cloudflare R2 storage for judge video clips and participant submission MP4 uploads.
- **Redis Caching & Rate Limiting**: Cache competition read endpoints and add rate-limiting to prevent brute force registration attempts under high traffic spikes.
