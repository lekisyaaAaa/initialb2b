This folder contains legacy migration helpers that historically referenced MongoDB/mongoose.

As part of the Postgres-only cleanup (Option A), runnable migration scripts were removed from the active tree and replaced by pointer files. The original runnable scripts are preserved in the repository history and can be restored if needed.

If you must perform a MongoDB -> Postgres migration or run the validator, restore the desired script from git history (for example:

```powershell
# show history
git log -- backend/legacy_migrations/

# restore a file from a specific commit
git checkout <commit-sha> -- backend/legacy_migrations/migrate-users-to-pg.js
```

After restoring, set `MONGODB_URI` in your environment and run the script from the `backend/` folder.
