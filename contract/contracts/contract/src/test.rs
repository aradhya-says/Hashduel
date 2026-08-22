#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Events, testutils::Ledger, Address, Bytes, Env};

// ── Minimal mock token for wager testing ──
mod mock_token {
    use soroban_sdk::{contract, contractimpl, Address, Env, Map};

    #[contract]
    pub struct MockToken;

    #[contractimpl]
    impl MockToken {
        pub fn mint(env: Env, to: Address, amount: i128) {
            let mut b: Map<Address, i128> =
                env.storage().instance().get(&0_u32).unwrap_or_else(|| Map::new(&env));
            b.set(to.clone(), b.get(to.clone()).unwrap_or(0) + amount);
            env.storage().instance().set(&0_u32, &b);
        }
        pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
            from.require_auth();
            let mut b: Map<Address, i128> =
                env.storage().instance().get(&0_u32).unwrap_or_else(|| Map::new(&env));
            let fb = b.get(from.clone()).unwrap_or(0);
            assert!(fb >= amount, "insufficient balance");
            b.set(from, fb - amount);
            b.set(to.clone(), b.get(to).unwrap_or(0) + amount);
            env.storage().instance().set(&0_u32, &b);
        }
        pub fn balance(env: Env, account: Address) -> i128 {
            let b: Map<Address, i128> =
                env.storage().instance().get(&0_u32).unwrap_or_else(|| Map::new(&env));
            b.get(account).unwrap_or(0)
        }
    }
}

// ── Helpers ──
fn setup() -> (Env, Address, mock_token::MockTokenClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let token_addr = env.register(mock_token::MockToken, ());
    let token = mock_token::MockTokenClient::new(&env, &token_addr);
    let p1 = Address::generate(&env);
    let p2 = Address::generate(&env);
    token.mint(&p1, &10_000);
    token.mint(&p2, &10_000);
    (env, token_addr, token, p1, p2)
}

fn make_commit(env: &Env, mv: u32, salt: &[u8]) -> BytesN<32> {
    let mut preimage = Bytes::new(env);
    preimage.push_back(mv as u8);
    for &b in salt {
        preimage.push_back(b);
    }
    env.crypto().sha256(&preimage).into()
}

// ── Happy paths ──
#[test]
fn test_create_and_join() {
    let (env, token_addr, token, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1, 2, 3]);
    let game_id = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    assert_eq!(game_id, 0);
    assert_eq!(token.balance(&p1), 9_900);
    assert_eq!(token.balance(&cid), 100);

    let commit2 = make_commit(&env, 2, &[4, 5, 6]);
    client.join_game(&p2, &game_id, &commit2);
    assert_eq!(token.balance(&p2), 9_900);
    assert_eq!(token.balance(&cid), 200);

    let game = client.get_game(&game_id);
    assert_eq!(game.status, Status::Committed);
}

#[test]
fn test_p1_wins_rock_beats_scissors() {
    let (env, token_addr, token, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[10]); // Rock
    let commit2 = make_commit(&env, 2, &[20]); // Scissors
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    client.join_game(&p2, &gid, &commit2);

    client.reveal_move(&p1, &gid, &0, &Bytes::from_array(&env, &[10]));
    client.reveal_move(&p2, &gid, &2, &Bytes::from_array(&env, &[20]));

    let game = client.get_game(&gid);
    assert_eq!(game.status, Status::Resolved);
    assert_eq!(token.balance(&p1), 10_100); // 10000 - 100 + 200
    assert_eq!(token.balance(&p2), 9_900); // 10000 - 100
}

#[test]
fn test_p2_wins_paper_beats_rock() {
    let (env, token_addr, token, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]); // Rock
    let commit2 = make_commit(&env, 1, &[2]); // Paper
    let gid = client.create_game(&p1, &200, &token_addr, &commit1, &500);
    client.join_game(&p2, &gid, &commit2);

    client.reveal_move(&p1, &gid, &0, &Bytes::from_array(&env, &[1]));
    client.reveal_move(&p2, &gid, &1, &Bytes::from_array(&env, &[2]));

    assert_eq!(token.balance(&p1), 9_800); // 10000 - 200
    assert_eq!(token.balance(&p2), 10_200); // 10000 - 200 + 400
}

#[test]
fn test_draw_refund() {
    let (env, token_addr, token, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 1, &[7]); // Paper
    let commit2 = make_commit(&env, 1, &[8]); // Paper
    let gid = client.create_game(&p1, &500, &token_addr, &commit1, &500);
    client.join_game(&p2, &gid, &commit2);

    client.reveal_move(&p1, &gid, &1, &Bytes::from_array(&env, &[7]));
    client.reveal_move(&p2, &gid, &1, &Bytes::from_array(&env, &[8]));

    assert_eq!(token.balance(&p1), 10_000); // full refund
    assert_eq!(token.balance(&p2), 10_000); // full refund
}

#[test]
fn test_events_emitted() {
    let (env, token_addr, _token, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]);
    let commit2 = make_commit(&env, 2, &[2]);
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    // created
    assert_eq!(env.events().all().events().len(), 1);

    client.join_game(&p2, &gid, &commit2);
    // joined
    assert_eq!(env.events().all().events().len(), 1);

    client.reveal_move(&p1, &gid, &0, &Bytes::from_array(&env, &[1]));
    // revealed
    assert_eq!(env.events().all().events().len(), 1);

    client.reveal_move(&p2, &gid, &2, &Bytes::from_array(&env, &[2]));
    // revealed + resolved
    let events = env.events().all();
    assert_eq!(events.events().len(), 2);
}

