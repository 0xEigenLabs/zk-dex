# ZKDEX

A fully decentralized privacy-preserving exchange marketplace with support for matching trade orders, on-chain settlement. ZKDEX provides confidentiality of order rates and account balances based on pedersen commitment and unlinkability between traders and their trade orders.

## Components

- Circuits
  - Range proof
  - Pedersen commitment based on [Baby Jubjub Elliptic Curve](https://eips.ethereum.org/EIPS/eip-2494)
- Contracts
  - Bucketization
  - Marketplace

## Test

Run `npm install` to install all dependencies, and then run `yarn test` to trigger test.

## Reference

1. [ https://doi.org/10.48550/arXiv.2111.15259](https://doi.org/10.48550/arXiv.2111.15259)
2. https://eips.ethereum.org/EIPS/eip-2494