# CRSet Issuer Backend

A backend service that handles W3C Verifiable Credentials and their revocation status for credential issuers. This service is meant to be used in conjunction with the `issuer-demo` in [bfc-status-demo](https://github.com/jfelixh/bfc-status-demo) and is part of the demo for the paper **[CRSet: Non-Interactive Verifiable Credential Revocation with Metadata Privacy for Issuers and Everyone Else](https://arxiv.org/abs/2501.17089)**, which introduces a novel approach for handling the revocation of Verifiable Credentials.

Note that this server enforces no access control. It is meant to be used in a protected network environment.

## Project Structure

The project is organized into the following (main) directories and files:

```bash
crset-issuer-backend
├── src                     # Source code
│   ├── controllers/        # Request handlers
│   ├── db/                 # Database related files
│   ├── models/             # Data models and schemas
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic
│   ├── utils/              # Helper functions
│   ├── index.ts            # Application entry point
├── Dockerfile              # Container configuration
├── compose.yaml            # Docker Compose configuration
├── package.json            # Project dependencies
├── package-lock.json       # Dependency lock file
```

## Prerequisites

Ensure you have the following installed on your local machine:

- [Node.js](https://nodejs.org/en/download/)
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Installation

### Set up the environment variables

Create a `.env` file in the root directory and copy the contents of the `.env.example` file into it. You can find the `.env.example` file [here](./.env.example).

## Running the server

Build and start the project using the following command:

```bash
docker-compose up --build
```

Alternatively, you can run the server locally without Docker using the following commands:

```bash
npm install
npm run db:init
npm run build
npm run start
```

The server should now be running on `http://localhost:5050`.

### EventEmitter

The server uses an `EventEmitter` to send live progress updates to clients when publishing. The client can subscribe to these events by connecting to the WebSocket server running on `ws://localhost:8091`.

### API Documentation

Interactive API documentation is available via Swagger UI at `http://localhost:5050/api-docs` when running the service.

## Links and References

- ![arXiv](https://img.shields.io/badge/arXiv-2501.17089-b31b1b.svg) **[CRSet: Non-Interactive Verifiable Credential Revocation with Metadata Privacy for Issuers and Everyone Else](https://arxiv.org/abs/2501.17089)**  
  _Hoops et al., 2025._
- ![GitHub](https://img.shields.io/badge/GitHub-bfc--status--demo-blue?logo=github) **[bfc-status-demo](https://github.com/jfelixh/bfc-status-demo)**
- **[W3C Verifiable Credentials Data Model 1.1](https://www.w3.org/TR/vc-data-model/)**
- ![GitHub](https://img.shields.io/badge/GitHub-padded--bloom--filter--cascade-blue?logo=github) **[padded-bloom-filter-cascade](https://github.com/jfelixh/padded-bloom-filter-cascade/blob/main/README.md)**