#[test]
fn test_multiple_games_sequential_ids() {
    let (env, token_addr, _, p1, _p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let c1 = make_commit(&env, 0, &[1]);
    let c2 = make_commit(&env, 1, &[2]);
    let g1 = client.create_game(&p1, &100, &token_addr, &c1, &500);
    let g2 = client.create_game(&p1, &200, &token_addr, &c2, &500);
    assert_eq!(g1, 0);
    assert_eq!(g2, 1);
}

// ── Timeout forfeit ──
#[test]
fn test_claim_timeout_p1_reveals_p2_quits() {
    let (env, token_addr, token, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]);
    let commit2 = make_commit(&env, 2, &[2]);
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    client.join_game(&p2, &gid, &commit2);

    // p1 reveals, p2 doesn't
    client.reveal_move(&p1, &gid, &0, &Bytes::from_array(&env, &[1]));

    // Advance past reveal deadline (set at join = 0 + 500 = 500)
    env.ledger().set_timestamp(501);
    client.claim_timeout(&gid, &p1);

    assert_eq!(token.balance(&p1), 10_100); // 10000 - 100 + 200
    assert_eq!(token.balance(&p2), 9_900); // 10000 - 100
    assert_eq!(client.get_game(&gid).status, Status::Resolved);
}

#[test]
#[should_panic(expected = "deadline not passed")]
fn test_claim_timeout_before_deadline_panics() {
    let (env, token_addr, _, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]);
    let commit2 = make_commit(&env, 2, &[2]);
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    client.join_game(&p2, &gid, &commit2);
    client.reveal_move(&p1, &gid, &0, &Bytes::from_array(&env, &[1]));
    // No time advance — claim must fail
    client.claim_timeout(&gid, &p1);
}

#[test]
#[should_panic(expected = "you haven't revealed")]
fn test_claim_without_revealing_panics() {
    let (env, token_addr, _, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]);
    let commit2 = make_commit(&env, 2, &[2]);
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    client.join_game(&p2, &gid, &commit2);

    env.ledger().set_timestamp(501);
    // Neither player revealed — nobody can snipe the pot
    client.claim_timeout(&gid, &p1);
}

// ── Cancel ──
#[test]
fn test_cancel_game_before_join() {
    let (env, token_addr, token, p1, _p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]);
    let gid = client.create_game(&p1, &300, &token_addr, &commit1, &500);
    assert_eq!(token.balance(&cid), 300);

    // Advance past deadline
    env.ledger().set_timestamp(600);
    client.cancel_game(&gid, &p1);

    assert_eq!(token.balance(&p1), 10_000); // full refund
    assert_eq!(token.balance(&cid), 0);
}

#[test]
#[should_panic(expected = "deadline not passed")]
fn test_cancel_before_deadline_panics() {
    let (env, token_addr, _, p1, _) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]);
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    // No time advance — should fail
    client.cancel_game(&gid, &p1);
}

// ── Failure modes ──
#[test]
#[should_panic(expected = "invalid reveal")]
fn test_wrong_salt_panics() {
    let (env, token_addr, _, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1, 2, 3]);
    let commit2 = make_commit(&env, 2, &[4, 5, 6]);
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    client.join_game(&p2, &gid, &commit2);

    // Wrong salt!
    client.reveal_move(&p1, &gid, &0, &Bytes::from_array(&env, &[9, 9, 9]));
}

#[test]
#[should_panic(expected = "not in commit phase")]
fn test_double_reveal_panics() {
    let (env, token_addr, _, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]);
    let commit2 = make_commit(&env, 2, &[2]);
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    client.join_game(&p2, &gid, &commit2);

    client.reveal_move(&p1, &gid, &0, &Bytes::from_array(&env, &[1]));
    client.reveal_move(&p2, &gid, &2, &Bytes::from_array(&env, &[2]));
    // Game resolved, reveal_move again should panic
    client.reveal_move(&p1, &gid, &0, &Bytes::from_array(&env, &[1]));
}

#[test]
#[should_panic(expected = "wrong status")]
fn test_claim_timeout_both_revealed_panics() {
    let (env, token_addr, _, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]);
    let commit2 = make_commit(&env, 2, &[2]);
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    client.join_game(&p2, &gid, &commit2);

    client.reveal_move(&p1, &gid, &0, &Bytes::from_array(&env, &[1]));
    client.reveal_move(&p2, &gid, &2, &Bytes::from_array(&env, &[2]));

    env.ledger().set_timestamp(501);
    // Both revealed — game already auto-resolved
    client.claim_timeout(&gid, &p1);
}

#[test]
#[should_panic(expected = "not a player")]
fn test_random_account_cannot_reveal() {
    let (env, token_addr, _, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]);
    let commit2 = make_commit(&env, 2, &[2]);
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    client.join_game(&p2, &gid, &commit2);

    let rando = Address::generate(&env);
    client.reveal_move(&rando, &gid, &0, &Bytes::from_array(&env, &[1]));
}

#[test]
#[should_panic(expected = "cannot play yourself")]
fn test_self_join_panics() {
    let (env, token_addr, _, p1, _) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]);
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    let commit2 = make_commit(&env, 2, &[2]);
    client.join_game(&p1, &gid, &commit2);
}

#[test]
#[should_panic(expected = "invalid move")]
fn test_invalid_move_panics() {
    let (env, token_addr, _, p1, p2) = setup();
    let cid = env.register(Contract, ());
    let client = ContractClient::new(&env, &cid);

    let commit1 = make_commit(&env, 0, &[1]);
    let commit2 = make_commit(&env, 2, &[2]);
    let gid = client.create_game(&p1, &100, &token_addr, &commit1, &500);
    client.join_game(&p2, &gid, &commit2);

    client.reveal_move(&p1, &gid, &7, &Bytes::from_array(&env, &[1]));
}
