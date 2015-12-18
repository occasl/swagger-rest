FROM nodesource/trusty:4.2.3

MAINTAINER Lou Sacco (lsacco@qualcomm.com)

# cache package.json and node_modules to speed up builds
COPY package.json /src/package.json
RUN cd /src; npm install --save

# Add your source files
COPY . /src

ENV DOCKER_PORT="8080"
ENV DOCKER_HOST="::"
ENV VERSION="$VERSION"

EXPOSE  8080
CMD ["node","/src/server.js"]