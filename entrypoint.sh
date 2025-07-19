#!/bin/bash

cleanup() {
    echo "Cleaning up..."
    pkill -f sway
    exit 0
}

trap cleanup EXIT


# Setup runtime directory
mkdir -p "${XDG_RUNTIME_DIR}"
chmod 0700 "${XDG_RUNTIME_DIR}"

# Start sway with headless backend
WLR_BACKENDS=headless WLR_RENDERER=pixman sway --verbose &

# Wait for sway socket with timeout
TIMEOUT=10
COUNTER=0
while [ ! -e "${SWAYSOCK}" ] && [ $COUNTER -lt $TIMEOUT ]; do
    echo "Waiting for sway socket... ($COUNTER/$TIMEOUT)"
    sleep 1
    COUNTER=$((COUNTER + 1))
done

if [ ! -e "${SWAYSOCK}" ]; then
    echo "Error: Sway socket not found after $TIMEOUT seconds"
    exit 1
fi

# Wait for Wayland socket with timeout
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

echo "Sway is ready"

# execute CMD
echo "$@"
"$@"
