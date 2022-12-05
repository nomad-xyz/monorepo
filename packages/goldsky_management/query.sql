-- ENV production START
CREATE
OR REPLACE VIEW "production_views"."decoded_dispatch" AS WITH decoded AS (
  SELECT
    dispatch.id,
    dispatch."timestamp",
    dispatch.transaction_hash,
    dispatch.block,
    dispatch.contract_id,
    dispatch.message_hash,
    dispatch.leaf_index,
    dispatch.destination_and_nonce,
    dispatch.committed_root,
    dispatch.message,
    dispatch._gs_chain,
    (
      (
        ('x' :: text || "substring"(dispatch.message, 3, 8))
      ) :: bit(32)
    ) :: integer AS origin_domain_id,
    (
      '0x' :: text || ltrim(
        "substring"(dispatch.message, (3 + 8), 64),
        '0' :: text
      )
    ) AS sender_address,
    (
      (
        (
          'x' :: text || "substring"(dispatch.message, ((3 + 8) + 64), 8)
        )
      ) :: bit(32)
    ) :: integer AS nonce,
    (
      (
        (
          'x' :: text || "substring"(dispatch.message, (((3 + 8) + 64) + 8), 8)
        )
      ) :: bit(32)
    ) :: integer AS destination_domain_id,
    (
      '0x' :: text || ltrim(
        "substring"(dispatch.message, ((((3 + 8) + 64) + 8) + 8), 64),
        '0' :: text
      )
    ) AS recipient_address,
    "substring"(
      dispatch.message,
      (((((3 + 8) + 64) + 8) + 8) + 64)
    ) AS message_body,
    "substring"(
      dispatch.message,
      (((((3 + 8) + 64) + 8) + 8) + 64),
      72
    ) AS message__token_body,
    (
      (
        (
          'x' :: text || "substring"(
            dispatch.message,
            (((((3 + 8) + 64) + 8) + 8) + 64),
            8
          )
        )
      ) :: bit(32)
    ) :: bigint AS message__token__domain,
    "substring"(
      dispatch.message,
      ((((((3 + 8) + 64) + 8) + 8) + 64) + 8),
      64
    ) AS message__token__id,
    "substring"(
      dispatch.message,
      (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64),
      194
    ) AS action_body,
    "substring"(
      dispatch.message,
      (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64),
      2
    ) AS message__action__type,
    (
      '0x' :: text || ltrim(
        "substring"(
          dispatch.message,
          (
            (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64) + 2
          ),
          64
        ),
        '0' :: text
      )
    ) AS message__action__to,
    (
      (
        (
          'x' :: text || ltrim(
            "substring"(
              dispatch.message,
              (
                (
                  (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64) + 2
                ) + 64
              ),
              64
            ),
            '0' :: text
          )
        )
      ) :: bit(32)
    ) :: bigint AS message__action__amount,
    "substring"(
      dispatch.message,
      (
        (
          (
            (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64) + 2
          ) + 64
        ) + 64
      ),
      64
    ) AS message__action__details_hash
  FROM
    subgraph.dispatch
)

