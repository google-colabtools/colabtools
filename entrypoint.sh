#!/bin/sh

cleanup() {
	echo "Cleaning up..."
	pkill -f weston
	exit 0
}

trap cleanup EXIT

# Log message to indicate the script is running
echo "Starting entrypoint script: Configuring DNS for this run..."

# Command to overwrite resolv.conf with the desired DNS servers
# This command will be executed every time the container starts
tee /etc/resolv.conf <<'EOF'
nameserver 8.8.8.8
nameserver 1.1.1.1
EOF

echo "DNS configured successfully."

# Setup runtime directory
mkdir -p "${XDG_RUNTIME_DIR}"
chmod 0700 "${XDG_RUNTIME_DIR}"

# Create Weston config file with specific resolution
mkdir -p /home/user/.config/weston
cat > /home/user/.config/weston/weston.ini << EOF
[core]
idle-time=0
require-input=false
cursor-theme=default
cursor-size=24

[shell]
size=1920x1080
EOF

# Start Weston with headless backend and specific resolution
nohup /usr/bin/weston --backend=headless-backend.so --width=1920 --height=1080 &

# Wait for Weston to start
TIMEOUT=10
COUNTER=0
while [ ! -e "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" ] && [ $COUNTER -lt $TIMEOUT ]; do
	echo "Waiting for Wayland socket... ($COUNTER/$TIMEOUT)"
	sleep 1
	COUNTER=$((COUNTER + 1))
done

if [ ! -e "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" ]; then
	echo "Error: Wayland socket not found after $TIMEOUT seconds"
	exit 1
fi

# Print environment variables for debugging
echo "XDG_RUNTIME_DIR: ${XDG_RUNTIME_DIR}"
echo "WAYLAND_DISPLAY: ${WAYLAND_DISPLAY}"
echo "Wayland socket path: ${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}"
echo "Socket exists: $([ -e "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" ] && echo "Yes" || echo "No")"

# Verify Weston is running
if pgrep -f weston > /dev/null; then
	echo "Weston process is running"
else
	echo "ERROR: Weston process is not running"
	exit 1
fi

# Try to run weston-info if available
if command -v weston-info > /dev/null; then
	echo "Running weston-info:"
	WAYLAND_DEBUG=1 weston-info || echo "weston-info failed"
fi

echo "Weston is ready"

exec /usr/local/bin/supercronic /home/user/app/crontemplate &

# Execute the main command (main.py)
exec "$@"
