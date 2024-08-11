FROM alpine:latest


RUN apk update && \
    apk upgrade && \
    apk add --no-cache nodejs npm ffmpeg


RUN addgroup -S appgroup && adduser -S appuser -G appgroup


WORKDIR /app
COPY package.json /app/
COPY index.js /app/


RUN npm install


RUN chown -R appuser:appgroup /app


USER appuser


ARG TOKEN
ENV TOKEN=$TOKEN


CMD ["npm", "start"]
