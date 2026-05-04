use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::invoke_signed,
    system_instruction,
    sysvar::instructions::{load_current_index_checked, load_instruction_at_checked},
    ed25519_program,
};

declare_id!("G8LyjnQ6xYW2txzk2nbiUpcdGC82AvmcXuMSEhSjutXU");

// ─── Constants ───────────────────────────────────────────────────────────────

const RISK_REJECT_THRESHOLD: u8 = 70;
const MAX_ORACLE_DRIFT_SECS: i64 = 300; // 5 minutes

// ─── Program ─────────────────────────────────────────────────────────────────

#[program]
pub mod uwu_escrow {
    use super::*;

    /// Initialize the global oracle config (one-time, admin-only).
    pub fn initialize(
        ctx: Context<Initialize>,
        oracle_pubkey: Pubkey,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.oracle_config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.oracle_pubkey = oracle_pubkey;
        cfg.bump = ctx.bumps.oracle_config;
        cfg.total_trades = 0;
        cfg.total_vol_lamports = 0;
        emit!(OracleInitialized {
            admin: cfg.admin,
            oracle_pubkey,
        });
        Ok(())
    }

    /// Seller creates a new open-order trade and locks SOL in the vault PDA.
    ///
    /// `is_open_order = true`  → buyer is not specified yet; anyone can match.
    /// `is_open_order = false` → buyer is specified upfront (direct trade).
    pub fn create_trade(
        ctx: Context<CreateTrade>,
        trade_id: [u8; 32],
        lamports: u64,
        inr_amount: u64,
        payee_vpa_hash: [u8; 32],
        deadline_delta: i64,
        is_open_order: bool,
    ) -> Result<()> {
        let clock = Clock::get()?;

        require!(deadline_delta > 0 && deadline_delta <= 30 * 86_400, UwuError::InvalidDeadline);
        require!(inr_amount > 0, UwuError::InvalidAmount);
        require!(lamports > 0, UwuError::InvalidAmount);
        require!(
            ctx.accounts.seller.lamports() >= lamports,
            UwuError::InsufficientFunds
        );

        let trade = &mut ctx.accounts.trade;
        trade.trade_id = trade_id;
        trade.seller = ctx.accounts.seller.key();
        trade.buyer = if is_open_order {
            Pubkey::default()
        } else {
            ctx.accounts.buyer.key()
        };
        trade.lamports = lamports;
        trade.inr_amount = inr_amount;
        trade.payee_vpa_hash = payee_vpa_hash;
        trade.deadline = clock.unix_timestamp + deadline_delta;
        trade.status = TradeStatus::Active as u8;
        trade.bump = ctx.bumps.trade;
        trade.vault_bump = ctx.bumps.vault;
        trade.created_at = clock.unix_timestamp;
        trade.released_at = 0;

        // Transfer SOL from seller → vault PDA
        invoke_signed(
            &system_instruction::transfer(
                ctx.accounts.seller.key,
                ctx.accounts.vault.key,
                lamports,
            ),
            &[
                ctx.accounts.seller.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[],
        )?;

        let trade_lamports = trade.lamports;
        let cfg = &mut ctx.accounts.oracle_config;
        cfg.total_trades = cfg.total_trades.saturating_add(1);
        cfg.total_vol_lamports = cfg.total_vol_lamports.saturating_add(trade_lamports);

        emit!(TradeCreated {
            trade_id,
            seller: trade.seller,
            buyer: trade.buyer,
            lamports: trade_lamports,
            inr_amount,
            deadline: trade.deadline,
        });
        Ok(())
    }

    /// Buyer matches an open order (buyer = Pubkey::default()).
    pub fn match_order(
        ctx: Context<MatchOrder>,
        trade_id: [u8; 32],
    ) -> Result<()> {
        let trade = &mut ctx.accounts.trade;
        require!(trade.trade_id == trade_id, UwuError::TradeMismatch);
        require!(trade.status == TradeStatus::Active as u8, UwuError::InvalidTradeStatus);
        require!(trade.buyer == Pubkey::default(), UwuError::NotOpenOrder);
        require!(
            ctx.accounts.buyer.key() != trade.seller,
            UwuError::SellerCannotBeBuyer
        );

        trade.buyer = ctx.accounts.buyer.key();
        emit!(OrderMatched {
            trade_id,
            buyer: trade.buyer,
        });
        Ok(())
    }

    /// Oracle-attested fund release. Requires an Ed25519 verify instruction at
    /// `ed25519_ix_index` in the same transaction that verified the oracle's
    /// signature on the packed attestation message.
    pub fn release_with_attestation(
        ctx: Context<ReleaseWithAttestation>,
        ed25519_ix_index: u8,
        attestation: AttestationPayload,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let trade = &ctx.accounts.trade;

        require!(trade.status == TradeStatus::Active as u8, UwuError::InvalidTradeStatus);
        require!(trade.buyer != Pubkey::default(), UwuError::BuyerNotSet);

        // Validate attestation freshness
        require!(attestation.expires_at > clock.unix_timestamp, UwuError::AttestationExpired);
        require!(
            (clock.unix_timestamp - attestation.timestamp).abs() <= MAX_ORACLE_DRIFT_SECS,
            UwuError::AttestationTooOld
        );
        require!(attestation.risk_score < RISK_REJECT_THRESHOLD, UwuError::RiskThresholdExceeded);

        // Verify the inr_amount matches
        require!(attestation.inr_amount == trade.inr_amount, UwuError::InrAmountMismatch);

        // Verify payee hash matches trade
        require!(
            attestation.payee_hash == trade.payee_vpa_hash,
            UwuError::PayeeHashMismatch
        );

        // Verify the ed25519 instruction verified our oracle's signature
        let ix_sysvar = &ctx.accounts.instruction_sysvar;
        let ed25519_ix = load_instruction_at_checked(ed25519_ix_index as usize, ix_sysvar)?;
        require_keys_eq!(
            ed25519_ix.program_id,
            ed25519_program::ID,
            UwuError::MissingEd25519Instruction
        );

        // Build the expected attestation message and verify it was what was signed
        let expected_message = build_attestation_message(&trade.trade_id, &attestation);
        verify_ed25519_ix_data(
            &ed25519_ix.data,
            &ctx.accounts.oracle_config.oracle_pubkey.to_bytes(),
            &expected_message,
        )?;

        // Replay protection: mark attestation hash as used
        let att_hash = anchor_lang::solana_program::hash::hash(&expected_message);
        require!(
            !ctx.accounts.attestation_record.is_used,
            UwuError::AttestationAlreadyUsed
        );
        ctx.accounts.attestation_record.is_used = true;
        ctx.accounts.attestation_record.hash = att_hash.to_bytes();
        ctx.accounts.attestation_record.bump = ctx.bumps.attestation_record;

        // Transfer SOL from vault → buyer
        let trade_id_seed = trade.trade_id;
        let vault_seeds: &[&[u8]] = &[b"vault", &trade_id_seed, &[trade.vault_bump]];
        invoke_signed(
            &system_instruction::transfer(
                ctx.accounts.vault.key,
                ctx.accounts.buyer.key,
                trade.lamports,
            ),
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[vault_seeds],
        )?;

        // Update trade state
        let trade = &mut ctx.accounts.trade;
        trade.status = TradeStatus::Released as u8;
        trade.released_at = clock.unix_timestamp;

        emit!(FundsReleased {
            trade_id: trade.trade_id,
            buyer: trade.buyer,
            lamports: trade.lamports,
            inr_amount: attestation.inr_amount,
        });
        Ok(())
    }

    /// Cancel an expired trade and refund SOL to the seller.
    pub fn cancel_expired(
        ctx: Context<CancelExpired>,
        trade_id: [u8; 32],
    ) -> Result<()> {
        let clock = Clock::get()?;
        let trade = &ctx.accounts.trade;

        require!(trade.trade_id == trade_id, UwuError::TradeMismatch);
        require!(trade.status == TradeStatus::Active as u8, UwuError::InvalidTradeStatus);
        require!(clock.unix_timestamp > trade.deadline, UwuError::TradeNotExpired);

        let lamports = trade.lamports;
        let vault_bump = trade.vault_bump;
        let vault_seeds: &[&[u8]] = &[b"vault", &trade_id, &[vault_bump]];

        invoke_signed(
            &system_instruction::transfer(
                ctx.accounts.vault.key,
                ctx.accounts.seller.key,
                lamports,
            ),
            &[
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.seller.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[vault_seeds],
        )?;

        let trade = &mut ctx.accounts.trade;
        trade.status = TradeStatus::Cancelled as u8;

        emit!(TradeCancelled { trade_id, seller: trade.seller, lamports });
        Ok(())
    }

    /// Buyer raises a dispute before the deadline.
    pub fn dispute(
        ctx: Context<DisputeTrade>,
        trade_id: [u8; 32],
    ) -> Result<()> {
        let clock = Clock::get()?;
        let trade = &mut ctx.accounts.trade;

        require!(trade.trade_id == trade_id, UwuError::TradeMismatch);
        require!(trade.status == TradeStatus::Active as u8, UwuError::InvalidTradeStatus);
        require!(clock.unix_timestamp <= trade.deadline, UwuError::TradeAlreadyExpired);
        require!(
            ctx.accounts.initiator.key() == trade.buyer
                || ctx.accounts.initiator.key() == trade.seller,
            UwuError::Unauthorized
        );

        trade.status = TradeStatus::Disputed as u8;
        emit!(TradeDisputed { trade_id, initiator: ctx.accounts.initiator.key() });
        Ok(())
    }

    /// Admin resolves a disputed trade.
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        trade_id: [u8; 32],
        release_to_buyer: bool,
    ) -> Result<()> {
        let trade = &ctx.accounts.trade;

        require!(trade.trade_id == trade_id, UwuError::TradeMismatch);
        require!(trade.status == TradeStatus::Disputed as u8, UwuError::InvalidTradeStatus);
        require!(
            ctx.accounts.admin.key() == ctx.accounts.oracle_config.admin,
            UwuError::Unauthorized
        );

        let lamports = trade.lamports;
        let vault_bump = trade.vault_bump;
        let vault_seeds: &[&[u8]] = &[b"vault", &trade_id, &[vault_bump]];

        let recipient = if release_to_buyer {
            ctx.accounts.buyer.to_account_info()
        } else {
            ctx.accounts.seller.to_account_info()
        };

        invoke_signed(
            &system_instruction::transfer(ctx.accounts.vault.key, recipient.key, lamports),
            &[
                ctx.accounts.vault.to_account_info(),
                recipient.clone(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[vault_seeds],
        )?;

        let trade = &mut ctx.accounts.trade;
        trade.status = TradeStatus::Resolved as u8;

        emit!(DisputeResolved { trade_id, release_to_buyer });
        Ok(())
    }
}

// ─── State Accounts ───────────────────────────────────────────────────────────

#[account]
#[derive(Default)]
pub struct OracleConfig {
    pub admin: Pubkey,         // 32
    pub oracle_pubkey: Pubkey, // 32
    pub total_trades: u64,     // 8
    pub total_vol_lamports: u64, // 8
    pub bump: u8,              // 1
}

impl OracleConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct Trade {
    pub trade_id: [u8; 32],       // 32
    pub seller: Pubkey,           // 32
    pub buyer: Pubkey,            // 32
    pub lamports: u64,            // 8
    pub inr_amount: u64,          // 8  (paisa)
    pub payee_vpa_hash: [u8; 32], // 32
    pub deadline: i64,            // 8
    pub status: u8,               // 1
    pub bump: u8,                 // 1
    pub vault_bump: u8,           // 1
    pub created_at: i64,          // 8
    pub released_at: i64,         // 8
}

impl Trade {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 32 + 8 + 1 + 1 + 1 + 8 + 8;
}

#[account]
pub struct AttestationRecord {
    pub hash: [u8; 32], // 32
    pub is_used: bool,  // 1
    pub bump: u8,       // 1
}

impl AttestationRecord {
    pub const LEN: usize = 8 + 32 + 1 + 1;
}

// ─── Enums ────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum TradeStatus {
    None     = 0,
    Active   = 1,
    Released = 2,
    Disputed = 3,
    Cancelled = 4,
    Resolved = 5,
}

// ─── Instruction Payloads ─────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AttestationPayload {
    pub inr_amount: u64,          // paisa
    pub payer_hash: [u8; 32],
    pub payee_hash: [u8; 32],
    pub timestamp: i64,
    pub expires_at: i64,
    pub evidence_hash: [u8; 32],
    pub risk_score: u8,
}

// ─── Instruction Contexts ─────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = OracleConfig::LEN,
        seeds = [b"oracle-config"],
        bump,
    )]
    pub oracle_config: Account<'info, OracleConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(trade_id: [u8; 32])]
