# HashDuel

A trustless Rock-Paper-Scissors game using commit-reveal hashing, wagering pools, and timeout forfeits.

## Project Description

HashDuel is a decentralized Rock-Paper-Scissors game designed to allow two players to compete without requiring either player to trust the other.

The game uses a **commit-reveal mechanism** to prevent players from changing their move after seeing their opponent's choice.

### How It Works

1. Player 1 chooses Rock, Paper, or Scissors.
2. Player 1 creates a cryptographic commitment of their move using a secret value.
3. The commitment is submitted to the smart contract.
4. Player 2 submits their commitment.
5. Both players reveal their original moves and secrets.
6. The smart contract verifies that the revealed moves match the original commitments.
7. The winner is determined automatically.
8. The wagering pool is released according to the game result.
9. If a player fails to reveal their move within the allowed time, they can forfeit the game.

Because the result and fund distribution are handled by the smart contract, the game does not require a centralized authority to determine the winner.

## Main Features

- Rock-Paper-Scissors gameplay
- Commit-reveal hashing
- Trustless winner determination
- Player wagering
- Wagering pools
- Automatic payout through smart contracts
- Timeout-based forfeits
- Blockchain transaction verification
- Web3 wallet integration
- Testnet support

## Project Structure

```text
hashduel/
├── contracts/                 # Smart contracts
├── test/                      # Smart contract tests
├── scripts/                   # Deployment and utility scripts
├── frontend/
│   └── src/
│       └── components/        # Frontend components
└── README.md
```

## Live Demo

The deployed HashDuel application is available here:

**https://hashduel.vercel.app/**

You can access the application, connect a Web3 wallet, and interact with the deployed interface.

## Contract Information

| Property | Value |
|---|---|
| Contract Name | hashduel |
| Standard | SEP-41 (Soroban Token Interface) |
| Language | Rust (`#![no_std]`, compiled to WASM) |
| SDK | soroban-sdk v23 |
| Testnet WASM Hash | `f458e8040e8f3417fa6e59d640175ef63a5f386dcec64afeeaefe2e992b143a8` |
| Network | Stellar Testnet (Soroban RPC) |

## Screenshots

### 1. Wallet Connected State

Screenshot showing the HashDuel application after successfully connecting a Web3 wallet.

_Add screenshot here._

### 2. Balance Displayed

Screenshot showing the connected wallet balance inside the application.

_Add screenshot here._

### 3. Successful Testnet Transaction

Screenshot showing a successful testnet transaction and the transaction result displayed to the user.

_Add screenshot here._

## Security Model

HashDuel uses a **commit-reveal mechanism** to prevent a player from changing their move after seeing their opponent's choice.

Conceptually, the commitment is generated as:

```text
commitment = hash(move + secret)
```

During the reveal phase, the player submits the original move and secret. The smart contract generates the commitment again and compares it with the commitment submitted earlier.

If both values match, the revealed move is considered valid.

## Timeout Forfeits

If a player commits to a game but fails to reveal their move within the allowed time, the timeout mechanism can be used to forfeit the game according to the smart contract rules.

This prevents a player from intentionally avoiding the reveal phase after committing to a match.

## Technology

- Solidity
- Smart Contracts
- Web3
- Cryptographic Hashing
- JavaScript / TypeScript
- Git
- Vercel
- Ethereum-compatible Testnet

## Future Improvements

- Improved game matchmaking
- Better game history
- Enhanced transaction status feedback
- Additional game statistics
- Improved UI/UX
- Support for additional blockchain networks

## License

This project is developed as a blockchain/Web3 project for educational and development purposes.
