FROM encoredotdev/encore:1.48.9

# Install Node.js + npm
RUN apt-get update && apt-get install -y nodejs npm

# Create app directory
WORKDIR /app

# Copy necessary files
COPY . .

# Run encore run directly
CMD ["run"]