pub struct CreateTrade<'info> {
    #[account(
        init,
        payer = seller,
        space = Trade::LEN,
        seeds = [b"trade", trade_id.as_ref()],
        bump,
    )]
    pub trade: Account<'info, Trade>,
    /// CHECK: vault is a system-owned PDA that holds SOL
    #[account(
        mut,
        seeds = [b"vault", trade_id.as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: optional buyer; use Pubkey::default() for open orders
    pub buyer: UncheckedAccount<'info>,
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(mut, seeds = [b"oracle-config"], bump = oracle_config.bump)]
    pub oracle_config: Account<'info, OracleConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(trade_id: [u8; 32])]
pub struct MatchOrder<'info> {
    #[account(mut, seeds = [b"trade", &trade_id], bump = trade.bump)]
    pub trade: Account<'info, Trade>,
    pub buyer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(ed25519_ix_index: u8, attestation: AttestationPayload)]
pub struct ReleaseWithAttestation<'info> {
    #[account(mut, seeds = [b"trade", &trade.trade_id], bump = trade.bump)]
    pub trade: Account<'info, Trade>,
    /// CHECK: vault PDA — holds escrow SOL
    #[account(mut, seeds = [b"vault", &trade.trade_id], bump = trade.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: buyer receives the SOL
    #[account(mut, address = trade.buyer)]
    pub buyer: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        space = AttestationRecord::LEN,
        seeds = [b"att", trade.trade_id.as_ref()],
        bump,
    )]
    pub attestation_record: Account<'info, AttestationRecord>,
    #[account(seeds = [b"oracle-config"], bump = oracle_config.bump)]
    pub oracle_config: Account<'info, OracleConfig>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Solana instructions sysvar
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instruction_sysvar: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(trade_id: [u8; 32])]
pub struct CancelExpired<'info> {
    #[account(mut, seeds = [b"trade", &trade_id], bump = trade.bump)]
    pub trade: Account<'info, Trade>,
    /// CHECK: vault holds the SOL to be refunded
    #[account(mut, seeds = [b"vault", &trade_id], bump = trade.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: refund target (must be seller)
    #[account(mut, address = trade.seller)]
    pub seller: UncheckedAccount<'info>,
    pub caller: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(trade_id: [u8; 32])]
