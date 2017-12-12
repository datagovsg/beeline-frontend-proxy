FROM node:8.9.1-alpine

WORKDIR /app

# Copy in package.json into the image and install node modules
# These layers are only rebuilt if package.json changes
COPY package.json  .
RUN npm install && npm cache clean --force

# Copy rest of source code into image
COPY . .

RUN mkdir logs

EXPOSE 10000
ENV PORT 10000

CMD node src/index.js