SELECT
  decoded.id,
  decoded."timestamp",
  decoded.transaction_hash,
  decoded.block,
  decoded.contract_id,
  decoded.message_hash,
  decoded.leaf_index,
  decoded.destination_and_nonce,
  decoded.committed_root,
  decoded.message,
  decoded._gs_chain,
  decoded.origin_domain_id,
  decoded.sender_address,
  decoded.nonce,
  decoded.destination_domain_id,
  decoded.recipient_address,
  decoded.message_body,
  decoded.message__token_body,
  decoded.message__token__domain,
  decoded.message__token__id,
  decoded.action_body,
  decoded.message__action__type,
  decoded.message__action__to,
  decoded.message__action__amount,
  decoded.message__action__details_hash,
  CASE
    length(decoded.message_body)
    WHEN (133 * 2) THEN 'TRANSFER' :: text
    ELSE 'OTHER' :: text
  END AS message_type,

  CASE
    decoded.origin_domain_id
    
      WHEN 6648936 THEN 'ethereum' :: text
    
      WHEN 1635148152 THEN 'avalanche' :: text
    
      WHEN 1702260083 THEN 'evmos' :: text
    
      WHEN 25393 THEN 'milkomedac1' :: text
    
      WHEN 1650811245 THEN 'moonbeam' :: text
    
      WHEN 2019844457 THEN 'xdai' :: text
    


    -- WHEN 6648936 THEN 'ethereum' :: text
    -- WHEN 1635148152 THEN 'avalanche' :: text
    -- WHEN 1702260083 THEN 'evmos' :: text
    -- WHEN 25393 THEN 'milkomedaC1' :: text
    -- WHEN 1650811245 THEN 'moonbeam' :: text
    -- WHEN 2019844457 THEN 'xdai' :: text
    ELSE 'OTHER' :: text
  END AS origin_domain_name,
  CASE
    decoded.destination_domain_id
    
      WHEN 6648936 THEN 'ethereum' :: text
    
      WHEN 1635148152 THEN 'avalanche' :: text
    
      WHEN 1702260083 THEN 'evmos' :: text
    
      WHEN 25393 THEN 'milkomedac1' :: text
    
      WHEN 1650811245 THEN 'moonbeam' :: text
    
      WHEN 2019844457 THEN 'xdai' :: text
    
    -- WHEN 6648936 THEN 'ethereum' :: text
    -- WHEN 1635148152 THEN 'avalanche' :: text
    -- WHEN 1702260083 THEN 'evmos' :: text
    -- WHEN 25393 THEN 'milkomedaC1' :: text
    -- WHEN 1650811245 THEN 'moonbeam' :: text
    -- WHEN 2019844457 THEN 'xdai' :: text
    ELSE 'OTHER' :: text
  END AS destination_domain_name,
  CASE
    decoded.message__token__domain

    
      WHEN '6648936' :: bigint THEN 'ethereum' :: text
    
      WHEN '1635148152' :: bigint THEN 'avalanche' :: text
    
      WHEN '1702260083' :: bigint THEN 'evmos' :: text
    
      WHEN '25393' :: bigint THEN 'milkomedac1' :: text
    
      WHEN '1650811245' :: bigint THEN 'moonbeam' :: text
    
      WHEN '2019844457' :: bigint THEN 'xdai' :: text
    
    -- WHEN '6648936' :: bigint THEN 'ethereum' :: text
    -- WHEN '1635148152' :: bigint THEN 'avalanche' :: text
    -- WHEN '1702260083' :: bigint THEN 'evmos' :: text
    -- WHEN '25393' :: bigint THEN 'milkomedaC1' :: text
    -- WHEN '1650811245' :: bigint THEN 'moonbeam' :: text
    -- WHEN '2019844457' :: bigint THEN 'xdai' :: text
    ELSE 'OTHER' :: text
  END AS message__token__domain_name
FROM
  decoded;


CREATE
OR REPLACE VIEW "production_views"."decoded_update" AS
SELECT
update_1.vid,
update_1.block,
update_1.id,
update_1."timestamp",
update_1.transaction_hash,
update_1.contract_id,
update_1.home_domain,
update_1.old_root,
update_1.new_root,
update_1.signature,
update_1._gs_chain,
update_1._gs_gid,
  CASE
    update_1._gs_chain
    
      WHEN 'ethereum' :: text THEN '6648936'
    
      WHEN 'avalanche' :: text THEN '1635148152'
    
      WHEN 'evmos' :: text THEN '1702260083'
    
      WHEN 'milkomedac1' :: text THEN '25393'
    
      WHEN 'moonbeam' :: text THEN '1650811245'
    
      WHEN 'xdai' :: text THEN '2019844457'
    
      -- WHEN 'avalanche' :: text THEN 1635148152
      -- WHEN 'mainnet' :: text THEN 6648936
      -- WHEN 'evmos' :: text THEN 1702260083
      -- WHEN 'milkomedac1' :: text THEN 25393
      -- WHEN 'moonbeam' :: text THEN 1650811245
      -- WHEN 'xdai' :: text THEN 2019844457
      ELSE 0
  END AS gs_chain_id
FROM
  subgraph.update update_1;

