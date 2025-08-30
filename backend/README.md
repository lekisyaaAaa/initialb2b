# Backend notes

This folder contains the Node.js/Express backend for the Environmental Monitoring system.

## Seed script

`createUsers.js` is a convenience seed script that creates a default admin user in the configured PostgreSQL database.

- Default credentials created by the script: `admin` / `admin123` (change immediately in production).
- The script connects using the `DATABASE_URL` environment variable (see root `.env` or `backend/.env`).
- The script will `destroy` existing users before inserting the admin (intentional for fresh installs).

Run locally (development only):

```powershell
node backend/createUsers.js
```

Important:
- Do NOT run this script in production without auditing its effects — it clears the `users` table.
- Ensure `JWT_SECRET` is set to a strong secret in production.
- The project uses Sequelize and expects `createdAt`/`updatedAt` columns on the `users` table (timestamps enabled in the model).
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
