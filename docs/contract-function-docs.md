# Contract Function Documentation

Comprehensive reference for all functions in the Fund-My-Cause Soroban contracts.

---

## CrowdfundContract (`contracts/crowdfund`)

Each deployed instance represents a single crowdfunding campaign.

### Campaign Lifecycle

#### `initialize`

Initialises a new crowdfunding campaign. Can only be called once per contract instance.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `creator` | `Address` | Campaign creator (must authorize). Stored as admin. |
| `token` | `Address` | Token accepted for contributions (e.g. native XLM). |
| `goal` | `i128` | Funding goal in stroops. Must be > 0. |
| `deadline` | `u64` | Unix timestamp (seconds) when campaign ends. Must be > current ledger time. |
| `min_contribution` | `i128` | Minimum contribution in stroops. Must be >= 0. |
| `max_contribution` | `i128` | Per-contributor cap in stroops. 0 = no cap. |
| `title` | `String` | Campaign title. |
| `description` | `String` | Campaign description. |
| `social_links` | `Option<Vec<String>>` | Optional social media URLs. |
| `platform_config` | `Option<PlatformConfig>` | Optional platform fee (address + fee_bps). |
| `accepted_tokens` | `Option<Vec<Address>>` | Optional token whitelist. |
| `category` | `Category` | Campaign category (Charity, Technology, Creative, Event, Personal, Other). |
| `vesting` | `Option<VestingSchedule>` | Optional cliff + linear vesting on withdrawal. |
| `penalty_bps` | `Option<u32>` | Optional early-withdrawal penalty in basis points. |

**Returns** `Result<(), ContractError>`

**Errors**

| Error | Condition |
|---|---|
| `AlreadyInitialized` | Contract already has a creator stored. |
| `InvalidGoal` | `goal <= 0` |
| `InvalidDeadline` | `deadline <= current ledger timestamp` |
| `BelowMinimum` | `min_contribution < 0` |
| `ExceedsMaximum` | `max_contribution > 0 && max_contribution < min_contribution` |
| `InvalidFee` | `platform_config.fee_bps > 10_000` |

**Example**
```rust
client.initialize(
    &creator,
    &token,
    &1_000_000_000i128,   // 100 XLM goal
    &(env.ledger().timestamp() + 86400),  // 24h deadline
    &1_000_000i128,        // 0.1 XLM minimum
    &0i128,                // no per-contributor cap
    &String::from_str(&env, "My Campaign"),
    &String::from_str(&env, "Help fund my project"),
    &None,
    &None,
    &None,
    &Category::Technology,
    &None,
    &None,
);
```

---

#### `contribute`

Submits a contribution to the campaign. Transfers tokens from contributor to contract.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `contributor` | `Address` | Contributor address (must authorize). |
| `amount` | `i128` | Contribution amount in stroops. |
| `token` | `Address` | Token being contributed. Must match campaign token or accepted_tokens whitelist. |
| `message` | `Option<String>` | Optional message/memo (max 256 chars). |

**Returns** `Result<(), ContractError>`

**Errors**

| Error | Condition |
|---|---|
| `BelowMinimum` | `amount < min_contribution` |
| `ExceedsMaximum` | Contributor's cumulative total would exceed `max_contribution` |
| `CampaignPaused` | Campaign status is `Paused` |
| `NotActive` | Campaign status is not `Active` |
| `CampaignEnded` | Current time >= deadline |
| `TokenNotAccepted` | Token not in whitelist |
| `Blacklisted` | Contributor is blacklisted |
| `NotWhitelisted` | Whitelist-only mode is on and contributor is not whitelisted |
| `RateLimitExceeded` | Contributor exceeded hourly rate limit |
| `Overflow` | Arithmetic overflow |
| `MessageTooLong` | Message exceeds 256 characters |

**Side Effects**
- Transfers tokens from contributor to contract.
- Updates contributor's stored balance.
- Increments contributor count on first contribution.
- Applies sponsor matching if configured.
- Publishes `("campaign", "contributed")` event.

---

#### `withdraw`

Withdraws raised funds to the campaign creator after a successful campaign.

**Parameters** — none (reads creator from storage, requires creator auth).

**Returns** `Result<(), ContractError>`

**Errors**

| Error | Condition |
|---|---|
| `NotActive` | Campaign is not in `Active` status |
| `CampaignStillActive` | Current time < deadline |
| `GoalNotReached` | Total raised < goal |
| `VestingNotComplete` | Vesting cliff has not been reached |

**Platform Fee Calculation**
```
fee = total_raised * platform_fee_bps / 10_000
creator_payout = total_raised - fee
```