CREATE
OR REPLACE VIEW "production_views"."events" AS (
SELECT
  decoded_dispatch.id,
  decoded_dispatch.message_hash,
  decoded_dispatch.leaf_index,
  decoded_dispatch.destination_and_nonce,
  decoded_dispatch.committed_root,
  decoded_dispatch.message,
  decoded_dispatch.origin_domain_id,
  decoded_dispatch.origin_domain_name,
  decoded_dispatch.sender_address,
  decoded_dispatch.nonce,
  decoded_dispatch.destination_domain_id,
  decoded_dispatch.destination_domain_name,
  decoded_dispatch.recipient_address,
  decoded_dispatch.message_body,
  decoded_dispatch.message__token__domain,
  decoded_dispatch.message__token__id,
  decoded_dispatch.message__action__type,
  decoded_dispatch.message__action__to,
  decoded_dispatch.message__action__amount,
  decoded_dispatch.message__action__details_hash,
  decoded_dispatch.message_type,
  decoded_dispatch.transaction_hash AS dispatch_tx,
  decoded_dispatch.block AS dispatch_block,
  decoded_dispatch."timestamp" AS dispatched_at,
update.transaction_hash AS update_tx,
update.block AS update_block,
update."timestamp" AS updated_at,
update.old_root,
update.new_root,
update.signature,
update.gs_chain_id AS update_chain_id,
  relay.transaction_hash AS relay_tx,
  relay.block AS relay_block,
  relay."timestamp" AS relayed_at,
  relay.gs_chain_id AS relay_chain_id,
  process.transaction_hash AS process_tx,
  process.block AS process_block,
  process."timestamp" AS processed_at
FROM
  (
    (
      (
        production_views.decoded_dispatch
        LEFT JOIN (
          SELECT
            update_1.old_root,
            update_1.new_root,
            update_1.signature,
            update_1.block,
            update_1.transaction_hash,
            update_1."timestamp",
            update_1.gs_chain_id
          FROM
            production_views.decoded_update update_1
        )
        update
          ON (
            (
              (
                decoded_dispatch.committed_root =
                update.old_root
              )
              AND (
                update.gs_chain_id = decoded_dispatch.origin_domain_id
              )
            )
          )
      )
      LEFT JOIN (
        SELECT
          relay_1.transaction_hash,
          relay_1.block,
          relay_1."timestamp",
          relay_1.old_root,
          relay_1.gs_chain_id
        FROM
          production_views.decoded_update relay_1
      ) relay ON (
        (
          (decoded_dispatch.committed_root = relay.old_root)
          AND (
            relay.gs_chain_id = decoded_dispatch.destination_domain_id
          )
        )
      )
    )
    LEFT JOIN subgraph.process ON (
      (
        decoded_dispatch.message_hash = process.message_hash
      )
    )
  )
);


CREATE
OR REPLACE VIEW "production_views"."number_messages" AS
SELECT 
origin_domain_id as origin, destination_domain_id as destination,
sum(case when _events.process_tx is null and _events.relay_tx is null and _events.update_tx is null then 1 else 0 end) as dispatched,
sum(case when _events.update_tx is not null and _events.process_tx is null and _events.relay_tx is null then 1 else 0 end) as updated,
sum(case when _events.relay_tx is not null and _events.process_tx is null then 1 else 0 end) as relayed,
sum(case when _events.process_tx is not null then 1 else 0 end) as processed
from production_views.events _events group by origin_domain_id, destination_domain_id;

CREATE
OR REPLACE VIEW "production_views"."recovery_view" AS SELECT * from subgraph.recovery;

CREATE
OR REPLACE VIEW "production_views"."process_failure_view" AS SELECT * from subgraph.process_failure;

