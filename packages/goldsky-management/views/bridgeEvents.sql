CREATE
OR REPLACE VIEW "<%= location; %>"."<%= name; %>" AS
SELECT
  events_1.*,
  send.transaction_hash AS send_tx,
  send."timestamp" AS sent_at,
  send.block_number AS send_block,
  receive.transaction_hash AS receive_tx,
  receive.origin_and_nonce,
  receive.block_number AS receive_block,
  receive."timestamp" AS received_at,
  send."from" AS original_sender,
  send.amount
FROM <%= events;%> events_1
  LEFT JOIN (
    SELECT * FROM <%= send;%> send_1
  ) send ON ((events_1.dispatch_tx = send.transaction_hash))
  LEFT JOIN (
    SELECT * FROM <%= receive;%> receive_1
  ) receive ON ((events_1.process_tx = receive.transaction_hash));