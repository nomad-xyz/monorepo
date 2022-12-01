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
    
      WHEN 25393 THEN 'milkomedaC1' :: text
    
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
    
      WHEN 25393 THEN 'milkomedaC1' :: text
    
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
    
      WHEN '25393' :: bigint THEN 'milkomedaC1' :: text
    
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
update.vid,
update.block,
update.id,
update."timestamp",
update.transaction_hash,
update.contract_id,
update.home_domain,
update.old_root,
update.new_root,
update.signature,
update._gs_chain,
update._gs_gid,
  CASE
    update._gs_chain
    
      WHEN 'ethereum' :: text THEN '6648936'
    
      WHEN 'avalanche' :: text THEN '1635148152'
    
      WHEN 'evmos' :: text THEN '1702260083'
    
      WHEN 'milkomedaC1' :: text THEN '25393'
    
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
  subgraph.update;

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
WITH _events AS (
  SELECT
    dispatch_tx,
    update_tx,
    relay_tx,
    process_tx,
    origin_domain_id as origin,
    destination_domain_id as destination
  from
    production_views.events
),
dispatched as (
  SELECT
    origin,
    destination,
    count(*) as dispatched
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NULL)
      AND (relay_tx IS NULL)
      AND (process_tx IS NULL)
    )
  group by
    origin,
    destination
),
updated as (
  SELECT
    origin,
    destination,
    count(*) as updated
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NOT NULL)
      AND (relay_tx IS NULL)
      AND (process_tx IS NULL)
    )
  group by
    origin,
    destination

),
relayed as (
  SELECT
    origin,
    destination,
    count(*) as relayed
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NOT NULL)
      AND (relay_tx IS NOT NULL)
      AND (process_tx IS NULL)
    )
  group by
    origin,
    destination

),
processed as (
  SELECT
    origin,
    destination,
    count(*) as processed
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NOT NULL)
      AND (relay_tx IS NOT NULL)
      AND (process_tx IS NOT NULL)
    )
  group by
    origin,
    destination

),
_full AS (
  SELECT
    dispatched.origin,
    dispatched.destination,
    dispatched.dispatched,
    updated.updated,
    relayed.relayed,
    processed.processed
  from
    dispatched
    LEFT JOIN updated ON dispatched.origin = updated.origin AND dispatched.destination = updated.destination
    LEFT JOIN relayed ON dispatched.origin = relayed.origin AND dispatched.destination = relayed.destination
    LEFT JOIN processed ON dispatched.origin = processed.origin AND dispatched.destination = processed.destination
)
SELECT
  _full.origin,
  _full.destination,
  _full.dispatched,
  _full.updated,
  _full.relayed,
  _full.processed
from
  _full;




-- ENV production END



-- ENV staging START
CREATE
OR REPLACE VIEW "staging_views"."decoded_dispatch" AS WITH decoded AS (
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
OR REPLACE VIEW "staging_views"."decoded_update" AS
SELECT
update.vid,
update.block,
update.id,
update."timestamp",
update.transaction_hash,
update.contract_id,
update.home_domain,
update.old_root,
update.new_root,
update.signature,
update._gs_chain,
update._gs_gid,
  CASE
    update._gs_chain
    
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
  staging.update;

CREATE
OR REPLACE VIEW "staging_views"."events" AS (
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
        staging_views.decoded_dispatch
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
            staging_views.decoded_update update_1
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
          staging_views.decoded_update relay_1
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
OR REPLACE VIEW "staging_views"."number_messages" AS
WITH _events AS (
  SELECT
    dispatch_tx,
    update_tx,
    relay_tx,
    process_tx,
    origin_domain_id as origin,
    destination_domain_id as destination
  from
    staging_views.events
),
dispatched as (
  SELECT
    origin,
    destination,
    count(*) as dispatched
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NULL)
      AND (relay_tx IS NULL)
      AND (process_tx IS NULL)
    )
  group by
    origin,
    destination
),
updated as (
  SELECT
    origin,
    destination,
    count(*) as updated
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NOT NULL)
      AND (relay_tx IS NULL)
      AND (process_tx IS NULL)
    )
  group by
    origin,
    destination

),
relayed as (
  SELECT
    origin,
    destination,
    count(*) as relayed
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NOT NULL)
      AND (relay_tx IS NOT NULL)
      AND (process_tx IS NULL)
    )
  group by
    origin,
    destination

),
processed as (
  SELECT
    origin,
    destination,
    count(*) as processed
  from
    _events
  WHERE
    (
      (dispatch_tx IS NOT NULL)
      AND (update_tx IS NOT NULL)
      AND (relay_tx IS NOT NULL)
      AND (process_tx IS NOT NULL)
    )
  group by
    origin,
    destination

),
_full AS (
  SELECT
    dispatched.origin,
    dispatched.destination,
    dispatched.dispatched,
    updated.updated,
    relayed.relayed,
    processed.processed
  from
    dispatched
    LEFT JOIN updated ON dispatched.origin = updated.origin AND dispatched.destination = updated.destination
    LEFT JOIN relayed ON dispatched.origin = relayed.origin AND dispatched.destination = relayed.destination
    LEFT JOIN processed ON dispatched.origin = processed.origin AND dispatched.destination = processed.destination
)
SELECT
  _full.origin,
  _full.destination,
  _full.dispatched,
  _full.updated,
  _full.relayed,
  _full.processed
from
  _full;

CREATE
OR REPLACE VIEW "staging_views"."recovery_view" AS SELECT * from staging.recovery;

CREATE
OR REPLACE VIEW "staging_views"."process_failure_view" AS SELECT * from staging.process_failure;
-- ENV staging END
