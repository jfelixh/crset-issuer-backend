# bfc-status-backend
A backend service that handles VC ids and their status for issuers. To be used in conjunction with the `issuer-demo` in [bfc-status-demo](https://github.com/jfelixh/bfc-status-demo).

## Prerequisites
Ensure you have the following installed on your local machine:
- [Node.js](https://nodejs.org/en/download/)
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Installation
### Clone the repository
```bash
git clone
cd bfc-status-issuer-backend
```

### Set up the environment variables
Create a `.env` file in the root directory and copy the contents of the `.env.example` file into it. You can find the `.env.example` file [here](./.env.example).

## Running the server
Build and start the project using the following command:

```bash
docker-compose up --build
```

The bfc-status-issuer-backend server should now be running on `http://localhost:5050`.