CREATE
OR REPLACE VIEW "prod_views"."decoded_dispatch" AS (DECODED DISPATCH SQL CODE)
FROM subgraph.dispatch



------

CREATE
OR REPLACE VIEW "prod_views"."events" AS (EVENTS SQL CODE)
FROM prod_views.decoded_dispatch




====


CREATE
OR REPLACE VIEW "staging_views"."decoded_dispatch" AS (DECODED DISPATCH SQL CODE)
FROM staging.dispatch



------

CREATE
OR REPLACE VIEW "staging_views"."events" AS (EVENTS SQL CODE)
FROM staging_views.decoded_dispatch

