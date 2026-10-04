FROM node:24-alpine AS build
RUN apk add --no-cache git
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The `git` context is the repository's .git (docker-compose.yml): stamp the build with its commit.
RUN --mount=type=bind,from=git,target=/repo.git \
    commit=$(git -c safe.directory='*' --git-dir=/repo.git rev-parse --short HEAD) \
    && npm run build -- --define NALA_COMMIT="'$commit'"

FROM nginxinc/nginx-unprivileged:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist/nala/browser /usr/share/nginx/html
EXPOSE 8080
