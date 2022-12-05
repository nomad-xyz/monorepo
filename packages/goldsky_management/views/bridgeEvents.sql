CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
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
      <%= events;%> events_1
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
          <%= send;%> send_1
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
        <%= receive;%> receive_1
    ) receive ON ((events_1.process_tx = receive.transaction_hash))
  );