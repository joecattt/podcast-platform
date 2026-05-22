# Cloud Run pipeline image — stitches WebM chunks, runs Whisper transcription,
# applies cuts + multicam plan, renders final via Remotion, generates Shorts,
# writes SEO metadata, uploads outputs to Firebase Storage.
FROM node:20-bookworm-slim

# System deps: ffmpeg (stitching/audio cleanup), python3 + git (whisper.cpp build),
# chromium (Remotion headless render).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    build-essential \
    cmake \
    python3 \
    ca-certificates \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Build whisper.cpp — the small.en model is a good balance of speed/accuracy
# on Cloud Run CPU. ggml-small.en-q5_1 is quantized and ~180MB.
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git /opt/whisper.cpp && \
    cd /opt/whisper.cpp && \
    cmake -B build && cmake --build build --config Release -j && \
    bash ./models/download-ggml-model.sh small.en-q5_1

ENV WHISPER_BIN=/opt/whisper.cpp/build/bin/whisper-cli
ENV WHISPER_MODEL=/opt/whisper.cpp/models/ggml-small.en-q5_1.bin
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV REMOTION_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev=false

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

EXPOSE 8080
CMD ["node", "dist/server.js"]
