CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS (
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
FROM <%= decoded_dispatch; %>
  LEFT JOIN (
    SELECT * FROM <%= decoded_update; %> update_1
  ) update ON (
    (decoded_dispatch.committed_root = update.old_root)
    AND (
      update.gs_chain_id = decoded_dispatch.origin_domain_id
    )
  )
  LEFT JOIN (
    SELECT * FROM <%= decoded_update; %> relay_1
  ) relay ON (
    (decoded_dispatch.committed_root = relay.old_root)
    AND (
      relay.gs_chain_id = decoded_dispatch.destination_domain_id
    )
  )
  LEFT JOIN <%= process;%> ON (
    (decoded_dispatch.message_hash = process.message_hash)
  )
);
