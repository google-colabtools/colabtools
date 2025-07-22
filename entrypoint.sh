#!/bin/bash

cleanup() {
    echo "Cleaning up..."
    pkill -f sway
    pkill -f squid
    exit 0
}

trap cleanup EXIT

# Start squid proxy in background
squid -N &

# Aguarda o Squid responder na porta 3128
SQUID_TIMEOUT=10
SQUID_COUNTER=0
while ! nc -z 127.0.0.1 3128 && [ $SQUID_COUNTER -lt $SQUID_TIMEOUT ]; do
    echo "Waiting for squid... ($SQUID_COUNTER/$SQUID_TIMEOUT)"
    sleep 1
    SQUID_COUNTER=$((SQUID_COUNTER + 1))
done

if ! nc -z 127.0.0.1 3128; then
    echo "Error: Squid not responding on port 3128 after $SQUID_TIMEOUT seconds"
    exit 1
fi

echo "Squid is ready"

# Show public IP and country via proxy
echo "Testing public IP and country via Squid proxy..."
PROXY_IP=$(curl -s --proxy http://127.0.0.1:3128 https://ipinfo.io/ip)
PROXY_COUNTRY=$(curl -s --proxy http://127.0.0.1:3128 https://ipinfo.io/country)
if [ -z "$PROXY_IP" ]; then
    echo "Proxy public IP: (not detected)"
else
    echo "Proxy public IP: $PROXY_IP"
fi
if [ -z "$PROXY_COUNTRY" ]; then
    echo "Proxy country: (not detected)"
else
    echo "Proxy country: $PROXY_COUNTRY"
fi

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
