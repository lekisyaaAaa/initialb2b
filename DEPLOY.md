# Deployment guide

This repository contains Dockerfiles and a `docker-compose.yml` to run the app (Postgres, backend, frontend). Below are simple options to host the system.

1) Docker host / VPS (simple)
  - Build images locally or via CI and push to a registry (Docker Hub).
  - On server: pull images and run `docker-compose up -d`.
  - Make sure to set environment variables (see `.env.example`) and open ports 3000 (frontend) and 5000 (backend) and 5075 (db).

2) Render / Railway / Fly
  - Create two services: backend (Docker) and frontend (static or Docker), and a managed Postgres database.
  - Point frontend build to serve static files and use environment variables to configure the backend URL.

3) GitHub Actions + Docker Hub (CI)
  - The included workflow will build and push images when you push to `main` or `fix/contact-header-gap`.
  - Set `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` in repository secrets.

Notes
  - For production, enable HTTPS with a reverse proxy (nginx or cloud provider certs) and secure JWT secrets.
  - Consider using managed Postgres for production.
