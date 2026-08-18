# Systemd management for Regola deployment

Usage:

1. On the VPS, deploy the application once with the provided script to build the image and create the container:

```bash
cd /opt/regola
sudo bash scripts/deploy.sh
```

2. Copy the systemd unit file to `/etc/systemd/system/regola.service`:

```bash
sudo cp deploy/regola.service /etc/systemd/system/regola.service
sudo systemctl daemon-reload
sudo systemctl enable --now regola.service
```

3. After this point, systemd will start/stop the existing `regola` container. To update the application, run `scripts/deploy.sh` again (it will recreate the container), then restart the service if needed:

```bash
sudo bash scripts/deploy.sh
sudo systemctl restart regola.service
```

Notes:

- `scripts/deploy.sh` creates a container named `regola`. The systemd unit assumes that name. Do not rename the container unless you update the unit.
- Keep your production `.env` at `/opt/regola/.env` with permissions `600` and owned by the deploy user.
- Do NOT commit `.env` or private keys into the repository.
