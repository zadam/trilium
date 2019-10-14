FROM gitpod/workspace-full

RUN sudo apt-get update \
    && sudo apt-get install -yq --no-install-recommends \
        libpng16-16 \
        libpng-dev \
        pkg-config \
        autoconf \
        libtool \
        build-essential \
        nasm \
        libx11-dev \
        libxkbfile-dev \
    && sudo rm -rf /var/lib/apt/lists/*

