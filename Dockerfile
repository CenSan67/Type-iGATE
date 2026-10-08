# Runs the Vite dev server inside the container, the same way `npm run dev` does locally -
# this matches how the app has been run and tested throughout development, so nothing about
# its behavior changes just because it's in Docker. node:20-alpine satisfies Vite 5's
# requirement (Node ^18 || >=20) and keeps the image small.
FROM node:20-alpine

WORKDIR /app

# Install dependencies first, separately from the app source, so Docker's layer cache skips
# the (slow) npm install step on every rebuild unless package.json/package-lock.json actually
# changed.
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# --host 0.0.0.0 is required: Vite's dev server only binds to localhost by default, which
# would be unreachable from outside the container (and so from another PC) even with the
# port published below.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
