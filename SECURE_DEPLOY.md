# Secure deployment checklist

Quick reference for safely deploying Regola to VPS and enabling automated deploys.

1) Never commit secrets
- Do NOT commit `.env` or any private keys. Keep a single `.env.example` in the repo with placeholders.

2) Use GitHub Secrets for CI deploys
- Store `VPS_HOST`, `VPS_USER`, `VPS_PORT` (optional), and `SSH_PRIVATE_KEY` as GitHub Secrets.
- The Actions workflow should use the private key only at runtime and never echo or store it.

3) SSH key and server user
- Create a dedicated `deploy` user on the VPS with limited sudo rights if needed.
- Install the public key in `~deploy/.ssh/authorized_keys` and set `chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`.

4) Environment and secrets rotation
- Use strong, randomly generated values for `JWT_SECRET`, `ADMIN_ACCESS_KEY`, `ADMIN_PASSWORD`.
- Plan rotation: update `.env` on VPS, then restart container. Keep rotation notes and rotate at least every 6-12 months or after any suspected exposure.

5) Backup before deploy
- Before running `scripts/deploy.sh` or updating the container, back up the SQLite DB:

  sudo cp /opt/regola-data/regola.db /opt/regola-backups/regola-$(date +%F-%H%M%S).db

6) Health checks and verification
- `scripts/health-check.sh` (in the repo) checks `http://127.0.0.1:4000/api/health`.
- After deploy, run:

  ./scripts/health-check.sh

  curl -fsS http://127.0.0.1:4000/api/commerce/config

7) CI / GitHub Actions tips
- Use `appleboy/ssh-action` or similar; provide `SSH_PRIVATE_KEY` via secrets and set `known_hosts` in the workflow.
- Prevent accidental deploys by adding `if: github.ref == 'refs/heads/main'` to the deploy job.

8) Removing secrets from history (if needed)
- If a secret was accidentally committed, rotate the secret immediately and then remove it from git history with `git filter-repo` or BFG. This operation rewrites history and requires force-push; coordinate with the team.

9) Permissions and file locations
- Application files: `/opt/regola` (git repo)
- Runtime data: `/opt/regola-data` (DB, uploads) — ensure only the deploy user and the container can write here.

10) Rollback plan
- Keep a tested DB and image backup. To rollback, stop the container, restore DB from backup, and re-run the previous image tag.