**Side Effects**
- Transfers platform fee to platform address (if configured).
- Transfers remaining funds to creator (subject to vesting schedule).
- Sets status to `Successful`.
- Publishes `("campaign", "withdrawn")` event.

---

#### `cancel_campaign`

Cancels the campaign, enabling all contributors to claim refunds.

**Parameters** — none (requires creator auth).

**Returns** `Result<(), ContractError>`

**Errors** — `NotActive` if campaign is not `Active`.

**Side Effects** — Sets status to `Cancelled`. Publishes `("campaign", "cancelled")` and `("campaign", "status_changed")` events.

---

### Refund Functions

#### `refund_single`

Claims a refund for a single contributor (pull-based model).

**Parameters**

| Name | Type | Description |
|---|---|---|
| `contributor` | `Address` | Address claiming the refund. |

**Eligible when** — campaign is `Cancelled`, OR deadline has passed AND goal was not reached.

**Returns** `Result<(), ContractError>`

**Errors**

| Error | Condition |
|---|---|
| `CampaignStillActive` | Deadline not passed and not cancelled |
| `GoalReached` | Goal was reached and campaign not cancelled |

---

#### `refund_batch`

Processes refunds for up to 25 contributors in a single transaction.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `contributors` | `Vec<Address>` | List of addresses to refund (capped at 25). |

**Returns** `Result<u32, ContractError>` — number of contributors successfully refunded.

---

#### `refund_partial`

Allows a contributor to request a partial refund before the campaign ends. Limited to 50% of original contribution.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `contributor` | `Address` | Contributor address (must authorize). |
| `amount` | `i128` | Amount to refund in stroops. |

**Errors** — `RefundLimitExceeded` if `amount > total_contribution / 2`.

---

### Metadata Functions

#### `update_metadata`

Updates campaign title, description, and/or social links. Creator must authorize.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `title` | `Option<String>` | New title (omit to leave unchanged). |
| `description` | `Option<String>` | New description (omit to leave unchanged). |
| `social_links` | `Option<Vec<String>>` | New social links (omit to leave unchanged). |

**Returns** `Result<(), ContractError>` — `NotActive` if campaign is not `Active`.

---

#### `extend_deadline`

Extends the campaign deadline. New deadline must be strictly greater than current. Creator must authorize.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `new_deadline` | `u64` | New Unix timestamp for campaign end. |

**Errors** — `NotActive`, `InvalidDeadline` if `new_deadline <= current_deadline`.

---

### Admin / Control Functions

#### `pause` / `unpause`

Pauses or resumes the campaign. Admin must authorize.

- `pause` — sets status to `Paused`. Errors if not `Active`.
- `unpause` — sets status to `Active`. Errors if not `Paused`.

---

#### `set_rate_limit`

Sets the maximum contribution amount per address per hour. Admin must authorize.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `max_amount_per_hour` | `i128` | Max stroops per hour. 0 = disabled. |

---

#### `initiate_emergency_withdrawal`

Starts a time-locked emergency withdrawal. Admin must authorize.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `lock_period` | `u64` | Seconds to lock before withdrawal can execute (e.g. 604800 = 7 days). |

---

#### `execute_emergency_withdrawal`

Executes the emergency withdrawal after the lock period expires. Admin must authorize.

**Errors** — `EmergencyLocked` if lock period has not expired.

---

#### `cancel_emergency_withdrawal`

Cancels a pending emergency withdrawal. Admin must authorize.

---

### Recurring Contributions

#### `setup_recurring`

Sets up a scheduled recurring contribution plan. Contributor must authorize.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `contributor` | `Address` | Contributor address (must authorize). |
| `amount` | `i128` | Amount per interval in stroops. |
| `interval` | `u64` | Seconds between contributions. |
| `end_date` | `u64` | Unix timestamp when plan expires. |

**Errors** — `InvalidRecurringPlan` if `amount <= 0`, `interval == 0`, or `end_date <= now`.

---

#### `execute_recurring`

Executes a pending recurring contribution. Can be called by anyone.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `contributor` | `Address` | Address whose plan to execute. |

**Errors** — `InvalidRecurringPlan` if no plan exists, plan expired, or interval not elapsed.

---

#### `cancel_recurring`

Cancels a recurring contribution plan. Contributor must authorize.

---

### Deadline Extension Voting

#### `propose_extension`

Proposes a deadline extension. Creator must authorize. Voting period is 7 days.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `new_deadline` | `u64` | Proposed new deadline (must be > current deadline). |

---

#### `vote_on_extension`

