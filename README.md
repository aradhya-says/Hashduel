# HashDuel

A trustless Rock-Paper-Scissors game using commit-reveal hashing, wagering pools, and timeout forfeits.

## Project Description

HashDuel is a decentralized Rock-Paper-Scissors game designed to allow two players to compete without requiring either player to trust the other.

The game uses a **commit-reveal mechanism** to prevent players from changing their move after seeing their opponent's choice.

### How it works

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
- Commit reveal hashing
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
├── README.md
└── ...
