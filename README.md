# CRSet Issuer Backend

This backend service handles the revocation status of W3C Verifiable Credentials according to the CRSet mechanism proposed in **[CRSet: Non-Interactive Verifiable Credential Revocation with Metadata Privacy for Issuers and Everyone Else](https://arxiv.org/abs/2501.17089)**. It handles creating new credential status entries, revoking them, building the status info as a Bloom filter cascade, and publishing it via blob-carrying Ethereum transaction. Thus, it covers all functionality an issuer needs to adopt CRSet.

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

## Acknowledgments

We thank the Ethereum Foundation for funding this work with an Ethereum Academic Grant under reference number FY24-1545.

## Links and References

- ![arXiv](https://img.shields.io/badge/arXiv-2501.17089-b31b1b.svg) **[CRSet: Non-Interactive Verifiable Credential Revocation with Metadata Privacy for Issuers and Everyone Else](https://arxiv.org/abs/2501.17089)**  
  _Hoops et al., 2025._
- ![GitHub](https://img.shields.io/badge/GitHub-crset--demo-blue?logo=github) **[crset-demo](https://github.com/jfelixh/crset-demo)**
- **[W3C Verifiable Credentials Data Model 1.1](https://www.w3.org/TR/vc-data-model/)**
- **[EIP-4844: Shard Blob Transactions](https://eips.ethereum.org/EIPS/eip-4844)**
- ![GitHub](https://img.shields.io/badge/GitHub-crset--cascade-blue?logo=github) **[crset-cascade](https://github.com/jfelixh/crset-cascade/blob/main/README.md)**
