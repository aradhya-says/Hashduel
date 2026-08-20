#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Bytes, BytesN, Env};

#[contracttype]
pub enum DataKey {
    Game(u64),
    NextId,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Status {
    Open,
    Committed,
    Resolved,
}

#[contracttype]
#[derive(Clone)]
pub struct Game {
    pub player1: Address,
    pub player2: Option<Address>,
    pub wager: i128,
    pub token: Address,
    pub commit1: BytesN<32>,
    pub commit2: Option<BytesN<32>>,
    pub move1: Option<u32>,
    pub move2: Option<u32>,
    pub status: Status,
    pub deadline: u64,
    pub timeout: u64,
}

#[contract]
pub struct Contract;

fn resolve(env: &Env, game: &mut Game) {
    let m1 = game.move1.unwrap();
    let m2 = game.move2.unwrap();
    let tc = token::Client::new(env, &game.token);
    let addr = env.current_contract_address();
    if m1 == m2 {
        // Draw — refund both
        tc.transfer(&addr, &game.player1, &game.wager);
        tc.transfer(&addr, game.player2.as_ref().unwrap(), &game.wager);
    } else if (m1 + 1) % 3 == m2 {
        // Player2 wins
        tc.transfer(&addr, game.player2.as_ref().unwrap(), &(game.wager * 2));
    } else {
        // Player1 wins
        tc.transfer(&addr, &game.player1, &(game.wager * 2));
    }
    game.status = Status::Resolved;
}

#[contractimpl]
impl Contract {
    /// Create a new RPS game. Player1 locks their wager and submits a commit hash.
    /// Returns the game_id.
    pub fn create_game(
        env: Env,
        player: Address,
        wager: i128,
        token: Address,
        commit: BytesN<32>,
        timeout: u64,
    ) -> u64 {
        player.require_auth();
        assert!(wager > 0, "wager must be positive");
        token::Client::new(&env, &token).transfer(&player, &env.current_contract_address(), &wager);
        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        env.storage().persistent().set(
            &DataKey::Game(id),
            &Game {
                player1: player,
                player2: None,
                wager,
                token,
                commit1: commit,
                commit2: None,
                move1: None,
                move2: None,
                status: Status::Open,
                deadline: env.ledger().timestamp() + timeout,
                timeout,
            },
        );
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        id
    }

    /// Join an open game. Player2 locks a matching wager and submits their commit hash.
    pub fn join_game(env: Env, player: Address, game_id: u64, commit: BytesN<32>) {
        player.require_auth();
        let mut game: Game = env
            .storage()
            .persistent()
            .get(&DataKey::Game(game_id))
            .unwrap();
        assert!(game.status == Status::Open, "game not open");
        assert!(game.player1 != player, "cannot play yourself");
        assert!(
            env.ledger().timestamp() <= game.deadline,
            "game expired"
        );
        token::Client::new(&env, &game.token)
            .transfer(&player, &env.current_contract_address(), &game.wager);
        game.player2 = Some(player);
        game.commit2 = Some(commit);
        game.status = Status::Committed;
        game.deadline = env.ledger().timestamp() + game.timeout;
        env.storage().persistent().set(&DataKey::Game(game_id), &game);
    }

    /// Reveal your move+salt. Contract verifies SHA-256(move||salt) == commit.
    /// Auto-resolves when both players have revealed.
    pub fn reveal_move(env: Env, player: Address, game_id: u64, mv: u32, salt: Bytes) {
        player.require_auth();
        assert!(mv <= 2, "invalid move");
        let mut game: Game = env
            .storage()
            .persistent()
            .get(&DataKey::Game(game_id))
            .unwrap();
        assert!(game.status == Status::Committed, "not in commit phase");
        assert!(
            env.ledger().timestamp() <= game.deadline,
            "reveal deadline passed"
        );
        let is_p1 = game.player1 == player;
        let is_p2 = game.player2.as_ref() == Some(&player);
        assert!(is_p1 || is_p2, "not a player");

        // Verify commit hash
        let mut preimage = Bytes::from_array(&env, &[mv as u8]);
        preimage.append(&salt);
        let hash: BytesN<32> = env.crypto().sha256(&preimage).into();

        if is_p1 {
            assert!(game.move1.is_none(), "already revealed");
            assert!(hash == game.commit1, "invalid reveal");
            game.move1 = Some(mv);
        } else {
            assert!(game.move2.is_none(), "already revealed");
            assert!(hash == *game.commit2.as_ref().unwrap(), "invalid reveal");
            game.move2 = Some(mv);
        }

        if game.move1.is_some() && game.move2.is_some() {
            resolve(&env, &mut game);
        }
        env.storage().persistent().set(&DataKey::Game(game_id), &game);
    }

    /// If the opponent didn't reveal after the deadline, claim the full pot.
    pub fn claim_timeout(env: Env, game_id: u64, player: Address) {
        player.require_auth();
        let mut game: Game = env
            .storage()
            .persistent()
            .get(&DataKey::Game(game_id))
            .unwrap();
        assert!(game.status == Status::Committed, "wrong status");
        assert!(
            env.ledger().timestamp() > game.deadline,
            "deadline not passed"
        );
        let is_p1 = game.player1 == player;
        let is_p2 = game.player2.as_ref() == Some(&player);
        assert!(is_p1 || is_p2, "not a player");

        let my_revealed = if is_p1 {
            game.move1.is_some()
        } else {
            game.move2.is_some()
        };
        let their_revealed = if is_p1 {
            game.move2.is_some()
        } else {
            game.move1.is_some()
        };
        assert!(my_revealed, "you haven't revealed");
        assert!(!their_revealed, "opponent already revealed");

        let pot = game.wager * 2;
        token::Client::new(&env, &game.token)
            .transfer(&env.current_contract_address(), &player, &pot);
        game.status = Status::Resolved;
        env.storage().persistent().set(&DataKey::Game(game_id), &game);
    }

    /// Cancel an open game before anyone joins. Only the creator can cancel after the deadline.
    pub fn cancel_game(env: Env, game_id: u64, player: Address) {
        player.require_auth();
        let mut game: Game = env
            .storage()
            .persistent()
            .get(&DataKey::Game(game_id))
            .unwrap();
        assert!(game.status == Status::Open, "game not open");
        assert!(game.player1 == player, "not the creator");
        assert!(
            env.ledger().timestamp() > game.deadline,
            "deadline not passed"
        );
        token::Client::new(&env, &game.token)
            .transfer(&env.current_contract_address(), &player, &game.wager);
        game.status = Status::Resolved;
        env.storage().persistent().set(&DataKey::Game(game_id), &game);
    }

    /// Read-only: get full game state.
    pub fn get_game(env: Env, game_id: u64) -> Game {
        env.storage()
            .persistent()
            .get(&DataKey::Game(game_id))
            .unwrap()
    }
}

mod test;
