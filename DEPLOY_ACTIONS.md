# CI-driven deploy (GitHub Actions)

This project includes a GitHub Actions workflow at `.github/workflows/ci-deploy.yml` that:

- runs `npm test` and `npm run build` on pushes to `main`
- SSHes to your VPS and runs the `scripts/deploy.sh` to back up DB, build image and restart the container

Required repository Secrets (set these in GitHub → Settings → Secrets & variables → Actions):

- `VPS_HOST` — IP or hostname of the VPS
- `VPS_USER` — SSH user to connect as (must be able to run `sudo` and control Docker)
- `VPS_PORT` — SSH port (default `22`)
- `SSH_PRIVATE_KEY` — private key contents for the user (keep private; do NOT commit into repo)

Preparation steps on the VPS (one-time):

1. Ensure Docker and git are installed and user has permission to run Docker.
2. Create `/opt/regola` checkout of the repo and a writable `/opt/regola-data` for DB.
3. Create a working `.env` at `/opt/regola/.env` with production secrets (do NOT commit to repo).
4. Ensure the SSH public key corresponding to `SSH_PRIVATE_KEY` is present in the remote user's `~/.ssh/authorized_keys`.

Security notes:

- Never add private keys or `.env` files to the repository. Use GitHub Secrets for private keys.
- Rotate keys and secrets periodically and after any suspicion of compromise.
