FROM node:22

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive \
    apt-get install -y tzdata poppler-utils graphicsmagick imagemagick libreoffice unoconv libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev build-essential && \
    ln -fs /usr/share/zoneinfo/Asia/Kolkata /etc/localtime && \
    dpkg-reconfigure --frontend noninteractive tzdata && \
    echo "Asia/Kolkata" > /etc/timezone && \
    rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Kolkata

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

CMD ["npm", "start"]