Votes on a pending extension proposal. Vote weight = contributor's total contribution.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `contributor` | `Address` | Voter address (must authorize). |
| `approve` | `bool` | `true` = vote for, `false` = vote against. |

**Errors** — `VotingEnded` if voting period has elapsed.

---

#### `execute_extension`

Executes the extension if >50% of votes are in favour. Can be called after voting ends.

---

### Whitelist / Blacklist

#### `add_to_whitelist` / `remove_from_whitelist`

Adds or removes an address from the contribution whitelist. Creator must authorize.

#### `set_whitelist_only`

Enables or disables whitelist-only mode. When enabled, only whitelisted addresses can contribute.

**Parameters** — `enabled: bool`

#### `is_whitelisted` / `is_blacklisted`

Read-only checks. Return `bool`.

#### `add_to_blacklist` / `remove_from_blacklist`

Adds or removes an address from the blacklist. Creator must authorize. Blacklisted addresses cannot contribute.

---

### Delegation

#### `delegate_contribution`

Delegates contribution authority to another address. Delegator must authorize.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `delegator` | `Address` | Address delegating authority (must authorize). |
| `delegate` | `Address` | Address receiving delegation. |
| `amount` | `i128` | Maximum amount the delegate can contribute on behalf of delegator. |

---

#### `contribute_on_behalf`

Contributes on behalf of a delegator. Delegate must authorize.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `delegator` | `Address` | Address on whose behalf the contribution is made. |
| `delegate` | `Address` | Delegate address (must authorize). |
| `amount` | `i128` | Contribution amount in stroops. |
| `token` | `Address` | Token address. |

---

#### `revoke_delegation`

Revokes a delegation. Delegator must authorize.

---

### Query Functions

#### `get_campaign_info`

Returns a [`CampaignInfo`] struct with all campaign metadata.

#### `get_campaign_stats`

Returns a [`CampaignStats`] struct with aggregated metrics (total raised, progress, contributor count, etc.).

#### `get_contribution`

Returns the total contribution amount for a specific address.

**Parameters** — `contributor: Address`

**Returns** `i128`

---

## RegistryContract (`contracts/registry`)

A lightweight on-chain directory of all deployed campaign contract addresses.

### `register`

Registers a campaign contract address. Deduplicates — calling with an already-registered address is a no-op.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `campaign_id` | `Address` | Contract address of the deployed campaign. |

**Side Effects** — Appends to stored list. Publishes `("registry", "registered")` event.

---

### `list`

Returns a paginated slice of registered campaign addresses.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `offset` | `u32` | Zero-based start index. |
| `limit` | `u32` | Maximum items to return. 0 returns empty list. |

**Returns** `Vec<Address>`

**Example**
```rust
// First page of 20
let page1 = registry_client.list(&0, &20);

// Second page
let page2 = registry_client.list(&20, &20);
```

---

## Error Reference

| Code | Name | Description |
|---|---|---|
| 1 | `AlreadyInitialized` | Campaign already initialized |
| 2 | `CampaignEnded` | Deadline has passed |
| 3 | `CampaignStillActive` | Deadline has not yet passed |
| 4 | `GoalNotReached` | Total raised < goal |
| 5 | `GoalReached` | Total raised >= goal |
| 6 | `Overflow` | Arithmetic overflow |
| 7 | `NotActive` | Campaign not in Active status |
| 8 | `InvalidFee` | Fee > 10,000 bps |
| 9 | `BelowMinimum` | Amount < min_contribution |
| 10 | `InvalidDeadline` | Deadline invalid |
| 11 | `CampaignPaused` | Campaign is paused |
| 12 | `InvalidGoal` | Goal <= 0 |
| 13 | `TokenNotAccepted` | Token not in whitelist |
| 14 | `ExceedsMaximum` | Exceeds per-contributor cap |
| 15 | `NotWhitelisted` | Address not whitelisted |
| 16 | `Blacklisted` | Address is blacklisted |
| 17 | `InvalidDelegation` | Invalid delegation parameters |
| 18 | `DelegationNotFound` | No delegation found |
| 19 | `InvalidTemplate` | Invalid template |
| 20 | `VotingEnded` | Voting period ended |
| 21 | `InvalidRecurringPlan` | Invalid recurring plan parameters |
| 22 | `RefundLimitExceeded` | Refund > 50% of contribution |
| 23 | `VestingNotComplete` | Vesting cliff not reached |
| 24 | `EmergencyLocked` | Emergency lock period not expired |
| 25 | `RateLimitExceeded` | Hourly rate limit exceeded |
| 26 | `MessageTooLong` | Message > 256 characters |
