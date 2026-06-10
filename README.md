# FD Platform Prototype

A simplified demo prototype for an FD booking platform.

## Features
- Mobile-responsive UI using plain HTML/JS/CSS.
- Simple OTP-less login flow for demo purposes (OTP is hardcoded to `123456`).
- Browse fixed deposit rates across multiple banks.
- Direct booking flow mocking KYC and payment layers.
- View portfolio and confirmed bookings.

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Database:**
   Ensure PostgreSQL is running and the database matches the `.env` settings.
   To run migrations or seeds:
   ```bash
   psql -d blostem -f ../db/schema.sql
   psql -d blostem -f ../db/seed.sql
   ```

3. **Start the server:**
   ```bash
   npm run start
   # or for development: npm run dev
   ```

4. **Access the application:**
   Open `http://localhost:4000` in your browser.