pub struct DisputeTrade<'info> {
    #[account(mut, seeds = [b"trade", &trade_id], bump = trade.bump)]
    pub trade: Account<'info, Trade>,
    pub initiator: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(trade_id: [u8; 32])]
pub struct ResolveDispute<'info> {
    #[account(mut, seeds = [b"trade", &trade_id], bump = trade.bump)]
    pub trade: Account<'info, Trade>,
    /// CHECK: vault holds the SOL
    #[account(mut, seeds = [b"vault", &trade_id], bump = trade.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: seller for refund path
    #[account(mut, address = trade.seller)]
    pub seller: UncheckedAccount<'info>,
    /// CHECK: buyer for release path
    #[account(mut, address = trade.buyer)]
    pub buyer: UncheckedAccount<'info>,
    #[account(seeds = [b"oracle-config"], bump = oracle_config.bump)]
    pub oracle_config: Account<'info, OracleConfig>,
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ─── Events ───────────────────────────────────────────────────────────────────

#[event]
pub struct OracleInitialized { pub admin: Pubkey, pub oracle_pubkey: Pubkey }

#[event]
pub struct TradeCreated {
    pub trade_id: [u8; 32],
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub lamports: u64,
    pub inr_amount: u64,
    pub deadline: i64,
}

#[event]
pub struct OrderMatched { pub trade_id: [u8; 32], pub buyer: Pubkey }