CREATE
OR REPLACE VIEW "production_views"."bridge_events" AS
SELECT
  events_1.id,
  events_1.message_hash,
  events_1.leaf_index,
  events_1.destination_and_nonce,
  events_1.committed_root,
  events_1.message,
  events_1.origin_domain_id,
  events_1.origin_domain_name,
  events_1.sender_address,
  events_1.nonce,
  events_1.destination_domain_id,
  events_1.destination_domain_name,
  events_1.recipient_address,
  events_1.message_body,
  events_1.message__token__domain,
  events_1.message__token__id,
  events_1.message__action__type,
  events_1.message__action__to,
  events_1.message__action__amount,
  events_1.message__action__details_hash,
  events_1.message_type,
  events_1.dispatch_tx,
  events_1.dispatch_block,
  events_1.dispatched_at,
  events_1.update_tx,
  events_1.update_block,
  events_1.updated_at,
  events_1.old_root,
  events_1.new_root,
  events_1.signature,
  events_1.update_chain_id,
  events_1.relay_tx,
  events_1.relay_block,
  events_1.relayed_at,
  events_1.relay_chain_id,
  events_1.process_tx,
  events_1.process_block,
  events_1.processed_at,
  send.transaction_hash AS send_tx,
  send."timestamp" AS sent_at,
  send.block_number AS send_block,
  receive.transaction_hash AS receive_tx,
  receive.origin_and_nonce,
  receive.block_number AS receive_block,
  receive."timestamp" AS received_at,
  send."from" AS original_sender,
  send.amount
FROM
  (
    (
      production_views.events events_1
      LEFT JOIN (
        SELECT
          send_1.vid,
          send_1.block,
          send_1.id,
          send_1."timestamp",
          send_1.transaction_hash,
          send_1.block_number,
          send_1.contract_id,
          send_1.token,
          send_1."from",
          send_1.to_domain,
          send_1.to_id,
          send_1.amount,
          send_1.to_hook,
          send_1._gs_chain,
          send_1._gs_gid
        FROM
          subgraph.send send_1
      ) send ON ((events_1.dispatch_tx = send.transaction_hash))
    )
    LEFT JOIN (
      SELECT
        receive_1.vid,
        receive_1.block,
        receive_1.id,
        receive_1."timestamp",
        receive_1.transaction_hash,
        receive_1.block_number,
        receive_1.contract_id,
        receive_1.origin_and_nonce,
        receive_1.token,
        receive_1.recipient,
        receive_1.liquidity_provider,
        receive_1.amount,
        receive_1._gs_chain,
        receive_1._gs_gid
      FROM
        subgraph.receive receive_1
    ) receive ON ((events_1.process_tx = receive.transaction_hash))
  );

CREATE
OR REPLACE VIEW "production_views"."send_tokens" AS
SELECT
  send.token,
  sum(send.amount) AS sum
FROM
  subgraph.send
GROUP BY
  send.token;

CREATE
OR REPLACE VIEW "production_views"."valid_receive_token_amts" AS
SELECT
  receive.token,
  sum(receive.amount) AS sum
FROM
  (
    subgraph.receive
    JOIN production_views.events ON ((receive.transaction_hash = events.process_tx))
  )
GROUP BY
  receive.token;

CREATE
OR REPLACE VIEW "production_views"."affected_token_amounts" AS
SELECT
  send_tokens.token,
  (send_tokens.sum - valid_receive_token_amts.sum) AS affected_amount
FROM
  (
    production_views.send_tokens
    JOIN production_views.valid_receive_token_amts ON (
      (
        send_tokens.token = valid_receive_token_amts.token
      )
    )
  );

CREATE
OR REPLACE VIEW "production_views"."undispatched_process" AS
SELECT
  process.vid,
  process.id,
  process."timestamp",
  process.transaction_hash,
  process.block_number,
  process.contract_id,
  process.message_hash,
  process.success,
  process.return_data,
  process._gs_chain,
  process._gs_gid
FROM
  subgraph.process
WHERE
  (
    NOT (
      process.message_hash IN (
        SELECT
          dispatch.message_hash
        FROM
          subgraph.dispatch
      )
    )
  );

CREATE
OR REPLACE VIEW "production_views"."will_mint_new" AS
SELECT
  events.id,
  events.dispatched_at AS sent_at,
  events.origin_domain_id,
  events.destination_domain_id,
  (events.message__token__domain) :: integer AS token_domain,
  events.message__token__id AS token_id,
  events.message__action__amount AS amount,
  events.dispatch_tx,
  events.relay_tx,
  events.update_tx,
  events.process_tx
FROM
  production_views.events
WHERE
  (
    (events.process_tx IS NULL)
    AND (events.dispatched_at > (1659139261) :: numeric)
    AND (
      (events.message__token__domain) :: integer <> events.destination_domain_id
    )
  )
ORDER BY
  events.dispatched_at DESC;

