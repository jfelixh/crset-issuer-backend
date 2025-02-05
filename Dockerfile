# Use an official Node.js image as the base image
FROM node:20.13.1

# Set the working directory inside the container
WORKDIR /app

# Install SQLite3 (dependencies for your app)
RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

# Copy only the package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies using npm ci
RUN npm ci

RUN npm install 
# Copy the rest of the application code to the container
COPY . .

# Expose the port that the server will listen on
EXPOSE 5050 8091

# Initialize SQLite DB and start the Express server
CMD ["sh", "-c", "npm run dev"]
