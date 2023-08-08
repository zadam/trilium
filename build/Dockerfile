FROM ubuntu

ARG DB_PATH=/trilium/code/db-data
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update

RUN apt-get install -y apt-utils libpng16-16 libpng-dev pkg-config autoconf libtool build-essential nasm libx11-dev libxkbfile-dev git curl iptables-persistent
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

RUN git clone https://github.com/VahidKay/trilium_customized.git /trilium

WORKDIR /trilium/code

RUN npm install --force
RUN npm rebuild

VOLUME $DB_PATH

ENV TRILIUM_DATA_DIR=$DB_PATH

EXPOSE 8080

ENTRYPOINT [ "tail", "-f", "/dev/null" ]

#ENTRYPOINT [ "npm", "run", "start-server-no-dir" ]