CREATE
OR REPLACE VIEW "production_views"."will_mint_new_all" AS
SELECT
  events.id,
  events.dispatched_at AS sent_at,
  events.origin_domain_id,
  events.destination_domain_id,
  (events.message__token__domain) :: integer AS token_domain,
  events.message__token__id AS token_id,
  events.message__action__amount AS amount,
  events.dispatch_tx,
  events.relay_tx,
  events.update_tx,
  events.process_tx
FROM
  production_views.events
WHERE
  (
    (events.process_tx IS NULL)
    AND (
      (events.message__token__domain) :: integer <> events.destination_domain_id
    )
  )
ORDER BY
  events.dispatched_at DESC;
-- ENV production END



-- ENV development START
CREATE
OR REPLACE VIEW "development_views"."decoded_dispatch" AS WITH decoded AS (
  SELECT
    dispatch.id,
    dispatch."timestamp",
    dispatch.transaction_hash,
    dispatch.block,
    dispatch.contract_id,
    dispatch.message_hash,
    dispatch.leaf_index,
    dispatch.destination_and_nonce,
    dispatch.committed_root,
    dispatch.message,
    dispatch._gs_chain,
    (
      (
        ('x' :: text || "substring"(dispatch.message, 3, 8))
      ) :: bit(32)
    ) :: integer AS origin_domain_id,
    (
      '0x' :: text || ltrim(
        "substring"(dispatch.message, (3 + 8), 64),
        '0' :: text
      )
    ) AS sender_address,
    (
      (
        (
          'x' :: text || "substring"(dispatch.message, ((3 + 8) + 64), 8)
        )
      ) :: bit(32)
    ) :: integer AS nonce,
    (
      (
        (
          'x' :: text || "substring"(dispatch.message, (((3 + 8) + 64) + 8), 8)
        )
      ) :: bit(32)
    ) :: integer AS destination_domain_id,
    (
      '0x' :: text || ltrim(
        "substring"(dispatch.message, ((((3 + 8) + 64) + 8) + 8), 64),
        '0' :: text
      )
    ) AS recipient_address,
    "substring"(
      dispatch.message,
      (((((3 + 8) + 64) + 8) + 8) + 64)
    ) AS message_body,
    "substring"(
      dispatch.message,
      (((((3 + 8) + 64) + 8) + 8) + 64),
      72
    ) AS message__token_body,
    (
      (
        (
          'x' :: text || "substring"(
            dispatch.message,
            (((((3 + 8) + 64) + 8) + 8) + 64),
            8
          )
        )
      ) :: bit(32)
    ) :: bigint AS message__token__domain,
    "substring"(
      dispatch.message,
      ((((((3 + 8) + 64) + 8) + 8) + 64) + 8),
      64
    ) AS message__token__id,
    "substring"(
      dispatch.message,
      (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64),
      194
    ) AS action_body,
    "substring"(
      dispatch.message,
      (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64),
      2
    ) AS message__action__type,
    (
      '0x' :: text || ltrim(
        "substring"(
          dispatch.message,
          (
            (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64) + 2
          ),
          64
        ),
        '0' :: text
      )
    ) AS message__action__to,
    (
      (
        (
          'x' :: text || ltrim(
            "substring"(
              dispatch.message,
              (
                (
                  (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64) + 2
                ) + 64
              ),
              64
            ),
            '0' :: text
          )
        )
      ) :: bit(32)
    ) :: bigint AS message__action__amount,
    "substring"(
      dispatch.message,
      (
        (
          (
            (((((((3 + 8) + 64) + 8) + 8) + 64) + 8) + 64) + 2
          ) + 64
        ) + 64
      ),
      64
    ) AS message__action__details_hash
  FROM
    staging.dispatch
)

