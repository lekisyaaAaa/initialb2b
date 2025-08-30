# Backend seeds and notes

This folder contains the backend server and a small seed script `createUsers.js` used to create an admin user for local development.

Usage:

- Ensure PostgreSQL is running and `DATABASE_URL` in `backend/.env` points to the correct DB.
- Run the seed script to create/reset the admin user:

```powershell
node backend/createUsers.js
```

Security:
- Do not enable `ENABLE_LOCAL_ADMIN` in production. That flag is only for temporary local testing.