#[event]
pub struct FundsReleased {
    pub trade_id: [u8; 32],
    pub buyer: Pubkey,
    pub lamports: u64,
    pub inr_amount: u64,
}

#[event]
pub struct TradeCancelled { pub trade_id: [u8; 32], pub seller: Pubkey, pub lamports: u64 }

#[event]
pub struct TradeDisputed { pub trade_id: [u8; 32], pub initiator: Pubkey }

#[event]
pub struct DisputeResolved { pub trade_id: [u8; 32], pub release_to_buyer: bool }

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum UwuError {
    #[msg("Invalid trade deadline")]
    InvalidDeadline,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Trade ID mismatch")]
    TradeMismatch,
    #[msg("Invalid trade status for this action")]
    InvalidTradeStatus,
    #[msg("Not an open order")]
    NotOpenOrder,
    #[msg("Seller cannot be the buyer")]
    SellerCannotBeBuyer,
    #[msg("Buyer not set on this trade")]
    BuyerNotSet,
    #[msg("Attestation has expired")]
    AttestationExpired,
    #[msg("Attestation timestamp too old")]
    AttestationTooOld,
    #[msg("Risk score exceeds threshold")]
    RiskThresholdExceeded,
    #[msg("INR amount mismatch")]
    InrAmountMismatch,
    #[msg("Payee hash mismatch")]
    PayeeHashMismatch,
    #[msg("Missing or invalid Ed25519 instruction")]
    MissingEd25519Instruction,
    #[msg("Invalid oracle signature")]
    InvalidOracleSignature,
    #[msg("Attestation already used (replay)")]
    AttestationAlreadyUsed,
    #[msg("Trade has not expired yet")]
    TradeNotExpired,
    #[msg("Trade has already expired")]
    TradeAlreadyExpired,
    #[msg("Unauthorized")]
    Unauthorized,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Builds the 160-byte attestation message that the oracle signs.
/// Layout: trade_id(32) + inr_amount(8) + payer_hash(32) + payee_hash(32)
///         + timestamp(8) + expires_at(8) + evidence_hash(32) + risk_score(8)
/// All integers big-endian.
pub fn build_attestation_message(trade_id: &[u8; 32], att: &AttestationPayload) -> Vec<u8> {
    let mut buf = Vec::with_capacity(160);
    buf.extend_from_slice(trade_id);
    buf.extend_from_slice(&att.inr_amount.to_be_bytes());
    buf.extend_from_slice(&att.payer_hash);
    buf.extend_from_slice(&att.payee_hash);
    buf.extend_from_slice(&att.timestamp.to_be_bytes());
    buf.extend_from_slice(&att.expires_at.to_be_bytes());
    buf.extend_from_slice(&att.evidence_hash);
    buf.extend_from_slice(&(att.risk_score as u64).to_be_bytes());
    buf
}

/// Verifies that the Ed25519Program instruction `data` attests to
/// `expected_message` signed by `expected_pubkey`.
///
/// Ed25519 instruction data layout:
///   [0]     num_signatures (u8)
///   [1]     padding (u8)
///   [2..16] SignatureOffsets for first sig (7 × u16 LE)
///   ...data block: pubkeys | signatures | messages
fn verify_ed25519_ix_data(
    data: &[u8],
    expected_pubkey: &[u8; 32],
    expected_message: &[u8],
) -> Result<()> {
    require!(data.len() >= 2, UwuError::InvalidOracleSignature);
    let num_sigs = data[0] as usize;
    require!(num_sigs >= 1, UwuError::InvalidOracleSignature);

    // Header per sig: 7 × u16 = 14 bytes starting at offset 2
    let header_start = 2usize;
    require!(data.len() >= header_start + num_sigs * 14, UwuError::InvalidOracleSignature);

    let pubkey_offset  = u16::from_le_bytes([data[header_start + 4], data[header_start + 5]]) as usize;
    let msg_offset     = u16::from_le_bytes([data[header_start + 8], data[header_start + 9]]) as usize;
    let msg_size       = u16::from_le_bytes([data[header_start + 10], data[header_start + 11]]) as usize;

    require!(data.len() >= pubkey_offset + 32, UwuError::InvalidOracleSignature);
    require!(data.len() >= msg_offset + msg_size, UwuError::InvalidOracleSignature);

    let signed_pubkey = &data[pubkey_offset..pubkey_offset + 32];
    let signed_message = &data[msg_offset..msg_offset + msg_size];

    require!(signed_pubkey == expected_pubkey, UwuError::InvalidOracleSignature);

    // The oracle signs SHA256(160-byte message); the ed25519 instruction
    // also receives SHA256(message) as the "message" to verify.
    let sha256_of_msg = anchor_lang::solana_program::hash::hash(expected_message);
    require!(signed_message == sha256_of_msg.as_ref(), UwuError::InvalidOracleSignature);

    Ok(())
}