SELECT
  decoded.id,
  decoded."timestamp",
  decoded.transaction_hash,
  decoded.block,
  decoded.contract_id,
  decoded.message_hash,
  decoded.leaf_index,
  decoded.destination_and_nonce,
  decoded.committed_root,
  decoded.message,
  decoded._gs_chain,
  decoded.origin_domain_id,
  decoded.sender_address,
  decoded.nonce,
  decoded.destination_domain_id,
  decoded.recipient_address,
  decoded.message_body,
  decoded.message__token_body,
  decoded.message__token__domain,
  decoded.message__token__id,
  decoded.action_body,
  decoded.message__action__type,
  decoded.message__action__to,
  decoded.message__action__amount,
  decoded.message__action__details_hash,
  CASE
    length(decoded.message_body)
    WHEN (133 * 2) THEN 'TRANSFER' :: text
    ELSE 'OTHER' :: text
  END AS message_type,

  CASE
    decoded.origin_domain_id
    
      WHEN 1337 THEN 'goerli' :: text
    
      WHEN 9999 THEN 'sepolia' :: text
    


    -- WHEN 6648936 THEN 'ethereum' :: text
    -- WHEN 1635148152 THEN 'avalanche' :: text
    -- WHEN 1702260083 THEN 'evmos' :: text
    -- WHEN 25393 THEN 'milkomedaC1' :: text
    -- WHEN 1650811245 THEN 'moonbeam' :: text
    -- WHEN 2019844457 THEN 'xdai' :: text
    ELSE 'OTHER' :: text
  END AS origin_domain_name,
  CASE
    decoded.destination_domain_id
    
      WHEN 1337 THEN 'goerli' :: text
    
      WHEN 9999 THEN 'sepolia' :: text
    
    -- WHEN 6648936 THEN 'ethereum' :: text
    -- WHEN 1635148152 THEN 'avalanche' :: text
    -- WHEN 1702260083 THEN 'evmos' :: text
    -- WHEN 25393 THEN 'milkomedaC1' :: text
    -- WHEN 1650811245 THEN 'moonbeam' :: text
    -- WHEN 2019844457 THEN 'xdai' :: text
    ELSE 'OTHER' :: text
  END AS destination_domain_name,
  CASE
    decoded.message__token__domain

    
      WHEN '1337' :: bigint THEN 'goerli' :: text
    
      WHEN '9999' :: bigint THEN 'sepolia' :: text
    
    -- WHEN '6648936' :: bigint THEN 'ethereum' :: text
    -- WHEN '1635148152' :: bigint THEN 'avalanche' :: text
    -- WHEN '1702260083' :: bigint THEN 'evmos' :: text
    -- WHEN '25393' :: bigint THEN 'milkomedaC1' :: text
    -- WHEN '1650811245' :: bigint THEN 'moonbeam' :: text
    -- WHEN '2019844457' :: bigint THEN 'xdai' :: text
    ELSE 'OTHER' :: text
  END AS message__token__domain_name
FROM
  decoded;


CREATE
OR REPLACE VIEW "development_views"."decoded_update" AS
SELECT
update_1.vid,
update_1.block,
update_1.id,
update_1."timestamp",
update_1.transaction_hash,
update_1.contract_id,
update_1.home_domain,
update_1.old_root,
update_1.new_root,
update_1.signature,
update_1._gs_chain,
update_1._gs_gid,
  CASE
    update_1._gs_chain
    
      WHEN 'goerli' :: text THEN '1337'
    
      WHEN 'sepolia' :: text THEN '9999'
    
      -- WHEN 'avalanche' :: text THEN 1635148152
      -- WHEN 'mainnet' :: text THEN 6648936
      -- WHEN 'evmos' :: text THEN 1702260083
      -- WHEN 'milkomedac1' :: text THEN 25393
      -- WHEN 'moonbeam' :: text THEN 1650811245
      -- WHEN 'xdai' :: text THEN 2019844457
      ELSE 0
  END AS gs_chain_id
FROM
  staging.update update_1;

