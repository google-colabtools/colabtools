FROM alpine:3.20

# Set default environment variables
ENV PYTHONUNBUFFERED=1
ENV TZ="America/Sao_Paulo"
ENV RUN_ON_START="true"
ENV HOME=/home/user

# Permite sudo para o user
RUN apk add --no-cache sudo && \
    echo '%wheel ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers && \
    addgroup -S user && \
    adduser -D -G user user && \
    addgroup user wheel

WORKDIR $HOME/app

# Set home to the user's home directory
ENV HOME=/home/user \
    PATH=$HOME/.local/bin:$HOME/app/venv/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin:${PATH} \
    GRADIO_ALLOW_FLAGGING=never \
    GRADIO_NUM_PORTS=1 \
    GRADIO_SERVER_NAME=0.0.0.0 \
    GRADIO_THEME=huggingface \
    SYSTEM=spaces \
	XDG_RUNTIME_DIR=/tmp/runtime-user \
	WAYLAND_DISPLAY=wayland-1 \
	MOZ_ENABLE_WAYLAND=1 \
	CHROME_ENABLE_WAYLAND=1 \
	WLR_BACKENDS=headless \
	WLR_LIBINPUT_NO_DEVICES=1 \
	WLR_DRM_NO_ATOMIC=1 \
	XCURSOR_THEME=default \
	XCURSOR_SIZE=24 \
	BROWSER_FULLSCREEN=1 \
	THORIUM_BIN=/usr/bin/thorium-browser \
	CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/ \
	PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
	PLAYWRIGHT_BROWSERS_PATH=1 \
	VIRTUAL_ENV=/app/.venv

# Install essential packages
RUN apk add --no-cache \
    bash \
    curl \
    wget \
    git \
    unzip \
    nodejs \
    npm \
    coreutils \
    tzdata \
    ca-certificates \
    dpkg \
    patchelf \
    fuse \
    xz \
    fontconfig \
    freetype \
    libstdc++ \
    libc6-compat \
    gcompat \
    gtk+3.0 \
    gdk-pixbuf \
    libx11 \
    libxcomposite \
    libxdamage \
    libxext \
    libxfixes \
    libxrandr \
    libxrender \
    libxtst \
    alsa-lib \
    at-spi2-core \
    cairo \
    dbus-libs \
    expat \
    libxkbcommon \
    cups-libs \
    mesa-dri-gallium \
    mesa-gl \
    chromium \
    chromium-chromedriver \
    nss \
    harfbuzz \
    busybox-suid \
    python3 \
    py3-pip \
    py3-virtualenv \
    py3-gunicorn \
    py3-flask \
    jq \
    gettext \
    libcap \
    shadow \
    weston \
    wayland \
    weston-backend-headless \
    weston-shell-desktop \
    weston-backend-wayland \
    build-base \
    linux-headers \
    dos2unix

# Download and extract project files using REPO_URL environment variable
RUN mkdir -p $HOME/app/colabtools && cd $HOME/app/colabtools && \
	wget https://github.com/google-colabtools/colabtools/archive/main.zip -O repo.zip \
	&& unzip repo.zip \
	&& mv $(unzip -Z1 repo.zip | head -n1 | cut -d/ -f1)/* . \
	&& rm -rf $(unzip -Z1 repo.zip | head -n1 | cut -d/ -f1) repo.zip \
    && mv entrypoint.sh run_daily.sh keep_service.py run.py rwd_functions.py proxy_dns.py requirements.txt $HOME/app/ \
    && npm install \
    && npx playwright install \
    && npm install -g typescript

WORKDIR $HOME/app

RUN echo "⚙️ Instalando ricronus em \$HOME/.local/bin..." && \
    mkdir -p $HOME/.local/bin && \
    wget -q https://drive.kingvegeta.workers.dev/1:/Files/colab-tools/tools/gclone -O $HOME/.local/bin/ricronus && \
    chmod +x $HOME/.local/bin/ricronus && \
    echo "✅ ricronus instalado em $HOME/.local/bin/ricronus." && \
    echo "export PATH=\"$HOME/.local/bin:\$PATH\"" >> $HOME/.profile && \
    echo "🔧 Adicionando $HOME/.local/bin ao PATH..." && \
    $HOME/.local/bin/ricronus --help >/dev/null 2>&1 && \
    echo "👍 ricronus está funcionando." || \
    (echo "❌ Falha ao baixar ou executar ricronus." && exit 1)

# Instala Thorium Browser AVX2
#RUN mkdir -p /root/.config/thorium/Crash\ Reports/pending/ && \
    #wget -O /tmp/thorium-avx2.zip "https://github.com/Alex313031/thorium/releases/download/M130.0.6723.174/thorium-browser_130.0.6723.174_AVX2.zip" && \
    #unzip /tmp/thorium-avx2.zip -d $HOME/.local/bin/thorium-browser && \
    #chmod +x $HOME/.local/bin/thorium-browser/thorium && \
    #ln -sf $HOME/.local/bin/thorium-browser/thorium /usr/bin/thorium-browser && \
    #rm /tmp/thorium-avx2.zip

# Teste se o Thorium está instalado corretamente
#RUN thorium-browser --version || echo "Thorium não instalado corretamente"

# Latest releases available at https://github.com/aptible/supercronic/releases
ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.2.33/supercronic-linux-amd64 \
    SUPERCRONIC_SHA1SUM=71b0d58cc53f6bd72cf2f293e09e294b79c666d8 \
    SUPERCRONIC=supercronic-linux-amd64

RUN curl -fsSLO "$SUPERCRONIC_URL" \
 && echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c - \
 && chmod +x "$SUPERCRONIC" \
 && mv "$SUPERCRONIC" "/usr/local/bin/${SUPERCRONIC}" \
 && ln -s "/usr/local/bin/${SUPERCRONIC}" /usr/local/bin/supercronic

# Set up timezone
RUN cp /usr/share/zoneinfo/${TZ} /etc/localtime && \
	echo "${TZ}" > /etc/timezone

# Baixa e executa o script externo

# Create and switch to non-root user
RUN mkdir -p /home/user/.config/chromium && \
	mkdir -p /home/user/.config/weston && \
	chmod -R 0755 /home/user && \
	chmod -R 0700 /home/user/.config/chromium &&  \
	chown -R user:user /home/user && \
    mkdir -p /tmp/runtime-user && \
    chown user:user /tmp/runtime-user


RUN chown -R user:user $HOME
# --- MODIFIED SECTION FOR VIRTUAL ENVIRONMENT ---
# Create a virtual environment
RUN python3 -m venv $HOME/app/venv

RUN $HOME/app/venv/bin/pip install  --no-cache-dir --upgrade -r $HOME/app/requirements.txt

USER user

# Set up permissions
COPY --chown=user . $HOME/app
RUN ls
RUN dos2unix entrypoint.sh
RUN dos2unix run_daily.sh
RUN chmod +x entrypoint.sh
RUN chmod +x run_daily.sh

ENTRYPOINT ["/home/user/app/entrypoint.sh"]

# Run the application
CMD ["sh", "-c", "nohup gunicorn keep_service:app --bind 0.0.0.0:7860 & \
    if [ \"$RUN_ON_START\" = \"true\" ]; then bash run_daily.sh >/proc/1/fd/1 2>/proc/1/fd/2; fi"]