CREATE
OR REPLACE VIEW "development_views"."events" AS (
SELECT
  decoded_dispatch.id,
  decoded_dispatch.message_hash,
  decoded_dispatch.leaf_index,
  decoded_dispatch.destination_and_nonce,
  decoded_dispatch.committed_root,
  decoded_dispatch.message,
  decoded_dispatch.origin_domain_id,
  decoded_dispatch.origin_domain_name,
  decoded_dispatch.sender_address,
  decoded_dispatch.nonce,
  decoded_dispatch.destination_domain_id,
  decoded_dispatch.destination_domain_name,
  decoded_dispatch.recipient_address,
  decoded_dispatch.message_body,
  decoded_dispatch.message__token__domain,
  decoded_dispatch.message__token__id,
  decoded_dispatch.message__action__type,
  decoded_dispatch.message__action__to,
  decoded_dispatch.message__action__amount,
  decoded_dispatch.message__action__details_hash,
  decoded_dispatch.message_type,
  decoded_dispatch.transaction_hash AS dispatch_tx,
  decoded_dispatch.block AS dispatch_block,
  decoded_dispatch."timestamp" AS dispatched_at,
update.transaction_hash AS update_tx,
update.block AS update_block,
update."timestamp" AS updated_at,
update.old_root,
update.new_root,
update.signature,
update.gs_chain_id AS update_chain_id,
  relay.transaction_hash AS relay_tx,
  relay.block AS relay_block,
  relay."timestamp" AS relayed_at,
  relay.gs_chain_id AS relay_chain_id,
  process.transaction_hash AS process_tx,
  process.block AS process_block,
  process."timestamp" AS processed_at
FROM
  (
    (
      (
        development_views.decoded_dispatch
        LEFT JOIN (
          SELECT
            update_1.old_root,
            update_1.new_root,
            update_1.signature,
            update_1.block,
            update_1.transaction_hash,
            update_1."timestamp",
            update_1.gs_chain_id
          FROM
            development_views.decoded_update update_1
        )
        update
          ON (
            (
              (
                decoded_dispatch.committed_root =
                update.old_root
              )
              AND (
                update.gs_chain_id = decoded_dispatch.origin_domain_id
              )
            )
          )
      )
      LEFT JOIN (
        SELECT
          relay_1.transaction_hash,
          relay_1.block,
          relay_1."timestamp",
          relay_1.old_root,
          relay_1.gs_chain_id
        FROM
          development_views.decoded_update relay_1
      ) relay ON (
        (
          (decoded_dispatch.committed_root = relay.old_root)
          AND (
            relay.gs_chain_id = decoded_dispatch.destination_domain_id
          )
        )
      )
    )
    LEFT JOIN staging.process ON (
      (
        decoded_dispatch.message_hash = process.message_hash
      )
    )
  )
);


CREATE
OR REPLACE VIEW "development_views"."number_messages" AS
SELECT 
origin_domain_id as origin, destination_domain_id as destination,
sum(case when _events.process_tx is null and _events.relay_tx is null and _events.update_tx is null then 1 else 0 end) as dispatched,
sum(case when _events.update_tx is not null and _events.process_tx is null and _events.relay_tx is null then 1 else 0 end) as updated,
sum(case when _events.relay_tx is not null and _events.process_tx is null then 1 else 0 end) as relayed,
sum(case when _events.process_tx is not null then 1 else 0 end) as processed
from development_views.events _events group by origin_domain_id, destination_domain_id;

CREATE
OR REPLACE VIEW "development_views"."recovery_view" AS SELECT * from staging.recovery;

CREATE
OR REPLACE VIEW "development_views"."process_failure_view" AS SELECT * from staging.process_failure;

CREATE
OR REPLACE VIEW "development_views"."bridge_events" AS
SELECT
  events_1.id,
  events_1.message_hash,
  events_1.leaf_index,
  events_1.destination_and_nonce,
  events_1.committed_root,
  events_1.message,
  events_1.origin_domain_id,
  events_1.origin_domain_name,
  events_1.sender_address,
  events_1.nonce,
  events_1.destination_domain_id,
  events_1.destination_domain_name,
  events_1.recipient_address,
  events_1.message_body,
  events_1.message__token__domain,
  events_1.message__token__id,
  events_1.message__action__type,
  events_1.message__action__to,
  events_1.message__action__amount,
  events_1.message__action__details_hash,
  events_1.message_type,
  events_1.dispatch_tx,
  events_1.dispatch_block,
  events_1.dispatched_at,
  events_1.update_tx,
  events_1.update_block,
  events_1.updated_at,
  events_1.old_root,
  events_1.new_root,
  events_1.signature,
  events_1.update_chain_id,
  events_1.relay_tx,
  events_1.relay_block,
  events_1.relayed_at,
  events_1.relay_chain_id,
  events_1.process_tx,
  events_1.process_block,
  events_1.processed_at,
  send.transaction_hash AS send_tx,
  send."timestamp" AS sent_at,
  send.block_number AS send_block,
  receive.transaction_hash AS receive_tx,
  receive.origin_and_nonce,
  receive.block_number AS receive_block,
  receive."timestamp" AS received_at,
  send."from" AS original_sender,
  send.amount
FROM
  (
    (
      development_views.events events_1
      LEFT JOIN (
        SELECT
          send_1.vid,
          send_1.block,
          send_1.id,
          send_1."timestamp",
          send_1.transaction_hash,
          send_1.block_number,
          send_1.contract_id,
          send_1.token,
          send_1."from",
          send_1.to_domain,
          send_1.to_id,
          send_1.amount,
          send_1.to_hook,
          send_1._gs_chain,
          send_1._gs_gid
        FROM
          staging.send send_1
      ) send ON ((events_1.dispatch_tx = send.transaction_hash))
    )
    LEFT JOIN (
      SELECT
        receive_1.vid,
        receive_1.block,
        receive_1.id,
        receive_1."timestamp",
        receive_1.transaction_hash,
        receive_1.block_number,
        receive_1.contract_id,
        receive_1.origin_and_nonce,
        receive_1.token,
        receive_1.recipient,
        receive_1.liquidity_provider,
        receive_1.amount,
        receive_1._gs_chain,
        receive_1._gs_gid
      FROM
        staging.receive receive_1
    ) receive ON ((events_1.process_tx = receive.transaction_hash))
  );

CREATE
OR REPLACE VIEW "development_views"."send_tokens" AS
SELECT
  send.token,
  sum(send.amount) AS sum
FROM
  staging.send
GROUP BY
  send.token;

CREATE
OR REPLACE VIEW "development_views"."valid_receive_token_amts" AS
SELECT
  receive.token,
  sum(receive.amount) AS sum
FROM
  (
    staging.receive
    JOIN development_views.events ON ((receive.transaction_hash = events.process_tx))
  )
GROUP BY
  receive.token;

CREATE
OR REPLACE VIEW "development_views"."affected_token_amounts" AS
SELECT
  send_tokens.token,
  (send_tokens.sum - valid_receive_token_amts.sum) AS affected_amount
FROM
  (
    development_views.send_tokens
    JOIN development_views.valid_receive_token_amts ON (
      (
        send_tokens.token = valid_receive_token_amts.token
      )
    )
  );

CREATE
OR REPLACE VIEW "development_views"."undispatched_process" AS
SELECT
  process.vid,
  process.id,
  process."timestamp",
  process.transaction_hash,
  process.block_number,
  process.contract_id,
  process.message_hash,
  process.success,
  process.return_data,
  process._gs_chain,
  process._gs_gid
FROM
  staging.process
WHERE
  (
    NOT (
      process.message_hash IN (
        SELECT
          dispatch.message_hash
        FROM
          staging.dispatch
      )
    )
  );

CREATE
OR REPLACE VIEW "development_views"."will_mint_new" AS
SELECT
  events.id,
  events.dispatched_at AS sent_at,
  events.origin_domain_id,
  events.destination_domain_id,
  (events.message__token__domain) :: integer AS token_domain,
  events.message__token__id AS token_id,
  events.message__action__amount AS amount,
  events.dispatch_tx,
  events.relay_tx,
  events.update_tx,
  events.process_tx
FROM
  development_views.events
WHERE
  (
    (events.process_tx IS NULL)
    AND (events.dispatched_at > (1659139261) :: numeric)
    AND (
      (events.message__token__domain) :: integer <> events.destination_domain_id
    )
  )
ORDER BY
  events.dispatched_at DESC;

CREATE
OR REPLACE VIEW "development_views"."will_mint_new_all" AS
SELECT
  events.id,
  events.dispatched_at AS sent_at,
  events.origin_domain_id,
  events.destination_domain_id,
  (events.message__token__domain) :: integer AS token_domain,
  events.message__token__id AS token_id,
  events.message__action__amount AS amount,
  events.dispatch_tx,
  events.relay_tx,
  events.update_tx,
  events.process_tx
FROM
  development_views.events
WHERE
  (
    (events.process_tx IS NULL)
    AND (
      (events.message__token__domain) :: integer <> events.destination_domain_id
    )
  )
ORDER BY
  events.dispatched_at DESC;
-- ENV development END
